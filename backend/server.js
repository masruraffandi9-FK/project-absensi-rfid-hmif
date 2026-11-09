const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Fix DNS SRV MongoDB Atlas

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mqtt = require('mqtt');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] }
});

// 1. KONEKSI MONGO DB ATLAS
const MONGO_URI = 'mongodb+srv://hmif:hmifrfid123@cluster0.lgucs5h.mongodb.net/hmif_rfid?retryWrites=true&w=majority';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Terhubung ke MongoDB Atlas (Cloud)!'))
  .catch((err) => console.error('❌ Gagal koneksi MongoDB Atlas:', err.message));

// 2. SCHEMA & MODEL MONGOOSE
const userSchema = new mongoose.Schema({
  card_id: { type: String, required: true, unique: true },
  nama: { type: String, required: true },
  npm: { type: String, required: true, unique: true },
  jabatan: { type: String, required: true },
  password: { type: String, default: '12345678' }
});
const User = mongoose.model('User', userSchema);

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'admin' },
  waktu: { type: Date, default: Date.now }
});
const Admin = mongoose.model('Admin', adminSchema);

const attendanceSchema = new mongoose.Schema({
  card_id: String,
  nama: String,
  npm: String,
  jabatan: String,
  isRegistered: Boolean,
  waktu: { type: Date, default: Date.now }
});
const Attendance = mongoose.model('Attendance', attendanceSchema);

const permissionSchema = new mongoose.Schema({
  nama: { type: String, required: true },
  npm: { type: String, required: true },
  jabatan: { type: String, required: true },
  kategori: { type: String, enum: ['Izin', 'Sakit', 'Lainnya'], required: true },
  alasan: { type: String, required: true },
  waktu: { type: Date, default: Date.now }
});
const Permission = mongoose.model('Permission', permissionSchema);

// 3. REST API ENDPOINTS - AUTH / LOGIN
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  // 1. Super Admin Login
  if (username === 'administratorhmif' && password === 'administratorhmif12345678') {
    return res.json({
      success: true,
      user: { nama: 'Super Admin HMIF', role: 'superadmin' }
    });
  }

  // 2. Admin Biasa Login
  try {
    const adminUser = await Admin.findOne({ username });
    if (adminUser) {
      if (adminUser.password === password) {
        return res.json({
          success: true,
          user: { id: adminUser._id, nama: adminUser.username, role: 'admin' }
        });
      } else {
        return res.status(401).json({ error: 'Password Admin salah!' });
      }
    }
  } catch (err) {
    console.error(err);
  }

  // 3. User / Anggota Login (Username = NPM)
  try {
    const user = await User.findOne({ npm: username });
    if (!user) {
      return res.status(401).json({ error: 'Username / NPM tidak terdaftar!' });
    }

    const validPass = user.password || '12345678';
    if (validPass !== password) {
      return res.status(401).json({ error: 'Password salah!' });
    }

    return res.json({
      success: true,
      user: {
        id: user._id,
        card_id: user.card_id,
        nama: user.nama,
        npm: user.npm,
        jabatan: user.jabatan,
        role: 'user'
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
});

// REST API - KELOLA ADMIN (SUPER ADMIN)
app.get('/api/admins', async (req, res) => {
  try {
    const admins = await Admin.find();
    res.json(admins);
  } catch (e) {
    res.json([]);
  }
});

app.post('/api/admins', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan Password wajib diisi!' });
    }
    if (username === 'administratorhmif') {
      return res.status(400).json({ error: 'Username ini dilindungi!' });
    }
    const newAdmin = new Admin({ username, password });
    await newAdmin.save();
    res.status(201).json(newAdmin);
  } catch (err) {
    res.status(400).json({ error: 'Username Admin sudah digunakan!' });
  }
});

app.delete('/api/admins/:id', async (req, res) => {
  try {
    await Admin.findByIdAndDelete(req.params.id);
    res.json({ message: 'Admin berhasil dihapus.' });
  } catch (err) {
    res.status(400).json({ error: 'Gagal menghapus admin.' });
  }
});

// REST API - UBAH PASSWORD MANDIRI USER
app.put('/api/users/:id/change-password', async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    }

    const currentPass = user.password || '12345678';
    if (currentPass !== oldPassword) {
      return res.status(400).json({ error: 'Password lama salah!' });
    }

    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password berhasil diperbarui!' });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memperbarui password.' });
  }
});

