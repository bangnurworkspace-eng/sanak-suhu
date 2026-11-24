import React, { useState } from 'react';
import {
  Thermometer,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  Sun,
  Moon,
  Loader2,
} from 'lucide-react';
import { authenticateUser } from '../utils/storage';
import { User as UserType } from '../types/simonsu';

interface LoginViewProps {
  users: UserType[];
  isLoadingUsers?: boolean;
  hasLoadedOnce?: boolean;
  syncError?: string | null;
  onLoginSuccess: (user: UserType) => void;
  onCreateFirstAdmin?: (adminUser: UserType) => Promise<void>;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  users,
  isLoadingUsers = false,
  hasLoadedOnce = true,
  syncError = null,
  onLoginSuccess,
  onCreateFirstAdmin,
  darkMode,
  onToggleDarkMode,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const needsBootstrapAdmin = hasLoadedOnce && !isLoadingUsers && !syncError && users.length === 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (isLoadingUsers) {
      setErrorMsg('Sedang memuat daftar akun dari Google Spreadsheet...');
      return;
    }

    if (!username.trim() || !password) {
      setErrorMsg('Username dan Password wajib diisi.');
      return;
    }

    const authenticatedUser = authenticateUser(username, password, users);
    if (authenticatedUser) {
      onLoginSuccess(authenticatedUser);
    } else {
      setErrorMsg('Username atau Password salah, atau akun Anda dinonaktifkan di Spreadsheet.');
    }
  };

  const handleBootstrapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!username.trim() || !password) {
      setErrorMsg('Username dan Password wajib diisi.');
      return;
    }

    if (!onCreateFirstAdmin) return;

    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();
      const cleanUsername = username.trim().toLowerCase();
      const firstAdmin: UserType = {
        id: 'usr-admin',
        username: cleanUsername,
        password,
        name: username.trim(),
        email: '-',
        role: 'ADMIN',
        nip: '-',
        position: 'Administrator Sistem',
        assigned_room_ids: ['ALL'],
        is_active: true,
        created_at: now,
        updated_at: now,
      };
      await onCreateFirstAdmin(firstAdmin);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan akun ke Google Spreadsheet.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col justify-between transition-colors duration-200 ${
        darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Top Bar / Theme Switcher */}
      <div className="max-w-7xl mx-auto w-full px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 p-0.5 flex items-center justify-center shadow-sm">
            <div className="w-full h-full bg-slate-900 rounded-[6px] flex items-center justify-center">
              <Thermometer className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
          <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white font-poppins">
            SIMONSU
          </span>
        </div>

        <button
          onClick={onToggleDarkMode}
          className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-xs font-semibold flex items-center gap-1.5 shadow-sm"
        >
          {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-cyan-600" />}
          <span>{darkMode ? 'Terang' : 'Gelap'}</span>
        </button>
      </div>

      {/* Main Login Card */}
      <div className="my-auto max-w-md w-full mx-auto px-4 py-8">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6 transition-colors">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 p-0.5 shadow-lg shadow-cyan-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
                <Thermometer className="w-7 h-7 text-cyan-400 animate-pulse" />
              </div>
            </div>
            <div className="text-[10px] font-bold tracking-wider text-cyan-600 dark:text-cyan-400 uppercase mt-2">
              UPT LABORATORIUM KESEHATAN KOTA BONTANG
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white font-poppins tracking-tight">
              Login SIMONSU
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {needsBootstrapAdmin
                ? 'Sheet Data_Pengguna di Google Spreadsheet masih kosong. Masukkan username dan password untuk membuat akun Admin pertama langsung ke Spreadsheet.'
                : 'Masukkan username dan password akun SIMONSU Anda yang tersinkronisasi dengan Google Spreadsheet.'}
            </p>
          </div>

          {/* Sync / Read Error Notification */}
          {(errorMsg || syncError) && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg || syncError}</span>
            </div>
          )}

          {needsBootstrapAdmin ? (
            <form onSubmit={handleBootstrapSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Masukkan username..."
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-cyan-500 rounded-xl pl-10 pr-4 py-3 text-xs text-slate-900 dark:text-white focus:outline-none transition-colors"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Masukkan password..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-cyan-500 rounded-xl pl-10 pr-10 py-3 text-xs text-slate-900 dark:text-white focus:outline-none transition-colors"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] mt-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan ke Spreadsheet...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk Ke Sistem</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Masukkan username Anda..."
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-cyan-500 rounded-xl pl-10 pr-4 py-3 text-xs text-slate-900 dark:text-white focus:outline-none transition-colors"
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Masukkan password Anda..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-cyan-500 rounded-xl pl-10 pr-10 py-3 text-xs text-slate-900 dark:text-white focus:outline-none transition-colors"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoadingUsers}
                className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] mt-2 disabled:opacity-50"
              >
                {isLoadingUsers ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memuat Akun Spreadsheet...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk Ke Sistem</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-4 text-xs text-slate-400 dark:text-slate-500 font-medium">
        SIMONSU v2.4 • UPT Laboratorium Kesehatan Kota Bontang
      </div>
    </div>
  );
};
