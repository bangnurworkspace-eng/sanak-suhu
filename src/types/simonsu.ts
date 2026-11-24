/**
 * SIMONSU - Types & Interfaces
 * Sistem Monitoring Suhu Ruangan UPT Laboratorium Kesehatan Kota Bontang
 */

export type UserRoleCode = 'ADMIN' | 'PETUGAS' | string;

export interface User {
  id: string;
  username: string;
  password: string;       // Password credential
  name: string;
  email: string;
  role: UserRoleCode;
  nip: string;
  position: string;
  assigned_room_ids?: string[]; // e.g. ['rm-1', 'rm-2'] or ['ALL']
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type PermissionKey =
  | 'dashboard'
  | 'input'
  | 'data'
  | 'data_edit'
  | 'data_delete'
  | 'grafik'
  | 'master'
  | 'master_edit'
  | 'laporan'
  | 'users'
  | 'audit'
  | 'pengaturan';

export interface RoleConfig {
  code: string;
  label: string;
  description: string;
  permissions: Record<PermissionKey, boolean>;
}

export interface Room {
  id: string;
  code: string;           // e.g. LAB-KIM
  name: string;           // e.g. Laboratorium Kimia
  location: string;       // e.g. Lantai 1 Gedung Utama
  description: string;    // e.g. Ruang pengujian spesimen kimia darah & urin
  min_temperature: number;// e.g. 20.0 (°C)
  max_temperature: number;// e.g. 25.0 (°C)
  critical_min: number;   // e.g. 18.0 (°C)
  critical_max: number;   // e.g. 28.0 (°C)
  min_humidity?: number;  // e.g. 40.0 (%)
  max_humidity?: number;  // e.g. 60.0 (%)
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type TemperatureStatus = 'NORMAL' | 'PERHATIAN' | 'KRITIS';

export interface TemperatureRecord {
  id: string;
  room_id: string;
  room_code?: string;
  room_name?: string;
  date: string;          // YYYY-MM-DD
  time: string;          // HH:mm
  temperature: number;   // e.g. 23.8 (°C)
  humidity?: number;     // e.g. 52.0 (% RH)
  status: TemperatureStatus;
  humidity_status?: TemperatureStatus;
  notes?: string;
  recorded_by: string;   // Name of petugas/user
  recorded_by_id: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  action: 'INPUT_SUHU' | 'EDIT_SUHU' | 'HAPUS_SUHU' | 'TAMBAH_RUANGAN' | 'EDIT_RUANGAN' | 'HAPUS_RUANGAN' | 'TAMBAH_USER' | 'EDIT_USER' | 'HAPUS_USER' | 'UPDATE_ROLE' | 'RESET_DEMO';
  record_id?: string;
  old_data?: string;
  new_data?: string;
  details: string;
  created_at: string;
}

export type DateFilterType = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'all' | 'custom';

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface RoomStatsSummary {
  room: Room;
  totalRecords: number;
  minTemp: number | null;
  maxTemp: number | null;
  avgTemp: number | null;
  normalCount: number;
  perhatianCount: number;
  kritisCount: number;
  latestRecord?: TemperatureRecord;
}

export interface PdfSignatory {
  roleTitle: string; // e.g. 'Kepala UPT Laboratorium Kesehatan'
  subTitle?: string; // e.g. 'Kota Bontang'
  name: string;      // e.g. 'Dr. Handayani, M.Kes'
  nip: string;       // e.g. 'NIP. 19781105 200501 2 008'
}

export interface PdfExportOptions {
  institutionName: string;    // e.g. 'PEMERINTAH KOTA BONTANG'
  departmentName: string;     // e.g. 'DINAS KESEHATAN'
  subDepartmentName: string;  // e.g. 'UPT LABORATORIUM KESEHATAN KOTA BONTANG'
  addressText: string;        // e.g. 'Jl. Ahmad Yani No. 1, Kota Bontang, Kalimantan Timur'
  contactText: string;        // e.g. 'Email: labkes@bontangkota.go.id | Telepon: (0548) 21102'
  reportTitle: string;        // e.g. 'LAPORAN MONITORING SUHU RUANGAN (SIMONSU)'
  cityName: string;           // e.g. 'Bontang'
  showDualSignatory: boolean; // True: 2 Penandatangan (Kiri & Kanan)
  primarySignatory: PdfSignatory;   // Kanan / Utama
  secondarySignatory?: PdfSignatory; // Kiri / Pembuat
  includeChart?: boolean;           // Sertakan grafik fluktuasi suhu & kelembapan dalam PDF (default: true)
  chartMetric?: 'temperature' | 'humidity' | 'both'; // Pilihan metrik grafik yang diekspor
  chartCurve?: 'monotone' | 'linear';                // Tipe garis grafik: Halus (monotone) atau Lurus (linear)
}
