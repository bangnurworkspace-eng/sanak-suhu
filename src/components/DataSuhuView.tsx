import React, { useState, useMemo } from 'react';
import {
  Table,
  Search,
  Calendar,
  Building2,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  Clock,
  X,
  Droplets,
  FileSpreadsheet,
} from 'lucide-react';
import { Room, TemperatureRecord, User, DateFilterType, DateRange, TemperatureStatus, RoleConfig } from '../types/simonsu';
import {
  getDateRangeFromFilter,
  filterRecordsByRangeAndRoom,
  formatDateIndonesia,
  calculateTemperatureStatus,
  calculateHumidityStatus,
  getLocalDateString,
  logAudit,
  hasPermission,
  isUserUnrestrictedRooms,
  canUserAccessRoom,
} from '../utils/storage';
import { SPREADSHEET_URL } from '../utils/googleSheets';

interface DataSuhuViewProps {
  rooms: Room[];
  records: TemperatureRecord[];
  currentUser: User;
  roleConfigs?: Record<string, RoleConfig>;
  onNavigate: (page: string) => void;
  onUpdateRecord: (updatedRecord: TemperatureRecord) => void;
  onDeleteRecord: (recordId: string) => void;
}

export const DataSuhuView: React.FC<DataSuhuViewProps> = ({
  rooms,
  records,
  currentUser,
  roleConfigs = {},
  onNavigate,
  onUpdateRecord,
  onDeleteRecord,
}) => {
  const isUnrestricted = isUserUnrestrictedRooms(currentUser);
  const isSingleRoomOnly = !isUnrestricted && rooms.length === 1;
  const canEditData = hasPermission(currentUser.role, 'data_edit', roleConfigs);
  const canDeleteData = hasPermission(currentUser.role, 'data_delete', roleConfigs);
  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<DateFilterType>('last30');
  const [customRange, setCustomRange] = useState<DateRange>({
    startDate: getLocalDateString(new Date(Date.now() - 7 * 86400000)),
    endDate: getLocalDateString(),
  });
  const [selectedRoomId, setSelectedRoomId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Edit Modal State
  const [editingRecord, setEditingRecord] = useState<TemperatureRecord | null>(null);
  const [editTemp, setEditTemp] = useState('');
  const [editHum, setEditHum] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Modal State
  const [deletingRecord, setDeletingRecord] = useState<TemperatureRecord | null>(null);

  // Sync feedback banner state
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  // Compute Active Date Range
  const activeRange = useMemo(() => {
    return getDateRangeFromFilter(filterType, customRange);
  }, [filterType, customRange]);

  const effectiveRoomId = isSingleRoomOnly
    ? rooms[0].id
    : selectedRoomId !== 'ALL' && !rooms.some((r) => r.id === selectedRoomId)
      ? 'ALL'
      : selectedRoomId;

  const selectedRoomObj = useMemo(
    () => rooms.find((r) => r.id === effectiveRoomId),
    [rooms, effectiveRoomId]
  );

  // Filtered & Searched Records
  const filteredRecords = useMemo(() => {
    let result = filterRecordsByRangeAndRoom(
      records,
      activeRange,
      effectiveRoomId,
      selectedStatus,
      selectedRoomObj?.code
    );

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          (r.room_name && r.room_name.toLowerCase().includes(q)) ||
          (r.room_code && r.room_code.toLowerCase().includes(q)) ||
          r.recorded_by.toLowerCase().includes(q) ||
          (r.notes && r.notes.toLowerCase().includes(q))
      );
    }

    return result.sort((a, b) => {
      const dtA = `${a.date} ${a.time}`;
      const dtB = `${b.date} ${b.time}`;
      return sortOrder === 'desc' ? dtB.localeCompare(dtA) : dtA.localeCompare(dtB);
    });
  }, [records, activeRange, effectiveRoomId, selectedRoomObj, selectedStatus, searchQuery, sortOrder]);

  // Paginated records (clamp page so deletions/filtering never leave user on an empty out-of-range page)
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRecords = useMemo(() => {
    const start = (safePage - 1) * itemsPerPage;
    return filteredRecords.slice(start, start + itemsPerPage);
  }, [filteredRecords, safePage]);

  // Open Edit Modal
  const handleOpenEdit = (rec: TemperatureRecord) => {
    setEditingRecord(rec);
    setEditTemp(rec.temperature.toString());
    setEditHum(rec.humidity !== undefined ? rec.humidity.toString() : '');
    setEditNotes(rec.notes || '');
    setEditDate(rec.date);
    setEditTime(rec.time);
    setEditError(null);
  };

  // Submit Edit Record
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    if (!editingRecord || !canEditData || !canUserAccessRoom(currentUser, editingRecord, rooms)) return;
    if (!editDate || !editTime) {
      setEditError('Tanggal dan waktu pencatatan wajib diisi.');
      return;
    }

    const parsedTemp = parseFloat(editTemp);
    if (isNaN(parsedTemp) || parsedTemp < -50 || parsedTemp > 100) {
      setEditError('Nilai suhu harus antara -50°C s/d 100°C.');
      return;
    }

    const parsedHum = editHum.trim() !== '' ? parseFloat(editHum) : undefined;
    if (parsedHum !== undefined && (isNaN(parsedHum) || parsedHum < 0 || parsedHum > 100)) {
      setEditError('Nilai kelembapan harus antara 0% s/d 100% RH.');
      return;
    }

    const room =
      rooms.find((r) => r.id === editingRecord.room_id) ||
      rooms.find((r) => r.code === editingRecord.room_code);
    const newStatus: TemperatureStatus = room
      ? calculateTemperatureStatus(parsedTemp, room)
      : editingRecord.status;
    const newHumStatus =
      room && parsedHum !== undefined ? calculateHumidityStatus(parsedHum, room) : undefined;

    const updated: TemperatureRecord = {
      ...editingRecord,
      room_id: room ? room.id : editingRecord.room_id,
      room_code: room ? room.code : editingRecord.room_code,
      room_name: room ? room.name : editingRecord.room_name,
      temperature: parsedTemp,
      humidity: parsedHum,
      humidity_status: newHumStatus,
      date: editDate,
      time: editTime,
      notes: editNotes.trim() || undefined,
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    logAudit(
      currentUser,
      'EDIT_SUHU',
      `${currentUser.name} mengubah data suhu & kelembapan ${editingRecord.room_name}: ${editingRecord.temperature}°C → ${parsedTemp}°C`,
      editingRecord.id,
      `${editingRecord.temperature}°C`,
      `${parsedTemp}°C`
    );

    onUpdateRecord(updated);
    setEditingRecord(null);
    setSyncStatusMsg(`Data suhu ${editingRecord.room_name} berhasil diperbarui di aplikasi & Google Spreadsheet.`);
    setTimeout(() => setSyncStatusMsg(null), 4000);
  };

  // Confirm Delete Record
  const handleConfirmDelete = () => {
    if (!deletingRecord || !canDeleteData || !canUserAccessRoom(currentUser, deletingRecord, rooms)) return;

    logAudit(
      currentUser,
      'HAPUS_SUHU',
      `${currentUser.name} menghapus data suhu ${deletingRecord.room_name} (${deletingRecord.temperature}°C pada ${deletingRecord.date})`,
      deletingRecord.id
    );

    onDeleteRecord(deletingRecord.id);
    setDeletingRecord(null);
    setSyncStatusMsg(`Data suhu ${deletingRecord.room_name} berhasil dihapus dari aplikasi & seluruh Sheet Google Spreadsheet.`);
    setTimeout(() => setSyncStatusMsg(null), 4000);
  };

  return (
    <div className="w-full space-y-6">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-cyan-500 to-blue-600 text-white rounded-xl shadow-md shadow-cyan-500/20">
            <Table className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white font-poppins">Data Suhu Ruangan</h2>
              <span className="px-2 py-0.5 rounded-md bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 font-mono text-[10px] font-bold border border-cyan-200 dark:border-cyan-800">
                Sheet: Data_Suhu
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Riwayat histori lengkap pencatatan suhu ruangan laboratorium.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigate('input')}
            className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-md shadow-cyan-500/20 flex items-center gap-2 transition-all hover:scale-[1.02]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Input Suhu Baru</span>
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncStatusMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 rounded-2xl flex items-center justify-between text-emerald-900 dark:text-emerald-200 text-xs font-bold animate-in fade-in">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{syncStatusMsg}</span>
          </div>
          <a
            href={SPREADSHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-emerald-700 dark:text-emerald-300 font-bold hover:text-emerald-900 ml-2 shrink-0"
          >
            Buka Spreadsheet ↗
          </a>
        </div>
      )}

      {/* Date Quick Filter Bar & Custom Filter */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-xl space-y-4 transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /> Filter Tanggal & Periode
          </div>

          {/* Quick Date Options */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'today', label: 'Hari ini' },
              { id: 'yesterday', label: 'Kemarin' },
              { id: 'last7', label: '7 Hari Terakhir' },
              { id: 'last30', label: '30 Hari Terakhir' },
              { id: 'thisMonth', label: 'Bulan Ini' },
              { id: 'all', label: 'Semua' },
              { id: 'custom', label: 'Custom' },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => {
                  setFilterType(btn.id as DateFilterType);
                  setCurrentPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  filterType === btn.id
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Range Inputs */}
        {filterType === 'custom' && (
          <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-600 dark:text-slate-400 font-medium">Dari:</span>
              <input
                type="date"
                value={customRange.startDate}
                onChange={(e) => setCustomRange((prev) => ({ ...prev, startDate: e.target.value }))}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-600 dark:text-slate-400 font-medium">Sampai:</span>
              <input
                type="date"
                value={customRange.endDate}
                onChange={(e) => setCustomRange((prev) => ({ ...prev, endDate: e.target.value }))}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        )}

        {/* Search, Room, and Status Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari ruangan, petugas, atau catatan..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-cyan-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none transition-colors"
            />
          </div>

          {/* Filter Room */}
          <div className="relative">
            <select
              disabled={isSingleRoomOnly || rooms.length === 0}
              value={effectiveRoomId}
              onChange={(e) => {
                setSelectedRoomId(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-cyan-500 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none transition-colors disabled:opacity-75"
            >
              {rooms.length === 0 ? (
                <option value="ALL">-- Belum Ada Akses Ruangan --</option>
              ) : isSingleRoomOnly ? (
                <option value={rooms[0].id}>
                  🔒 [{rooms[0].code}] {rooms[0].name}
                </option>
              ) : (
                <>
                  <option value="ALL">{isUnrestricted ? 'Semua Ruangan' : 'Semua Ruangan Anda'}</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      [{r.code}] {r.name}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* Filter Status */}
          <div className="relative">
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-cyan-500 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none transition-colors"
            >
              <option value="ALL">Semua Status</option>
              <option value="NORMAL">🟢 Normal</option>
              <option value="PERHATIAN">🟡 Perhatian</option>
              <option value="KRITIS">🔴 Kritis</option>
            </select>
          </div>

        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm dark:shadow-xl overflow-hidden transition-colors">
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
          <div>
            Menampilkan <span className="font-bold text-slate-900 dark:text-white">{filteredRecords.length}</span> data pencatatan suhu
          </div>
          <button
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            className="text-cyan-600 dark:text-cyan-400 hover:underline font-semibold"
          >
            Urutan: {sortOrder === 'desc' ? 'Terbaru → Terlama' : 'Terlama → Terbaru'}
          </button>
        </div>

        {paginatedRecords.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Table className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto" />
            <h4 className="text-base font-bold text-slate-700 dark:text-slate-300">Belum Ada Data Suhu</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Belum terdapat pencatatan suhu untuk periode atau filter yang dipilih. Silakan sesuaikan filter atau tambahkan data baru.
            </p>
            <button
              onClick={() => onNavigate('input')}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl inline-flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" /> + Input Suhu
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">Tanggal & Waktu</th>
                  <th className="py-3 px-4">Ruangan</th>
                  <th className="py-3 px-4">Suhu (°C)</th>
                  <th className="py-3 px-4">Kelembapan (% RH)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Petugas</th>
                  <th className="py-3 px-4">Catatan</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
                {paginatedRecords.map((rec, index) => {
                  const itemIndex = (safePage - 1) * itemsPerPage + index + 1;
                  const isNormal = rec.status === 'NORMAL';
                  const isPerhatian = rec.status === 'PERHATIAN';

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 text-center text-slate-400 font-mono">
                        {itemIndex}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{formatDateIndonesia(rec.date)}</div>
                        <div className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-slate-400" /> {rec.time} WITA
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{rec.room_name}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{rec.room_code}</div>
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
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Normal
                          </span>
                        ) : isPerhatian ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" /> Perhatian
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            <ShieldAlert className="w-3 h-3 text-rose-600 dark:text-rose-400" /> Kritis
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                        {rec.recorded_by}
                      </td>

                      <td className="py-3.5 px-4 max-w-[200px] truncate text-slate-500 dark:text-slate-400">
                        {rec.notes || '-'}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {canEditData && canUserAccessRoom(currentUser, rec, rooms) && (
                            <button
                              onClick={() => handleOpenEdit(rec)}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-cyan-600 dark:text-cyan-400 transition-colors"
                              title="Edit Data Suhu"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDeleteData && canUserAccessRoom(currentUser, rec, rooms) && (
                            <button
                              onClick={() => setDeletingRecord(rec)}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-950 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                              title="Hapus Data Suhu"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {(!canEditData && !canDeleteData) || !canUserAccessRoom(currentUser, rec, rooms) ? (
                            <span className="text-[10px] text-slate-400 font-mono">-</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              Halaman <span className="font-bold text-slate-900 dark:text-white">{safePage}</span> dari{' '}
              <span className="font-bold text-slate-900 dark:text-white">{totalPages}</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                disabled={safePage === 1}
                onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-40 text-slate-800 dark:text-slate-200 transition-colors flex items-center gap-1 shadow-sm"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <button
                disabled={safePage === totalPages}
                onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-40 text-slate-800 dark:text-slate-200 transition-colors flex items-center gap-1 shadow-sm"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingRecord && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-cyan-600 dark:text-cyan-400" /> Edit Pencatatan Suhu
              </h3>
              <button
                onClick={() => setEditingRecord(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              {editError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-300 text-xs font-medium">
                  {editError}
                </div>
              )}

              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                <div className="font-bold text-slate-900 dark:text-white">{editingRecord.room_name}</div>
                <div className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono font-bold">{editingRecord.room_code}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Tanggal</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Waktu</label>
                  <input
                    type="time"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Suhu (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editTemp}
                    onChange={(e) => setEditTemp(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-base font-mono font-bold text-slate-900 dark:text-cyan-300"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Kelembapan (% RH)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Contoh: 50.0"
                    value={editHum}
                    onChange={(e) => setEditHum(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-base font-mono font-bold text-slate-900 dark:text-blue-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Catatan</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-slate-200"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingRecord && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-900 dark:text-white">
            <div className="p-3 bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 rounded-xl text-rose-600 dark:text-rose-400 inline-block">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold">Konfirmasi Hapus Data</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                Apakah Anda yakin ingin menghapus data suhu ini?
              </p>
              <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs space-y-1">
                <div className="font-bold">{deletingRecord.room_name}</div>
                <div className="text-cyan-600 dark:text-cyan-400 font-mono font-bold">
                  {deletingRecord.temperature.toFixed(1)}°C • {formatDateIndonesia(deletingRecord.date)} ({deletingRecord.time})
                </div>
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setDeletingRecord(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/20"
              >
                Ya, Hapus Data
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
