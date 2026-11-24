import React, { useState, useMemo } from 'react';
import {
  LineChart as LineChartIcon,
  Building2,
  Calendar,
  Thermometer,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Droplets,
  Printer,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Legend,
} from 'recharts';
import { Room, TemperatureRecord, DateFilterType, DateRange, RoomStatsSummary, User } from '../types/simonsu';
import {
  getDateRangeFromFilter,
  filterRecordsByRangeAndRoom,
  formatDateIndonesia,
  getLocalDateString,
  isUserUnrestrictedRooms,
} from '../utils/storage';
import { exportToPDF, DEFAULT_PDF_OPTIONS } from '../utils/exportHelpers';

interface GrafikViewProps {
  rooms: Room[];
  records: TemperatureRecord[];
  darkMode: boolean;
  currentUser?: User;
}

export const GrafikView: React.FC<GrafikViewProps> = ({ rooms, records, darkMode, currentUser }) => {
  const activeRooms = rooms.filter((r) => r.is_active);
  const isUnrestricted = !currentUser || isUserUnrestrictedRooms(currentUser);
  const isSingleRoomOnly = !isUnrestricted && activeRooms.length === 1;

  // Filter States (Default to ALL rooms so any recorded room appears immediately)
  const [selectedRoomId, setSelectedRoomId] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<DateFilterType>('last30');
  const [customRange, setCustomRange] = useState<DateRange>({
    startDate: getLocalDateString(new Date(Date.now() - 30 * 86400000)),
    endDate: getLocalDateString(),
  });

  // Line curve style for Grafik Garis: 'monotone' (halus) or 'linear' (tegas)
  const [lineCurve, setLineCurve] = useState<'monotone' | 'linear'>('monotone');

  // Metric selector: Suhu, Kelembapan, atau Kedua-duanya
  const [metric, setMetric] = useState<'temperature' | 'humidity' | 'both'>('temperature');

  const activeRange = useMemo(() => {
    return getDateRangeFromFilter(filterType, customRange);
  }, [filterType, customRange]);

  const effectiveRoomId = isSingleRoomOnly
    ? activeRooms[0].id
    : selectedRoomId !== 'ALL' && !activeRooms.some((r) => r.id === selectedRoomId)
      ? 'ALL'
      : selectedRoomId;

  const selectedRoom = useMemo(() => {
    return rooms.find((r) => r.id === effectiveRoomId);
  }, [rooms, effectiveRoomId]);

  // Filtered records
  const chartRecords = useMemo(() => {
    const raw = filterRecordsByRangeAndRoom(
      records,
      activeRange,
      effectiveRoomId,
      undefined,
      selectedRoom?.code
    );
    return raw.sort((a, b) => {
      const dtA = `${a.date} ${a.time}`;
      const dtB = `${b.date} ${b.time}`;
      return dtA.localeCompare(dtB);
    });
  }, [records, activeRange, effectiveRoomId, selectedRoom]);

  // Chart Formatted Data (1:1 with actual records, unique xKey prevents multi-room timestamp collisions)
  const chartData = useMemo(() => {
    return chartRecords.map((r, idx) => {
      const dateParts = r.date.split('-');
      const d = dateParts[2] || '';
      const m = dateParts[1] || '';
      const shortLabel = `${d}/${m} ${r.time}`;
      return {
        id: r.id,
        xKey: `${idx}__${shortLabel}`,
        label: shortLabel,
        fullDate: formatDateIndonesia(r.date),
        time: r.time,
        temperature: r.temperature,
        humidity: r.humidity !== undefined && r.humidity !== null ? r.humidity : null,
        roomName: r.room_name,
        roomCode: r.room_code,
        status: r.status,
        recordedBy: r.recorded_by,
        minLimit: selectedRoom ? selectedRoom.min_temperature : undefined,
        maxLimit: selectedRoom ? selectedRoom.max_temperature : undefined,
      };
    });
  }, [chartRecords, selectedRoom]);

  // Dedicated Y-Axis Domains so Temperature & Humidity never flatten each other
  const tempDomain = useMemo<[number, number]>(() => {
    if (chartRecords.length === 0) return [15, 35];
    const vals = chartRecords.map((r) => r.temperature);
    if (selectedRoom) {
      vals.push(selectedRoom.min_temperature - 1.5, selectedRoom.max_temperature + 1.5);
    }
    let min = Math.floor(Math.min(...vals) - 1.5);
    let max = Math.ceil(Math.max(...vals) + 1.5);
    if (max - min < 4) {
      min -= 2;
      max += 2;
    }
    return [min, max];
  }, [chartRecords, selectedRoom]);

  const humDomain = useMemo<[number, number]>(() => {
    const hums = chartRecords
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
  }, [chartRecords]);

  // Summary Statistics Calculation
  const stats = useMemo(() => {
    if (chartRecords.length === 0) {
      return {
        minTemp: null,
        maxTemp: null,
        avgTemp: null,
        avgHum: null,
        totalCount: 0,
        normalCount: 0,
        attentionCount: 0,
        kritisCount: 0,
      };
    }

    const temps = chartRecords.map((r) => r.temperature);
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    const sum = temps.reduce((a, b) => a + b, 0);
    const avg = sum / temps.length;

    const hums = chartRecords.map((r) => r.humidity).filter((h): h is number => h !== undefined && h !== null);
    const avgHum = hums.length > 0 ? hums.reduce((a, b) => a + b, 0) / hums.length : null;

    const normal = chartRecords.filter((r) => r.status === 'NORMAL').length;
    const attention = chartRecords.filter((r) => r.status === 'PERHATIAN').length;
    const kritis = chartRecords.filter((r) => r.status === 'KRITIS').length;

    return {
      minTemp: min,
      maxTemp: max,
      avgTemp: avg,
      avgHum,
      totalCount: chartRecords.length,
      normalCount: normal,
      attentionCount: attention,
      kritisCount: kritis,
    };
  }, [chartRecords]);

  // Custom Colored Dot based on Status
  const renderCustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (typeof cx !== 'number' || typeof cy !== 'number') return null;

    let fill = '#10b981'; // Emerald for Normal
    let stroke = '#047857';

    if (payload.status === 'PERHATIAN') {
      fill = '#f59e0b'; // Amber
      stroke = '#b45309';
    } else if (payload.status === 'KRITIS') {
      fill = '#ef4444'; // Red
      stroke = '#b91c1c';
    }

    return (
      <circle
        key={`dot-${payload.id}`}
        cx={cx}
        cy={cy}
        r={5}
        fill={fill}
        stroke={stroke}
        strokeWidth={2}
        className="cursor-pointer"
      />
    );
  };

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isNormal = data.status === 'NORMAL';
      const isPerhatian = data.status === 'PERHATIAN';

      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-2xl text-xs space-y-2 max-w-xs animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
            <div>
              <p className="font-bold text-slate-900 dark:text-white">{data.roomName}</p>
              <p className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono font-bold">{data.roomCode}</p>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              isNormal
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : isPerhatian
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
            }`}>
              {data.status}
            </span>
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Suhu Terukur:</span>
            <span className="text-xl font-extrabold font-mono text-slate-900 dark:text-cyan-300">
              {data.temperature.toFixed(1)}°C
            </span>
          </div>

          {data.humidity !== null && data.humidity !== undefined && (
            <div className="flex items-baseline justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Kelembapan:</span>
              <span className="text-lg font-extrabold font-mono text-blue-600 dark:text-blue-400">
                {data.humidity.toFixed(1)}% RH
              </span>
            </div>
          )}

          <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5 pt-1 border-t border-slate-100 dark:border-slate-800">
            <p><strong>Waktu:</strong> {data.fullDate} jam {data.time} WITA</p>
            <p><strong>Petugas:</strong> {data.recordedBy}</p>
          </div>
        </div>
      );
    }
    return null;
  };

  // Handle Export PDF directly from Grafik View
  const handleExportPDF = () => {
    const targetRooms = effectiveRoomId === 'ALL' ? activeRooms : activeRooms.filter((r) => r.id === effectiveRoomId);
    const roomSummaries: RoomStatsSummary[] = targetRooms.map((room) => {
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
      return {
        room,
        totalRecords: roomRecs.length,
        minTemp: Math.min(...temps),
        maxTemp: Math.max(...temps),
        avgTemp: temps.reduce((a, b) => a + b, 0) / roomRecs.length,
        normalCount: roomRecs.filter((r) => r.status === 'NORMAL').length,
        perhatianCount: roomRecs.filter((r) => r.status === 'PERHATIAN').length,
        kritisCount: roomRecs.filter((r) => r.status === 'KRITIS').length,
        latestRecord: roomRecs[0],
      };
    });

    const periodLabel = `${formatDateIndonesia(activeRange.startDate)} s/d ${formatDateIndonesia(activeRange.endDate)}`;
    const selectedRoomName = selectedRoom ? `${selectedRoom.name} (${selectedRoom.code})` : 'Semua Ruangan';

    const pdfOpts = {
      ...DEFAULT_PDF_OPTIONS,
      includeChart: true,
      chartMetric: metric,
      chartCurve: lineCurve,
    };

    exportToPDF(chartRecords, roomSummaries, periodLabel, selectedRoomName, pdfOpts, selectedRoom);
  };

  return (
    <div className="w-full space-y-6">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-cyan-500 to-blue-600 text-white rounded-xl shadow-md shadow-cyan-500/20">
            <LineChartIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white font-poppins">Grafik Suhu Ruangan</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Visualisasi tren Fluktuasi suhu dan area batas aman ideal per ruangan.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Metric Selector Toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setMetric('temperature')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                metric === 'temperature'
                  ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Thermometer className="w-3.5 h-3.5" /> Suhu (°C)
            </button>
            <button
              onClick={() => setMetric('humidity')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                metric === 'humidity'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Droplets className="w-3.5 h-3.5" /> Kelembapan (% RH)
            </button>
            <button
              onClick={() => setMetric('both')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                metric === 'both'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              📊 Keduanya
            </button>
          </div>

          {/* Line Curve Style Selector (Grafik Garis) */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setLineCurve('monotone')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                lineCurve === 'monotone'
                  ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              📈 Garis Halus
            </button>
            <button
              onClick={() => setLineCurve('linear')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                lineCurve === 'linear'
                  ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              📐 Garis Lurus
            </button>
          </div>

          {/* Export PDF Button */}
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-rose-600/20 transition-all hover:scale-[1.02]"
            title="Cetak Laporan PDF Resmi Lengkap dengan Grafik Garis"
          >
            <Printer className="w-4 h-4" />
            <span>Export PDF & Grafik</span>
          </button>
        </div>
      </div>

      {/* Filter Controls Bar */}
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
                  🔒 [{activeRooms[0].code}] {activeRooms[0].name} (Batas: {activeRooms[0].min_temperature}°C – {activeRooms[0].max_temperature}°C)
                </option>
              ) : (
                <>
                  <option value="ALL">{isUnrestricted ? 'Semua Ruangan Kombinasi' : 'Semua Ruangan Anda'}</option>
                  {activeRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      [{r.code}] {r.name} (Batas: {r.min_temperature}°C – {r.max_temperature}°C)
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* Period Selector Buttons */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /> Periode Grafik
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

        {/* Custom Range Option */}
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

      {/* Main Chart Box */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-xl space-y-4 transition-colors">
        
        {/* Chart Header & Interactive Color Legend */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
              <span>
                Grafik Garis Tren{' '}
                {metric === 'humidity'
                  ? 'Kelembapan (% RH)'
                  : metric === 'temperature'
                  ? 'Suhu (°C)'
                  : 'Suhu (°C) & Kelembapan (% RH)'}{' '}
                — {selectedRoom ? selectedRoom.name : 'Semua Ruangan'}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                {lineCurve === 'monotone' ? 'Garis Halus' : 'Garis Lurus'}
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Titik warna pada garis menunjukkan status: <span className="text-emerald-600 dark:text-emerald-400 font-bold">🟢 Normal</span>, <span className="text-amber-600 dark:text-amber-400 font-bold">🟡 Perhatian</span>, <span className="text-rose-600 dark:text-rose-400 font-bold">🔴 Kritis</span>.
            </p>
          </div>

          {/* Legend Badges */}
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
            {selectedRoom && (metric === 'temperature' || metric === 'both') && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Area Aman: {selectedRoom.min_temperature}°C – {selectedRoom.max_temperature}°C</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Perhatian
            </div>
            <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Kritis
            </div>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="h-72 flex flex-col items-center justify-center text-center space-y-3">
            <LineChartIcon className="w-12 h-12 text-slate-300 dark:text-slate-700" />
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Belum Ada Data Suhu untuk Grafik Garis</h4>
            <p className="text-xs text-slate-500 max-w-sm">
              Tidak ada data pencatatan suhu pada periode atau ruangan yang dipilih. Silakan input data suhu terlebih dahulu.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="h-80 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 16, right: metric === 'both' ? 16 : 24, left: 6, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1e293b' : '#e2e8f0'} />

                  <XAxis
                    dataKey="xKey"
                    stroke={darkMode ? '#94a3b8' : '#64748b'}
                    fontSize={10}
                    tickLine={false}
                    minTickGap={24}
                    padding={{ left: 16, right: 16 }}
                    tickFormatter={(val) => String(val).split('__').slice(1).join('__')}
                  />

                  {(metric === 'temperature' || metric === 'both') && (
                    <YAxis
                      yAxisId="temp"
                      orientation="left"
                      stroke={darkMode ? '#38bdf8' : '#0284c7'}
                      fontSize={10}
                      tickLine={false}
                      unit="°C"
                      width={52}
                      domain={tempDomain}
                    />
                  )}

                  {(metric === 'humidity' || metric === 'both') && (
                    <YAxis
                      yAxisId="hum"
                      orientation={metric === 'both' ? 'right' : 'left'}
                      stroke={darkMode ? '#818cf8' : '#4f46e5'}
                      fontSize={10}
                      tickLine={false}
                      unit="%"
                      width={46}
                      domain={humDomain}
                    />
                  )}

                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />

                  {/* Shaded Green Area for Room Target Safe Temperature Range */}
                  {selectedRoom && (metric === 'temperature' || metric === 'both') && (
                    <ReferenceArea
                      yAxisId="temp"
                      y1={selectedRoom.min_temperature}
                      y2={selectedRoom.max_temperature}
                      fill="#10b981"
                      fillOpacity={darkMode ? 0.12 : 0.08}
                      stroke={darkMode ? '#10b981' : '#059669'}
                      strokeDasharray="3 3"
                      strokeOpacity={0.4}
                    />
                  )}

                  {/* Min Limit Line */}
                  {selectedRoom && (metric === 'temperature' || metric === 'both') && (
                    <ReferenceLine
                      yAxisId="temp"
                      y={selectedRoom.min_temperature}
                      stroke="#10b981"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{
                        value: `Min Normal (${selectedRoom.min_temperature}°C)`,
                        fill: '#10b981',
                        fontSize: 10,
                        position: 'insideBottomLeft',
                      }}
                    />
                  )}

                  {/* Max Limit Line */}
                  {selectedRoom && (metric === 'temperature' || metric === 'both') && (
                    <ReferenceLine
                      yAxisId="temp"
                      y={selectedRoom.max_temperature}
                      stroke="#ef4444"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{
                        value: `Max Normal (${selectedRoom.max_temperature}°C)`,
                        fill: '#ef4444',
                        fontSize: 10,
                        position: 'insideTopLeft',
                      }}
                    />
                  )}

                  {/* Grafik Garis (Line Chart) */}
                  {(metric === 'temperature' || metric === 'both') && (
                    <Line
                      key={`temp-${lineCurve}`}
                      yAxisId="temp"
                      type={lineCurve}
                      dataKey="temperature"
                      name="Suhu (°C)"
                      stroke={darkMode ? '#38bdf8' : '#0284c7'}
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin={lineCurve === 'linear' ? 'miter' : 'round'}
                      connectNulls={true}
                      dot={renderCustomDot}
                      activeDot={{ r: 7, fill: '#0284c7', stroke: '#ffffff', strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                  )}
                  {(metric === 'humidity' || metric === 'both') && (
                    <Line
                      key={`hum-${lineCurve}`}
                      yAxisId="hum"
                      type={lineCurve}
                      dataKey="humidity"
                      name="Kelembapan (% RH)"
                      stroke={darkMode ? '#818cf8' : '#4f46e5'}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin={lineCurve === 'linear' ? 'miter' : 'round'}
                      connectNulls={true}
                      strokeDasharray={metric === 'both' ? '5 5' : undefined}
                      dot={{ r: 4, fill: darkMode ? '#818cf8' : '#4f46e5', strokeWidth: 1.5, stroke: '#ffffff' }}
                      activeDot={{ r: 7, fill: '#4f46e5', stroke: '#ffffff', strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
            {chartData.length === 1 && (
              <p className="text-[11px] text-center text-slate-500 dark:text-slate-400">
                Baru terdapat 1 titik pengukuran pada rentang ini. Tambahkan pencatatan berikutnya agar garis tren ({lineCurve === 'monotone' ? 'Garis Halus' : 'Garis Lurus'}) terbentuk antar titik waktu.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Ringkasan Grafik (Summary Statistics) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-xl space-y-4 transition-colors">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Thermometer className="w-5 h-5 text-cyan-600 dark:text-cyan-400" /> Ringkasan Statistik Grafik
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          
          {/* Suhu Minimum */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-blue-500" /> Suhu Min
            </div>
            <div className="text-xl font-extrabold font-mono text-blue-600 dark:text-blue-400">
              {stats.minTemp !== null ? `${stats.minTemp.toFixed(1)}°C` : '-'}
            </div>
          </div>

          {/* Suhu Maksimum */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-rose-500" /> Suhu Max
            </div>
            <div className="text-xl font-extrabold font-mono text-rose-600 dark:text-rose-400">
              {stats.maxTemp !== null ? `${stats.maxTemp.toFixed(1)}°C` : '-'}
            </div>
          </div>

          {/* Suhu Rata-rata */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Thermometer className="w-3.5 h-3.5 text-cyan-500" /> Suhu Avg
            </div>
            <div className="text-xl font-extrabold font-mono text-cyan-600 dark:text-cyan-300">
              {stats.avgTemp !== null ? `${stats.avgTemp.toFixed(1)}°C` : '-'}
            </div>
          </div>

          {/* Kelembapan Rata-rata */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Droplets className="w-3.5 h-3.5 text-blue-500" /> RH Avg
            </div>
            <div className="text-xl font-extrabold font-mono text-blue-600 dark:text-blue-400">
              {stats.avgHum !== null ? `${stats.avgHum.toFixed(1)}%` : '-'}
            </div>
          </div>

          {/* Jumlah Pencatatan */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Jumlah Pencatatan
            </div>
            <div className="text-xl font-extrabold font-mono text-slate-900 dark:text-white">
              {stats.totalCount} <span className="text-xs font-normal text-slate-500">data</span>
            </div>
          </div>

          {/* Data Normal */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Data Normal
            </div>
            <div className="text-xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
              {stats.normalCount}
            </div>
          </div>

          {/* Perlu Perhatian / Kritis */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Perlu Perhatian
            </div>
            <div className={`text-xl font-extrabold font-mono ${stats.attentionCount + stats.kritisCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
              {stats.attentionCount + stats.kritisCount}
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};
