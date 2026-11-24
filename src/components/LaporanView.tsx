import React, { useState, useMemo } from 'react';
import {
  FileText,
  Building2,
  Calendar,
  FileSpreadsheet,
  FileCheck,
  Printer,
  Table,
  Settings2,
  X,
  Check,
  UserCheck,
  FileSignature,
  RotateCcw,
  LineChart as LineChartIcon,
  Droplets,
  Thermometer,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  Legend,
} from 'recharts';
import { Room, TemperatureRecord, DateFilterType, DateRange, RoomStatsSummary, PdfExportOptions, User } from '../types/simonsu';
import {
  getDateRangeFromFilter,
  filterRecordsByRangeAndRoom,
  formatDateIndonesia,
  getLocalDateString,
  isUserUnrestrictedRooms,
} from '../utils/storage';
import { exportToExcel, exportToPDF, DEFAULT_PDF_OPTIONS } from '../utils/exportHelpers';

interface LaporanViewProps {
  rooms: Room[];
  records: TemperatureRecord[];
  currentUser?: User;
}

export const LaporanView: React.FC<LaporanViewProps> = ({ rooms, records, currentUser }) => {
  const activeRooms = rooms.filter((r) => r.is_active);
  const isUnrestricted = !currentUser || isUserUnrestrictedRooms(currentUser);
  const isSingleRoomOnly = !isUnrestricted && activeRooms.length === 1;

  // Filter States
  const [selectedRoomId, setSelectedRoomId] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<DateFilterType>('thisMonth');
  const [customRange, setCustomRange] = useState<DateRange>({
    startDate: getLocalDateString(new Date(Date.now() - 30 * 86400000)),
    endDate: getLocalDateString(),
  });

  // Chart Metric & Line Curve Style on Screen Preview
  const [previewMetric, setPreviewMetric] = useState<'temperature' | 'humidity' | 'both'>('both');
  const [lineCurve, setLineCurve] = useState<'monotone' | 'linear'>('monotone');

  // PDF Modal & Config States
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [pdfOptions, setPdfOptions] = useState<PdfExportOptions>(DEFAULT_PDF_OPTIONS);

  const activeRange = useMemo(() => {
    return getDateRangeFromFilter(filterType, customRange);
  }, [filterType, customRange]);

  const effectiveRoomId = isSingleRoomOnly
    ? activeRooms[0].id
    : selectedRoomId !== 'ALL' && !activeRooms.some((r) => r.id === selectedRoomId)
      ? 'ALL'
      : selectedRoomId;

  // Selected Room Object
  const selectedRoomObj = useMemo(() => {
    return rooms.find((r) => r.id === effectiveRoomId);
  }, [rooms, effectiveRoomId]);

  // Filtered Detailed Records
  const reportRecords = useMemo(() => {
    return filterRecordsByRangeAndRoom(
      records,
      activeRange,
      effectiveRoomId,
      undefined,
      selectedRoomObj?.code
    ).sort((a, b) => {
      const dtA = `${a.date} ${a.time}`;
      const dtB = `${b.date} ${b.time}`;
      return dtB.localeCompare(dtA);
    });
  }, [records, activeRange, effectiveRoomId, selectedRoomObj]);

  // Recapitulation Per Room Summaries
  const roomSummaries = useMemo<RoomStatsSummary[]>(() => {
    const targetRooms = effectiveRoomId === 'ALL' ? activeRooms : activeRooms.filter((r) => r.id === effectiveRoomId);

    return targetRooms.map((room) => {
      const roomRecs = records.filter(
        (r) =>
          (r.room_id === room.id || (!!room.code && r.room_code === room.code)) &&
          r.date >= activeRange.startDate &&
          r.date <= activeRange.endDate
      );

      if (roomRecs.length === 0) {
        return {
          room,
          totalRecords: 0,
          minTemp: null,
          maxTemp: null,
          avgTemp: null,
          normalCount: 0,
          perhatianCount: 0,
          kritisCount: 0,
        };
      }

      const temps = roomRecs.map((r) => r.temperature);
      const min = Math.min(...temps);
      const max = Math.max(...temps);
      const sum = temps.reduce((a, b) => a + b, 0);

      const normal = roomRecs.filter((r) => r.status === 'NORMAL').length;
      const perhatian = roomRecs.filter((r) => r.status === 'PERHATIAN').length;
      const kritis = roomRecs.filter((r) => r.status === 'KRITIS').length;

      return {
        room,
        totalRecords: roomRecs.length,
        minTemp: min,
        maxTemp: max,
        avgTemp: sum / roomRecs.length,
        normalCount: normal,
        perhatianCount: perhatian,
        kritisCount: kritis,
        latestRecord: roomRecs[0],
      };
    });
  }, [records, activeRooms, effectiveRoomId, activeRange]);

  // Labels for Exports
  const periodLabel = `${formatDateIndonesia(activeRange.startDate)} s/d ${formatDateIndonesia(activeRange.endDate)}`;
  const selectedRoomName = selectedRoomObj ? `${selectedRoomObj.name} (${selectedRoomObj.code})` : 'Semua Ruangan';

  // Chart Formatted Data for Visual Preview (1:1 with actual records, unique xKey prevents multi-room collisions)
  const chartData = useMemo(() => {
    const sorted = [...reportRecords].sort((a, b) => {
      const dtA = `${a.date} ${a.time}`;
      const dtB = `${b.date} ${b.time}`;
      return dtA.localeCompare(dtB);
    });

    return sorted.map((r, idx) => {
      const dateParts = r.date.split('-');
      const d = dateParts[2] || '';
      const m = dateParts[1] || '';
      const shortLabel = `${d}/${m} ${r.time}`;
      return {
        id: r.id,
        xKey: `${idx}__${shortLabel}`,
        label: shortLabel,
        date: r.date,
        time: r.time,
        temperature: r.temperature,
        humidity: r.humidity !== undefined && r.humidity !== null ? r.humidity : null,
        roomName: r.room_name,
        roomCode: r.room_code,
        status: r.status,
        recordedBy: r.recorded_by,
        minLimit: selectedRoomObj ? selectedRoomObj.min_temperature : undefined,
        maxLimit: selectedRoomObj ? selectedRoomObj.max_temperature : undefined,
      };
    });
  }, [reportRecords, selectedRoomObj]);

  // Dedicated Y-Axis Domains so Temperature & Humidity never flatten each other
  const tempDomain = useMemo<[number, number]>(() => {
    if (reportRecords.length === 0) return [15, 35];
    const vals = reportRecords.map((r) => r.temperature);
    if (selectedRoomObj) {
      vals.push(selectedRoomObj.min_temperature - 1.5, selectedRoomObj.max_temperature + 1.5);
    }
    let min = Math.floor(Math.min(...vals) - 1.5);
    let max = Math.ceil(Math.max(...vals) + 1.5);
    if (max - min < 4) {
      min -= 2;
      max += 2;
    }
    return [min, max];
  }, [reportRecords, selectedRoomObj]);

  const humDomain = useMemo<[number, number]>(() => {
    const hums = reportRecords
      .map((r) => r.humidity)
      .filter((h): h is number => h !== undefined && h !== null);
    if (hums.length === 0) return [0, 100];
    let min = Math.max(0, Math.floor(Math.min(...hums) - 5));
    let max = Math.min(100, Math.ceil(Math.max(...hums) + 5));
    if (max - min < 10) {
      min = Math.max(0, min - 5);
      max = Math.min(100, max + 5);
    }
    return [min, max];
  }, [reportRecords]);

  // Handle Export Excel
  const handleExportExcel = () => {
    exportToExcel(reportRecords, roomSummaries, periodLabel, selectedRoomName);
  };

  // Handle Save PDF Options and Generate PDF
  const handleGeneratePDF = () => {
    exportToPDF(reportRecords, roomSummaries, periodLabel, selectedRoomName, pdfOptions, selectedRoomObj);
    setIsPdfModalOpen(false);
  };

  // Handle Direct 1-Click PDF Export (Includes Chart & syncs active preview curve/metric)
  const handleDirectExportPDF = () => {
    exportToPDF(
      reportRecords,
      roomSummaries,
      periodLabel,
      selectedRoomName,
      {
        ...pdfOptions,
        chartMetric: previewMetric,
        chartCurve: lineCurve,
      },
      selectedRoomObj
    );
  };

  const handleResetPdfOptions = () => {
    setPdfOptions(DEFAULT_PDF_OPTIONS);
    setLineCurve(DEFAULT_PDF_OPTIONS.chartCurve || 'monotone');
  };

  return (
    <div className="w-full space-y-6">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-cyan-500 to-blue-600 text-white rounded-xl shadow-md shadow-cyan-500/20">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white font-poppins">Laporan Monitoring Suhu</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Rekapitulasi resmi pencatatan suhu ruangan UPT Laboratorium Kesehatan Kota Bontang.
            </p>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all hover:scale-[1.02]"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={handleDirectExportPDF}
            className="px-4 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-600/20 flex items-center gap-2 transition-all hover:scale-[1.02]"
            title="Cetak Laporan PDF Resmi Lengkap Bersama Grafik"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak PDF & Grafik</span>
          </button>

          <button
            onClick={() => setIsPdfModalOpen(true)}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-all hover:scale-[1.02]"
            title="Pengaturan Kop Laporan, Penandatangan, dan Opsi Grafik PDF"
          >
            <Settings2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>Setting Kop & TTD</span>
          </button>
        </div>
      </div>

      {/* Filter Box */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-xl space-y-4 transition-colors">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Room Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /> Pilih Ruangan
            </label>
            <select
              disabled={isSingleRoomOnly || activeRooms.length === 0}
              value={effectiveRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-cyan-500 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none transition-colors disabled:opacity-75"
            >
              {activeRooms.length === 0 ? (
                <option value="ALL">-- Belum Ada Akses Ruangan --</option>
              ) : isSingleRoomOnly ? (
                <option value={activeRooms[0].id}>
                  🔒 [{activeRooms[0].code}] {activeRooms[0].name}
                </option>
              ) : (
                <>
                  <option value="ALL">{isUnrestricted ? 'Semua Ruangan Laboratorium' : 'Semua Ruangan Anda'}</option>
                  {activeRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      [{r.code}] {r.name}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* Period Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /> Periode Laporan
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'today', label: 'Hari ini' },
                { id: 'last7', label: '7 Hari' },
                { id: 'last30', label: '30 Hari' },
                { id: 'thisMonth', label: 'Bulan Ini' },
                { id: 'all', label: 'Semua' },
                { id: 'custom', label: 'Custom' },
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setFilterType(btn.id as DateFilterType)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                    filterType === btn.id
                      ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                      : 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

        </div>

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
      </div>

      {/* Recapitulation Table per Room */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm dark:shadow-xl overflow-hidden space-y-4 p-5 transition-colors">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-cyan-600 dark:text-cyan-400" /> Rekapitulasi Suhu per Ruangan
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Periode Laporan: <span className="text-cyan-600 dark:text-cyan-300 font-bold">{periodLabel}</span>
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4 w-10">No</th>
                <th className="py-3 px-4">Nama Ruangan</th>
                <th className="py-3 px-4 text-center">Jumlah Data</th>
                <th className="py-3 px-4 text-center">Suhu Min</th>
                <th className="py-3 px-4 text-center">Suhu Max</th>
                <th className="py-3 px-4 text-center">Rata-Rata</th>
                <th className="py-3 px-4 text-center">Normal</th>
                <th className="py-3 px-4 text-center">Perhatian</th>
                <th className="py-3 px-4 text-center">Kritis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
              {roomSummaries.map((s, idx) => (
                <tr key={s.room.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 text-slate-400 font-mono text-center">{idx + 1}</td>
                  
                  <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                    <div>{s.room.name}</div>
                    <div className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono font-bold">{s.room.code}</div>
                  </td>

                  <td className="py-3.5 px-4 text-center font-bold text-slate-700 dark:text-slate-300 font-mono">
                    {s.totalRecords}
                  </td>

                  <td className="py-3.5 px-4 text-center font-mono font-bold text-blue-600 dark:text-blue-400">
                    {s.minTemp !== null ? `${s.minTemp.toFixed(1)}°C` : '-'}
                  </td>

                  <td className="py-3.5 px-4 text-center font-mono font-bold text-rose-600 dark:text-rose-400">
                    {s.maxTemp !== null ? `${s.maxTemp.toFixed(1)}°C` : '-'}
                  </td>

                  <td className="py-3.5 px-4 text-center font-mono font-bold text-cyan-600 dark:text-cyan-300">
                    {s.avgTemp !== null ? `${s.avgTemp.toFixed(1)}°C` : '-'}
                  </td>

                  <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {s.normalCount}
                  </td>

                  <td className="py-3.5 px-4 text-center font-mono font-bold text-amber-600 dark:text-amber-400">
                    {s.perhatianCount}
                  </td>

                  <td className="py-3.5 px-4 text-center font-mono font-bold text-rose-600 dark:text-rose-400">
                    {s.kritisCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visual Chart Card Preview */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm dark:shadow-xl p-5 space-y-4 transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
              <LineChartIcon className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              <span>Grafik Garis Fluktuasi Suhu & Kelembapan</span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                {lineCurve === 'monotone' ? 'Garis Halus' : 'Garis Lurus'}
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Grafik garis ini otomatis disertakan ke dalam dokumen cetak PDF resmi sesuai pilihan metrik & model garis.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Metric Toggle */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => {
                  setPreviewMetric('temperature');
                  setPdfOptions((prev) => ({ ...prev, chartMetric: 'temperature' }));
                }}
                className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                  previewMetric === 'temperature'
                    ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Thermometer className="w-3 h-3" /> Suhu
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewMetric('humidity');
                  setPdfOptions((prev) => ({ ...prev, chartMetric: 'humidity' }));
                }}
                className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                  previewMetric === 'humidity'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Droplets className="w-3 h-3" /> RH
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewMetric('both');
                  setPdfOptions((prev) => ({ ...prev, chartMetric: 'both' }));
                }}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  previewMetric === 'both'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Keduanya
              </button>
            </div>

            {/* Line Curve Style Toggle (Garis Halus / Garis Lurus) */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => {
                  setLineCurve('monotone');
                  setPdfOptions((prev) => ({ ...prev, chartCurve: 'monotone' }));
                }}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  lineCurve === 'monotone'
                    ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                📈 Garis Halus
              </button>
              <button
                type="button"
                onClick={() => {
                  setLineCurve('linear');
                  setPdfOptions((prev) => ({ ...prev, chartCurve: 'linear' }));
                }}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  lineCurve === 'linear'
                    ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                📐 Garis Lurus
              </button>
            </div>

            <button
              onClick={handleDirectExportPDF}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-rose-600/20 transition-all hover:scale-[1.02]"
              title="Unduh PDF berisi grafik garis ini dan rincian tabel"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak PDF Sekarang</span>
            </button>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            <LineChartIcon className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-xs">Tidak ada data untuk ditampilkan dalam grafik garis pada periode ini.</p>
          </div>
        ) : (
          <div className="h-64 sm:h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 16, right: previewMetric === 'both' ? 16 : 24, left: 6, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800/80" />
                <XAxis
                  dataKey="xKey"
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  dy={6}
                  minTickGap={24}
                  padding={{ left: 16, right: 16 }}
                  tickFormatter={(val) => String(val).split('__').slice(1).join('__')}
                />
                {(previewMetric === 'both' || previewMetric === 'temperature') && (
                  <YAxis
                    yAxisId="temp"
                    orientation="left"
                    stroke="#0284c7"
                    fontSize={10}
                    tickLine={false}
                    unit="°C"
                    width={52}
                    domain={tempDomain}
                  />
                )}
                {(previewMetric === 'both' || previewMetric === 'humidity') && (
                  <YAxis
                    yAxisId="hum"
                    orientation={previewMetric === 'both' ? 'right' : 'left'}
                    stroke="#6366f1"
                    fontSize={10}
                    tickLine={false}
                    unit="%"
                    width={46}
                    domain={humDomain}
                  />
                )}
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl shadow-lg text-xs space-y-1">
                          <p className="font-bold text-slate-900 dark:text-white">{data.roomName}</p>
                          <p className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">
                            Suhu: {data.temperature.toFixed(1)}°C
                          </p>
                          {data.humidity !== null && (
                            <p className="font-mono text-blue-600 dark:text-blue-400">
                              RH: {data.humidity.toFixed(1)}%
                            </p>
                          )}
                          <p className="text-[10px] text-slate-500">
                            {data.date} {data.time} | Petugas: {data.recordedBy}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />

                {/* Safe Temperature Area if Room Selected */}
                {selectedRoomObj && (previewMetric === 'both' || previewMetric === 'temperature') && (
                  <ReferenceArea
                    yAxisId="temp"
                    y1={selectedRoomObj.min_temperature}
                    y2={selectedRoomObj.max_temperature}
                    fill="#10b981"
                    fillOpacity={0.08}
                  />
                )}

                {selectedRoomObj && (previewMetric === 'both' || previewMetric === 'temperature') && (
                  <ReferenceLine
                    yAxisId="temp"
                    y={selectedRoomObj.max_temperature}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    label={{ value: `Maks ${selectedRoomObj.max_temperature}°C`, fill: '#059669', fontSize: 10, position: 'insideTopLeft' }}
                  />
                )}
                {selectedRoomObj && (previewMetric === 'both' || previewMetric === 'temperature') && (
                  <ReferenceLine
                    yAxisId="temp"
                    y={selectedRoomObj.min_temperature}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    label={{ value: `Min ${selectedRoomObj.min_temperature}°C`, fill: '#059669', fontSize: 10, position: 'insideBottomLeft' }}
                  />
                )}

                {(previewMetric === 'both' || previewMetric === 'temperature') && (
                  <Line
                    key={`laporan-temp-${lineCurve}`}
                    yAxisId="temp"
                    type={lineCurve}
                    dataKey="temperature"
                    name="Suhu (°C)"
                    stroke="#0284c7"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin={lineCurve === 'linear' ? 'miter' : 'round'}
                    connectNulls={true}
                    dot={{ r: 4, fill: '#0284c7', stroke: '#ffffff', strokeWidth: 1.5 }}
                    activeDot={{ r: 6 }}
                    isAnimationActive={false}
                  />
                )}

                {(previewMetric === 'both' || previewMetric === 'humidity') && (
                  <Line
                    key={`laporan-hum-${lineCurve}`}
                    yAxisId="hum"
                    type={lineCurve}
                    dataKey="humidity"
                    name="Kelembapan (%)"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin={lineCurve === 'linear' ? 'miter' : 'round'}
                    connectNulls={true}
                    strokeDasharray={previewMetric === 'both' ? '4 4' : undefined}
                    dot={{ r: 3.5, fill: '#6366f1', stroke: '#ffffff', strokeWidth: 1.5 }}
                    activeDot={{ r: 6 }}
                    isAnimationActive={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            <span>Grafik di atas otomatis ter-export saat mencetak PDF lengkap dengan batas aman suhu.</span>
          </div>
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Total {chartData.length} Data Titik
          </span>
        </div>
      </div>

      {/* Detail Transactions Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm dark:shadow-xl overflow-hidden p-5 space-y-4 transition-colors">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Table className="w-5 h-5 text-cyan-600 dark:text-cyan-400" /> Detail Rincian Pencatatan Suhu
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Total <span className="text-slate-900 dark:text-white font-bold">{reportRecords.length}</span> transaksi pencatatan ditemukan dalam rentang waktu ini.
          </p>
        </div>

        {reportRecords.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            Belum terdapat data pencatatan untuk periode ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 w-10">No</th>
                  <th className="py-3 px-4">Tanggal & Waktu</th>
                  <th className="py-3 px-4">Ruangan</th>
                  <th className="py-3 px-4">Suhu (°C)</th>
                  <th className="py-3 px-4">Kelembapan (% RH)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Petugas</th>
                  <th className="py-3 px-4">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
                {reportRecords.map((rec, idx) => (
                  <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-900 dark:text-white">{formatDateIndonesia(rec.date)}</span>
                      <span className="text-cyan-600 dark:text-cyan-400 font-mono ml-2">{rec.time}</span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{rec.room_name}</td>
                    <td className="py-3.5 px-4 font-bold font-mono text-slate-900 dark:text-cyan-300">{rec.temperature.toFixed(1)}°C</td>
                    <td className="py-3.5 px-4 font-bold font-mono text-blue-600 dark:text-blue-400">
                      {rec.humidity !== undefined ? `${rec.humidity.toFixed(1)}%` : '-'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        rec.status === 'NORMAL'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : rec.status === 'PERHATIAN'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      }`}>
                        {rec.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">{rec.recorded_by}</td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{rec.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PDF Configuration & Export Modal */}
      {isPdfModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 text-slate-900 dark:text-white my-8">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-200 dark:border-rose-800">
                  <FileSignature className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">Pengaturan Keterangan & Tanda Tangan PDF</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Atur tulisan laporan, kop surat, dan data pejabat penandatangan sebelum cetak PDF.</p>
                </div>
              </div>
              <button
                onClick={() => setIsPdfModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              
              {/* Section 1: Report Title & Kop */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5">
                  <Settings2 className="w-4 h-4" /> Header & Kop Surat
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Judul Laporan</label>
                    <input
                      type="text"
                      value={pdfOptions.reportTitle}
                      onChange={(e) => setPdfOptions((prev) => ({ ...prev, reportTitle: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                      placeholder="e.g. LAPORAN MONITORING SUHU RUANGAN"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Kota Tempat Cetak</label>
                    <input
                      type="text"
                      value={pdfOptions.cityName}
                      onChange={(e) => setPdfOptions((prev) => ({ ...prev, cityName: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                      placeholder="e.g. Bontang"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nama Instansi</label>
                    <input
                      type="text"
                      value={pdfOptions.institutionName}
                      onChange={(e) => setPdfOptions((prev) => ({ ...prev, institutionName: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Dinas / Induk</label>
                    <input
                      type="text"
                      value={pdfOptions.departmentName}
                      onChange={(e) => setPdfOptions((prev) => ({ ...prev, departmentName: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nama UPT Lab</label>
                    <input
                      type="text"
                      value={pdfOptions.subDepartmentName}
                      onChange={(e) => setPdfOptions((prev) => ({ ...prev, subDepartmentName: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Alamat Kantor</label>
                  <input
                    type="text"
                    value={pdfOptions.addressText}
                    onChange={(e) => setPdfOptions((prev) => ({ ...prev, addressText: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Section 2: Chart Inclusion & Metric Config */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 rounded-lg">
                      <LineChartIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">Sertakan Grafik Fluktuasi ke dalam PDF</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Mencetak grafik tren fluktuasi suhu & area batas aman standar ke dokumen PDF.
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPdfOptions((prev) => ({ ...prev, includeChart: prev.includeChart === false ? true : false }))}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                      pdfOptions.includeChart !== false
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {pdfOptions.includeChart !== false ? '✓ Grafik Aktif' : 'Grafik Nonaktif'}
                  </button>
                </div>

                {pdfOptions.includeChart !== false && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="space-y-2">
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Pilihan Metrik Data pada Lembar Grafik PDF:
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPdfOptions((prev) => ({ ...prev, chartMetric: 'both' }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            (pdfOptions.chartMetric || 'both') === 'both'
                              ? 'bg-cyan-600 text-white shadow-sm'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          📊 Suhu & Kelembapan (Lengkap)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPdfOptions((prev) => ({ ...prev, chartMetric: 'temperature' }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            pdfOptions.chartMetric === 'temperature'
                              ? 'bg-cyan-600 text-white shadow-sm'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          🌡️ Suhu Saja
                        </button>
                        <button
                          type="button"
                          onClick={() => setPdfOptions((prev) => ({ ...prev, chartMetric: 'humidity' }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            pdfOptions.chartMetric === 'humidity'
                              ? 'bg-cyan-600 text-white shadow-sm'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          💧 Kelembapan Saja
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Model Garis Grafik PDF:
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setLineCurve('monotone');
                            setPdfOptions((prev) => ({ ...prev, chartCurve: 'monotone' }));
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            (pdfOptions.chartCurve || 'monotone') === 'monotone'
                              ? 'bg-cyan-600 text-white shadow-sm'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          📈 Garis Halus
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setLineCurve('linear');
                            setPdfOptions((prev) => ({ ...prev, chartCurve: 'linear' }));
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            pdfOptions.chartCurve === 'linear'
                              ? 'bg-cyan-600 text-white shadow-sm'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          📐 Garis Lurus
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3: Dual Signatory Toggle */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">Jumlah Penandatangan Laporan</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {pdfOptions.showDualSignatory ? '2 Penandatangan (Kiri: Petugas, Kanan: Kepala)' : '1 Penandatangan (Kanan: Kepala Labkes)'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPdfOptions((prev) => ({ ...prev, showDualSignatory: !prev.showDualSignatory }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      pdfOptions.showDualSignatory
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {pdfOptions.showDualSignatory ? 'Mode 2 Tanda Tangan' : 'Mode 1 Tanda Tangan'}
                  </button>
                </div>
              </div>

              {/* Section 3: Primary Signatory (Right) */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <h5 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /> Penandatangan Utama (Sisi Kanan / Mengetahui)
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">Jabatan / Baris 1</label>
                    <input
                      type="text"
                      value={pdfOptions.primarySignatory.roleTitle}
                      onChange={(e) =>
                        setPdfOptions((prev) => ({
                          ...prev,
                          primarySignatory: { ...prev.primarySignatory, roleTitle: e.target.value },
                        }))
                      }
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                      placeholder="e.g. Kepala UPT Laboratorium Kesehatan"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">Sub Jabatan / Baris 2</label>
                    <input
                      type="text"
                      value={pdfOptions.primarySignatory.subTitle || ''}
                      onChange={(e) =>
                        setPdfOptions((prev) => ({
                          ...prev,
                          primarySignatory: { ...prev.primarySignatory, subTitle: e.target.value },
                        }))
                      }
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                      placeholder="e.g. Kota Bontang"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">Nama Lengkap & Gelar</label>
                    <input
                      type="text"
                      value={pdfOptions.primarySignatory.name}
                      onChange={(e) =>
                        setPdfOptions((prev) => ({
                          ...prev,
                          primarySignatory: { ...prev.primarySignatory, name: e.target.value },
                        }))
                      }
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white font-semibold"
                      placeholder="e.g. Dr. Handayani, M.Kes"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">NIP Penandatangan</label>
                    <input
                      type="text"
                      value={pdfOptions.primarySignatory.nip}
                      onChange={(e) =>
                        setPdfOptions((prev) => ({
                          ...prev,
                          primarySignatory: { ...prev.primarySignatory, nip: e.target.value },
                        }))
                      }
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white font-mono"
                      placeholder="e.g. NIP. 19781105 200501 2 008"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Secondary Signatory (Left) */}
              {pdfOptions.showDualSignatory && (
                <div className="p-4 bg-slate-50 dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 animate-in fade-in">
                  <h5 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /> Penandatangan Kedua (Sisi Kiri / Pembuat/Petugas)
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">Jabatan / Baris 1</label>
                      <input
                        type="text"
                        value={pdfOptions.secondarySignatory?.roleTitle || ''}
                        onChange={(e) =>
                          setPdfOptions((prev) => ({
                            ...prev,
                            secondarySignatory: {
                              roleTitle: e.target.value,
                              subTitle: prev.secondarySignatory?.subTitle || '',
                              name: prev.secondarySignatory?.name || '',
                              nip: prev.secondarySignatory?.nip || '',
                            },
                          }))
                        }
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                        placeholder="e.g. Petugas / Validator Suhu"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">Sub Jabatan / Baris 2</label>
                      <input
                        type="text"
                        value={pdfOptions.secondarySignatory?.subTitle || ''}
                        onChange={(e) =>
                          setPdfOptions((prev) => ({
                            ...prev,
                            secondarySignatory: {
                              roleTitle: prev.secondarySignatory?.roleTitle || '',
                              subTitle: e.target.value,
                              name: prev.secondarySignatory?.name || '',
                              nip: prev.secondarySignatory?.nip || '',
                            },
                          }))
                        }
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                        placeholder="e.g. Laboratorium"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">Nama Lengkap & Gelar</label>
                      <input
                        type="text"
                        value={pdfOptions.secondarySignatory?.name || ''}
                        onChange={(e) =>
                          setPdfOptions((prev) => ({
                            ...prev,
                            secondarySignatory: {
                              roleTitle: prev.secondarySignatory?.roleTitle || '',
                              subTitle: prev.secondarySignatory?.subTitle || '',
                              name: e.target.value,
                              nip: prev.secondarySignatory?.nip || '',
                            },
                          }))
                        }
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white font-semibold"
                        placeholder="e.g. Ahmad Muzakki, A.Md.AK"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">NIP Penandatangan</label>
                      <input
                        type="text"
                        value={pdfOptions.secondarySignatory?.nip || ''}
                        onChange={(e) =>
                          setPdfOptions((prev) => ({
                            ...prev,
                            secondarySignatory: {
                              roleTitle: prev.secondarySignatory?.roleTitle || '',
                              subTitle: prev.secondarySignatory?.subTitle || '',
                              name: prev.secondarySignatory?.name || '',
                              nip: e.target.value,
                            },
                          }))
                        }
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white font-mono"
                        placeholder="e.g. NIP. 19900315 201502 1 003"
                      />
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleResetPdfOptions}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset ke Bawaan SOP
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setIsPdfModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors w-full sm:w-auto"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleGeneratePDF}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 transition-all w-full sm:w-auto shrink-0"
                >
                  <Printer className="w-4 h-4" />
                  <span>Simpan & Cetak PDF Now</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
