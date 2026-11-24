import React, { useState, useEffect } from 'react';
import {
  Thermometer,
  Bell,
  Sun,
  Moon,
  User as UserIcon,
  Menu,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  X,
  PanelLeft,
  LogOut,
} from 'lucide-react';
import { User } from '../types/simonsu';

interface HeaderProps {
  currentUser: User;
  onOpenMobileMenu: () => void;
  onToggleCollapseDesktop: () => void;
  isCollapsedDesktop: boolean;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  attentionCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onOpenMobileMenu,
  onToggleCollapseDesktop,
  isCollapsedDesktop,
  darkMode,
  onToggleDarkMode,
  onNavigate,
  onLogout,
  attentionCount,
}) => {
  const [timeString, setTimeString] = useState('');
  const [dateString, setDateString] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(
        now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WITA'
      );
      setDateString(
        now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Zone 1: Sidebar Toggles & Brand Title */}
          <div className="flex items-center gap-3">
            {/* Mobile Drawer Button */}
            <button
              onClick={onOpenMobileMenu}
              className="lg:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
              aria-label="Buka Menu Mobile"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Desktop Sidebar Toggle Button */}
            <button
              onClick={onToggleCollapseDesktop}
              className="hidden lg:flex p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
              title={isCollapsedDesktop ? 'Buka Sidebar' : 'Ciutkan Sidebar'}
            >
              <PanelLeft className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            </button>

            {/* Logo Badge & Brand Name */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 p-0.5 shadow-md shadow-cyan-500/20 flex items-center justify-center shrink-0">
                <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
                  <Thermometer className="w-5 h-5 text-cyan-400 animate-pulse" />
                </div>
              </div>

              <div>
                <div className="text-[10px] sm:text-[11px] font-semibold tracking-wider text-cyan-700 dark:text-cyan-400 uppercase leading-none">
                  UPT LABKES KOTA BONTANG
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white font-poppins">
                    SIMONSU
                  </span>
                  <span className="hidden md:inline-block px-2 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-cyan-950/80 text-slate-700 dark:text-cyan-300 border border-slate-200 dark:border-cyan-800/60 rounded-md">
                    Monitoring Suhu
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Zone 2: Live Clock */}
          <div className="hidden md:flex flex-col items-end pr-4 border-r border-slate-200 dark:border-slate-800 text-right">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{dateString}</span>
            <span className="text-sm font-bold font-mono text-cyan-700 dark:text-cyan-400 tabular-nums">{timeString}</span>
          </div>

          {/* Zone 3: Dark Mode, Notification, User Profile */}
          <div className="flex items-center gap-2 sm:gap-3">

            {/* Dark/Light Mode Toggle */}
            <button
              onClick={onToggleDarkMode}
              className="p-2 sm:p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all border border-slate-200 dark:border-slate-700/60 flex items-center gap-1.5 text-xs font-bold"
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-cyan-600" />
              )}
              <span className="hidden xl:inline text-xs">{darkMode ? 'Terang' : 'Gelap'}</span>
            </button>

            {/* Notification Badge */}
            <div className="relative">
              <button
                onClick={() => setShowNotifDrawer(!showNotifDrawer)}
                className="relative p-2 sm:p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all border border-slate-200 dark:border-slate-700/60"
                title="Pemberitahuan Status Suhu"
              >
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                {attentionCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-slate-950 animate-bounce">
                    {attentionCount}
                  </span>
                )}
              </button>

              {/* Notification Drawer */}
              {showNotifDrawer && (
                <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 text-slate-900 dark:text-white">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <h4 className="text-sm font-bold flex items-center gap-2">
                      <Bell className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /> Status Pemantauan
                    </h4>
                    <button
                      onClick={() => setShowNotifDrawer(false)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="py-3 space-y-2">
                    {attentionCount > 0 ? (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-start gap-3 text-amber-900 dark:text-amber-200">
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div className="text-xs">
                          <p className="font-semibold text-amber-800 dark:text-amber-300">Terdapat {attentionCount} Ruangan Perlu Perhatian</p>
                          <p className="mt-0.5 text-amber-700 dark:text-amber-200/80">Suhu terdeteksi di luar batas suhu ideal.</p>
                          <button
                            onClick={() => {
                              setShowNotifDrawer(false);
                              onNavigate('data');
                            }}
                            className="mt-2 text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline inline-block"
                          >
                            Lihat Detail Data →
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-center gap-3 text-emerald-900 dark:text-emerald-200">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                        <div className="text-xs">
                          <p className="font-semibold text-emerald-800 dark:text-emerald-300">Semua Suhu Ruangan Normal</p>
                          <p className="text-slate-500 dark:text-slate-400">Pencatatan suhu hari ini terpantau stabil dalam batas acuan.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Selector Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700/60 text-left"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white text-xs shadow-inner shrink-0">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="hidden sm:block text-xs">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 leading-tight flex items-center gap-1.5">
                    {currentUser.name.split(',')[0]}
                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                      currentUser.role === 'ADMIN' ? 'bg-indigo-100 dark:bg-indigo-900/80 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}>
                      {currentUser.role}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[120px]">{currentUser.position}</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* User Dropdown Selector */}
              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 text-slate-900 dark:text-white">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Pengguna Saat Ini</p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{currentUser.name}</p>
                    <p className="text-[11px] text-cyan-600 dark:text-cyan-400 font-mono">@{currentUser.username}</p>
                  </div>

                  <div className="py-1 space-y-1">
                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        onNavigate('profile');
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                    >
                      <UserIcon className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /> Profil Pengguna
                    </button>

                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        onLogout();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" /> Keluar (Logout)
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>
      </div>
    </header>
  );
};
