import React, { useState } from 'react';
import {
  Building2,
  PlusCircle,
  Edit3,
  Trash2,
  ShieldAlert,
  Lock,
  CheckCircle2,
  X,
  ToggleLeft,
  ToggleRight,
  Droplets,
} from 'lucide-react';
import { Room, User } from '../types/simonsu';
import { logAudit } from '../utils/storage';

interface MasterRuanganViewProps {
  rooms: Room[];
  currentUser: User;
  onSaveRoom: (room: Room) => void;
  onUpdateRoom: (room: Room) => void;
  onDeleteRoom: (roomId: string) => void;
}

export const MasterRuanganView: React.FC<MasterRuanganViewProps> = ({
  rooms,
  currentUser,
  onSaveRoom,
  onUpdateRoom,
  onDeleteRoom,
}) => {
  const isAdmin = currentUser.role === 'ADMIN';

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  // Form Fields
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [minTemp, setMinTemp] = useState('20.0');
  const [maxTemp, setMaxTemp] = useState('25.0');
  const [critMin, setCritMin] = useState('18.0');
  const [critMax, setCritMax] = useState('28.0');
  const [minHum, setMinHum] = useState('40.0');
  const [maxHum, setMaxHum] = useState('60.0');
  const [isActive, setIsActive] = useState(true);

  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleOpenAdd = () => {
    setEditingRoom(null);
    setCode('');
    setName('');
    setLocation('');
    setDescription('');
    setMinTemp('20.0');
    setMaxTemp('25.0');
    setCritMin('18.0');
    setCritMax('28.0');
    setMinHum('40.0');
    setMaxHum('60.0');
    setIsActive(true);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (room: Room) => {
    setEditingRoom(room);
    setCode(room.code);
    setName(room.name);
    setLocation(room.location || '');
    setDescription(room.description || '');
    setMinTemp(room.min_temperature.toString());
    setMaxTemp(room.max_temperature.toString());
    setCritMin(room.critical_min.toString());
    setCritMax(room.critical_max.toString());
    setMinHum(room.min_humidity !== undefined ? room.min_humidity.toString() : '40.0');
    setMaxHum(room.max_humidity !== undefined ? room.max_humidity.toString() : '60.0');
    setIsActive(room.is_active);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    if (!code.trim() || !name.trim()) {
      setErrorMsg('Kode dan Nama Ruangan wajib diisi.');
      return;
    }

    const normalizedCode = code.trim().toUpperCase();
    const duplicateCode = rooms.some(
      (r) => r.code.toUpperCase() === normalizedCode && r.id !== editingRoom?.id
    );
    if (duplicateCode) {
      setErrorMsg(`Kode ruangan "${normalizedCode}" sudah digunakan.`);
      return;
    }

    const minT = parseFloat(minTemp);
    const maxT = parseFloat(maxTemp);
    const cMin = parseFloat(critMin);
    const cMax = parseFloat(critMax);
    const minH = parseFloat(minHum);
    const maxH = parseFloat(maxHum);

    if (isNaN(minT) || isNaN(maxT) || isNaN(cMin) || isNaN(cMax)) {
      setErrorMsg('Batas suhu harus berupa angka valid.');
      return;
    }

    if (minT >= maxT) {
      setErrorMsg('Batas suhu minimum harus lebih kecil dari batas maksimum.');
      return;
    }

    if (cMin > minT || cMax < maxT) {
      setErrorMsg('Batas kritis harus mencakup di luar batas normal.');
      return;
    }

    if (isNaN(minH) || isNaN(maxH) || minH < 0 || maxH > 100 || minH >= maxH) {
      setErrorMsg('Batas kelembapan ideal harus antara 0%–100% dan Min lebih kecil dari Max.');
      return;
    }

    if (editingRoom) {
      const updated: Room = {
        ...editingRoom,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        location: location.trim(),
        description: description.trim(),
        min_temperature: minT,
        max_temperature: maxT,
        critical_min: cMin,
        critical_max: cMax,
        min_humidity: !isNaN(minH) ? minH : 40.0,
        max_humidity: !isNaN(maxH) ? maxH : 60.0,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      };
      logAudit(
        currentUser,
        'EDIT_RUANGAN',
        `${currentUser.name} memperbarui data master ruangan ${updated.name} (${updated.code})`
      );
      onUpdateRoom(updated);
    } else {
      const newRoom: Room = {
        id: `rm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        location: location.trim(),
        description: description.trim(),
        min_temperature: minT,
        max_temperature: maxT,
        critical_min: cMin,
        critical_max: cMax,
        min_humidity: !isNaN(minH) ? minH : 40.0,
        max_humidity: !isNaN(maxH) ? maxH : 60.0,
        is_active: isActive,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      logAudit(
        currentUser,
        'TAMBAH_RUANGAN',
        `${currentUser.name} menambah master ruangan baru ${newRoom.name} (${newRoom.code})`
      );
      onSaveRoom(newRoom);
    }

    setIsModalOpen(false);
  };

  const handleToggleActive = (room: Room) => {
    if (!isAdmin) return;
    const updated = { ...room, is_active: !room.is_active, updated_at: new Date().toISOString() };
    logAudit(
      currentUser,
      'EDIT_RUANGAN',
      `${currentUser.name} mengubah status ruangan ${room.name} menjadi ${updated.is_active ? 'Aktif' : 'Non-aktif'}`
    );
    onUpdateRoom(updated);
  };

  const handleConfirmDelete = () => {
    if (!deletingRoomId || !isAdmin) return;
    const roomToDelete = rooms.find((r) => r.id === deletingRoomId);
    if (roomToDelete) {
      logAudit(
        currentUser,
        'HAPUS_RUANGAN',
        `${currentUser.name} menghapus master ruangan ${roomToDelete.name} (${roomToDelete.code})`
      );
      onDeleteRoom(deletingRoomId);
    }
    setDeletingRoomId(null);
  };

  return (
    <div className="w-full space-y-6">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-cyan-500 to-blue-600 text-white rounded-xl shadow-md shadow-cyan-500/20">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white font-poppins">Master Ruangan Laboratorium</h2>
              <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono text-[10px] font-bold border border-blue-200 dark:border-blue-800">
                Sheet: Master_Ruangan
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Kelola daftar ruangan dan atur ambang batas suhu acuan spesifik per ruangan.
            </p>
          </div>
        </div>

        {isAdmin ? (
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-md shadow-cyan-500/20 flex items-center gap-2 transition-all hover:scale-[1.02]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Tambah Ruangan</span>
          </button>
        ) : (
          <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-amber-500" /> Read-Only (Akses Admin Diperlukan untuk Edit)
          </div>
        )}
      </div>

      {/* Access Permission Banner for Petugas */}
      {!isAdmin && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-3">
          <Lock className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <span className="font-bold">Akses Terbatas:</span> Anda saat ini berada dalam mode login <strong>Petugas</strong>. Mengubah master ruangan atau ambang batas suhu hanya dapat dilakukan oleh pengguna ber-role <strong>Admin</strong>.
          </div>
        </div>
      )}

      {/* Room Cards Grid */}
      {rooms.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-2 shadow-sm">
          <Building2 className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Belum Ada Ruangan Ditugaskan</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Tidak ada ruangan yang terdaftar atau ditugaskan pada akun Anda. Hubungi Administrator jika diperlukan akses ruangan.
          </p>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
        {rooms.map((room) => (
          <div
            key={room.id}
            className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm dark:shadow-xl transition-all flex flex-col justify-between ${
              room.is_active
                ? 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                : 'border-slate-200 dark:border-slate-800/50 opacity-60'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-950 text-cyan-700 dark:text-cyan-400 border border-slate-200 dark:border-slate-800">
                  {room.code}
                </span>
                
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    room.is_active
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}>
                    {room.is_active ? 'Aktif' : 'Non-Aktif'}
                  </span>

                  {isAdmin && (
                    <button
                      onClick={() => handleToggleActive(room)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                      title={room.is_active ? 'Nonaktifkan Ruangan' : 'Aktifkan Ruangan'}
                    >
                      {room.is_active ? (
                        <ToggleRight className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-slate-400" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              <h3 className="text-base font-bold text-slate-900 dark:text-white mt-3">{room.name}</h3>
              {room.location && <p className="text-xs text-cyan-600 dark:text-cyan-400 font-medium">{room.location}</p>}
              {room.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{room.description}</p>}

              {/* Temperature & Humidity Limit Boxes */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Suhu Ideal:
                  </span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {room.min_temperature.toFixed(1)}°C – {room.max_temperature.toFixed(1)}°C
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Droplets className="w-3.5 h-3.5 text-blue-500" /> Kelembapan Ideal:
                  </span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                    {room.min_humidity ?? 40}% – {room.max_humidity ?? 60}% RH
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-500" /> Kritis Suhu:
                  </span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                    &lt; {room.critical_min.toFixed(1)}°C atau &gt; {room.critical_max.toFixed(1)}°C
                  </span>
                </div>
              </div>
            </div>

            {/* Action buttons if admin */}
            {isAdmin && (
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  onClick={() => handleOpenEdit(room)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-cyan-600 dark:text-cyan-400 text-xs font-semibold rounded-xl flex items-center gap-1 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => setDeletingRoomId(room.id)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-950 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-semibold rounded-xl flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Hapus
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      )}

      {/* Add / Edit Room Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Building2 className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                {editingRoom ? 'Edit Master Ruangan' : 'Tambah Ruangan Baru'}
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
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Kode Ruangan *</label>
                  <input
                    type="text"
                    placeholder="LAB-KIM"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Nama Ruangan *</label>
                  <input
                    type="text"
                    placeholder="Laboratorium Kimia"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Temperature & Humidity Limits Inputs */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                <p className="font-bold text-cyan-600 dark:text-cyan-400 text-xs">Konfigurasi Batas Suhu Ideal (°C)</p>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">Batas Normal Min (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={minTemp}
                      onChange={(e) => setMinTemp(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-emerald-600 dark:text-emerald-400 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">Batas Normal Max (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={maxTemp}
                      onChange={(e) => setMaxTemp(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-emerald-600 dark:text-emerald-400 font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">Batas Kritis Min (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={critMin}
                      onChange={(e) => setCritMin(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-rose-600 dark:text-rose-400 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">Batas Kritis Max (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={critMax}
                      onChange={(e) => setCritMax(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-rose-600 dark:text-rose-400 font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <p className="font-bold text-blue-600 dark:text-blue-400 text-xs">Konfigurasi Batas Kelembapan Ideal (% RH)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 mb-1">Min Kelembapan (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="40.0"
                        value={minHum}
                        onChange={(e) => setMinHum(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-blue-600 dark:text-blue-400 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 mb-1">Max Kelembapan (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="60.0"
                        value={maxHum}
                        onChange={(e) => setMaxHum(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-blue-600 dark:text-blue-400 font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>

              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActiveCheck"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-cyan-600 focus:ring-cyan-500"
                />
                <label htmlFor="isActiveCheck" className="text-slate-700 dark:text-slate-300 font-medium">
                  Status Ruangan Aktif untuk Pencatatan
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
                  Simpan Ruangan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Room Modal */}
      {deletingRoomId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-900 dark:text-white">
            <div className="p-3 bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 rounded-xl text-rose-600 dark:text-rose-400 inline-block">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold">Konfirmasi Hapus Ruangan</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                Apakah Anda yakin ingin menghapus master ruangan ini dari sistem?
              </p>
            </div>

            <div className="pt-3 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setDeletingRoomId(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/20"
              >
                Ya, Hapus Ruangan
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