// REST API ENDPOINTS - ANGGOTA
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (e) {
    res.json([]);
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { card_id, nama, npm, jabatan } = req.body;
    const newUser = new User({ 
      card_id: card_id.toUpperCase(), 
      nama, 
      npm, 
      jabatan,
      password: '12345678'
    });
    await newUser.save();
    res.status(201).json(newUser);
  } catch (err) {
    res.status(400).json({ error: 'UID Kartu / NPM sudah terdaftar atau DB terputus.' });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const { card_id, nama, npm, jabatan } = req.body;
    const updatePayload = {};

    if (card_id) updatePayload.card_id = card_id.toUpperCase();
    if (nama) updatePayload.nama = nama;
    if (npm) updatePayload.npm = npm;
    if (jabatan) updatePayload.jabatan = jabatan;

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true }
    );
    res.json(updatedUser);
  } catch (err) {
    res.status(400).json({ error: 'Gagal memperbarui data anggota.' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Anggota berhasil dihapus.' });
  } catch (err) {
    res.status(400).json({ error: 'Gagal menghapus anggota.' });
  }
});

// REST API ENDPOINTS - PRESENSI & PERIZINAN
app.get('/api/attendances', async (req, res) => {
  try {
    const data = await Attendance.find().sort({ waktu: -1 });
    res.json(data);
  } catch (e) {
    res.json([]);
  }
});

app.get('/api/permissions', async (req, res) => {
  try {
    const data = await Permission.find().sort({ waktu: -1 });
    res.json(data);
  } catch (e) {
    res.json([]);
  }
});

app.post('/api/permissions', async (req, res) => {
  try {
    const { nama, npm, jabatan, kategori, alasan } = req.body;
    const newPermission = new Permission({ nama, npm, jabatan, kategori, alasan });
    await newPermission.save();
    res.status(201).json(newPermission);
  } catch (err) {
    res.status(400).json({ error: 'Gagal menyimpan data izin.' });
  }
});

app.delete('/api/permissions/:id', async (req, res) => {
  try {
    await Permission.findByIdAndDelete(req.params.id);
    res.json({ message: 'Data perizinan berhasil dihapus.' });
  } catch (err) {
    res.status(400).json({ error: 'Gagal menghapus data perizinan.' });
  }
});

// 4. KONEKSI MQTT RABBITMQ
const mqttClient = mqtt.connect('mqtt://195.35.23.135:1883', {
  username: '/vh-iot-cps-2026:iot-cps-2026',
  password: 'iotcihuy71.'
});

mqttClient.on('connect', () => {
  console.log('✅ Backend terhubung ke RabbitMQ MQTT Broker!');
  mqttClient.subscribe('r_rfid');
});

mqttClient.on('message', async (topic, message) => {
  const payloadStr = message.toString();

  try {
    let cardId = "";
    try {
      const rawData = JSON.parse(payloadStr);
      cardId = (rawData.card_id || payloadStr).toUpperCase();
    } catch (e) {
      cardId = payloadStr.trim().toUpperCase();
    }

    let user = null;
    try {
      user = await User.findOne({ card_id: cardId });
    } catch (dbErr) {
      console.log("⚠️ Peringatan: Tidak dapat mengakses DB User");
    }

    const attendanceData = {
      card_id: cardId,
      nama: user ? user.nama : 'Tidak Dikenal',
      npm: user ? user.npm : '-',
      jabatan: user ? user.jabatan : 'Tamu / Belum Terdaftar',
      isRegistered: !!user,
      waktu: new Date()
    };

    io.emit('rfid_scan', attendanceData);

    try {
      const attendanceRecord = new Attendance(attendanceData);
      await attendanceRecord.save();
    } catch (dbSaveErr) {
      console.log('⚠️ Gagal menyimpan ke DB');
    }

  } catch (e) {
    console.error('❌ Error proses pesan MQTT:', e.message);
  }
});

io.on('connection', (socket) => {
  console.log('Frontend React terhubung ID:', socket.id);
});

server.listen(5000, () => {
  console.log('Backend berjalan di http://localhost:5000');
});