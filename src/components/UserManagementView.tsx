import React, { useState, useMemo } from 'react';
import {
  Users,
  PlusCircle,
  Search,
  Edit3,
  Trash2,
  Eye,
  UserCheck,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  X,
  Building2,
} from 'lucide-react';
import { User, UserRoleCode, RoleConfig, Room } from '../types/simonsu';
import {
  DEFAULT_ROLE_CONFIGS,
  formatDateIndonesia,
  logAudit,
  isUserUnrestrictedRooms,
  getUserAssignedRooms,
  normalizeAssignedRoomIds,
} from '../utils/storage';

interface UserManagementViewProps {
  users: User[];
  currentUser: User;
  rooms: Room[];
  roleConfigs: Record<string, RoleConfig>;
  onSaveUser: (newUser: User) => void;
  onUpdateUser: (updatedUser: User) => void;
  onDeleteUser: (userId: string) => void;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  users,
  currentUser,
  rooms,
  roleConfigs,
  onSaveUser,
  onUpdateUser,
  onDeleteUser,
}) => {
  const activeRooms = rooms.filter((r) => r.is_active);
  const effectiveRoleConfigs =
    Object.keys(roleConfigs).length > 0 ? roleConfigs : DEFAULT_ROLE_CONFIGS;

  // Filter States
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [detailUser, setDetailUser] = useState<User | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  // Form Fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRoleCode>('PETUGAS');
  const [nip, setNip] = useState('');
  const [position, setPosition] = useState('');
  const [assignedRoomIds, setAssignedRoomIds] = useState<string[]>(['ALL']);
  const [isActive, setIsActive] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        u.nip.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  const handleOpenAdd = () => {
    setEditingUser(null);
    setUsername('');
    setPassword('');
    setName('');
    setEmail('');
    setRole('PETUGAS');
    setNip('');
    setPosition('Pranata Laboratorium Kesehatan');
    setAssignedRoomIds([]);
    setIsActive(true);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (u: User) => {
    setEditingUser(u);
    setUsername(u.username);
    setPassword(''); // Leave blank unless updating
    setName(u.name);
    setEmail(u.email);
    setRole(u.role);
    setNip(u.nip);
    setPosition(u.position);
    setAssignedRoomIds(normalizeAssignedRoomIds(u.assigned_room_ids, u.role));
    setIsActive(u.is_active);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleToggleRoomSelection = (roomId: string) => {
    if (roomId === 'ALL') {
      setAssignedRoomIds((prev) => (prev.includes('ALL') ? [] : ['ALL']));
      return;
    }

    setAssignedRoomIds((prev) => {
      let filtered = prev.filter((id) => id !== 'ALL');
      if (filtered.includes(roomId)) {
        filtered = filtered.filter((id) => id !== roomId);
      } else {
        filtered.push(roomId);
      }
      return filtered;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!username.trim() || !name.trim() || !email.trim() || !nip.trim()) {
      setErrorMsg('Username, Nama, Email, dan NIP wajib diisi.');
      return;
    }

    // Check duplicate username
    const existingUsername = users.find(
      (u) => u.username.toLowerCase() === username.toLowerCase().trim() && u.id !== editingUser?.id
    );
    if (existingUsername) {
      setErrorMsg(`Username "${username}" telah digunakan oleh user lain.`);
      return;
    }

    if (!editingUser && !password.trim()) {
      setErrorMsg('Password wajib diisi untuk user baru.');
      return;
    }

    const finalAssignedRooms = normalizeAssignedRoomIds(assignedRoomIds, role);
    if (role !== 'ADMIN' && finalAssignedRooms.length === 0) {
      setErrorMsg('Pilih minimal 1 ruangan tanggung jawab untuk user ini (atau centang Semua Ruangan).');
      return;
    }

    if (editingUser) {
      const updated: User = {
        ...editingUser,
        username: username.trim().toLowerCase(),
        password: password.trim() ? password : editingUser.password, // Update password if typed
        name: name.trim(),
        email: email.trim(),
        role,
        nip: nip.trim(),
        position: position.trim(),
        assigned_room_ids: finalAssignedRooms,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      };
      logAudit(
        currentUser,
        'EDIT_USER',
        `${currentUser.name} memperbarui data user "${updated.name}" (${updated.username})`
      );
      onUpdateUser(updated);
    } else {
      const newUser: User = {
        id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        username: username.trim().toLowerCase(),
        password: password.trim(),
        name: name.trim(),
        email: email.trim(),
        role,
        nip: nip.trim(),
        position: position.trim(),
        assigned_room_ids: finalAssignedRooms,
        is_active: isActive,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      logAudit(
        currentUser,
        'TAMBAH_USER',
        `${currentUser.name} menambah user baru "${newUser.name}" (${newUser.username}) dengan role ${newUser.role}`
      );
      onSaveUser(newUser);
    }

    setIsModalOpen(false);
  };

  const handleConfirmDelete = () => {
    if (!deletingUserId) return;
    if (deletingUserId === currentUser.id) {
      setErrorMsg('Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif login.');
      setDeletingUserId(null);
      return;
    }

    const userToDelete = users.find((u) => u.id === deletingUserId);
    if (userToDelete) {
      logAudit(
        currentUser,
        'HAPUS_USER',
        `${currentUser.name} menghapus akun user "${userToDelete.name}" (${userToDelete.username})`
      );
      onDeleteUser(deletingUserId);
    }
    setDeletingUserId(null);
  };

  const renderAssignedRoomBadges = (u: User) => {
    if (isUserUnrestrictedRooms(u)) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
          Semua Ruangan (Akses Penuh)
        </span>
      );
    }

    const assignedRooms = getUserAssignedRooms(u, rooms, false);
    if (assignedRooms.length === 0) {
      return <span className="text-[10px] text-amber-500 font-semibold">Belum Diatur</span>;
    }

    return (
      <div className="flex flex-wrap gap-1">
        {assignedRooms.map((r) => (
          <span key={r.id} className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
            [{r.code}] {r.name}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="w-full space-y-6">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-cyan-500 to-blue-600 text-white rounded-xl shadow-md shadow-cyan-500/20">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white font-poppins">Manajemen Pengguna (User)</h2>
              <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                Sheet: Data_Pengguna
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Kelola akun petugas (Admin & Petugas) dan penetapan tanggung jawab ruangan.
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-md shadow-cyan-500/20 flex items-center gap-2 transition-all hover:scale-[1.02]"
        >
          <PlusCircle className="w-4 h-4" />
          <span>+ Tambah User Baru</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-xl space-y-4 transition-colors">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama, username, NIP, atau email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-cyan-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          {/* Role Filter */}
          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-cyan-500 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none font-semibold"
            >
              <option value="ALL">Semua Role (Admin & Petugas)</option>
              {Object.keys(effectiveRoleConfigs).map((rCode) => (
                <option key={rCode} value={rCode}>
                  {effectiveRoleConfigs[rCode].label} ({rCode})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* User List Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm dark:shadow-xl overflow-hidden transition-colors">
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
          Total <span className="font-bold text-slate-900 dark:text-white">{filteredUsers.length}</span> pengguna terdaftar
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Pengguna</th>
                <th className="py-3 px-4">Username & NIP</th>
                <th className="py-3 px-4">Role Hak Akses</th>
                <th className="py-3 px-4">Akses Input Ruangan</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
              {filteredUsers.map((u) => {
                const roleConfig = effectiveRoleConfigs[u.role];
                const isCurrentLoggedIn = u.id === currentUser.id;

                return (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    
                    {/* Name & Email */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-sm">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            {u.name}
                            {isCurrentLoggedIn && (
                              <span className="text-[9px] bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 font-bold px-1.5 py-0.2 rounded border border-cyan-300 dark:border-cyan-800">
                                Anda
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">{u.position} • {u.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Username & NIP */}
                    <td className="py-3.5 px-4 font-mono">
                      <div className="font-bold text-cyan-600 dark:text-cyan-400">{u.username}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">NIP: {u.nip}</div>
                    </td>

                    {/* Role */}
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                        u.role === 'ADMIN'
                          ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                          : 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800'
                      }`}>
                        <ShieldCheck className="w-3 h-3" />
                        {roleConfig ? roleConfig.label : u.role}
                      </span>
                    </td>

                    {/* Assigned Rooms */}
                    <td className="py-3.5 px-4">
                      {renderAssignedRoomBadges(u)}
                    </td>

                    {/* Active Status */}
                    <td className="py-3.5 px-4">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-500 font-bold text-[11px]">
                          <XCircle className="w-3.5 h-3.5" /> Non-Aktif
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setDetailUser(u)}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                          title="Lihat Detail User"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-cyan-600 dark:text-cyan-400 transition-colors"
                          title="Edit Data User"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          disabled={isCurrentLoggedIn}
                          onClick={() => setDeletingUserId(u.id)}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-950 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                          title={isCurrentLoggedIn ? 'Tidak bisa menghapus diri sendiri' : 'Hapus User'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-slate-900 dark:text-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                {editingUser ? 'Edit Data Pengguna' : 'Tambah Pengguna Baru'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-300 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Username Login *</label>
                  <input
                    type="text"
                    placeholder="Contoh: fajar"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    {editingUser ? 'Password Baru (Opsional)' : 'Password *'}
                  </label>
                  <input
                    type="password"
                    placeholder={editingUser ? 'Kosongkan jika tidak diubah' : 'Min. 6 karakter'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  placeholder="Contoh: Fajar, S.Tr.AK"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Email Resmi *</label>
                  <input
                    type="email"
                    placeholder="fajar@labkes.bontangkota.go.id"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">NIP (Nomor Induk Pegawai) *</label>
                  <input
                    type="text"
                    placeholder="19880412 201201 1 002"
                    value={nip}
                    onChange={(e) => setNip(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Role Hak Akses *</label>
                  <select
                    value={role}
                    onChange={(e) => {
                      const nextRole = e.target.value;
                      setRole(nextRole);
                      if (nextRole === 'ADMIN') {
                        setAssignedRoomIds(['ALL']);
                      } else if (!editingUser && assignedRoomIds.includes('ALL')) {
                        setAssignedRoomIds([]);
                      }
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white font-semibold"
                  >
                    {Object.keys(effectiveRoleConfigs).map((rCode) => (
                      <option key={rCode} value={rCode}>
                        {effectiveRoleConfigs[rCode].label} ({rCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Jabatan / Posisi</label>
                  <input
                    type="text"
                    placeholder="Pranata Laboratorium Kesehatan"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Room Assignment Section */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="block text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /> Tanggung Jawab Ruangan (Akses Input & Data)
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  User hanya dapat memilih dan menginput suhu pada ruangan yang dicentang di bawah ini.
                </p>

                <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                  <label className="flex items-center gap-2 font-bold cursor-pointer text-cyan-700 dark:text-cyan-300">
                    <input
                      type="checkbox"
                      checked={role === 'ADMIN' || assignedRoomIds.includes('ALL')}
                      disabled={role === 'ADMIN'}
                      onChange={() => handleToggleRoomSelection('ALL')}
                      className="rounded bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-cyan-600 focus:ring-cyan-500 disabled:opacity-60"
                    />
                    <span>Semua Ruangan (Akses Penuh Tanpa Batas)</span>
                  </label>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeRooms.map((room) => {
                      const isChecked =
                        role !== 'ADMIN' &&
                        !assignedRoomIds.includes('ALL') &&
                        (assignedRoomIds.includes(room.id) || assignedRoomIds.includes(room.code));
                      return (
                        <label
                          key={room.id}
                          className={`p-2 rounded-lg border flex items-center gap-2 cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-cyan-50 dark:bg-cyan-950/60 border-cyan-300 dark:border-cyan-800 font-semibold text-slate-900 dark:text-white'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={role === 'ADMIN'}
                            checked={isChecked}
                            onChange={() => handleToggleRoomSelection(room.id)}
                            className="rounded bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-cyan-600 focus:ring-cyan-500 disabled:opacity-50"
                          />
                          <span className="truncate">[{room.code}] {room.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="userActiveCheck"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-cyan-600 focus:ring-cyan-500"
                />
                <label htmlFor="userActiveCheck" className="text-slate-700 dark:text-slate-300 font-medium">
                  Status Akun Aktif (Dapat Digunakan Login)
                </label>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold"
                >
                  Simpan User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail User Modal */}
      {detailUser && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-cyan-600 dark:text-cyan-400" /> Detail Informasi Pengguna
              </h3>
              <button onClick={() => setDetailUser(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white text-lg">
                  {detailUser.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">{detailUser.name}</h4>
                  <p className="text-cyan-600 dark:text-cyan-400 font-mono text-[11px]">@{detailUser.username}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Role Hak Akses:</span>
                  <span className="font-bold text-cyan-600 dark:text-cyan-300">{effectiveRoleConfigs[detailUser.role]?.label || detailUser.role}</span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Akses Ruangan:</span>
                  <div>{renderAssignedRoomBadges(detailUser)}</div>
                </div>

                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">NIP:</span>
                  <span className="font-bold font-mono">{detailUser.nip}</span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Email:</span>
                  <span className="font-semibold">{detailUser.email}</span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Jabatan:</span>
                  <span className="font-semibold">{detailUser.position}</span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Status Akun:</span>
                  <span className={`font-bold ${detailUser.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                    {detailUser.is_active ? 'Aktif' : 'Non-Aktif'}
                  </span>
                </div>

                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500 dark:text-slate-400">Tanggal Terdaftar:</span>
                  <span className="font-mono text-slate-600 dark:text-slate-400">{formatDateIndonesia((detailUser.created_at || '').split('T')[0])}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 flex justify-end border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setDetailUser(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete User Modal */}
      {deletingUserId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-900 dark:text-white">
            <div className="p-3 bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 rounded-xl text-rose-600 dark:text-rose-400 inline-block">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold">Konfirmasi Hapus Pengguna</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                Apakah Anda yakin ingin menghapus akun pengguna ini?
              </p>
            </div>

            <div className="pt-3 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setDeletingUserId(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/20"
              >
                Ya, Hapus User
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
