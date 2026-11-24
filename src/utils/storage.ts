/**
 * SIMONSU - Domain Helpers & Session Pointer
 * Zero local application data: all records, rooms, users, roles, and audit logs
 * are loaded and saved exclusively against Google Spreadsheet.
 */

import {
  TemperatureRecord,
  AuditLog,
  User,
  DateFilterType,
  DateRange,
  RoleConfig,
  PermissionKey,
} from '../types/simonsu';
import {
  DEFAULT_ROLE_CONFIGS,
  calculateTemperatureStatus,
  calculateHumidityStatus,
  getRecordUniqueKey,
  getRecordAllKeys,
  getLocalDateString,
  normalizeAssignedRoomIds,
  isUserUnrestrictedRooms,
  getUserAssignedRooms,
  canUserAccessRoom,
} from './sheetsMatrix';

export {
  DEFAULT_ROLE_CONFIGS,
  calculateTemperatureStatus,
  calculateHumidityStatus,
  getRecordUniqueKey,
  getRecordAllKeys,
  getLocalDateString,
  normalizeAssignedRoomIds,
  isUserUnrestrictedRooms,
  getUserAssignedRooms,
  canUserAccessRoom,
};

// Pure in-memory active user ID (zero localStorage / sessionStorage / cookies)
let ephemeralActiveUserId: string | null = null;

// Ephemeral synchronous audit buffer passed inside immediate API requests to Google Spreadsheet
let sessionAuditBuffer: AuditLog[] = [];

export function consumePendingAuditLogs(): AuditLog[] {
  const items = [...sessionAuditBuffer];
  sessionAuditBuffer = [];
  return items;
}

export function getActiveUserId(): string | null {
  return ephemeralActiveUserId;
}

export function setActiveUserId(userId: string | null): void {
  ephemeralActiveUserId = userId;
}

export function authenticateUser(
  usernameInput: string,
  passwordInput: string,
  usersList: User[]
): User | null {
  if (!Array.isArray(usersList) || usersList.length === 0) return null;
  const normalized = usernameInput.trim().toLowerCase();
  const found = usersList.find(
    (u) =>
      u.username.toLowerCase().trim() === normalized &&
      u.password === passwordInput &&
      u.is_active
  );
  if (found) {
    setActiveUserId(found.id);
    return found;
  }
  return null;
}

export function hasPermission(
  roleCode: string,
  permissionKey: PermissionKey,
  roleConfigs?: Record<string, RoleConfig>
): boolean {
  const effectiveConfigs =
    roleConfigs && Object.keys(roleConfigs).length > 0 ? roleConfigs : DEFAULT_ROLE_CONFIGS;
  const role = effectiveConfigs[roleCode] || DEFAULT_ROLE_CONFIGS[roleCode];
  if (!role) return roleCode === 'ADMIN';
  return !!role.permissions[permissionKey];
}

export function logAudit(
  user: User,
  action: AuditLog['action'],
  details: string,
  recordId?: string,
  oldData?: string,
  newData?: string
): AuditLog {
  const newLog: AuditLog = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    user_id: user.id,
    user_name: user.name,
    action,
    record_id: recordId,
    old_data: oldData,
    new_data: newData,
    details,
    created_at: new Date().toISOString(),
  };
  sessionAuditBuffer.unshift(newLog);
  return newLog;
}

// Date Filter Helpers
export function getDateRangeFromFilter(filterType: DateFilterType, customRange?: DateRange): DateRange {
  const today = new Date();
  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const todayStr = formatDate(today);

  if (filterType === 'today') {
    return { startDate: todayStr, endDate: todayStr };
  }

  if (filterType === 'yesterday') {
    const yest = new Date(today);
    yest.setDate(today.getDate() - 1);
    const yestStr = formatDate(yest);
    return { startDate: yestStr, endDate: yestStr };
  }

  if (filterType === 'last7') {
    const d7 = new Date(today);
    d7.setDate(today.getDate() - 6);
    return { startDate: formatDate(d7), endDate: todayStr };
  }

  if (filterType === 'last30') {
    const d30 = new Date(today);
    d30.setDate(today.getDate() - 29);
    return { startDate: formatDate(d30), endDate: todayStr };
  }

  if (filterType === 'thisMonth') {
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return { startDate: formatDate(firstDay), endDate: todayStr };
  }

  if (filterType === 'all') {
    return { startDate: '2000-01-01', endDate: '2099-12-31' };
  }

  if (filterType === 'custom' && customRange) {
    return customRange;
  }

  return { startDate: todayStr, endDate: todayStr };
}

export function filterRecordsByRangeAndRoom(
  records: TemperatureRecord[],
  range: DateRange,
  roomId?: string,
  statusFilter?: string,
  roomCode?: string
): TemperatureRecord[] {
  return records.filter((rec) => {
    const inDateRange = rec.date >= range.startDate && rec.date <= range.endDate;
    const matchesRoom =
      !roomId ||
      roomId === 'ALL' ||
      rec.room_id === roomId ||
      (!!roomCode && !!rec.room_code && rec.room_code.toLowerCase() === roomCode.toLowerCase());
    const matchesStatus = !statusFilter || statusFilter === 'ALL' || rec.status === statusFilter;
    return inDateRange && matchesRoom && matchesStatus;
  });
}

export function formatDateIndonesia(dateStr: string): string {
  if (!dateStr) return '-';
  const match = dateStr.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return dateStr.trim() || '-';
  const year = match[1];
  const monthNum = parseInt(match[2], 10);
  const dayNum = parseInt(match[3], 10);
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  if (
    !Number.isFinite(monthNum) ||
    !Number.isFinite(dayNum) ||
    monthNum < 1 ||
    monthNum > 12 ||
    dayNum < 1 ||
    dayNum > 31
  ) {
    return dateStr.trim() || '-';
  }
  return `${dayNum} ${months[monthNum - 1]} ${year}`;
}
