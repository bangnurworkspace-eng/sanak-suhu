import React, { useState, useEffect } from 'react';
import {
  Settings,
  Moon,
  Sun,
  Info,
  ShieldCheck,
  Check,
  X,
  FileSpreadsheet,
  ExternalLink,
  Layers,
  Download,
  Copy,
  Database,
  Building2,
  Users,
  ShieldAlert,
  Key,
  LayoutDashboard,
  TrendingUp,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { RoleConfig, PermissionKey, User, Room, TemperatureRecord, AuditLog } from '../types/simonsu';
import { DEFAULT_ROLE_CONFIGS, logAudit } from '../utils/storage';
import {
  SPREADSHEET_ID,
  SPREADSHEET_URL,
  SIMONSU_SHEETS,
  saveServerWebhookConfig,
  exportAllSheetsToExcel,
  GOOGLE_APPS_SCRIPT_TEMPLATE,
  type ServerSyncMeta,
} from '../utils/googleSheets';

interface SettingsViewProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onClearAllData: () => void;
  roleConfigs: Record<string, RoleConfig>;
  onUpdateRoleConfigs: (updatedConfigs: Record<string, RoleConfig>) => void;
  currentUser: User;
  rooms?: Room[];
  records?: TemperatureRecord[];
  users?: User[];
  auditLogs?: AuditLog[];
  syncMeta?: ServerSyncMeta | null;
  onConfigSaved?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  darkMode,
  onToggleDarkMode,
  roleConfigs,
  onUpdateRoleConfigs,
  currentUser,
  rooms = [],
  records = [],
  users = [],
  auditLogs = [],
  syncMeta = null,
  onConfigSaved,
}) => {
  const [activeTab, setActivePage] = useState<'general' | 'sheets' | 'roles'>('general');
  const [selectedRoleCode, setSelectedRoleCode] = useState<string>('PETUGAS');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorBannerMsg, setErrorBannerMsg] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrlState] = useState<string>(syncMeta?.webhookUrl || '');
  const [isSavingWebhook, setIsSavingWebhook] = useState<boolean>(false);
  const [webhookSaved, setWebhookSaved] = useState<boolean>(false);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);

  const effectiveRoleConfigs =
    Object.keys(roleConfigs).length > 0 ? roleConfigs : DEFAULT_ROLE_CONFIGS;

  useEffect(() => {
    if (syncMeta?.webhookUrl !== undefined && !isSavingWebhook) {
      setWebhookUrlState((prev) => prev || syncMeta.webhookUrl || '');
    }
  }, [syncMeta?.webhookUrl, isSavingWebhook]);

  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingWebhook(true);
    setErrorBannerMsg(null);
    try {
      const res = await saveServerWebhookConfig(webhookUrl);
      setWebhookSaved(true);
      setSaveSuccessMsg(res.message);
      if (onConfigSaved) onConfigSaved();
      setTimeout(() => {
        setWebhookSaved(false);
        setSaveSuccessMsg(null);
      }, 4500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan URL Web App ke server.';
      setErrorBannerMsg(msg);
      setTimeout(() => setErrorBannerMsg(null), 4000);
    } finally {
      setIsSavingWebhook(false);
    }
  };

  const handleDownloadExcel = () => {
    exportAllSheetsToExcel({
      records,
      rooms,
      users,
      auditLogs,
      roleConfigs,
    });
    setSaveSuccessMsg('File spreadsheet 8-sheet (.xlsx) berhasil di-download.');
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  const handleCopyScript = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
      } else {
        throw new Error('Clipboard API tidak tersedia');
      }
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 3000);
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = GOOGLE_APPS_SCRIPT_TEMPLATE;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setCopiedScript(true);
        setTimeout(() => setCopiedScript(false), 3000);
      } catch {
        setErrorBannerMsg('Gagal menyalin otomatis. Silakan blok dan salin kode skrip secara manual.');
        setTimeout(() => setErrorBannerMsg(null), 4000);
      }
    }
  };

  const permissionLabels: { key: PermissionKey; title: string; category: string }[] = [
    { key: 'dashboard', title: 'Halaman Dashboard', category: 'Fitur Utama' },
    { key: 'input', title: 'Input Suhu Manual', category: 'Fitur Utama' },
    { key: 'data', title: 'Melihat Data Suhu', category: 'Histori Data' },
    { key: 'data_edit', title: 'Mengubah (Edit) Data Suhu', category: 'Histori Data' },
    { key: 'data_delete', title: 'Menghapus Data Suhu', category: 'Histori Data' },
    { key: 'grafik', title: 'Melihat Grafik Suhu', category: 'Visualisasi' },
    { key: 'master', title: 'Melihat Master Ruangan', category: 'Konfigurasi' },
    { key: 'master_edit', title: 'Kelola (Tambah/Edit/Hapus) Master Ruangan', category: 'Konfigurasi' },
    { key: 'laporan', title: 'Melihat & Export Laporan Excel/PDF', category: 'Laporan' },
    { key: 'users', title: 'Manajemen Pengguna (User CRUD)', category: 'Sistem' },
    { key: 'audit', title: 'Melihat Audit Log Aktivitas', category: 'Sistem' },
    { key: 'pengaturan', title: 'Mengakses Pengaturan Sistem', category: 'Sistem' },
  ];

  const handleTogglePermission = (roleCode: string, pKey: PermissionKey) => {
    if (roleCode === 'ADMIN' && pKey === 'pengaturan') {
      setErrorBannerMsg('Role ADMIN harus memiliki akses ke Pengaturan Sistem agar tidak terkunci.');
      setTimeout(() => setErrorBannerMsg(null), 4000);
      return;
    }

    const currentRole = effectiveRoleConfigs[roleCode];
    if (!currentRole) return;

    const updatedPermissions = {
      ...currentRole.permissions,
      [pKey]: !currentRole.permissions[pKey],
    };

    const updatedConfigs = {
      ...effectiveRoleConfigs,
      [roleCode]: {
        ...currentRole,
        permissions: updatedPermissions,
      },
    };

    logAudit(
      currentUser,
      'UPDATE_ROLE',
      `${currentUser.name} memperbarui matriks hak akses untuk role ${roleCode}`
    );

    onUpdateRoleConfigs(updatedConfigs);

    setSaveSuccessMsg(`Matriks hak akses role ${currentRole.label} berhasil diperbarui & disinkronkan ke Sheet Hak_Akses_Role.`);
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  const selectedRoleConfig = effectiveRoleConfigs[selectedRoleCode];

  // List of all 8 sheets definitions matching every page in the application
  const sheetDefinitions = [
    {
      name: SIMONSU_SHEETS.DASHBOARD,
      title: 'Halaman Dashboard & Status Terkini',
      desc: 'Ringkasan KPI harian dan status suhu & kelembapan terbaru untuk setiap ruangan laboratorium.',
      icon: LayoutDashboard,
      count: `${rooms.filter((r) => r.is_active).length} ruang + KPI`,
      columns: ['Kode_Ruang', 'Nama_Ruangan', 'Lokasi', 'Standar_Suhu_C', 'Standar_RH', 'Suhu_Terakhir_C', 'Kelembapan_Terakhir_RH', 'Status_Terakhir', 'Waktu_Update', 'Petugas_Terakhir'],
      color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800',
    },
    {
      name: SIMONSU_SHEETS.DATA_SUHU,
      title: 'Halaman Input Suhu & Data Suhu',
      desc: 'Histori lengkap rekaman suhu dan kelembapan ruangan lab harian sesuai penginputan petugas.',
      icon: Database,
      count: `${records.length} data`,
      columns: ['ID_Data', 'Tanggal', 'Waktu', 'Kode_Ruang', 'Nama_Ruangan', 'Suhu_C', 'Kelembapan_RH', 'Status_Suhu', 'Petugas', 'Catatan'],
      color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-800',
    },
    {
      name: SIMONSU_SHEETS.GRAFIK_TREN,
      title: 'Halaman Grafik Garis Tren Suhu',
      desc: 'Deret waktu (time-series) titik plot grafik garis beserta batas minimum dan maksimum ruangan.',
      icon: TrendingUp,
      count: `${records.length} titik plot`,
      columns: ['No_Urut', 'Waktu_Plot', 'Tanggal', 'Jam', 'Kode_Ruang', 'Nama_Ruangan', 'Suhu_Aktual_C', 'Batas_Min_C', 'Batas_Max_C', 'Kelembapan_Aktual_RH', 'Status_Titik', 'Petugas'],
      color: 'text-sky-500 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800',
    },
    {
      name: SIMONSU_SHEETS.MASTER_RUANGAN,
      title: 'Halaman Master Ruangan Laboratorium',
      desc: 'Konfigurasi ruangan, lokasi gedung, serta ambang batas suhu & kelembapan aman.',
      icon: Building2,
      count: `${rooms.length} ruangan`,
      columns: ['ID_Ruang', 'Kode_Ruang', 'Nama_Ruangan', 'Lokasi', 'Suhu_Min', 'Suhu_Max', 'Kritis_Min', 'Kritis_Max', 'Kelembapan_Min', 'Kelembapan_Max', 'Status_Aktif', 'Keterangan'],
      color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
    },
    {
      name: SIMONSU_SHEETS.REKAP_LAPORAN,
      title: 'Halaman Laporan & Rekapitulasi Statistik',
      desc: 'Rekapitulasi statistik per ruangan (Suhu Min, Max, Rata-rata, Kelembapan, Normal, Perhatian, Kritis).',
      icon: FileText,
      count: `${rooms.length} rekap ruang`,
      columns: ['Kode_Ruang', 'Nama_Ruangan', 'Lokasi_Gedung', 'Standar_Suhu', 'Total_Pencatatan', 'Suhu_Min_C', 'Suhu_Max_C', 'Suhu_Rata2_C', 'Kelembapan_Rata2_RH', 'Jml_Normal', 'Jml_Perhatian', 'Jml_Kritis', 'Persentase_Normal'],
      color: 'text-teal-500 bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800',
    },
    {
      name: SIMONSU_SHEETS.DATA_PENGGUNA,
      title: 'Halaman Manajemen Pengguna & Profil',
      desc: 'Daftar akun petugas laboratorium dan admin beserta NIP, jabatan, & akses ruangan.',
      icon: Users,
      count: `${users.length} user`,
      columns: ['ID_User', 'Username', 'Password', 'Nama_Lengkap', 'NIP', 'Jabatan', 'Role', 'Email', 'Akses_Ruangan', 'Status_Aktif'],
      color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
    },
    {
      name: SIMONSU_SHEETS.AUDIT_LOG,
      title: 'Halaman Audit Log Aktivitas',
      desc: 'Rekam jejak setiap aksi input, perubahan data, penambahan user, dan konfigurasi.',
      icon: ShieldAlert,
      count: `${auditLogs.length} log`,
      columns: ['ID_Log', 'Waktu_Aktivitas', 'Nama_Pengguna', 'Tindakan_Aksi', 'ID_Terkait', 'Rincian_Aktivitas'],
      color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
    },
    {
      name: SIMONSU_SHEETS.HAK_AKSES_ROLE,
      title: 'Halaman Pengaturan Hak Akses Role',
      desc: 'Tabel perizinan modul sistem untuk role ADMIN dan PETUGAS.',
      icon: Key,
      count: `${Object.keys(effectiveRoleConfigs).length} role`,
      columns: ['Kode_Role', 'Nama_Role', 'Deskripsi', 'Dashboard', 'Input_Suhu', 'Lihat_Data', 'Edit_Data', 'Hapus_Data', 'Grafik', 'Master_Ruang', 'Edit_Master', 'Laporan', 'Pengguna', 'Audit_Log', 'Pengaturan'],
      color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800',
    },
  ];

  return (
    <div className="w-full space-y-6">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-xl transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-cyan-500 to-blue-600 text-white rounded-xl shadow-md shadow-cyan-500/20">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white font-poppins">Pengaturan Sistem & Database Spreadsheet</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Konfigurasi tema, sinkronisasi penuh seluruh halaman spreadsheet (8 Sheet), dan matriks batasan role hak akses.
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-2 mt-5 border-t border-slate-100 dark:border-slate-800 pt-4">
          <button
            onClick={() => setActivePage('general')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'general'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            ⚙️ Tampilan & Integrasi
          </button>

          <button
            onClick={() => setActivePage('sheets')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'sheets'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Layers className="w-4 h-4 text-emerald-500" />
            <span>Pembagian Sheet Spreadsheet (8 Sheet)</span>
          </button>

          <button
            onClick={() => setActivePage('roles')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'roles'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <ShieldCheck className="w-4 h-4" /> Batasan Hak Akses Role
          </button>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {errorBannerMsg && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{errorBannerMsg}</span>
        </div>
      )}

      {/* Tab 1: General Settings */}
      {activeTab === 'general' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-xl space-y-6 transition-colors">
          
          {/* Dark Mode Toggle */}
          <div className="flex items-center justify-between pb-6 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {darkMode ? <Moon className="w-4 h-4 text-cyan-400" /> : <Sun className="w-4 h-4 text-amber-500" />} Mode Tampilan Aplikasi
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Pilih antara tema Gelap (Dark Mode) atau Terang (Light Mode) untuk kenyamanan mata saat bekerja.
              </p>
            </div>

            <button
              onClick={onToggleDarkMode}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm ${
                darkMode
                  ? 'bg-slate-800 text-amber-400 border-slate-700 hover:bg-slate-700'
                  : 'bg-slate-100 text-slate-900 border-slate-300 hover:bg-slate-200'
              }`}
            >
              {darkMode ? 'Switch to Light Mode ☀️' : 'Switch to Dark Mode 🌙'}
            </button>
          </div>

          {/* Google Sheets Integration Card */}
          <div className="pt-2 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Integrasi Google Spreadsheet SIMONSU (8 Sheet)
              </h3>
            </div>

            <div className="p-5 bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl space-y-4 text-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-slate-900 dark:text-white text-sm">Google Spreadsheet ID:</p>
                  <p className="font-mono text-emerald-700 dark:text-emerald-400 font-bold text-xs mt-1 break-all bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/60 inline-block">
                    {SPREADSHEET_ID}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                    Seluruh 8 halaman aplikasi (Dashboard, Data Suhu, Grafik Tren, Master Ruangan, Rekap Laporan, Data Pengguna, Audit Log, dan Hak Akses Role) tersimpan dan terbagi per tab sheet.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <a
                    href={SPREADSHEET_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 text-xs flex items-center gap-2 transition-all hover:scale-[1.02]"
                  >
                    <span>Buka Spreadsheet Sekarang</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Automatic Sync Architecture Info + Server Webhook URL Input */}
              <form onSubmit={handleSaveWebhook} className="pt-3 border-t border-emerald-200/60 dark:border-emerald-800/60 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    URL Web App Apps Script (Sinkronisasi Tulis/Hapus Otomatis di Server Tanpa Login Gmail):
                  </label>
                  {webhookSaved && (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 shrink-0">
                      <Check className="w-3.5 h-3.5" /> Tersimpan di Server
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://script.google.com/macros/s/.../exec"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrlState(e.target.value)}
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <button
                    type="submit"
                    disabled={isSavingWebhook}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold rounded-xl transition-colors shrink-0 disabled:opacity-50"
                  >
                    {isSavingWebhook ? 'Menyimpan...' : 'Simpan URL Server'}
                  </button>
                </div>
                {syncMeta?.lastSyncMessage && (
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Status Sinkronisasi Otomatis: <strong>{syncMeta.lastSyncMessage}</strong>
                  </p>
                )}
              </form>
            </div>
          </div>

          {/* System Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Info className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /> Informasi Sistem
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-0.5">
                <span className="text-slate-500 dark:text-slate-400">Instansi:</span>
                <p className="font-bold text-slate-900 dark:text-white">UPT Laboratorium Kesehatan Kota Bontang</p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-0.5">
                <span className="text-slate-500 dark:text-slate-400">Aplikasi:</span>
                <p className="font-bold text-slate-900 dark:text-white">SIMONSU v2.4 (8-Sheet Real-Time Sync Engine)</p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-0.5">
                <span className="text-slate-500 dark:text-slate-400">Penyimpanan:</span>
                <p className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">Google Spreadsheet (ID: {SPREADSHEET_ID})</p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-0.5">
                <span className="text-slate-500 dark:text-slate-400">Metode Sensor:</span>
                <p className="font-bold text-cyan-600 dark:text-cyan-400 font-mono">Input Manual Termometer Terkalibrasi</p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Tab 2: Multi-Sheet Partition (Seluruh 8 Halaman Tersimpan per Sheet) */}
      {activeTab === 'sheets' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-xl space-y-6 transition-colors">
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Struktur Pembagian 8 Sheet Spreadsheet
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Seluruh bagian halaman aplikasi dan isinya disinkronkan secara otomatis ke dalam 8 worksheet (sheet tab) terpisah di Google Spreadsheet ID: <strong className="font-mono">{SPREADSHEET_ID}</strong>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={handleDownloadExcel}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all"
                title="Download 8 sheet dalam 1 file Excel (.xlsx)"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Export 8 Sheet (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* 8 Sheet Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {sheetDefinitions.map((sheet, idx) => {
              const Icon = sheet.icon;
              return (
                <div
                  key={sheet.name}
                  className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 space-y-3 hover:border-cyan-500/50 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        Sheet #{idx + 1}
                      </span>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        {sheet.count}
                      </span>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className={`p-2 rounded-xl border shrink-0 ${sheet.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white font-mono">
                          {sheet.name}
                        </h4>
                        <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          {sheet.title}
                        </p>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      {sheet.desc}
                    </p>
                  </div>

                  {/* Columns List Preview */}
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Kolom ({sheet.columns.length}):
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {sheet.columns.map((col) => (
                        <span
                          key={col}
                          className="px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-[9.5px] font-mono text-slate-600 dark:text-slate-400"
                        >
                          {col}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Google Apps Script Automation Setup Helper */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
                  <Database className="w-4 h-4 text-cyan-500" />
                  Skrip Otomatisasi Google Apps Script (Pembuat 8 Tab & Sinkronisasi Webhook)
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Pasang kode Apps Script berikut satu kali di Google Spreadsheet (menu <strong>Ekstensi &rarr; Apps Script &rarr; Deploy sebagai Web App</strong> dengan akses <em>Anyone</em>), lalu simpan URL Web App pada tab <strong>Tampilan &amp; Integrasi</strong> agar penulisan dan penghapusan otomatis berjalan tanpa perlu login Gmail dan tanpa tombol Sinkronkan.
                </p>
              </div>

              <button
                onClick={handleCopyScript}
                className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
              >
                {copiedScript ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedScript ? 'Tersalin ke Clipboard!' : 'Salin Kode Skrip'}</span>
              </button>
            </div>

            <pre className="p-4 bg-slate-950 text-emerald-400 font-mono text-[11px] rounded-xl border border-slate-800 overflow-x-auto max-h-60 leading-relaxed selection:bg-cyan-900">
              <code>{GOOGLE_APPS_SCRIPT_TEMPLATE}</code>
            </pre>
          </div>

        </div>
      )}

      {/* Tab 3: RBAC Role Permissions Matrix Settings */}
      {activeTab === 'roles' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-xl space-y-6 transition-colors">
          
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-cyan-600 dark:text-cyan-400" /> Matriks Hak Akses & Batasan Role
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Tentukan fitur dan menu apa saja yang dapat diakses oleh masing-masing role pengguna (tersimpan & tersinkronisasi di sheet <strong>Hak_Akses_Role</strong>).
            </p>
          </div>

          {/* Role Selector Tabs */}
          <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            {Object.keys(effectiveRoleConfigs).map((rCode) => {
              const r = effectiveRoleConfigs[rCode];
              const isSelected = selectedRoleCode === rCode;
              return (
                <button
                  key={rCode}
                  onClick={() => setSelectedRoleCode(rCode)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    isSelected
                      ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                      : 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{r.label}</span>
                  <span className="text-[10px] font-mono opacity-80">({rCode})</span>
                </button>
              );
            })}
          </div>

          {selectedRoleConfig && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1">
                <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{selectedRoleConfig.label}</span>
                  <span className="text-xs px-2 py-0.5 rounded font-mono bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 font-bold">
                    {selectedRoleConfig.code}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{selectedRoleConfig.description}</p>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Daftar Batasan Izin Fitur (Permissions)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {permissionLabels.map((item) => {
                    const hasAccess = !!selectedRoleConfig.permissions[item.key];
                    return (
                      <div
                        key={item.key}
                        onClick={() => handleTogglePermission(selectedRoleCode, item.key)}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          hasAccess
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-200'
                            : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-xs">{item.title}</div>
                          <div className="text-[10px] opacity-80">{item.category}</div>
                        </div>

                        <div className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 ${
                          hasAccess ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                        }`}>
                          {hasAccess ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                          <span className="text-[10px]">{hasAccess ? 'Diizinkan' : 'Dibatasi'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
};
