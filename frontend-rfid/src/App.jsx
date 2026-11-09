import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import XLSX from 'xlsx-js-style';
import {
  ClipboardList,
  Users,
  FileText,
  User as UserIcon,
  LogOut,
  Pencil,
  Trash2,
  Plus,
  Key,
  AlertTriangle,
  Send,
  ShieldCheck,
  UserPlus,
  Download,
  Menu,
  X,
  Radio,
  CheckCircle2,
  Clock,
  ChevronRight
} from 'lucide-react';

const socket = io('http://localhost:5000');

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loginInput, setLoginInput] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  // Navigation & Mobile Drawer State
  const [activeTab, setActiveTab] = useState('presensi');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Data States
  const [latestScan, setLatestScan] = useState(null);
  const [attendances, setAttendances] = useState([]);
  const [users, setUsers] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [admins, setAdmins] = useState([]);

  // Form States
  const [formData, setFormData] = useState({ card_id: '', nama: '', npm: '', jabatan: '' });
  const [editingUserId, setEditingUserId] = useState(null);
  const [newAdminForm, setNewAdminForm] = useState({ username: '', password: '' });
  const [profileData, setProfileData] = useState({ nama: '', npm: '', jabatan: '' });
  const [permissionForm, setPermissionForm] = useState({
    nama: '',
    npm: '',
    jabatan: '',
    kategori: 'Izin',
    alasan: ''
  });
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });

  const isAdminOrSuper = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const isSuperAdmin = currentUser?.role === 'superadmin';

  useEffect(() => {
    if (currentUser) {
      fetchAttendances();
      if (isAdminOrSuper) {
        fetchUsers();
        fetchPermissions();
      }
      if (isSuperAdmin) {
        fetchAdmins();
      }

      if (currentUser.role === 'user') {
        setProfileData({
          nama: currentUser.nama || '',
          npm: currentUser.npm || '',
          jabatan: currentUser.jabatan || ''
        });

        setPermissionForm((prev) => ({
          ...prev,
          nama: currentUser.nama || '',
          npm: currentUser.npm || '',
          jabatan: currentUser.jabatan || ''
        }));
      }
    }
  }, [currentUser]);

  useEffect(() => {
    socket.on('rfid_scan', (data) => {
      setLatestScan(data);
      setAttendances((prev) => [data, ...prev]);
    });

    return () => socket.off('rfid_scan');
  }, []);

  const fetchAttendances = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/attendances');
      const data = await res.json();
      setAttendances(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/users');
      const data = await res.json();
      setUsers(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPermissions = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/permissions');
      const data = await res.json();
      setPermissions(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAdmins = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/admins');
      const data = await res.json();
      setAdmins(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    try {
      const res = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginInput)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setCurrentUser(data.user);
        setActiveTab('presensi');
      } else {
        setLoginError(data.error || 'Login gagal! Periksa username & password.');
      }
    } catch (err) {
      setLoginError('Tidak dapat terhubung ke server backend.');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setLoginInput({ username: '', password: '' });
  };

  const handleExportExcel = () => {
    if (attendances.length === 0) {
      alert('Belum ada data presensi untuk dieksport!');
      return;
    }

    const wb = XLSX.utils.book_new();
    const dateMap = new Map();

    attendances.forEach((att) => {
      const dateObj = new Date(att.waktu);
      const dateStr = dateObj.toISOString().split('T')[0];
      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, []);
      }
      dateMap.get(dateStr).push(att);
    });

    const sortedDates = Array.from(dateMap.keys()).sort();
    let sheetCount = 0;

    sortedDates.forEach((dateStr) => {
      const dateAttendances = dateMap.get(dateStr);
      if (!dateAttendances || dateAttendances.length === 0) return;

      const datePermissions = permissions.filter((p) => {
        const pDate = new Date(p.waktu).toISOString().split('T')[0];
        return pDate === dateStr;
      });

      const sheetRows = users.map((u) => {
        const att = dateAttendances.find((a) => a.npm === u.npm || (a.card_id && a.card_id === u.card_id));
        const perm = datePermissions.find((p) => p.npm === u.npm);

        let status = 'Alpha';
        let waktuTap = '-';
        let keterangan = '-';

        if (att && att.isRegistered) {
          status = 'Hadir';
          waktuTap = new Date(att.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        } else if (perm) {
          status = `Izin (${perm.kategori})`;
          keterangan = perm.alasan;
        }

        return {
          'NPM': u.npm,
          'Nama Lengkap': u.nama,
          'Jabatan / Departemen': u.jabatan,
          'Status Presensi': status,
          'Waktu Tap': waktuTap,
          'Keterangan / Alasan': keterangan
        };
      });

      const guestTaps = dateAttendances.filter((a) => !a.isRegistered);
      guestTaps.forEach((g) => {
        sheetRows.push({
          'NPM': '-',
          'Nama Lengkap': 'Tidak Dikenal (Tamu)',
          'Jabatan / Departemen': 'Tamu / Belum Terdaftar',
          'Status Presensi': 'Hadir (Tamu)',
          'Waktu Tap': new Date(g.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          'Keterangan / Alasan': `UID: ${g.card_id}`
        });
      });

      const [year, month, day] = dateStr.split('-');
      const sheetName = `${day}-${month}-${year}`;
      const ws = XLSX.utils.json_to_sheet(sheetRows);

      const headerKeys = ['NPM', 'Nama Lengkap', 'Jabatan / Departemen', 'Status Presensi', 'Waktu Tap', 'Keterangan / Alasan'];
      headerKeys.forEach((_, colIdx) => {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIdx });
        if (ws[cellRef]) {
          ws[cellRef].s = {
            fill: { fgColor: { rgb: "0F172A" } },
            font: { color: { rgb: "FFFFFF" }, bold: true },
            alignment: { horizontal: "center", vertical: "center" }
          };
        }
      });

      sheetRows.forEach((row, rowIdx) => {
        const r = rowIdx + 1;
        const statusVal = row['Status Presensi'];
        const statusCellRef = XLSX.utils.encode_cell({ r: r, c: 3 });

        if (ws[statusCellRef]) {
          let bgHex = "FFFFFF";
          let textHex = "000000";

          if (statusVal.includes('Hadir')) {
            bgHex = "DCFCE7";
            textHex = "15803D";
          } else if (statusVal.includes('Izin') || statusVal.includes('Sakit') || statusVal.includes('Lainnya')) {
            bgHex = "FEF9C3";
            textHex = "A16207";
          } else if (statusVal.includes('Alpha')) {
            bgHex = "FEE2E2";
            textHex = "B91C1C";
          }

          ws[statusCellRef].s = {
            fill: { fgColor: { rgb: bgHex } },
            font: { color: { rgb: textHex }, bold: true },
            alignment: { horizontal: "center", vertical: "center" }
          };
        }
      });

      ws['!cols'] = [
        { wch: 15 },
        { wch: 25 },
        { wch: 22 },
        { wch: 18 },
        { wch: 12 },
        { wch: 30 }
      ];

      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      sheetCount++;
    });

    if (sheetCount === 0) return;

    const todayStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Laporan_Presensi_HMIF_${todayStr}.xlsx`);
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:5000/api/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAdminForm)
      });
      const data = await res.json();

      if (res.ok) {
        alert('Admin baru berhasil ditambahkan!');
        setNewAdminForm({ username: '', password: '' });
        fetchAdmins();
      } else {
        alert(data.error || 'Gagal menambahkan admin.');
      }
    } catch (err) {
      alert('Terjadi kesalahan koneksi.');
    }
  };

  const handleDeleteAdmin = async (id, username) => {
    if (window.confirm(`Yakin ingin menghapus Admin "${username}"?`)) {
      const res = await fetch(`http://localhost:5000/api/admins/${id}`, { method: 'DELETE' });
      if (res.ok) fetchAdmins();
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`http://localhost:5000/api/users/${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData)
      });
      const data = await res.json();

      if (res.ok) {
        alert('Profil berhasil diperbarui!');
        setCurrentUser((prev) => ({
          ...prev,
          nama: data.nama,
          npm: data.npm,
          jabatan: data.jabatan
        }));
      } else {
        alert(data.error || 'Gagal memperbarui profil.');
      }
    } catch (err) {
      alert('Terjadi kesalahan koneksi.');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert('Konfirmasi password baru tidak cocok!');
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/users/${currentUser.id}/change-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldPassword: passwordForm.oldPassword,
          newPassword: passwordForm.newPassword
        })
      });
      const data = await res.json();

      if (res.ok) {
        alert('Password berhasil diperbarui!');
        setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        alert(data.error || 'Gagal mengubah password.');
      }
    } catch (err) {
      alert('Terjadi kesalahan koneksi.');
    }
  };

  const handleSubmitUser = async (e) => {
    e.preventDefault();
    if (editingUserId) {
      const res = await fetch(`http://localhost:5000/api/users/${editingUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        alert('Data anggota diperbarui!');
        resetFormUser();
        fetchUsers();
      }
    } else {
      const res = await fetch('http://localhost:5000/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        alert('Anggota berhasil didaftarkan! Password default: 12345678');
        resetFormUser();
        fetchUsers();
      } else {
        const err = await res.json();
        alert(err.error);
      }
    }
  };

  const handleEditClick = (user) => {
    setEditingUserId(user._id);
    setFormData({ card_id: user.card_id, nama: user.nama, npm: user.npm, jabatan: user.jabatan });
  };

  const handleDeleteUser = async (id, nama) => {
    if (window.confirm(`Yakin ingin menghapus ${nama}?`)) {
      const res = await fetch(`http://localhost:5000/api/users/${id}`, { method: 'DELETE' });
      if (res.ok) fetchUsers();
    }
  };

  const resetFormUser = () => {
    setFormData({ card_id: '', nama: '', npm: '', jabatan: '' });
    setEditingUserId(null);
  };

  const handleSubmitPermission = async (e) => {
    e.preventDefault();
    const res = await fetch('http://localhost:5000/api/permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(permissionForm)
    });

    if (res.ok) {
      alert('Pengajuan izin berhasil terkirim!');
      if (isAdminOrSuper) {
        setPermissionForm({ nama: '', npm: '', jabatan: '', kategori: 'Izin', alasan: '' });
        fetchPermissions();
      } else {
        setPermissionForm((prev) => ({ ...prev, alasan: '' }));
      }
    } else {
      alert('Gagal mengirim form izin.');
    }
  };

  const handleDeletePermission = async (id) => {
    if (window.confirm('Yakin ingin menghapus riwayat perizinan ini?')) {
      const res = await fetch(`http://localhost:5000/api/permissions/${id}`, { method: 'DELETE' });
      if (res.ok) fetchPermissions();
    }
  };

  const navItems = [
    { id: 'presensi', label: 'Presensi Rapat', icon: ClipboardList, visible: true },
    { id: 'anggota', label: 'Data Anggota', icon: Users, visible: isAdminOrSuper },
    { id: 'izin', label: 'Form Perizinan', icon: FileText, visible: true },
    { id: 'kelola-admin', label: 'Kelola Admin', icon: ShieldCheck, visible: isSuperAdmin },
    { id: 'profil', label: 'Profil Saya', icon: UserIcon, visible: true },
  ];

  // LOGIN SCREEN
  if (!currentUser) {
    return (
      <div className="login-wrapper">
        <style>{`
          .login-wrapper {
            min-height: 100vh;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
          }
          .login-card {
            background: rgba(30, 41, 59, 0.75);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 24px;
            padding: 32px 24px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          }
          .custom-input {
            width: 100%;
            padding: 14px 16px;
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 12px;
            color: #ffffff;
            font-size: 15px;
            outline: none;
            transition: all 0.2s;
            box-sizing: border-box;
          }
          .custom-input:focus {
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25);
          }
          .login-btn {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            color: #ffffff;
            border: none;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
          }
        `}</style>

        <div className="login-card">
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '56px',
              height: '56px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              borderRadius: '16px',
              boxShadow: '0 8px 20px rgba(59, 130, 246, 0.4)',
              marginBottom: '14px'
            }}>
              <Radio size={28} color="#ffffff" />
            </div>
            <h2 style={{ color: '#ffffff', margin: '0 0 6px 0', fontSize: '24px', fontWeight: '700' }}>HMIF IoT System</h2>
            <p style={{ color: '#94a3b8', margin: 0, fontSize: '13px' }}>Portal Presensi RFID & Manajemen Anggota</p>
          </div>

          {loginError && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              padding: '12px 14px',
              borderRadius: '12px',
              marginBottom: '20px',
              fontSize: '13px'
            }}>
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
                Username / NPM
              </label>
              <input
                type="text"
                placeholder="Masukkan Username atau NPM"
                value={loginInput.username}
                onChange={(e) => setLoginInput({ ...loginInput, username: e.target.value })}
                className="custom-input"
                required
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
                Password
              </label>
              <input
                type="password"
                placeholder="Masukkan Password"
                value={loginInput.password}
                onChange={(e) => setLoginInput({ ...loginInput, password: e.target.value })}
                className="custom-input"
                required
              />
            </div>

            <button type="submit" className="login-btn">
              Masuk Ke Portal
            </button>
          </form>
        </div>
      </div>
    );
  }

  // DASHBOARD MAIN UI
  return (
    <div className="dashboard-container">
      <style>{`
        * { box-sizing: border-box; }
        html, body {
          margin: 0;
          padding: 0;
          background-color: #f8fafc;
          color: #0f172a;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          overflow-x: hidden;
        }

        .dashboard-container {
          display: flex;
          min-height: 100vh;
          width: 100%;
          position: relative;
        }

        /* Sidebar Standard Desktop */
        .sidebar {
          width: 280px;
          background: #0f172a;
          color: #ffffff;
          padding: 24px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: fixed;
          top: 0;
          bottom: 0;
          left: 0;
          z-index: 100;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Main Content Container */
        .main-content {
          flex: 1;
          margin-left: 280px;
          padding: 32px;
          min-width: 0;
          width: calc(100% - 280px);
        }

        /* Top Mobile Header */
        .mobile-header {
          display: none;
        }

        /* Card Panel */
        .card-panel {
          background: #ffffff;
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 24px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.03);
          width: 100%;
        }

        /* Responsive Table Wrapper */
        .table-responsive {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
        }
        .custom-table {
          width: 100%;
          border-collapse: collapse;
          white-space: nowrap;
          font-size: 14px;
        }
        .custom-table th {
          background: #0f172a;
          color: #ffffff;
          padding: 14px 16px;
          text-align: left;
          font-weight: 600;
        }
        .custom-table td {
          padding: 14px 16px;
          border-bottom: 1px solid #f1f5f9;
        }

        /* Inputs */
        .form-control {
          width: 100%;
          padding: 10px 14px;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          outline: none;
          font-size: 14px;
        }
        .form-control:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
        }

        /* MOBILE RESPONSIEV BREAKPOINT */
        @media (max-width: 1024px) {
          .dashboard-container {
            flex-direction: column;
          }
          
          .mobile-header {
            display: flex;
            width: 100%;
            height: 64px;
            background: #0f172a;
            color: #ffffff;
            padding: 0 20px;
            align-items: center;
            justify-content: space-between;
            position: sticky;
            top: 0;
            z-index: 80;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          }

          .sidebar {
            transform: translateX(-100%);
            width: 280px;
            box-shadow: 10px 0 30px rgba(0,0,0,0.5);
          }
          .sidebar.open {
            transform: translateX(0);
          }

          .main-content {
            margin-left: 0;
            width: 100%;
            padding: 16px;
          }

          .sidebar-overlay {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.65);
            backdrop-filter: blur(4px);
            z-index: 90;
          }
        }
      `}</style>

      {/* OVERLAY MOBILE MENU */}
      {isMobileMenuOpen && (
        <div className="sidebar-overlay" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* MOBILE TOP HEADER BAR */}
      <header className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Radio size={22} color="#60a5fa" />
          <span style={{ fontWeight: '700', fontSize: '16px' }}>HMIF IoT Presensi</span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '6px' }}>
          {isMobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
        </button>
      </header>

      {/* SIDEBAR NAVIGATION */}
      <aside className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '20px', borderBottom: '1px solid #1e293b' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
            }}>
              <Radio size={20} color="#fff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700' }}>HMIF System</h3>
              <span style={{ fontSize: '11px', color: '#64748b' }}>IoT RFID Attendance</span>
            </div>
          </div>

          {/* USER CARD */}
          <div style={{
            margin: '20px 0',
            padding: '12px 14px',
            background: '#1e293b',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: '#334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#60a5fa',
                flexShrink: 0
              }}>
                <UserIcon size={16} />
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: '600', fontSize: '13px', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentUser.nama}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  {isAdminOrSuper ? (
                    <span style={{
                      color: isSuperAdmin ? '#f87171' : '#fbbf24',
                      fontWeight: '700',
                      textTransform: 'uppercase'
                    }}>
                      {currentUser.role}
                    </span>
                  ) : (
                    `NPM: ${currentUser.npm || '-'}`
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* MENU LINKS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {navItems.filter(item => item.visible).map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    backgroundColor: isActive ? '#2563eb' : 'transparent',
                    color: isActive ? '#ffffff' : '#94a3b8',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: isActive ? '600' : '500',
                    fontSize: '14px',
                    textAlign: 'left',
                    transition: 'all 0.2s'
                  }}>
                  <Icon size={18} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {isActive && <ChevronRight size={16} />}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: '#f87171',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '10px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px',
            marginTop: '20px'
          }}>
          <LogOut size={18} />
          <span>Keluar</span>
        </button>
      </aside>

      {/* CONTENT PANEL */}
      <main className="main-content">
        
        {/* TAB 1: PRESENSI RAPAT */}
        {activeTab === 'presensi' && (
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '20px'
            }}>
              <div>
                <h1 style={{ margin: '0 0 4px 0', fontSize: '22px', fontWeight: '800' }}>Presensi Real-Time</h1>
                <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>Monitoring kehadiran peserta rapat organisasi</p>
              </div>

              {isAdminOrSuper && (
                <button
                  onClick={handleExportExcel}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '13px',
                    boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)'
                  }}>
                  <Download size={16} />
                  <span>Export Excel (.xlsx)</span>
                </button>
              )}
            </div>

            {/* SCAN TERAKHIR BANNER */}
            <div className="card-panel" style={{
              background: latestScan ? (latestScan.isRegistered ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' : 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)') : '#ffffff',
              borderColor: latestScan ? (latestScan.isRegistered ? '#86efac' : '#fca5a5') : '#e2e8f0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: latestScan ? (latestScan.isRegistered ? '#16a34a' : '#dc2626') : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  flexShrink: 0
                }}>
                  {latestScan ? (latestScan.isRegistered ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />) : <Clock size={24} />}
                </div>

                <div style={{ flex: 1, minWidth: '200px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>
                    Status Scan RFID Terakhir
                  </span>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>
                    {latestScan
                      ? `${latestScan.nama} (${latestScan.npm})`
                      : 'Menunggu perangkat men-tap kartu...'}
                  </div>
                  {latestScan && (
                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                      Jabatan: <strong>{latestScan.jabatan}</strong> | UID: <code>{latestScan.card_id}</code>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* TABEL PRESENSI */}
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Waktu Tap</th>
                    <th>Nama Peserta</th>
                    <th>NPM</th>
                    <th>Jabatan</th>
                    <th>UID Kartu</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendances.length > 0 ? (
                    attendances.map((item, i) => {
                      const dateObj = new Date(item.waktu);
                      const tanggalStr = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
                      const waktuStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: '600', color: '#475569' }}>{tanggalStr}</td>
                          <td>{waktuStr}</td>
                          <td style={{ fontWeight: '700', color: '#0f172a' }}>{item.nama}</td>
                          <td>{item.npm}</td>
                          <td>{item.jabatan}</td>
                          <td><code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{item.card_id}</code></td>
                          <td>
                            <span style={{
                              padding: '5px 10px',
                              borderRadius: '20px',
                              fontSize: '11px',
                              fontWeight: '700',
                              backgroundColor: item.isRegistered ? '#dcfce7' : '#fee2e2',
                              color: item.isRegistered ? '#15803d' : '#b91c1c'
                            }}>
                              {item.isRegistered ? 'Hadir' : 'Tidak Dikenal'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                        Belum ada aktivitas presensi rapat.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: DATA ANGGOTA */}
        {activeTab === 'anggota' && isAdminOrSuper && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <h1 style={{ margin: '0 0 4px 0', fontSize: '22px', fontWeight: '800' }}>Data Anggota</h1>
              <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>Kelola daftar kartu dan profil anggota terdaftar</p>
            </div>

            <div className="card-panel">
              <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', color: editingUserId ? '#2563eb' : '#0f172a', fontSize: '16px' }}>
                {editingUserId ? <Pencil size={18} /> : <Plus size={18} />}
                <span>{editingUserId ? 'Edit Data Anggota' : 'Registrasi Anggota & Kartu Baru'}</span>
              </h3>

              <form onSubmit={handleSubmitUser}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: '#475568' }}>UID Kartu RFID:</label>
                    <input
                      placeholder="Contoh: 029E29B9"
                      value={formData.card_id}
                      onChange={(e) => setFormData({ ...formData, card_id: e.target.value })}
                      className="form-control"
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: '#475568' }}>Nama Lengkap:</label>
                    <input
                      placeholder="Nama Lengkap"
                      value={formData.nama}
                      onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                      className="form-control"
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: '#475568' }}>NPM:</label>
                    <input
                      placeholder="Nomor Pokok Mahasiswa"
                      value={formData.npm}
                      onChange={(e) => setFormData({ ...formData, npm: e.target.value })}
                      className="form-control"
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: '#475568' }}>Jabatan / Departemen:</label>
                    <input
                      placeholder="Jabatan Organisasi"
                      value={formData.jabatan}
                      onChange={(e) => setFormData({ ...formData, jabatan: e.target.value })}
                      className="form-control"
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" style={{
                    padding: '10px 18px',
                    backgroundColor: editingUserId ? '#2563eb' : '#16a34a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '13px'
                  }}>
                    {editingUserId ? 'Simpan Perubahan' : '+ Daftarkan Anggota'}
                  </button>

                  {editingUserId && (
                    <button type="button" onClick={resetFormUser} style={{
                      padding: '10px 14px',
                      backgroundColor: '#64748b',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}>
                      Batal
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>UID Kartu</th>
                    <th>Nama Anggota</th>
                    <th>NPM</th>
                    <th>Jabatan</th>
                    <th style={{ textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length > 0 ? (
                    users.map((u, i) => (
                      <tr key={i}>
                        <td><code style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px' }}>{u.card_id}</code></td>
                        <td style={{ fontWeight: '700' }}>{u.nama}</td>
                        <td>{u.npm}</td>
                        <td>{u.jabatan}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => handleEditClick(u)}
                            style={{
                              marginRight: '8px',
                              padding: '6px 12px',
                              backgroundColor: '#2563eb',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                            <Pencil size={14} /> Edit
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u._id, u.nama)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#dc2626',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                            <Trash2 size={14} /> Hapus
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                        Belum ada anggota yang terdaftar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: FORM PERIZINAN */}
        {activeTab === 'izin' && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <h1 style={{ margin: '0 0 4px 0', fontSize: '22px', fontWeight: '800' }}>Form Perizinan</h1>
              <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>Pengajuan izin / sakit ketidakhadiran rapat</p>
            </div>

            <div className="card-panel">
              <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
                <FileText size={18} />
                <span>Ajukan Form Izin Rapat</span>
              </h3>

              <form onSubmit={handleSubmitPermission}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: '#475568' }}>Nama Lengkap:</label>
                    <input
                      type="text"
                      value={permissionForm.nama}
                      onChange={(e) => setPermissionForm({ ...permissionForm, nama: e.target.value })}
                      disabled={currentUser.role === 'user'}
                      className="form-control"
                      style={{ backgroundColor: currentUser.role === 'user' ? '#f1f5f9' : '#fff' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: '#475568' }}>NPM:</label>
                    <input
                      type="text"
                      value={permissionForm.npm}
                      onChange={(e) => setPermissionForm({ ...permissionForm, npm: e.target.value })}
                      disabled={currentUser.role === 'user'}
                      className="form-control"
                      style={{ backgroundColor: currentUser.role === 'user' ? '#f1f5f9' : '#fff' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: '#475568' }}>Jabatan / Departemen:</label>
                    <input
                      type="text"
                      value={permissionForm.jabatan}
                      onChange={(e) => setPermissionForm({ ...permissionForm, jabatan: e.target.value })}
                      disabled={currentUser.role === 'user'}
                      className="form-control"
                      style={{ backgroundColor: currentUser.role === 'user' ? '#f1f5f9' : '#fff' }}
                      required
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: '#475568' }}>Kategori Perizinan:</label>
                  <select
                    value={permissionForm.kategori}
                    onChange={(e) => setPermissionForm({ ...permissionForm, kategori: e.target.value })}
                    className="form-control"
                  >
                    <option value="Izin">Izin (Keperluan / Urusan)</option>
                    <option value="Sakit">Sakit</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: '#475568' }}>Alasan Keterangan:</label>
                  <textarea
                    placeholder="Jelaskan alasan tidak menghadiri rapat..."
                    value={permissionForm.alasan}
                    onChange={(e) => setPermissionForm({ ...permissionForm, alasan: e.target.value })}
                    className="form-control"
                    rows={3}
                    style={{ fontFamily: 'inherit' }}
                    required
                  />
                </div>

                <button type="submit" style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  backgroundColor: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '13px'
                }}>
                  <Send size={16} />
                  <span>Kirim Pengajuan Izin</span>
                </button>
              </form>
            </div>

            {isAdminOrSuper && (
              <div>
                <h3 style={{ marginBottom: '14px', fontSize: '16px' }}>Riwayat Pengajuan Izin Anggota</h3>
                <div className="table-responsive">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Tanggal</th>
                        <th>Waktu</th>
                        <th>Nama Anggota</th>
                        <th>NPM</th>
                        <th>Jabatan</th>
                        <th>Kategori</th>
                        <th>Alasan</th>
                        <th style={{ textAlign: 'center' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {permissions.length > 0 ? (
                        permissions.map((item, i) => {
                          const dateObj = new Date(item.waktu);
                          const tanggalStr = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
                          const waktuStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

                          const badgeBg = item.kategori === 'Sakit' ? '#fee2e2' : item.kategori === 'Izin' ? '#fef3c7' : '#f1f5f9';
                          const badgeTextColor = item.kategori === 'Sakit' ? '#b91c1c' : item.kategori === 'Izin' ? '#b45309' : '#475569';

                          return (
                            <tr key={i}>
                              <td style={{ fontWeight: '600', color: '#475568' }}>{tanggalStr}</td>
                              <td>{waktuStr}</td>
                              <td style={{ fontWeight: '700' }}>{item.nama}</td>
                              <td>{item.npm}</td>
                              <td>{item.jabatan}</td>
                              <td>
                                <span style={{
                                  padding: '4px 10px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  backgroundColor: badgeBg,
                                  color: badgeTextColor
                                }}>
                                  {item.kategori}
                                </span>
                              </td>
                              <td style={{ maxWidth: '280px', whiteSpace: 'normal' }}>{item.alasan}</td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  onClick={() => handleDeletePermission(item._id)}
                                  style={{
                                    padding: '6px 12px',
                                    backgroundColor: '#dc2626',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}>
                                  <Trash2 size={14} /> Hapus
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                            Belum ada pengajuan perizinan.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: KELOLA ADMIN */}
        {activeTab === 'kelola-admin' && isSuperAdmin && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <h1 style={{ margin: '0 0 4px 0', fontSize: '22px', fontWeight: '800' }}>Manajemen Admin</h1>
              <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>Kelola hak akses pengurus dan admin sistem</p>
            </div>

            <div className="card-panel">
              <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
                <UserPlus size={18} />
                <span>Tambah Akun Admin Baru</span>
              </h3>

              <form onSubmit={handleCreateAdmin}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: '#475568' }}>Username Admin:</label>
                    <input
                      type="text"
                      placeholder="Username Baru"
                      value={newAdminForm.username}
                      onChange={(e) => setNewAdminForm({ ...newAdminForm, username: e.target.value })}
                      className="form-control"
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: '#475568' }}>Password Admin:</label>
                    <input
                      type="password"
                      placeholder="Password"
                      value={newAdminForm.password}
                      onChange={(e) => setNewAdminForm({ ...newAdminForm, password: e.target.value })}
                      className="form-control"
                      required
                    />
                  </div>
                </div>

                <button type="submit" style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  backgroundColor: '#16a34a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '13px'
                }}>
                  <UserPlus size={16} />
                  <span>+ Tambah Admin</span>
                </button>
              </form>
            </div>

            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Role Hak Akses</th>
                    <th>Tanggal Dibuat</th>
                    <th style={{ textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.length > 0 ? (
                    admins.map((adm, i) => {
                      const dateObj = new Date(adm.waktu);
                      const tanggalStr = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: '700' }}>{adm.username}</td>
                          <td>
                            <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', color: '#1d4ed8', backgroundColor: '#dbeafe', fontWeight: '700' }}>
                              ADMIN
                            </span>
                          </td>
                          <td>{tanggalStr}</td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              onClick={() => handleDeleteAdmin(adm._id, adm.username)}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#dc2626',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                              <Trash2 size={14} /> Hapus Admin
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                        Belum ada akun Admin biasa.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: PROFIL SAYA */}
        {activeTab === 'profil' && (
          <div style={{ maxWidth: '600px' }}>
            <div style={{ marginBottom: '20px' }}>
              <h1 style={{ margin: '0 0 4px 0', fontSize: '22px', fontWeight: '800' }}>Profil Saya</h1>
              <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>Pengaturan akun dan pembaruan kata sandi</p>
            </div>

            {currentUser.role === 'user' ? (
              <div className="card-panel">
                <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
                  <UserIcon size={18} />
                  <span>Edit Data Diri Mandiri</span>
                </h3>

                <form onSubmit={handleUpdateProfile}>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: '#475568' }}>Nama Lengkap:</label>
                    <input
                      type="text"
                      value={profileData.nama}
                      onChange={(e) => setProfileData({ ...profileData, nama: e.target.value })}
                      className="form-control"
                      required
                    />
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: '#475568' }}>NPM:</label>
                    <input
                      type="text"
                      value={profileData.npm}
                      onChange={(e) => setProfileData({ ...profileData, npm: e.target.value })}
                      className="form-control"
                      required
                    />
                  </div>

                  <div style={{ marginBottom: '18px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: '#475568' }}>Jabatan / Departemen:</label>
                    <input
                      type="text"
                      value={profileData.jabatan}
                      onChange={(e) => setProfileData({ ...profileData, jabatan: e.target.value })}
                      className="form-control"
                      required
                    />
                  </div>

                  <button type="submit" style={{ padding: '10px 18px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
                    Simpan Perubahan Profil
                  </button>
                </form>
              </div>
            ) : (
              <div className="card-panel">
                <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
                  <UserIcon size={18} />
                  <span>Informasi Akun</span>
                </h3>
                <p><strong>Nama:</strong> {currentUser.nama}</p>
                <p><strong>Role:</strong> <span style={{ textTransform: 'uppercase', fontWeight: '700', color: isSuperAdmin ? '#dc2626' : '#d97706' }}>{currentUser.role}</span></p>
              </div>
            )}

            {currentUser.role === 'user' && (
              <div className="card-panel">
                <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
                  <Key size={18} />
                  <span>Ubah Password</span>
                </h3>

                <form onSubmit={handleChangePassword}>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: '#475568' }}>Password Saat Ini:</label>
                    <input
                      type="password"
                      placeholder="Default: 12345678"
                      value={passwordForm.oldPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                      className="form-control"
                      required
                    />
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: '#475568' }}>Password Baru:</label>
                    <input
                      type="password"
                      placeholder="Masukkan Password Baru"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      className="form-control"
                      required
                    />
                  </div>

                  <div style={{ marginBottom: '18px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: '#475568' }}>Konfirmasi Password Baru:</label>
                    <input
                      type="password"
                      placeholder="Ulangi Password Baru"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      className="form-control"
                      required
                    />
                  </div>

                  <button type="submit" style={{ padding: '10px 18px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
                    Simpan Password Baru
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;