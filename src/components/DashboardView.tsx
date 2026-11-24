import React from 'react';
import {
  Building2,
  CalendarCheck,
  CheckCircle2,
  AlertTriangle,
  PlusCircle,
  Thermometer,
  Droplets,
  ArrowUpRight,
  Info,
  Clock,
  User,
  ShieldAlert,
} from 'lucide-react';
import { Room, TemperatureRecord, TemperatureStatus, User as UserType } from '../types/simonsu';
import {
  formatDateIndonesia,
  getLocalDateString,
  calculateHumidityStatus,
  isUserUnrestrictedRooms,
} from '../utils/storage';

interface DashboardViewProps {
  rooms: Room[];
  records: TemperatureRecord[];
  currentUser?: UserType;
  onNavigate: (page: string) => void;
  onClearAllData: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  rooms,
  records,
  currentUser,
  onNavigate,
}) => {
  const todayStr = getLocalDateString();

  const getHumStatus = (r: TemperatureRecord): TemperatureStatus => {
    if (r.humidity_status) return r.humidity_status;
    if (r.humidity === undefined || r.humidity === null || isNaN(r.humidity)) return 'NORMAL';
    const rm = rooms.find((room) => room.id === r.room_id || room.code === r.room_code);
    return rm ? calculateHumidityStatus(r.humidity, rm) : 'NORMAL';
  };

  // Today's records (Temperature & Humidity)
  const todayRecords = records.filter((r) => r.date === todayStr);
  const todayHumidityRecords = todayRecords.filter(
    (r) => r.humidity !== undefined && r.humidity !== null && !isNaN(r.humidity)
  );
  const totalTodayTempCount = todayRecords.length;
  const totalTodayHumidityCount = todayHumidityRecords.length;

  const normalTempTodayCount = todayRecords.filter((r) => r.status === 'NORMAL').length;
  const normalHumTodayCount = todayHumidityRecords.filter(
    (r) => getHumStatus(r) === 'NORMAL'
  ).length;

  const attentionTempTodayCount = todayRecords.filter(
    (r) => r.status === 'PERHATIAN' || r.status === 'KRITIS'
  ).length;
  const attentionHumTodayCount = todayHumidityRecords.filter((r) => {
    const hs = getHumStatus(r);
    return hs === 'PERHATIAN' || hs === 'KRITIS';
  }).length;
  const totalAttentionToday = attentionTempTodayCount + attentionHumTodayCount;

  // Overall totals across all recorded history
  const totalTempCount = records.length;
  const avgTempAll =
    totalTempCount > 0
      ? (records.reduce((sum, r) => sum + r.temperature, 0) / totalTempCount).toFixed(1)
      : null;

  const humidityRecords = records.filter(
    (r) => r.humidity !== undefined && r.humidity !== null && !isNaN(r.humidity)
  );
  const totalHumidityCount = humidityRecords.length;
  const avgHumAll =
    totalHumidityCount > 0
      ? (humidityRecords.reduce((sum, r) => sum + (r.humidity as number), 0) / totalHumidityCount).toFixed(1)
      : null;

  // Sorted chronological desc records
  const sortedRecords = [...records].sort((a, b) => {
    const dtA = `${a.date} ${a.time}`;
    const dtB = `${b.date} ${b.time}`;
    return dtB.localeCompare(dtA);
  });

  // Latest 8 records for Monitoring Terakhir table
  const recentRecords = sortedRecords.slice(0, 8);

  const activeRooms = rooms.filter((r) => r.is_active);

  return (
    <div className="w-full space-y-6">
      
      {/* Top Banner Notice */}
      <div className="bg-gradient-to-r from-cyan-900 via-blue-900 to-slate-900 text-white border border-cyan-700/50 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 shrink-0 mt-0.5 sm:mt-0">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Pencatatan Suhu Ruangan Manual
              <span className="text-[10px] bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-800 font-semibold">
                SOP UPT Labkes • Sinkron Otomatis 8 Sheet
              </span>
            </h3>
            <p className="text-xs text-slate-200 mt-1">
              Setiap petugas wajib mencatat suhu ruangan laboratorium secara berkala. Seluruh perubahan otomatis tersinkronisasi ke 8 Sheet Google Spreadsheet tanpa login Gmail.
            </p>
            {currentUser && !isUserUnrestrictedRooms(currentUser) && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                  Ruangan Tugas Anda:
                </span>
                {activeRooms.length > 0 ? (
                  activeRooms.map((r) => (
                    <span
                      key={r.id}
                      className="text-[10px] bg-cyan-950/90 text-cyan-200 px-2 py-0.5 rounded-md border border-cyan-700/70 font-mono font-bold"
                    >
                      [{r.code}] {r.name}
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] bg-amber-950/80 text-amber-200 px-2 py-0.5 rounded-md border border-amber-700 font-semibold">
                    Belum Ada Ruangan Ditugaskan
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto shrink-0">
          <button
            onClick={() => onNavigate('input')}
            className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-md shadow-cyan-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Input Suhu Baru</span>
          </button>
        </div>
      </div>

      {/* 6 Summary Cards (Hari Ini & Total Keseluruhan) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 xl:gap-6 w-full">
        
        {/* Card 1: Total Ruangan */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-lg relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Ruangan</span>
              <div className="p-2.5 rounded-xl bg-cyan-50 dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 border border-cyan-100 dark:border-slate-700">
                <Building2 className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-poppins">{activeRooms.length}</span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Ruangan Aktif</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Terdaftar di Master</span>
            <button
              onClick={() => onNavigate('master')}
              className="text-cyan-600 dark:text-cyan-400 hover:underline font-semibold flex items-center gap-0.5"
            >
              Kelola <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Card 2: Pencatatan Hari Ini (2 Angka: Suhu & Kelembapan) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-lg relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pencatatan Hari Ini</span>
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-slate-700">
                <CalendarCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-100 dark:border-slate-800/80">
                <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">Suhu (°C)</div>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white font-poppins mt-0.5">{totalTodayTempCount}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-100 dark:border-slate-800/80">
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Kelembapan</div>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white font-poppins mt-0.5">{totalTodayHumidityCount}</div>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Tanggal: {formatDateIndonesia(todayStr)}</span>
            <button
              onClick={() => onNavigate('data')}
              className="text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-0.5"
            >
              Lihat Histori <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Card 3: Suhu & Kelembapan Normal */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-lg relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Suhu & Kelembapan Normal</span>
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/60">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Suhu Normal</div>
                <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-poppins mt-0.5">{normalTempTodayCount}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">RH Normal</div>
                <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-poppins mt-0.5">{normalHumTodayCount}</div>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Dalam Batas Standar Hari Ini</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">🟢 Safe</span>
          </div>
        </div>

        {/* Card 4: Suhu & Kelembapan Perlu Perhatian */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-lg relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Suhu & Kelembapan Perlu Perhatian</span>
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/60">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="p-2.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/25 border border-amber-100 dark:border-amber-900/40">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Suhu</div>
                <div className={`text-2xl font-extrabold font-poppins mt-0.5 ${attentionTempTodayCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                  {attentionTempTodayCount}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/25 border border-amber-100 dark:border-amber-900/40">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Kelembapan</div>
                <div className={`text-2xl font-extrabold font-poppins mt-0.5 ${attentionHumTodayCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                  {attentionHumTodayCount}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Di Luar Standar Hari Ini</span>
            {totalAttentionToday > 0 ? (
              <span className="text-amber-600 dark:text-amber-400 font-bold animate-pulse">🟡 Perlu Cek</span>
            ) : (
              <span className="text-slate-400 font-medium">Nihil</span>
            )}
          </div>
        </div>

        {/* Card 5: Total Pencatatan Suhu (Keseluruhan) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-lg relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total Pencatatan Suhu
              </span>
              <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-800/60">
                <Thermometer className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-teal-600 dark:text-teal-400 font-poppins">
                {totalTempCount}
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Total Data (°C)
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>
              Rata-rata:{' '}
              <strong className="text-slate-700 dark:text-slate-200 font-mono">
                {avgTempAll !== null ? `${avgTempAll}°C` : '-'}
              </strong>
            </span>
            <button
              onClick={() => onNavigate('data')}
              className="text-teal-600 dark:text-teal-400 hover:underline font-semibold flex items-center gap-0.5"
            >
              Semua Data <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Card 6: Total Pencatatan Kelembapan (Keseluruhan) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-lg relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total Pencatatan Kelembapan
              </span>
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/60">
                <Droplets className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 font-poppins">
                {totalHumidityCount}
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Total Data (% RH)
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>
              Rata-rata:{' '}
              <strong className="text-slate-700 dark:text-slate-200 font-mono">
                {avgHumAll !== null ? `${avgHumAll}% RH` : '-'}
              </strong>
            </span>
            <button
              onClick={() => onNavigate('grafik')}
              className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold flex items-center gap-0.5"
            >
              Grafik RH <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>

      </div>

      {/* Monitoring Terakhir Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm dark:shadow-xl overflow-hidden transition-colors">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Thermometer className="w-5 h-5 text-cyan-600 dark:text-cyan-400" /> Monitoring Terakhir
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Urutan pencatatan suhu paling mutakhir yang diinput oleh petugas.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('input')}
              className="px-3 py-1.5 bg-cyan-50 dark:bg-cyan-950 hover:bg-cyan-100 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/80 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Input Suhu</span>
            </button>
            <button
              onClick={() => onNavigate('data')}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <span>Selengkapnya</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {recentRecords.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Thermometer className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-300">Belum Ada Data Suhu</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Belum terdapat pencatatan suhu. Silakan tambahkan data baru melalui menu Input Suhu.
            </p>
            <button
              onClick={() => onNavigate('input')}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-md shadow-cyan-600/20"
            >
              <PlusCircle className="w-4 h-4" /> + Input Suhu Baru
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">Ruangan</th>
                  <th className="py-3 px-4">Suhu (°C)</th>
                  <th className="py-3 px-4">Kelembapan (% RH)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Petugas</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
                {recentRecords.map((rec) => {
                  const isNormal = rec.status === 'NORMAL';
                  const isPerhatian = rec.status === 'PERHATIAN';
                  return (
                    <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {rec.time}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">{formatDateIndonesia(rec.date)}</div>
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                        <div>{rec.room_name}</div>
                        <div className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono font-bold">{rec.room_code}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="text-sm font-extrabold font-mono text-slate-900 dark:text-cyan-300">
                          {rec.temperature.toFixed(1)}°C
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="text-sm font-extrabold font-mono text-blue-600 dark:text-blue-400">
                          {rec.humidity !== undefined ? `${rec.humidity.toFixed(1)}%` : '-'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {isNormal ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Normal
                          </span>
                        ) : isPerhatian ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80">
                            <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" /> Perhatian
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80">
                            <ShieldAlert className="w-3 h-3 text-rose-600 dark:text-rose-400" /> Kritis
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-medium">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {rec.recorded_by}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => onNavigate('data')}
                          className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline font-semibold"
                        >
                          Detail →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Room Status Cards Grid */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-xl transition-colors">
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-cyan-600 dark:text-cyan-400" /> Acuan Batas Suhu Master Ruangan
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Batas normal & kritis dikonfigurasi secara spesifik untuk setiap ruangan laboratorium.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
          {activeRooms.map((room) => {
            const latestForRoom = sortedRecords.find(
              (r) => r.room_id === room.id || r.room_code === room.code
            );
            return (
              <div
                key={room.id}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-cyan-700 dark:text-cyan-400 font-bold">
                      {room.code}
                    </span>
                    {latestForRoom && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        latestForRoom.status === 'NORMAL'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : latestForRoom.status === 'PERHATIAN'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      }`}>
                        Terakhir: {latestForRoom.temperature.toFixed(1)}°C
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm mt-2">{room.name}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{room.description}</p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-500 dark:text-slate-400">Target Normal:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    {room.min_temperature}°C — {room.max_temperature}°C
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
