/**
 * SIMONSU - Sistem Monitoring Suhu Ruangan
 * UPT Laboratorium Kesehatan Kota Bontang
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  DEFAULT_ROLE_CONFIGS,
  getActiveUserId,
  setActiveUserId,
  hasPermission,
  consumePendingAuditLogs,
  getRecordAllKeys,
  getRecordUniqueKey,
  getLocalDateString,
  getUserAssignedRooms,
  canUserAccessRoom,
} from './utils/storage';
import { Room, TemperatureRecord, AuditLog, User, RoleConfig, PermissionKey } from './types/simonsu';
import {
  fetchSyncedStateFromServer,
  pushStateToSpreadsheet,
  type ServerSyncMeta,
  type ServerStateResponse,
} from './utils/googleSheets';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { InputSuhuView } from './components/InputSuhuView';
import { DataSuhuView } from './components/DataSuhuView';
import { GrafikView } from './components/GrafikView';
import { MasterRuanganView } from './components/MasterRuanganView';
import { LaporanView } from './components/LaporanView';
import { AuditLogView } from './components/AuditLogView';
import { ProfileView } from './components/ProfileView';
import { SettingsView } from './components/SettingsView';
import { UserManagementView } from './components/UserManagementView';
import { LoginView } from './components/LoginView';
import { Lock, Loader2, AlertCircle, X } from 'lucide-react';

export default function App() {
  // Active tab user ID pointer (full user record always comes live from Google Spreadsheet Data_Pengguna)
  const [activeUserId, setActiveUserIdState] = useState<string | null>(() => getActiveUserId());
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Live Google Spreadsheet Data States (Zero local database or fallback data)
  const [users, setUsers] = useState<User[]>([]);
  const [roleConfigs, setRoleConfigs] = useState<Record<string, RoleConfig>>({});
  const [rooms, setRooms] = useState<Room[]>([]);
  const [records, setRecords] = useState<TemperatureRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [syncMeta, setSyncMeta] = useState<ServerSyncMeta | null>(null);

  // UI States
  const [activePage, setActivePage] = useState<string>('dashboard');
  const [isOpenMobile, setIsOpenMobile] = useState<boolean>(false);
  const [isCollapsedDesktop, setIsCollapsedDesktop] = useState<boolean>(false);
  const [darkMode, setDarkMode] = useState<boolean>(true);

  // Mutation guards so background auto-polling never overwrites an in-flight write
  const inFlightMutationsRef = useRef<number>(0);
  const lastMutationAtRef = useRef<number>(0);
  const mutationChainRef = useRef<Promise<void>>(Promise.resolve());

  // Authoritative latest-state ref so rapid consecutive edits/saves never read stale closures
  const latestStateRef = useRef({
    records,
    rooms,
    users,
    auditLogs,
    roleConfigs,
  });
  latestStateRef.current = { records, rooms, users, auditLogs, roleConfigs };

  // Resolve currentUser exclusively from live Google Spreadsheet Data_Pengguna
  const currentUser = useMemo<User | null>(() => {
    if (!activeUserId) return null;
    return users.find((u) => u.id === activeUserId && u.is_active) || null;
  }, [users, activeUserId]);

  // Scoped rooms & records visible to currentUser (App state retains full arrays so spreadsheet sync never drops other rooms)
  const accessibleRooms = useMemo<Room[]>(() => {
    if (!currentUser) return [];
    return getUserAssignedRooms(currentUser, rooms, false);
  }, [currentUser, rooms]);

  const accessibleRecords = useMemo<TemperatureRecord[]>(() => {
    if (!currentUser) return [];
    return records.filter((r) => canUserAccessRoom(currentUser, r, rooms));
  }, [currentUser, records, rooms]);

  // Apply authoritative state returned from Google Spreadsheet
  const applyServerState = useCallback((res: ServerStateResponse) => {
    const nextRecords = Array.isArray(res.records) ? res.records : [];
    const nextRooms = Array.isArray(res.rooms) ? res.rooms : [];
    const nextUsers = Array.isArray(res.users) ? res.users : [];
    const nextLogs = Array.isArray(res.auditLogs) ? res.auditLogs : [];
    const nextRoles = res.roleConfigs && typeof res.roleConfigs === 'object' ? res.roleConfigs : {};

    latestStateRef.current = {
      records: nextRecords,
      rooms: nextRooms,
      users: nextUsers,
      auditLogs: nextLogs,
      roleConfigs: nextRoles,
    };

    setRecords(nextRecords);
    setRooms(nextRooms);
    setUsers(nextUsers);
    setAuditLogs(nextLogs);
    setRoleConfigs(nextRoles);
    if (res.syncMeta) {
      setSyncMeta(res.syncMeta);
    }
    setHasLoadedOnce(true);
    setSyncError(null);
  }, []);

  const refreshFromServer = useCallback(
    async (ignoreCooldown = false) => {
      if (inFlightMutationsRef.current > 0) return;
      if (!ignoreCooldown && Date.now() - lastMutationAtRef.current < 3500) return;
      try {
        const res = await fetchSyncedStateFromServer();
        if (inFlightMutationsRef.current === 0) {
          applyServerState(res);
        }
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : 'Gagal memuat data langsung dari Google Spreadsheet.';
        setSyncError(msg);
      } finally {
        setIsInitialLoading(false);
      }
    },
    [applyServerState]
  );

  // Push mutations sequentially to Google Spreadsheet (if write fails, re-sync live state & show error)
  const pushMutation = useCallback(
    (payload: Parameters<typeof pushStateToSpreadsheet>[0]) => {
      inFlightMutationsRef.current += 1;
      lastMutationAtRef.current = Date.now();
      setSyncError(null);

      const run = async () => {
        try {
          const res = await pushStateToSpreadsheet(payload);
          lastMutationAtRef.current = Date.now();
          if (res.syncMeta) {
            setSyncMeta(res.syncMeta);
          }
          if (inFlightMutationsRef.current <= 1) {
            applyServerState(res);
          }
        } catch (err: unknown) {
          const msg =
            err instanceof Error ? err.message : 'Gagal menulis perubahan ke Google Spreadsheet.';
          setSyncError(msg);
          if (inFlightMutationsRef.current <= 1) {
            try {
              const live = await fetchSyncedStateFromServer();
              applyServerState(live);
            } catch {
              // Keep error visible
            }
          }
          throw err;
        } finally {
          inFlightMutationsRef.current = Math.max(0, inFlightMutationsRef.current - 1);
        }
      };

      const queued = mutationChainRef.current.then(run, run);
      mutationChainRef.current = queued.then(
        () => undefined,
        () => undefined
      );
      return queued;
    },
    [applyServerState]
  );

  // Continuous live synchronization with Google Spreadsheet on mount, focus, and every 4s
  useEffect(() => {
    refreshFromServer(true);

    const syncInterval = setInterval(() => {
      refreshFromServer(false);
    }, 4000);

    const handleFocusOrVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshFromServer(false);
      }
    };

    window.addEventListener('focus', handleFocusOrVisibility);
    document.addEventListener('visibilitychange', handleFocusOrVisibility);

    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('focus', handleFocusOrVisibility);
      document.removeEventListener('visibilitychange', handleFocusOrVisibility);
    };
  }, [refreshFromServer]);

  // Dark Mode class toggle
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleToggleCollapseDesktop = () => {
    setIsCollapsedDesktop((prev) => !prev);
  };

  const handleToggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  const mergePendingLogs = (): AuditLog[] => {
    const pending = consumePendingAuditLogs();
    const curLogs = latestStateRef.current.auditLogs;
    if (pending.length === 0) return curLogs;
    const nextLogs = [...pending, ...curLogs];
    latestStateRef.current.auditLogs = nextLogs;
    setAuditLogs(nextLogs);
    return nextLogs;
  };

  const getFirstPermittedPage = useCallback(
    (userRole: string): string => {
      const candidates: Array<{ page: string; perm: PermissionKey }> = [
        { page: 'dashboard', perm: 'dashboard' },
        { page: 'input', perm: 'input' },
        { page: 'data', perm: 'data' },
        { page: 'grafik', perm: 'grafik' },
        { page: 'master', perm: 'master' },
        { page: 'laporan', perm: 'laporan' },
        { page: 'users', perm: 'users' },
        { page: 'audit', perm: 'audit' },
        { page: 'pengaturan', perm: 'pengaturan' },
      ];
      const allowed = candidates.find((c) =>
        hasPermission(userRole, c.perm, latestStateRef.current.roleConfigs)
      );
      return allowed ? allowed.page : 'profile';
    },
    []
  );

  // Login & Logout
  const handleLoginSuccess = (user: User) => {
    setActiveUserId(user.id);
    setActiveUserIdState(user.id);
    setActivePage(getFirstPermittedPage(user.role));
    refreshFromServer(true);
  };

  const handleBootstrapAdmin = async (adminUser: User) => {
    const s = latestStateRef.current;
    const nextRoleConfigs =
      Object.keys(s.roleConfigs).length > 0 ? s.roleConfigs : DEFAULT_ROLE_CONFIGS;
    const bootstrapLog: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      user_id: adminUser.id,
      user_name: adminUser.name,
      action: 'TAMBAH_USER',
      record_id: adminUser.id,
      details: `${adminUser.name} menginisialisasi akun Administrator pertama langsung ke Google Spreadsheet`,
      created_at: new Date().toISOString(),
    };
    const nextLogs = [bootstrapLog, ...s.auditLogs];
    await pushMutation({
      records: s.records,
      rooms: s.rooms,
      users: [adminUser],
      auditLogs: nextLogs,
      roleConfigs: nextRoleConfigs,
    });
    setActiveUserId(adminUser.id);
    setActiveUserIdState(adminUser.id);
    setActivePage('dashboard');
  };

  const handleLogout = () => {
    setActiveUserId(null);
    setActiveUserIdState(null);
  };

  // User CRUD Handlers
  const handleSaveUser = (newUser: User) => {
    const s = latestStateRef.current;
    const updated = [...s.users, newUser];
    const nextLogs = mergePendingLogs();
    latestStateRef.current.users = updated;
    setUsers(updated);
    pushMutation({
      records: s.records,
      rooms: s.rooms,
      users: updated,
      auditLogs: nextLogs,
      roleConfigs: s.roleConfigs,
    }).catch(() => {});
  };

  const handleUpdateUser = (updatedUser: User) => {
    const s = latestStateRef.current;
    const updated = s.users.map((u) => (u.id === updatedUser.id ? updatedUser : u));
    const nextLogs = mergePendingLogs();
    latestStateRef.current.users = updated;
    setUsers(updated);
    pushMutation({
      records: s.records,
      rooms: s.rooms,
      users: updated,
      auditLogs: nextLogs,
      roleConfigs: s.roleConfigs,
    }).catch(() => {});
  };

  const handleDeleteUser = (userId: string) => {
    const s = latestStateRef.current;
    const updated = s.users.filter((u) => u.id !== userId);
    const nextLogs = mergePendingLogs();
    latestStateRef.current.users = updated;
    setUsers(updated);
    pushMutation({
      records: s.records,
      rooms: s.rooms,
      users: updated,
      auditLogs: nextLogs,
      roleConfigs: s.roleConfigs,
    }).catch(() => {});
  };

  // Role Config Matrix Handler
  const handleUpdateRoleConfigs = (updatedConfigs: Record<string, RoleConfig>) => {
    const s = latestStateRef.current;
    const nextLogs = mergePendingLogs();
    latestStateRef.current.roleConfigs = updatedConfigs;
    setRoleConfigs(updatedConfigs);
    pushMutation({
      records: s.records,
      rooms: s.rooms,
      users: s.users,
      auditLogs: nextLogs,
      roleConfigs: updatedConfigs,
    }).catch(() => {});
  };

  // Temperature Record Handlers (guarded by assigned room access)
  const handleSaveRecord = (newRecord: TemperatureRecord) => {
    const s = latestStateRef.current;
    if (currentUser && !canUserAccessRoom(currentUser, newRecord, s.rooms)) {
      setSyncError('Akses ditolak: Anda hanya dapat menginput data pada ruangan yang ditugaskan kepada Anda.');
      return;
    }
    const updated = [newRecord, ...s.records.filter((r) => r.id !== newRecord.id)];
    const nextLogs = mergePendingLogs();
    latestStateRef.current.records = updated;
    setRecords(updated);
    pushMutation({
      records: updated,
      rooms: s.rooms,
      users: s.users,
      auditLogs: nextLogs,
      roleConfigs: s.roleConfigs,
    }).catch(() => {});
  };

  const handleUpdateRecord = (updatedRecord: TemperatureRecord) => {
    const s = latestStateRef.current;
    const existingRecord = s.records.find((r) => r.id === updatedRecord.id);
    if (
      currentUser &&
      (!canUserAccessRoom(currentUser, updatedRecord, s.rooms) ||
        (existingRecord && !canUserAccessRoom(currentUser, existingRecord, s.rooms)))
    ) {
      setSyncError('Akses ditolak: Anda hanya dapat mengubah data pada ruangan yang ditugaskan kepada Anda.');
      return;
    }
    // IMPORTANT: Never pass deletedRecordKeys on edit — updatedRecord retains the same ID!
    const updated = s.records.map((r) => (r.id === updatedRecord.id ? updatedRecord : r));
    const nextLogs = mergePendingLogs();
    latestStateRef.current.records = updated;
    setRecords(updated);
    pushMutation({
      records: updated,
      rooms: s.rooms,
      users: s.users,
      auditLogs: nextLogs,
      roleConfigs: s.roleConfigs,
    }).catch(() => {});
  };

  const handleDeleteRecord = (recordId: string) => {
    const s = latestStateRef.current;
    const target = s.records.find((r) => r.id === recordId);
    if (currentUser && target && !canUserAccessRoom(currentUser, target, s.rooms)) {
      setSyncError('Akses ditolak: Anda hanya dapat menghapus data pada ruangan yang ditugaskan kepada Anda.');
      return;
    }
    const deletedRecordKeys = target ? [target.id, getRecordUniqueKey(target)] : [recordId];
    const updated = s.records.filter((r) => r.id !== recordId);
    const nextLogs = mergePendingLogs();
    latestStateRef.current.records = updated;
    setRecords(updated);
    pushMutation({
      records: updated,
      rooms: s.rooms,
      users: s.users,
      auditLogs: nextLogs,
      roleConfigs: s.roleConfigs,
      deletedRecordKeys,
    }).catch(() => {});
  };

  // Master Room Handlers
  const handleSaveRoom = (newRoom: Room) => {
    const s = latestStateRef.current;
    const updated = [...s.rooms, newRoom];
    const nextLogs = mergePendingLogs();
    latestStateRef.current.rooms = updated;
    setRooms(updated);
    pushMutation({
      records: s.records,
      rooms: updated,
      users: s.users,
      auditLogs: nextLogs,
      roleConfigs: s.roleConfigs,
    }).catch(() => {});
  };

  const handleUpdateRoom = (updatedRoom: Room) => {
    const s = latestStateRef.current;
    const updated = s.rooms.map((r) => (r.id === updatedRoom.id ? updatedRoom : r));
    const nextLogs = mergePendingLogs();
    latestStateRef.current.rooms = updated;
    setRooms(updated);
    pushMutation({
      records: s.records,
      rooms: updated,
      users: s.users,
      auditLogs: nextLogs,
      roleConfigs: s.roleConfigs,
    }).catch(() => {});
  };

  const handleDeleteRoom = (roomId: string) => {
    const s = latestStateRef.current;
    const updated = s.rooms.filter((r) => r.id !== roomId);
    const nextLogs = mergePendingLogs();
    latestStateRef.current.rooms = updated;
    setRooms(updated);
    pushMutation({
      records: s.records,
      rooms: updated,
      users: s.users,
      auditLogs: nextLogs,
      roleConfigs: s.roleConfigs,
    }).catch(() => {});
  };

  const handleClearAllData = () => {
    if (!currentUser || currentUser.role !== 'ADMIN') return;
    const s = latestStateRef.current;
    const deletedRecordKeys = s.records.flatMap((r) => getRecordAllKeys(r));
    consumePendingAuditLogs();
    latestStateRef.current.records = [];
    latestStateRef.current.auditLogs = [];
    setRecords([]);
    setAuditLogs([]);
    pushMutation({
      records: [],
      rooms: s.rooms,
      users: s.users,
      auditLogs: [],
      roleConfigs: s.roleConfigs,
      deletedRecordKeys,
      clearAll: true,
    }).catch(() => {});
  };

  const todayStr = getLocalDateString();
  const attentionCountToday = useMemo(() => {
    return accessibleRecords.filter(
      (r) => r.date === todayStr && (r.status === 'PERHATIAN' || r.status === 'KRITIS')
    ).length;
  }, [accessibleRecords, todayStr]);

  // Initial load screen while pulling live data exclusively from Google Spreadsheet
  if (isInitialLoading) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center p-6 transition-colors duration-200 ${
          darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'
        }`}
      >
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 max-w-sm w-full text-center space-y-4 shadow-xl">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mx-auto" />
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Menghubungkan Google Spreadsheet
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Memuat seluruh data ruangan, suhu, user, dan hak akses langsung dari Google Spreadsheet...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If user is not logged in, render Login Screen backed exclusively by Google Spreadsheet
  if (!currentUser) {
    return (
      <LoginView
        users={users}
        isLoadingUsers={isInitialLoading}
        hasLoadedOnce={hasLoadedOnce}
        syncError={syncError}
        onLoginSuccess={handleLoginSuccess}
        onCreateFirstAdmin={handleBootstrapAdmin}
        darkMode={darkMode}
        onToggleDarkMode={handleToggleDarkMode}
      />
    );
  }

  // Permission Guard Helper (strictly against live Hak_Akses_Role sheet with safe default fallback)
  const checkPagePermission = (pKey: PermissionKey): boolean => {
    return hasPermission(currentUser.role, pKey, roleConfigs);
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${
        darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'
      }`}
    >
      {/* Top Header */}
      <Header
        currentUser={currentUser}
        onOpenMobileMenu={() => setIsOpenMobile(true)}
        onToggleCollapseDesktop={handleToggleCollapseDesktop}
        isCollapsedDesktop={isCollapsedDesktop}
        darkMode={darkMode}
        onToggleDarkMode={handleToggleDarkMode}
        onNavigate={(page) => setActivePage(page)}
        onLogout={handleLogout}
        attentionCount={attentionCountToday}
      />

      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-6 flex gap-6">
        {/* Navigation Sidebar */}
        <Sidebar
          activePage={activePage}
          onNavigate={(page) => setActivePage(page)}
          isOpenMobile={isOpenMobile}
          onCloseMobile={() => setIsOpenMobile(false)}
          isCollapsedDesktop={isCollapsedDesktop}
          onToggleCollapseDesktop={handleToggleCollapseDesktop}
          currentUser={currentUser}
          roleConfigs={roleConfigs}
          onLogout={handleLogout}
        />

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 space-y-6 transition-all duration-300">
          {syncError && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{syncError}</span>
              </div>
              <button
                type="button"
                onClick={() => setSyncError(null)}
                className="p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {activePage === 'dashboard' && checkPagePermission('dashboard') && (
            <DashboardView
              rooms={accessibleRooms}
              records={accessibleRecords}
              currentUser={currentUser}
              onNavigate={(p) => setActivePage(p)}
              onClearAllData={handleClearAllData}
            />
          )}

          {activePage === 'input' && checkPagePermission('input') && (
            <InputSuhuView
              rooms={accessibleRooms}
              currentUser={currentUser}
              onSaveRecord={handleSaveRecord}
              onNavigate={(p) => setActivePage(p)}
            />
          )}

          {activePage === 'data' && checkPagePermission('data') && (
            <DataSuhuView
              rooms={accessibleRooms}
              records={accessibleRecords}
              currentUser={currentUser}
              roleConfigs={roleConfigs}
              onNavigate={(p) => setActivePage(p)}
              onUpdateRecord={handleUpdateRecord}
              onDeleteRecord={handleDeleteRecord}
            />
          )}

          {activePage === 'grafik' && checkPagePermission('grafik') && (
            <GrafikView
              rooms={accessibleRooms}
              records={accessibleRecords}
              darkMode={darkMode}
              currentUser={currentUser}
            />
          )}

          {activePage === 'master' && checkPagePermission('master') && (
            <MasterRuanganView
              rooms={accessibleRooms}
              currentUser={currentUser}
              onSaveRoom={handleSaveRoom}
              onUpdateRoom={handleUpdateRoom}
              onDeleteRoom={handleDeleteRoom}
            />
          )}

          {activePage === 'laporan' && checkPagePermission('laporan') && (
            <LaporanView
              rooms={accessibleRooms}
              records={accessibleRecords}
              currentUser={currentUser}
            />
          )}

          {activePage === 'users' && checkPagePermission('users') && (
            <UserManagementView
              users={users}
              currentUser={currentUser}
              rooms={rooms}
              roleConfigs={roleConfigs}
              onSaveUser={handleSaveUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
            />
          )}

          {activePage === 'audit' && checkPagePermission('audit') && (
            <AuditLogView logs={auditLogs} />
          )}

          {activePage === 'profile' && (
            <ProfileView
              currentUser={currentUser}
              rooms={rooms}
              users={users}
              onSelectUser={(u) => {
                setActiveUserId(u.id);
                setActiveUserIdState(u.id);
              }}
            />
          )}

          {activePage === 'pengaturan' && checkPagePermission('pengaturan') && (
            <SettingsView
              darkMode={darkMode}
              onToggleDarkMode={handleToggleDarkMode}
              onClearAllData={handleClearAllData}
              roleConfigs={roleConfigs}
              onUpdateRoleConfigs={handleUpdateRoleConfigs}
              currentUser={currentUser}
              rooms={rooms}
              records={records}
              users={users}
              auditLogs={auditLogs}
              syncMeta={syncMeta}
              onConfigSaved={() => refreshFromServer(true)}
            />
          )}

          {/* Access Restricted Screen if user navigates to an unpermitted page */}
          {((activePage === 'dashboard' && !checkPagePermission('dashboard')) ||
            (activePage === 'input' && !checkPagePermission('input')) ||
            (activePage === 'data' && !checkPagePermission('data')) ||
            (activePage === 'grafik' && !checkPagePermission('grafik')) ||
            (activePage === 'master' && !checkPagePermission('master')) ||
            (activePage === 'laporan' && !checkPagePermission('laporan')) ||
            (activePage === 'users' && !checkPagePermission('users')) ||
            (activePage === 'audit' && !checkPagePermission('audit')) ||
            (activePage === 'pengaturan' && !checkPagePermission('pengaturan'))) && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-4 shadow-sm">
              <div className="w-14 h-14 mx-auto bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center">
                <Lock className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Akses Dibatasi oleh Sistem
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Role Anda (<strong>{currentUser.role}</strong>) tidak memiliki hak akses untuk
                  membuka halaman ini. Hubungi Administrator jika Anda memerlukan akses tambahan.
                </p>
              </div>
              <button
                onClick={() => setActivePage(getFirstPermittedPage(currentUser.role))}
                className="px-4 py-2 bg-cyan-600 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-600/20"
              >
                Kembali Ke Halaman Utama
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
