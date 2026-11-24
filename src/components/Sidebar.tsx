import React from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  Table,
  LineChart,
  Building2,
  FileText,
  History,
  Settings,
  UserCheck,
  LogOut,
  X,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  Users,
} from 'lucide-react';
import { User, PermissionKey, RoleConfig } from '../types/simonsu';
import { hasPermission } from '../utils/storage';

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  isCollapsedDesktop: boolean;
  onToggleCollapseDesktop: () => void;
  currentUser: User;
  roleConfigs?: Record<string, RoleConfig>;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onNavigate,
  isOpenMobile,
  onCloseMobile,
  isCollapsedDesktop,
  onToggleCollapseDesktop,
  currentUser,
  roleConfigs,
  onLogout,
}) => {
  const navItems: { id: string; label: string; icon: any; permission: PermissionKey; highlight?: boolean }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard' },
    { id: 'input', label: 'Input Suhu', icon: PlusCircle, permission: 'input', highlight: true },
    { id: 'data', label: 'Data Suhu', icon: Table, permission: 'data' },
    { id: 'grafik', label: 'Grafik', icon: LineChart, permission: 'grafik' },
    { id: 'master', label: 'Master Ruangan', icon: Building2, permission: 'master' },
    { id: 'laporan', label: 'Laporan', icon: FileText, permission: 'laporan' },
    { id: 'users', label: 'Manajemen User', icon: Users, permission: 'users' },
    { id: 'audit', label: 'Audit Log', icon: History, permission: 'audit' },
  ];

  const visibleNavItems = navItems.filter((item) =>
    hasPermission(currentUser.role, item.permission, roleConfigs)
  );

  const rawBottomItems: { id: string; label: string; icon: any; permission?: PermissionKey }[] = [
    { id: 'pengaturan', label: 'Pengaturan', icon: Settings, permission: 'pengaturan' as PermissionKey },
    { id: 'profile', label: 'Profil User', icon: UserCheck },
  ];

  const bottomNavItems = rawBottomItems.filter(
    (item) => !item.permission || hasPermission(currentUser.role, item.permission, roleConfigs)
  );

  const handleNavClick = (id: string) => {
    onNavigate(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container with Smooth Vertical Scrolling */}
      <aside
        className={`fixed lg:sticky top-0 lg:top-20 left-0 h-screen lg:h-[calc(100vh-5rem)] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800/80 z-50 transition-all duration-300 ease-in-out flex flex-col justify-between p-3 overflow-y-auto ${
          isCollapsedDesktop ? 'lg:w-20' : 'lg:w-64'
        } ${
          isOpenMobile ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex-1 min-h-0 flex flex-col justify-between">
          
          {/* Main Navigation Section */}
          <div>
            {/* Mobile & Collapse Header Bar inside sidebar */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
              {/* Mobile Title */}
              <div className="flex items-center gap-2 lg:hidden">
                <span className="font-extrabold text-slate-900 dark:text-white text-base font-poppins">SIMONSU</span>
                <span className="text-[10px] bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 px-2 py-0.5 rounded-md font-semibold">
                  Labkes
                </span>
              </div>

              {/* Desktop Toggle Button */}
              <button
                onClick={onToggleCollapseDesktop}
                className="hidden lg:flex items-center gap-2 p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors w-full justify-between"
                title={isCollapsedDesktop ? 'Buka Sidebar' : 'Tutup Sidebar'}
              >
                {!isCollapsedDesktop && (
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Navigasi</span>
                )}
                {isCollapsedDesktop ? (
                  <PanelLeft className="w-5 h-5 mx-auto text-cyan-600 dark:text-cyan-400" />
                ) : (
                  <PanelLeftClose className="w-5 h-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" />
                )}
              </button>

              {/* Mobile Close Button */}
              <button
                onClick={onCloseMobile}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 lg:hidden"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Badge Summary */}
            {!isCollapsedDesktop ? (
              <div className="mb-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Petugas Aktif
                </div>
                <div className="font-bold text-slate-900 dark:text-white text-xs truncate mt-0.5">
                  {currentUser.name}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[11px] text-cyan-600 dark:text-cyan-400 font-semibold truncate">
                    Role: {currentUser.role}
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" title="Aktif" />
                </div>
              </div>
            ) : (
              <div className="mb-4 flex justify-center">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm" title={`${currentUser.name} (${currentUser.role})`}>
                  {currentUser.name.charAt(0)}
                </div>
              </div>
            )}

            {/* Navigation Menu Links */}
            {!isCollapsedDesktop && (
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">
                Menu Utama
              </div>
            )}

            <nav className="space-y-1">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    title={isCollapsedDesktop ? item.label : undefined}
                    className={`w-full flex items-center ${
                      isCollapsedDesktop ? 'justify-center px-2' : 'justify-between px-3'
                    } py-2.5 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-600/20 font-bold'
                        : item.highlight
                        ? 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/40 hover:bg-cyan-100 dark:hover:bg-cyan-900/40'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : item.highlight ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}`} />
                      {!isCollapsedDesktop && <span className="truncate">{item.label}</span>}
                    </div>
                    {!isCollapsedDesktop && isActive && <ChevronRight className="w-3.5 h-3.5 opacity-80 shrink-0" />}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom System Menu & Logout */}
          <div className="mt-6 pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1 shrink-0">
            {!isCollapsedDesktop && (
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-2">
                Sistem
              </div>
            )}

            {bottomNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  title={isCollapsedDesktop ? item.label : undefined}
                  className={`w-full flex items-center ${
                    isCollapsedDesktop ? 'justify-center px-2' : 'gap-3 px-3'
                  } py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                  {!isCollapsedDesktop && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}

            <button
              onClick={onLogout}
              title={isCollapsedDesktop ? 'Logout' : undefined}
              className={`w-full flex items-center ${
                isCollapsedDesktop ? 'justify-center px-2' : 'gap-3 px-3'
              } py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all mt-1`}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {!isCollapsedDesktop && <span>Logout (Keluar)</span>}
            </button>

            {!isCollapsedDesktop && (
              <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-800/80 text-center pb-1">
                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                  SIMONSU v2.4 • Manual Logging
                </div>
              </div>
            )}
          </div>

        </div>
      </aside>
    </>
  );
};
