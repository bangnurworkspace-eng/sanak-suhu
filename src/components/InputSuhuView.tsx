import React, { useState, useEffect, useMemo } from 'react';
import {
  PlusCircle,
  Thermometer,
  Calendar,
  Clock,
  User as UserIcon,
  FileText,
  Building2,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Check,
  Droplets,
  Lock,
} from 'lucide-react';
import { Room, User, TemperatureRecord } from '../types/simonsu';
import {
  calculateTemperatureStatus,
  calculateHumidityStatus,
  logAudit,
  getUserAssignedRooms,
  isUserUnrestrictedRooms,
  canUserAccessRoom,
} from '../utils/storage';

interface InputSuhuViewProps {
  rooms: Room[];
  currentUser: User;
  onSaveRecord: (newRecord: TemperatureRecord) => void;
  onNavigate: (page: string) => void;
}

export const InputSuhuView: React.FC<InputSuhuViewProps> = ({
  rooms,
  currentUser,
  onSaveRecord,
  onNavigate,
}) => {
  const isUnrestricted = isUserUnrestrictedRooms(currentUser);

  // Filter active rooms strictly assigned to the current user
  const activeRooms = useMemo(() => {
    return getUserAssignedRooms(currentUser, rooms, true);
  }, [rooms, currentUser]);

  const isSingleAssignedRoom = !isUnrestricted && activeRooms.length === 1;

  // Form states
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('');
  const [temperature, setTemperature] = useState<string>('');
  const [humidity, setHumidity] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Notification & Validation state
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Initialize date, time, and room selection
  useEffect(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    setDate(`${y}-${m}-${d}`);

    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setTime(`${hh}:${mm}`);

    if (activeRooms.length > 0) {
      // Auto select first assigned room if current selection invalid
      if (!selectedRoomId || !activeRooms.some((r) => r.id === selectedRoomId)) {
        setSelectedRoomId(activeRooms[0].id);
      }
    } else {
      setSelectedRoomId('');
    }
  }, [activeRooms]);

  // Selected room details
  const selectedRoom = activeRooms.find((r) => r.id === selectedRoomId);

  // Preview status when temperature is entered
  let previewStatus: 'NORMAL' | 'PERHATIAN' | 'KRITIS' | null = null;
  const parsedTemp = parseFloat(temperature);
  if (selectedRoom && !isNaN(parsedTemp)) {
    previewStatus = calculateTemperatureStatus(parsedTemp, selectedRoom);
  }

  let previewHumidityStatus: 'NORMAL' | 'PERHATIAN' | 'KRITIS' | null = null;
  const parsedHum = parseFloat(humidity);
  if (selectedRoom && !isNaN(parsedHum)) {
    previewHumidityStatus = calculateHumidityStatus(parsedHum, selectedRoom);
  }

  // Handle Temp Input (Strictly decimal/numeric, including negative chiller/freezer values)
  const handleTempChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
      setTemperature(val);
      if (errors.temperature) {
        setErrors((prev) => ({ ...prev, temperature: '' }));
      }
    }
  };

  // Handle Humidity Input
  const handleHumChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '' || /^\d*\.?\d*$/.test(val)) {
      setHumidity(val);
      if (errors.humidity) {
        setErrors((prev) => ({ ...prev, humidity: '' }));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    if (!selectedRoomId) {
      newErrors.roomId = 'Ruangan wajib dipilih dari penugasan Anda.';
    }

    if (!date) {
      newErrors.date = 'Tanggal wajib diisi.';
    }

    if (!time) {
      newErrors.time = 'Waktu pencatatan wajib diisi.';
    }

    if (!temperature || isNaN(parsedTemp)) {
      newErrors.temperature = 'Suhu harus diisi angka yang valid (contoh: 23.5).';
    } else if (parsedTemp < -50 || parsedTemp > 100) {
      newErrors.temperature = 'Nilai suhu di luar batas wajar termometer (-50°C s/d 100°C).';
    }

    if (humidity && isNaN(parsedHum)) {
      newErrors.humidity = 'Kelembapan harus diisi angka yang valid (contoh: 55.0).';
    } else if (humidity && (parsedHum < 0 || parsedHum > 100)) {
      newErrors.humidity = 'Nilai kelembapan harus antara 0% s/d 100% RH.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (!selectedRoom || !canUserAccessRoom(currentUser, selectedRoom, rooms)) {
      setErrors({ roomId: 'Anda tidak memiliki akses untuk menginput data pada ruangan tersebut.' });
      return;
    }

    const calculatedStatus = calculateTemperatureStatus(parsedTemp, selectedRoom);
    const calculatedHumStatus = !isNaN(parsedHum) ? calculateHumidityStatus(parsedHum, selectedRoom) : undefined;

    const newRecord: TemperatureRecord = {
      id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      room_id: selectedRoom.id,
      room_code: selectedRoom.code,
      room_name: selectedRoom.name,
      date,
      time,
      temperature: parsedTemp,
      humidity: !isNaN(parsedHum) ? parsedHum : undefined,
      status: calculatedStatus,
      humidity_status: calculatedHumStatus,
      notes: notes.trim(),
      recorded_by: currentUser.name,
      recorded_by_id: currentUser.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Audit Log Entry (saved before onSaveRecord so Audit_Log sheet is immediately synced with this entry)
    logAudit(
      currentUser,
      'INPUT_SUHU',
      `${currentUser.name} mencatat suhu & kelembapan ${selectedRoom.name} (${selectedRoom.code}): ${parsedTemp}°C${!isNaN(parsedHum) ? `, ${parsedHum}% RH` : ''} [Status: ${calculatedStatus}]`,
      newRecord.id
    );

    onSaveRecord(newRecord);

    // Success Toast
    setSuccessMessage('Data suhu dan kelembapan berhasil disimpan.');
    setErrors({});

    // Reset notes, temp, and humidity for next entry
    setTemperature('');
    setHumidity('');
    setNotes('');

    // Hide success after 4 seconds
    setTimeout(() => {
      setSuccessMessage(null);
    }, 4000);
  };

  const isAccessRestricted = activeRooms.length === 0;

  return (
    <div className="w-full space-y-6">
      
      {/* Header Title */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-xl transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-cyan-500 to-blue-600 text-white rounded-xl shadow-md shadow-cyan-500/20">
            <PlusCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white font-poppins">Input Suhu Ruangan</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Pencatatan manual suhu ruangan laboratorium sesuai tanggung jawab akun petugas.
            </p>
          </div>
        </div>
      </div>

      {/* Access Restriction Warning Banner if No Assigned Rooms */}
      {isAccessRestricted && (
        <div className="p-5 bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-start gap-3.5 text-amber-900 dark:text-amber-200 text-xs shadow-md">
          <Lock className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-amber-900 dark:text-amber-200">Akses Ruangan Belum Diatur</h4>
            <p className="leading-relaxed">
              Akun Anda (<strong>@{currentUser.username}</strong>) belum diberikan penugasan akses ruangan. Penginputan suhu & kelembapan hanya dapat dilakukan pada ruangan yang telah ditugaskan kepada Anda oleh Administrator.
            </p>
            <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 pt-1">
              Hubungi Administrator Sistem untuk mengatur penugasan ruangan pada menu Manajemen User.
            </p>
          </div>
        </div>
      )}

      {/* Success Notification Alert */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/90 border border-emerald-300 dark:border-emerald-700/80 rounded-2xl shadow-lg flex items-center justify-between text-emerald-900 dark:text-emerald-200 animate-in fade-in zoom-in-95">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 dark:bg-emerald-800 rounded-xl text-white">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-emerald-800 dark:text-emerald-300">{successMessage}</h4>
              <p className="text-xs text-emerald-700 dark:text-emerald-200/80">Data telah masuk ke Dashboard, Data Suhu, Grafik, dan Laporan.</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('data')}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors shrink-0"
          >
            Lihat Data Suhu →
          </button>
        </div>
      )}

      {/* Main Input Form */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-xl space-y-6 transition-colors">
        
        {/* Section 1: Room Selection & Range Preview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /> Ruangan Laboratorium <span className="text-rose-500">*</span>
            </label>
            <span className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-400">
              {isUnrestricted
                ? '🔑 Akses Penuh Semua Ruangan'
                : activeRooms.length === 0
                  ? '🔒 Belum Ada Ruangan Ditugaskan'
                  : isSingleAssignedRoom
                    ? '🔒 Khusus Ruangan Anda'
                    : `🔒 ${activeRooms.length} Ruangan Ditugaskan kepada Anda`}
            </span>
          </div>

          {isSingleAssignedRoom ? (
            <div className="w-full bg-slate-100 dark:bg-slate-950 border border-cyan-300 dark:border-cyan-800/80 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Lock className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                <span className="font-bold truncate">
                  [{activeRooms[0].code}] {activeRooms[0].name}
                </span>
                <span className="hidden sm:inline text-xs text-slate-500 dark:text-slate-400 shrink-0">
                  (Suhu: {activeRooms[0].min_temperature}°C s.d {activeRooms[0].max_temperature}°C)
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 shrink-0">
                Terkunci
              </span>
            </div>
          ) : (
            <select
              disabled={isAccessRestricted}
              value={selectedRoomId}
              onChange={(e) => {
                setSelectedRoomId(e.target.value);
                if (errors.roomId) setErrors((prev) => ({ ...prev, roomId: '' }));
              }}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-cyan-500 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none transition-colors disabled:opacity-50"
            >
              {isAccessRestricted ? (
                <option value="">-- Belum Memiliki Akses Ruangan --</option>
              ) : (
                <>
                  <option value="" disabled>-- Pilih Ruangan Laboratorium --</option>
                  {activeRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      [{r.code}] {r.name} — (Suhu: {r.min_temperature}°C s.d {r.max_temperature}°C)
                    </option>
                  ))}
                </>
              )}
            </select>
          )}
          {errors.roomId && <p className="text-xs text-rose-500 font-medium">{errors.roomId}</p>}

          {/* Selected Room Limit Badge */}
          {selectedRoom && (
            <div className="p-3 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
              <div className="text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-900 dark:text-slate-200">{selectedRoom.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Target Normal:</span>
                <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 font-mono font-bold rounded-lg">
                  {selectedRoom.min_temperature.toFixed(1)}°C – {selectedRoom.max_temperature.toFixed(1)}°C
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Date & Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* Tanggal */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /> Tanggal <span className="text-rose-500">*</span>
            </label>
            <input
              disabled={isAccessRestricted}
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                if (errors.date) setErrors((prev) => ({ ...prev, date: '' }));
              }}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-cyan-500 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition-colors font-mono disabled:opacity-50"
            />
            {errors.date && <p className="text-xs text-rose-500 font-medium">{errors.date}</p>}
          </div>

          {/* Jam / Waktu */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /> Waktu (Jam) <span className="text-rose-500">*</span>
            </label>
            <input
              disabled={isAccessRestricted}
              type="time"
              value={time}
              onChange={(e) => {
                setTime(e.target.value);
                if (errors.time) setErrors((prev) => ({ ...prev, time: '' }));
              }}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-cyan-500 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition-colors font-mono disabled:opacity-50"
            />
            {errors.time && <p className="text-xs text-rose-500 font-medium">{errors.time}</p>}
          </div>

        </div>

        {/* Section 3: Temperature (°C) & Humidity (% RH) Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* Suhu */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Thermometer className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /> Suhu Terukur (°C) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                disabled={isAccessRestricted}
                type="text"
                inputMode="decimal"
                placeholder="Contoh: 23.5"
                value={temperature}
                onChange={handleTempChange}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-cyan-500 rounded-xl px-4 py-3 text-lg font-bold font-mono text-slate-900 dark:text-white focus:outline-none transition-colors disabled:opacity-50"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">°C</span>
            </div>
            {errors.temperature && <p className="text-xs text-rose-500 font-medium">{errors.temperature}</p>}

            {/* Realtime Temperature Status Preview */}
            {previewStatus && selectedRoom && (
              <div className="pt-1">
                {previewStatus === 'NORMAL' ? (
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800/80 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Suhu Normal ({parsedTemp.toFixed(1)}°C dalam batas aman)</span>
                  </div>
                ) : previewStatus === 'PERHATIAN' ? (
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800/80 rounded-xl text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Perhatian! Suhu mendekati batas kritis ({parsedTemp.toFixed(1)}°C)</span>
                  </div>
                ) : (
                  <div className="p-2.5 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800/80 rounded-xl text-rose-800 dark:text-rose-300 text-xs font-bold flex items-center gap-2 animate-pulse">
                    <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    <span>Peringatan Kritis! Suhu di luar batas aman standar!</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Kelembapan */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Droplets className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Kelembapan Nisbi (% RH)
            </label>
            <div className="relative">
              <input
                disabled={isAccessRestricted}
                type="text"
                inputMode="decimal"
                placeholder="Contoh: 52.0"
                value={humidity}
                onChange={handleHumChange}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-cyan-500 rounded-xl px-4 py-3 text-lg font-bold font-mono text-slate-900 dark:text-white focus:outline-none transition-colors disabled:opacity-50"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">% RH</span>
            </div>
            {errors.humidity && <p className="text-xs text-rose-500 font-medium">{errors.humidity}</p>}

            {/* Realtime Humidity Preview */}
            {previewHumidityStatus && selectedRoom && (
              <div className="pt-1">
                {previewHumidityStatus === 'NORMAL' ? (
                  <div className="p-2.5 bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800/80 rounded-xl text-blue-800 dark:text-blue-300 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Kelembapan Normal ({parsedHum.toFixed(1)}% RH)</span>
                  </div>
                ) : (
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800/80 rounded-xl text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Kelembapan Luar Batas Standar ({parsedHum.toFixed(1)}% RH)</span>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Section 4: Officer / Petugas Info */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-bold flex items-center justify-center">
              <UserIcon className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Petugas Pencatat</span>
              <span className="font-bold text-slate-900 dark:text-white">{currentUser.name}</span>
              <span className="text-slate-500 dark:text-slate-400 ml-1 font-mono">({currentUser.position})</span>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/80 rounded-lg font-bold uppercase text-[10px]">
            {currentUser.role}
          </span>
        </div>

        {/* Section 5: Notes */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /> Catatan Tambahan (Opsional)
          </label>
          <textarea
            disabled={isAccessRestricted}
            rows={2}
            placeholder="Contoh: AC kamar pendingin berfungsi normal, cuaca di luar hujan deras..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-cyan-500 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none transition-colors disabled:opacity-50"
          />
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors"
          >
            Batal
          </button>
          <button
            disabled={isAccessRestricted}
            type="submit"
            className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>Simpan Pencatatan Suhu</span>
          </button>
        </div>

      </form>

    </div>
  );
};
