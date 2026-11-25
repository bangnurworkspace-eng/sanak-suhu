/**
 * SIMONSU - Shared 8-Sheet Matrix, Defaults & Parsers
 * Used by both Express backend (server.ts) and React client.
 */

import type {
  Room,
  TemperatureRecord,
  TemperatureStatus,
  User,
  AuditLog,
  RoleConfig,
  PermissionKey,
} from '../types/simonsu.ts';

export const SPREADSHEET_ID = '1OSxiUqSNVrYBuW2VG_2SrUGGdCNp-_K4NaKfSx5q9QA';
export const SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`;
export const DEFAULT_APPS_SCRIPT_WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycbwDvf0IU64HuWOKkX0YF23lDoNOdydZmd0d_JXLbVcNQo7FskXVp6Ck9RTo4SUnaxrNUQ/exec';

export const SIMONSU_SHEETS = {
  DASHBOARD: 'Dashboard_Ringkasan',
  DATA_SUHU: 'Data_Suhu',
  GRAFIK_TREN: 'Grafik_Tren',
  MASTER_RUANGAN: 'Master_Ruangan',
  REKAP_LAPORAN: 'Rekap_Laporan',
  DATA_PENGGUNA: 'Data_Pengguna',
  AUDIT_LOG: 'Audit_Log',
  HAK_AKSES_ROLE: 'Hak_Akses_Role',
} as const;

export type SimonsuSheetName = (typeof SIMONSU_SHEETS)[keyof typeof SIMONSU_SHEETS];

export interface FullAppSyncData {
  records: TemperatureRecord[];
  rooms: Room[];
  users: User[];
  auditLogs: AuditLog[];
  roleConfigs: Record<string, RoleConfig>;
}

export const DEFAULT_ROLE_CONFIGS: Record<string, RoleConfig> = {
  ADMIN: {
    code: 'ADMIN',
    label: 'Administrator',
    description: 'Akses penuh tanpa batas ke semua menu, kelola user, master ruangan, dan sistem.',
    permissions: {
      dashboard: true,
      input: true,
      data: true,
      data_edit: true,
      data_delete: true,
      grafik: true,
      master: true,
      master_edit: true,
      laporan: true,
      users: true,
      audit: true,
      pengaturan: true,
    },
  },
  PETUGAS: {
    code: 'PETUGAS',
    label: 'Petugas Laboratorium',
    description: 'Petugas operasional yang melakukan pencatatan suhu harian dan melihat laporan.',
    permissions: {
      dashboard: true,
      input: true,
      data: true,
      data_edit: true,
      data_delete: false,
      grafik: true,
      master: true,
      master_edit: false,
      laporan: true,
      users: false,
      audit: false,
      pengaturan: false,
    },
  },
};

export function calculateTemperatureStatus(temp: number, room: Room): TemperatureStatus {
  if (temp >= room.min_temperature && temp <= room.max_temperature) {
    return 'NORMAL';
  }
  if (temp < room.critical_min || temp > room.critical_max) {
    return 'KRITIS';
  }
  return 'PERHATIAN';
}

export function calculateHumidityStatus(humidity: number | undefined, room: Room): TemperatureStatus {
  if (humidity === undefined || humidity === null || isNaN(humidity)) return 'NORMAL';
  const minH = room.min_humidity ?? 30.0;
  const maxH = room.max_humidity ?? 60.0;
  if (humidity >= minH && humidity <= maxH) {
    return 'NORMAL';
  }
  if (humidity < minH - 10 || humidity > maxH + 10) {
    return 'KRITIS';
  }
  return 'PERHATIAN';
}

export function normalizeAssignedRoomIds(
  assignedRoomIds?: string[],
  role?: string
): string[] {
  const cleaned = (assignedRoomIds || [])
    .map((s) => s.trim())
    .filter((s) => {
      const upper = s.toUpperCase();
      return s !== '' && s !== '-' && upper !== 'NONE' && upper !== 'TIDAK ADA';
    });

  if (cleaned.some((s) => s.toUpperCase() === 'ALL')) {
    return ['ALL'];
  }
  if (cleaned.length === 0 && role === 'ADMIN') {
    return ['ALL'];
  }
  return cleaned;
}

export function isUserUnrestrictedRooms(user?: Pick<User, 'role' | 'assigned_room_ids'> | null): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  const normalized = normalizeAssignedRoomIds(user.assigned_room_ids, user.role);
  return normalized.includes('ALL');
}

export function getUserAssignedRooms(
  user: Pick<User, 'role' | 'assigned_room_ids'> | null | undefined,
  rooms: Room[],
  activeOnly = false
): Room[] {
  const baseRooms = activeOnly ? rooms.filter((r) => r.is_active) : rooms;
  if (!user) return [];
  if (isUserUnrestrictedRooms(user)) return baseRooms;

  const assigned = normalizeAssignedRoomIds(user.assigned_room_ids, user.role);
  if (assigned.length === 0) return [];

  const assignedLower = new Set(assigned.map((a) => a.toLowerCase()));
  return baseRooms.filter(
    (r) => assignedLower.has(r.id.toLowerCase()) || assignedLower.has(r.code.toLowerCase())
  );
}

export function canUserAccessRoom(
  user: Pick<User, 'role' | 'assigned_room_ids'> | null | undefined,
  target: { id?: string; code?: string; room_id?: string; room_code?: string } | null | undefined,
  rooms: Room[] = []
): boolean {
  if (!user || !target) return false;
  if (isUserUnrestrictedRooms(user)) return true;

  const assigned = normalizeAssignedRoomIds(user.assigned_room_ids, user.role);
  if (assigned.length === 0) return false;

  const assignedLower = new Set(assigned.map((a) => a.toLowerCase()));
  const roomId = (target.room_id ?? target.id ?? '').trim().toLowerCase();
  const roomCode = (target.room_code ?? target.code ?? '').trim().toLowerCase();

  if (roomId && assignedLower.has(roomId)) return true;
  if (roomCode && assignedLower.has(roomCode)) return true;

  if (rooms.length > 0) {
    const matchedRoom = rooms.find(
      (r) =>
        (roomId && r.id.toLowerCase() === roomId) ||
        (roomCode && r.code.toLowerCase() === roomCode)
    );
    if (matchedRoom) {
      return (
        assignedLower.has(matchedRoom.id.toLowerCase()) ||
        assignedLower.has(matchedRoom.code.toLowerCase())
      );
    }
  }

  return false;
}

export function getRecordUniqueKey(
  rec: Pick<TemperatureRecord, 'date' | 'time' | 'room_code' | 'room_name' | 'temperature'>
): string {
  const roomKey = (rec.room_code || rec.room_name || '').toLowerCase().trim();
  return `${rec.date}_${rec.time}_${roomKey}_${Number(rec.temperature).toFixed(1)}`;
}

export function getRecordAllKeys(
  rec: Partial<TemperatureRecord> & Pick<TemperatureRecord, 'date' | 'time' | 'temperature'>
): string[] {
  const keys: string[] = [];
  if (rec.id) keys.push(rec.id);
  const tempStr = Number(rec.temperature).toFixed(1);
  if (rec.room_code) {
    const codeKey = rec.room_code.toLowerCase().trim();
    keys.push(`${rec.date}_${rec.time}_${codeKey}_${tempStr}`);
  }
  if (rec.room_name) {
    const nameKey = rec.room_name.toLowerCase().trim();
    keys.push(`${rec.date}_${rec.time}_${nameKey}_${tempStr}`);
  }
  return Array.from(new Set(keys));
}

function parseNumericValue(raw: any): number | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  const str = String(raw).trim();
  if (str === '' || str === '-') return null;
  const normalized = str.includes(',') && !str.includes('.') ? str.replace(',', '.') : str;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

function parseCellNumber(cell: any, fallback: number): number {
  const raw = cell?.v !== undefined && cell?.v !== null ? cell.v : cell?.f;
  const parsed = parseNumericValue(raw);
  return parsed !== null ? parsed : fallback;
}

export function getLocalDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function buildAllSheetsMatrix(
  data: FullAppSyncData,
  deletedRecordKeys: string[] = []
): Record<SimonsuSheetName, (string | number)[][]> {
  const todayStr = getLocalDateString();
  const deletedSet = new Set(deletedRecordKeys);
  const validRecords = data.records.filter(
    (r) => !getRecordAllKeys(r).some((k) => deletedSet.has(k))
  );
  const sortedRecords = [...validRecords].sort((a, b) =>
    `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)
  );
  const chronologicalRecords = [...validRecords].sort((a, b) =>
    `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
  );

  // 1. Dashboard_Ringkasan
  const todayRecords = validRecords.filter((r) => r.date === todayStr);
  const normalToday = todayRecords.filter((r) => r.status === 'NORMAL').length;
  const perhatianToday = todayRecords.filter((r) => r.status === 'PERHATIAN').length;
  const kritisToday = todayRecords.filter((r) => r.status === 'KRITIS').length;

  const dashboardMatrix: (string | number)[][] = [
    [
      'ID_Ruang',
      'Kode_Ruang',
      'Nama_Ruangan',
      'Lokasi',
      'Status_Ruangan',
      'Batas_Normal_C',
      'Batas_Kritis_C',
      'Suhu_Terakhir_C',
      'Kelembapan_Terakhir_RH',
      'Status_Suhu_Terakhir',
      'Waktu_Update_Terakhir',
      'Petugas_Terakhir',
      'Total_Input_Hari_Ini',
      'Normal_Hari_Ini',
      'Perhatian_Kritis_Hari_Ini',
    ],
    ...data.rooms.map((rm) => {
      const latest = sortedRecords.find((r) => r.room_id === rm.id || r.room_code === rm.code);
      return [
        rm.id,
        rm.code,
        rm.name,
        rm.location || '-',
        rm.is_active ? 'AKTIF' : 'NONAKTIF',
        `${rm.min_temperature} - ${rm.max_temperature}`,
        `< ${rm.critical_min} / > ${rm.critical_max}`,
        latest ? latest.temperature : '-',
        latest && latest.humidity !== undefined ? latest.humidity : '-',
        latest ? latest.status : 'BELUM ADA DATA',
        latest ? `${latest.date} ${latest.time}` : '-',
        latest ? latest.recorded_by : '-',
        todayRecords.length,
        normalToday,
        perhatianToday + kritisToday,
      ];
    }),
  ];

  // 2. Data_Suhu
  const dataSuhuMatrix: (string | number)[][] = [
    [
      'Tanggal',
      'Waktu',
      'Kode_Ruang',
      'Nama_Ruangan',
      'Suhu_C',
      'Kelembapan_RH',
      'Status_Suhu',
      'Petugas',
      'Catatan',
      'ID_Record',
      'ID_Ruang',
    ],
    ...sortedRecords.map((r) => [
      r.date,
      r.time,
      r.room_code || '-',
      r.room_name || '-',
      r.temperature,
      r.humidity !== undefined ? r.humidity : '-',
      r.status,
      r.recorded_by,
      r.notes || '-',
      r.id,
      r.room_id,
    ]),
  ];

  // 3. Grafik_Tren
  const grafikMatrix: (string | number)[][] = [
    [
      'No_Urut',
      'Label_Waktu',
      'Tanggal',
      'Waktu',
      'Kode_Ruang',
      'Nama_Ruangan',
      'Suhu_C',
      'Kelembapan_RH',
      'Batas_Min_Normal_C',
      'Batas_Max_Normal_C',
      'Status_Titik',
      'Petugas',
    ],
    ...chronologicalRecords.map((r, idx) => {
      const rm = data.rooms.find((room) => room.id === r.room_id || room.code === r.room_code);
      const [, m, d] = r.date.split('-');
      return [
        idx + 1,
        `${d}/${m} ${r.time}`,
        r.date,
        r.time,
        r.room_code || '-',
        r.room_name || '-',
        r.temperature,
        r.humidity !== undefined ? r.humidity : '-',
        rm ? rm.min_temperature : 20,
        rm ? rm.max_temperature : 25,
        r.status,
        r.recorded_by,
      ];
    }),
  ];

  // 4. Master_Ruangan
  const masterRuanganMatrix: (string | number)[][] = [
    [
      'ID_Ruang',
      'Kode_Ruang',
      'Nama_Ruangan',
      'Lokasi',
      'Suhu_Min',
      'Suhu_Max',
      'Kritis_Min',
      'Kritis_Max',
      'Kelembapan_Min',
      'Kelembapan_Max',
      'Status_Aktif',
      'Keterangan',
    ],
    ...data.rooms.map((rm) => [
      rm.id,
      rm.code,
      rm.name,
      rm.location || '-',
      rm.min_temperature,
      rm.max_temperature,
      rm.critical_min,
      rm.critical_max,
      rm.min_humidity ?? 40,
      rm.max_humidity ?? 60,
      rm.is_active ? 'AKTIF' : 'NONAKTIF',
      rm.description || '-',
    ]),
  ];

  // 5. Rekap_Laporan
  const rekapLaporanMatrix: (string | number)[][] = [
    [
      'No',
      'Kode_Ruang',
      'Nama_Ruangan',
      'Lokasi',
      'Jumlah_Data',
      'Suhu_Min_C',
      'Suhu_Max_C',
      'Suhu_Rata_Rata_C',
      'Jumlah_Normal',
      'Jumlah_Perhatian',
      'Jumlah_Kritis',
      'Suhu_Terakhir_C',
      'Waktu_Terakhir',
    ],
    ...data.rooms.map((rm, idx) => {
      const roomRecs = sortedRecords.filter((r) => r.room_id === rm.id || r.room_code === rm.code);
      const temps = roomRecs.map((r) => r.temperature);
      const minT = temps.length > 0 ? Number(Math.min(...temps).toFixed(1)) : '-';
      const maxT = temps.length > 0 ? Number(Math.max(...temps).toFixed(1)) : '-';
      const avgT =
        temps.length > 0
          ? Number((temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1))
          : '-';
      const normCount = roomRecs.filter((r) => r.status === 'NORMAL').length;
      const attCount = roomRecs.filter((r) => r.status === 'PERHATIAN').length;
      const critCount = roomRecs.filter((r) => r.status === 'KRITIS').length;
      const latest = roomRecs[0];

      return [
        idx + 1,
        rm.code,
        rm.name,
        rm.location || '-',
        roomRecs.length,
        minT,
        maxT,
        avgT,
        normCount,
        attCount,
        critCount,
        latest ? latest.temperature : '-',
        latest ? `${latest.date} ${latest.time}` : '-',
      ];
    }),
  ];

  // 6. Data_Pengguna
  const dataPenggunaMatrix: (string | number)[][] = [
    [
      'ID_User',
      'Username',
      'Password',
      'Nama_Lengkap',
      'NIP',
      'Jabatan',
      'Role',
      'Email',
      'Akses_Ruangan',
      'Status_Aktif',
    ],
    ...data.users.map((u) => [
      u.id,
      u.username,
      u.password || '',
      u.name,
      u.nip || '-',
      u.position || '-',
      u.role,
      u.email || '-',
      u.assigned_room_ids && u.assigned_room_ids.length > 0
        ? u.assigned_room_ids.join(', ')
        : u.role === 'ADMIN'
          ? 'ALL'
          : 'NONE',
      u.is_active ? 'AKTIF' : 'NONAKTIF',
    ]),
  ];

  // 7. Audit_Log
  const auditLogMatrix: (string | number)[][] = [
    [
      'ID_Log',
      'Waktu_Aktivitas',
      'ID_User',
      'Nama_Pengguna',
      'Tindakan_Aksi',
      'ID_Terkait',
      'Rincian_Aktivitas',
    ],
    ...data.auditLogs.map((l) => [
      l.id,
      l.created_at,
      l.user_id || 'usr-admin',
      l.user_name,
      l.action,
      l.record_id || '-',
      l.details,
    ]),
  ];

  // 8. Hak_Akses_Role
  const hakAksesMatrix: (string | number)[][] = [
    [
      'Kode_Role',
      'Nama_Role',
      'Deskripsi',
      'Dashboard',
      'Input_Suhu',
      'Lihat_Data',
      'Edit_Data',
      'Hapus_Data',
      'Grafik',
      'Master_Ruang',
      'Edit_Master',
      'Laporan',
      'Pengguna',
      'Audit_Log',
      'Pengaturan',
    ],
    ...Object.values(data.roleConfigs).map((rc) => [
      rc.code,
      rc.label,
      rc.description,
      rc.permissions.dashboard ? 'YA' : 'TIDAK',
      rc.permissions.input ? 'YA' : 'TIDAK',
      rc.permissions.data ? 'YA' : 'TIDAK',
      rc.permissions.data_edit ? 'YA' : 'TIDAK',
      rc.permissions.data_delete ? 'YA' : 'TIDAK',
      rc.permissions.grafik ? 'YA' : 'TIDAK',
      rc.permissions.master ? 'YA' : 'TIDAK',
      rc.permissions.master_edit ? 'YA' : 'TIDAK',
      rc.permissions.laporan ? 'YA' : 'TIDAK',
      rc.permissions.users ? 'YA' : 'TIDAK',
      rc.permissions.audit ? 'YA' : 'TIDAK',
      rc.permissions.pengaturan ? 'YA' : 'TIDAK',
    ]),
  ];

  return {
    [SIMONSU_SHEETS.DASHBOARD]: dashboardMatrix,
    [SIMONSU_SHEETS.DATA_SUHU]: dataSuhuMatrix,
    [SIMONSU_SHEETS.GRAFIK_TREN]: grafikMatrix,
    [SIMONSU_SHEETS.MASTER_RUANGAN]: masterRuanganMatrix,
    [SIMONSU_SHEETS.REKAP_LAPORAN]: rekapLaporanMatrix,
    [SIMONSU_SHEETS.DATA_PENGGUNA]: dataPenggunaMatrix,
    [SIMONSU_SHEETS.AUDIT_LOG]: auditLogMatrix,
    [SIMONSU_SHEETS.HAK_AKSES_ROLE]: hakAksesMatrix,
  };
}

export function parseGvizDate(cell: any): string {
  if (!cell) return '';
  const normalizeDateStr = (raw: string): string => {
    const s = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    if (/^\d{4}\/\d{1,2}\/\d{1,2}/.test(s)) {
      const [y, m, d] = s.split(/[\/\sT]/);
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) {
      const [d, m, y] = s.split(/[\/\sT]/);
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    if (/^\d{1,2}-\d{1,2}-\d{4}/.test(s)) {
      const [d, m, y] = s.split(/[-\sT]/);
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return s;
  };
  if (typeof cell === 'string') {
    return normalizeDateStr(cell);
  }
  if (cell.f && /^\d{4}-\d{2}-\d{2}$/.test(String(cell.f).trim())) return String(cell.f).trim();
  if (typeof cell.v === 'string') {
    if (cell.v.startsWith('Date(')) {
      const parts = cell.v.replace('Date(', '').replace(')', '').split(',').map(Number);
      const y = parts[0];
      const m = String(parts[1] + 1).padStart(2, '0');
      const d = String(parts[2]).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return normalizeDateStr(cell.v);
  }
  return normalizeDateStr(String(cell.f || cell.v || ''));
}

export function parseGvizTime(cell: any): string {
  if (!cell) return '';
  const normalizeTimeStr = (raw: string): string => {
    const trimmed = raw.trim();
    const m = trimmed.match(/^(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?$/);
    if (m) {
      return `${m[1].padStart(2, '0')}:${m[2]}`;
    }
    return trimmed;
  };
  if (typeof cell === 'string') {
    return normalizeTimeStr(cell);
  }
  if (cell.f && /^\d{1,2}[:.]\d{2}/.test(String(cell.f).trim())) {
    return normalizeTimeStr(String(cell.f));
  }
  if (typeof cell.v === 'string' && cell.v.startsWith('Date(')) {
    const parts = cell.v.replace('Date(', '').replace(')', '').split(',').map(Number);
    const hh = String(parts[3] || 0).padStart(2, '0');
    const mm = String(parts[4] || 0).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  return normalizeTimeStr(String(cell.f || cell.v || ''));
}

export function parseRecordsFromRows(
  rows: any[],
  rooms: Room[],
  deletedRecordKeys: string[] = []
): TemperatureRecord[] {
  const deletedSet = new Set(deletedRecordKeys);
  const records: TemperatureRecord[] = [];

  rows.forEach((r: any, index: number) => {
    const c = r.c || (Array.isArray(r) ? r.map((v) => ({ v, f: String(v ?? '') })) : []);
    if (!c || c.length === 0) return;

    const date = parseGvizDate(c[0]);
    const time = parseGvizTime(c[1]);

    const col4Val = c[4]?.v !== undefined ? c[4]?.v : c[4]?.f;
    const col3Val = c[3]?.v !== undefined ? c[3]?.v : c[3]?.f;

    let roomRaw = '';
    let roomCodeFromSheet = '';
    let roomIdFromSheet = '';
    let tempRaw: any;
    let humRaw: any;
    let statusRaw = '';
    let recordedBy = '';
    let notesRaw = '';
    let recordIdFromSheet = '';

    const col3Str = (c[3]?.f ?? c[3]?.v ?? '').toString().trim();
    const col2Str = (c[2]?.f ?? c[2]?.v ?? '').toString().trim();
    const col4Num = parseNumericValue(col4Val);
    const col3Num = parseNumericValue(col3Val);

    if (col4Num !== null && (col3Str !== '' || col2Str !== '')) {
      roomCodeFromSheet = col2Str;
      roomRaw = col3Str || col2Str;
      tempRaw = col4Val;
      humRaw = c[5]?.v !== undefined ? c[5]?.v : c[5]?.f;
      statusRaw = (c[6]?.f ?? c[6]?.v ?? '').toString().trim().toUpperCase();
      recordedBy = (c[7]?.f ?? c[7]?.v ?? 'Petugas').toString().trim() || 'Petugas';
      notesRaw = (c[8]?.f ?? c[8]?.v ?? '').toString().trim();
      recordIdFromSheet = (c[9]?.f ?? c[9]?.v ?? '').toString().trim();
      roomIdFromSheet = (c[10]?.f ?? c[10]?.v ?? '').toString().trim();
    } else {
      roomRaw = col2Str;
      tempRaw = col3Num !== null ? col3Val : col4Val;
      humRaw =
        c[4]?.v !== undefined ? c[4]?.v : c[5]?.v !== undefined ? c[5]?.v : c[5]?.f;
      statusRaw = (c[5]?.f ?? c[5]?.v ?? c[6]?.f ?? c[6]?.v ?? '')
        .toString()
        .trim()
        .toUpperCase();
      recordedBy = (c[6]?.f ?? c[6]?.v ?? c[7]?.f ?? c[7]?.v ?? 'Petugas').toString().trim() || 'Petugas';
      notesRaw = (c[7]?.f ?? c[7]?.v ?? c[8]?.f ?? c[8]?.v ?? '').toString().trim();
    }

    const temp = parseNumericValue(tempRaw);
    const parsedHum = parseNumericValue(humRaw);
    const hum = parsedHum !== null ? parsedHum : undefined;

    if (!date || !time || temp === null) return;
    if (!roomRaw && !roomIdFromSheet && !roomCodeFromSheet) return;
    if (date.toLowerCase().includes('tanggal') || roomRaw.toLowerCase().includes('nama_ruang'))
      return;

    const target = roomRaw.toLowerCase();
    const codeTarget = roomCodeFromSheet.toLowerCase();

    // Strict priority: 1) ID_Ruang exact, 2) Kode_Ruang exact, 3) Nama_Ruangan exact, 4) Fallback partial/keyword
    const matchedRoom =
      (roomIdFromSheet ? rooms.find((rm) => rm.id === roomIdFromSheet) : undefined) ||
      (codeTarget ? rooms.find((rm) => rm.code.toLowerCase() === codeTarget) : undefined) ||
      rooms.find((rm) => rm.name.toLowerCase() === target || rm.code.toLowerCase() === target) ||
      rooms.find((rm) => {
        const rmName = rm.name.toLowerCase();
        const rmCode = rm.code.toLowerCase();
        return (
          rmName.includes(target) ||
          target.includes(rmName) ||
          (target.includes('patologi') && (rmCode === 'lab-pk' || rmName.includes('patologi'))) ||
          (target.includes('kimia') && (rmCode === 'lab-kim' || rmName.includes('kimia'))) ||
          (target.includes('mikro') && (rmCode === 'lab-mik' || rmName.includes('mikrobiologi'))) ||
          (target.includes('parasit') && (rmCode === 'lab-par' || rmName.includes('parasitologi'))) ||
          (target.includes('reagen') && (rmCode === 'rr-01' || rmName.includes('reagen'))) ||
          (target.includes('sampel') && (rmCode === 'rs-01' || rmName.includes('sampel'))) ||
          (target.includes('hematologi') && (rmCode === 'lab-hem' || rmName.includes('hematologi')))
        );
      });

    const roomId = matchedRoom?.id || roomIdFromSheet || `rm-gen-${index}`;
    const roomCode = matchedRoom?.code || roomCodeFromSheet || roomRaw.toUpperCase().slice(0, 7);
    const roomName = matchedRoom?.name || roomRaw;

    let status: TemperatureStatus = 'NORMAL';
    if (statusRaw === 'NORMAL' || statusRaw === 'PERHATIAN' || statusRaw === 'KRITIS') {
      status = statusRaw;
    } else if (matchedRoom) {
      status = calculateTemperatureStatus(temp, matchedRoom);
    }

    let humStatus: TemperatureStatus | undefined = undefined;
    if (hum !== undefined && matchedRoom) {
      humStatus = calculateHumidityStatus(hum, matchedRoom);
    }

    const candidate: TemperatureRecord = {
      id:
        recordIdFromSheet ||
        `sheet-${date}-${time}-${roomCode}-${Number(temp).toFixed(1)}-${index}`,
      room_id: roomId,
      room_code: roomCode,
      room_name: roomName,
      date,
      time,
      temperature: temp,
      humidity: hum,
      status,
      humidity_status: humStatus,
      notes: notesRaw === '-' ? '' : notesRaw,
      recorded_by: recordedBy,
      recorded_by_id: 'usr-petugas',
      created_at: `${date}T${time}:00Z`,
      updated_at: `${date}T${time}:00Z`,
    };

    if (getRecordAllKeys(candidate).some((k) => deletedSet.has(k))) {
      return;
    }

    records.push(candidate);
  });

  return records;
}

export function parseRoomsFromRows(rows: any[], deletedRoomKeys: string[] = []): Room[] {
  const deletedSet = new Set(deletedRoomKeys);
  const rooms: Room[] = [];
  rows.forEach((r: any, idx: number) => {
    const c = r.c || (Array.isArray(r) ? r.map((v) => ({ v, f: String(v ?? '') })) : []);
    if (!c || c.length < 5) return;
    const id = (c[0]?.f ?? c[0]?.v ?? `rm-${idx + 1}`).toString().trim() || `rm-${idx + 1}`;
    const code = (c[1]?.f ?? c[1]?.v ?? '').toString().trim();
    const name = (c[2]?.f ?? c[2]?.v ?? '').toString().trim();
    if (!code || !name || code.toLowerCase().includes('kode')) return;

    if (deletedSet.has(id) || deletedSet.has(code.toLowerCase().trim())) {
      return;
    }

    rooms.push({
      id,
      code,
      name,
      location: (c[3]?.f ?? c[3]?.v ?? '').toString().trim(),
      min_temperature: parseCellNumber(c[4], 20),
      max_temperature: parseCellNumber(c[5], 25),
      critical_min: parseCellNumber(c[6], 18),
      critical_max: parseCellNumber(c[7], 28),
      min_humidity: parseCellNumber(c[8], 40),
      max_humidity: parseCellNumber(c[9], 60),
      is_active: !(c[10]?.f ?? c[10]?.v ?? 'AKTIF').toString().toUpperCase().includes('NON'),
      description: (c[11]?.f ?? c[11]?.v ?? '').toString().trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });
  return rooms;
}

export function parseUsersFromRows(
  rows: any[],
  existingUsers: User[] = [],
  deletedUserKeys: string[] = []
): User[] {
  const deletedSet = new Set(deletedUserKeys);
  const users: User[] = [];
  rows.forEach((r: any, idx: number) => {
    const c = r.c || (Array.isArray(r) ? r.map((v) => ({ v, f: String(v ?? '') })) : []);
    if (!c || c.length < 4) return;
    const id = (c[0]?.f ?? c[0]?.v ?? `usr-${idx + 1}`).toString().trim() || `usr-${idx + 1}`;
    const username = (c[1]?.f ?? c[1]?.v ?? '').toString().trim().toLowerCase();
    if (!username || username.includes('username')) return;

    // Guard against stray date/time rows accidentally present in Data_Pengguna
    if (/^\d{4}-\d{2}-\d{2}$/.test(id) || /^\d{1,2}:\d{2}$/.test(username)) {
      return;
    }

    if (deletedSet.has(id) || deletedSet.has(username)) {
      return;
    }

    const hasPasswordCol = c.length >= 10;
    const existing = existingUsers.find((u) => u.username.toLowerCase() === username || u.id === id);

    const password = hasPasswordCol
      ? (c[2]?.f ?? c[2]?.v ?? existing?.password ?? '').toString().trim()
      : existing?.password || '';
    const name = (c[hasPasswordCol ? 3 : 2]?.f ?? c[hasPasswordCol ? 3 : 2]?.v ?? '').toString().trim();
    const nip = (c[hasPasswordCol ? 4 : 3]?.f ?? c[hasPasswordCol ? 4 : 3]?.v ?? '-').toString().trim();
    const position = (c[hasPasswordCol ? 5 : 4]?.f ?? c[hasPasswordCol ? 5 : 4]?.v ?? '-').toString().trim();
    const roleRaw = (c[hasPasswordCol ? 6 : 5]?.f ?? c[hasPasswordCol ? 6 : 5]?.v ?? 'PETUGAS')
      .toString()
      .trim()
      .toUpperCase();
    const email = (c[hasPasswordCol ? 7 : 6]?.f ?? c[hasPasswordCol ? 7 : 6]?.v ?? '-').toString().trim();
    const rawAssignedCell = c[hasPasswordCol ? 8 : 7]?.f ?? c[hasPasswordCol ? 8 : 7]?.v;
    const assignedStr = (rawAssignedCell !== undefined && rawAssignedCell !== null ? String(rawAssignedCell) : '')
      .trim();
    const statusStr = (c[hasPasswordCol ? 9 : 8]?.f ?? c[hasPasswordCol ? 9 : 8]?.v ?? 'AKTIF')
      .toString()
      .toUpperCase();

    if (!name) return;

    const normalizedRole = roleRaw === 'ADMIN' ? 'ADMIN' : 'PETUGAS';
    const parsedAssigned = normalizeAssignedRoomIds(
      assignedStr
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean),
      normalizedRole
    );

    users.push({
      id,
      username,
      password,
      name,
      nip,
      position,
      role: normalizedRole,
      email,
      assigned_room_ids: parsedAssigned,
      is_active: !statusStr.includes('NON'),
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });
  return users;
}

export function parseAuditLogsFromRows(rows: any[]): AuditLog[] {
  const logs: AuditLog[] = [];
  rows.forEach((r: any, idx: number) => {
    const c = r.c || (Array.isArray(r) ? r.map((v) => ({ v, f: String(v ?? '') })) : []);
    if (!c || c.length < 4) return;
    const id = (c[0]?.f || c[0]?.v || `log-${idx}`).toString().trim();
    const createdAt = (c[1]?.f || c[1]?.v || '').toString().trim();
    if (!id || id.toLowerCase().includes('id_log')) return;

    const hasUserIdCol = c.length >= 7;
    const userId = hasUserIdCol
      ? (c[2]?.f || c[2]?.v || 'usr-admin').toString().trim()
      : 'usr-admin';
    const userName = (c[hasUserIdCol ? 3 : 2]?.f || c[hasUserIdCol ? 3 : 2]?.v || 'Petugas')
      .toString()
      .trim();
    const action = (c[hasUserIdCol ? 4 : 3]?.f || c[hasUserIdCol ? 4 : 3]?.v || 'INPUT_SUHU')
      .toString()
      .trim() as AuditLog['action'];
    const recordId = (c[hasUserIdCol ? 5 : 4]?.f || c[hasUserIdCol ? 5 : 4]?.v || '')
      .toString()
      .trim();
    const details = (c[hasUserIdCol ? 6 : 5]?.f || c[hasUserIdCol ? 6 : 5]?.v || '')
      .toString()
      .trim();

    if (!details) return;

    logs.push({
      id,
      user_id: userId,
      user_name: userName,
      action,
      record_id: recordId === '-' ? undefined : recordId,
      details,
      created_at: createdAt || new Date().toISOString(),
    });
  });
  return logs;
}

export function parseRoleConfigsFromRows(rows: any[]): Record<string, RoleConfig> | null {
  const configs: Record<string, RoleConfig> = {};
  let foundAny = false;

  const toBool = (cell: any): boolean => {
    const v = (cell?.f || cell?.v || '').toString().trim().toUpperCase();
    return v === 'YA' || v === 'TRUE' || v === '1' || v === 'AKTIF';
  };

  rows.forEach((r: any) => {
    const c = r.c || (Array.isArray(r) ? r.map((v) => ({ v, f: String(v ?? '') })) : []);
    if (!c || c.length < 15) return;
    const code = (c[0]?.f || c[0]?.v || '').toString().trim().toUpperCase();
    if (code !== 'ADMIN' && code !== 'PETUGAS') return;

    foundAny = true;
    const permissions: Record<PermissionKey, boolean> = {
      dashboard: toBool(c[3]),
      input: toBool(c[4]),
      data: toBool(c[5]),
      data_edit: toBool(c[6]),
      data_delete: toBool(c[7]),
      grafik: toBool(c[8]),
      master: toBool(c[9]),
      master_edit: toBool(c[10]),
      laporan: toBool(c[11]),
      users: toBool(c[12]),
      audit: toBool(c[13]),
      pengaturan: code === 'ADMIN' ? true : toBool(c[14]),
    };

    configs[code] = {
      code,
      label: (c[1]?.f || c[1]?.v || code).toString().trim(),
      description: (c[2]?.f || c[2]?.v || '').toString().trim(),
      permissions,
    };
  });

  return foundAny ? configs : null;
}

export const GOOGLE_APPS_SCRIPT_TEMPLATE = `/**
 * SIMONSU - Google Apps Script Bridge (Sinkronisasi 2 Arah Otomatis Tanpa Login Gmail)
 * Target Spreadsheet ID: ${SPREADSHEET_ID}
 *
 * CARA PASANG (1 KALI SAJA):
 * 1. Buka Spreadsheet > Ekstensi > Apps Script.
 * 2. Hapus kode lama, tempel skrip ini, lalu Simpan.
 * 3. Klik Terapkan (Deploy) > Deployment baru > Jenis: Aplikasi Web.
 *    - Jalankan sebagai: Saya (Me)
 *    - Yang memiliki akses: Siapa saja (Anyone)
 * 4. Salin URL Web App (/exec) ke Pengaturan SIMONSU (tersimpan di server untuk semua user).
 */

var SPREADSHEET_ID = "${SPREADSHEET_ID}";

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function doGet(e) {
  try {
    var ss = getSpreadsheet();
    var sheetNames = [
      "Dashboard_Ringkasan", "Data_Suhu", "Grafik_Tren", "Master_Ruangan",
      "Rekap_Laporan", "Data_Pengguna", "Audit_Log", "Hak_Akses_Role"
    ];
    var result = {};
    sheetNames.forEach(function(name) {
      var sh = ss.getSheetByName(name);
      if (sh && sh.getLastRow() > 1) {
        var values = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getDisplayValues();
        result[name] = values;
      } else {
        result[name] = [];
      }
    });
    return ContentService.createTextOutput(JSON.stringify({ status: "success", sheets: result })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var ss = getSpreadsheet();
    var data = JSON.parse(e.postData.contents);

    if (data.action === "sync_all_sheets" && data.sheets) {
      for (var sheetName in data.sheets) {
        var sh = ss.getSheetByName(sheetName);
        if (!sh) {
          sh = ss.insertSheet(sheetName);
        }
        var rows = data.sheets[sheetName];
        var headers = (data.headers && data.headers[sheetName]) || (rows && rows.length > 0 ? Object.keys(rows[0]) : []);
        sh.clearContents();
        if (headers && headers.length > 0) {
          sh.getRange(1, 1, 1, headers.length).setValues([headers]);
          var headerRange = sh.getRange(1, 1, 1, headers.length);
          headerRange.setBackground("#0891b2");
          headerRange.setFontColor("#ffffff");
          headerRange.setFontWeight("bold");
          sh.setFrozenRows(1);

          if (rows && rows.length > 0) {
            var matrix = rows.map(function(item) {
              return headers.map(function(h) { return item[h] !== undefined ? item[h] : "-"; });
            });
            sh.getRange(2, 1, matrix.length, headers.length).setValues(matrix);
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Semua 8 sheet tersinkronisasi" })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "ok" })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}
`;
