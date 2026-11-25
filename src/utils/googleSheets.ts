/**
 * SIMONSU - Client Automatic Spreadsheet Sync Service
 * Synchronizes all 8 sheets automatically with backend & Google Spreadsheet
 * without requiring manual Sync buttons or Gmail login.
 */

import * as XLSX from 'xlsx';
import { Room, TemperatureRecord, User, AuditLog, RoleConfig } from '../types/simonsu';
import {
  SPREADSHEET_ID,
  SPREADSHEET_URL,
  DEFAULT_APPS_SCRIPT_WEBHOOK_URL,
  SIMONSU_SHEETS,
  GOOGLE_APPS_SCRIPT_TEMPLATE,
  buildAllSheetsMatrix,
  getLocalDateString,
  type FullAppSyncData,
  type SimonsuSheetName,
} from './sheetsMatrix';

export {
  SPREADSHEET_ID,
  SPREADSHEET_URL,
  DEFAULT_APPS_SCRIPT_WEBHOOK_URL,
  SIMONSU_SHEETS,
  GOOGLE_APPS_SCRIPT_TEMPLATE,
  buildAllSheetsMatrix,
  type FullAppSyncData,
  type SimonsuSheetName,
};

export interface ServerSyncMeta {
  spreadsheetId: string;
  spreadsheetUrl: string;
  writeMode: 'service_account' | 'apps_script' | 'read_only';
  hasWriteBridge: boolean;
  webhookUrl: string;
  pendingSpreadsheetPush: boolean;
  lastSheetPullAt: string | null;
  lastSheetPushAt: string | null;
  lastSyncMessage: string;
}

export interface ServerStateResponse {
  records: TemperatureRecord[];
  rooms: Room[];
  users: User[];
  auditLogs: AuditLog[];
  roleConfigs: Record<string, RoleConfig>;
  syncMeta: ServerSyncMeta;
}

export async function fetchSyncedStateFromServer(): Promise<ServerStateResponse> {
  const res = await fetch(`/api/sheets/state?t=${Date.now()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.message || `Gagal memuat data dari Google Spreadsheet (${res.status})`);
  }
  return json as ServerStateResponse;
}

export async function pushStateToSpreadsheet(
  payload: Partial<FullAppSyncData> & {
    deletedRecordKeys?: string[];
    clearAll?: boolean;
  }
): Promise<ServerStateResponse & { success: boolean; spreadsheetSynced: boolean; message: string }> {
  const res = await fetch('/api/sheets/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || `Gagal menulis perubahan ke Google Spreadsheet (${res.status})`);
  }
  return json;
}

export async function saveServerWebhookConfig(
  webhookUrl: string
): Promise<{ success: boolean; message: string; syncMeta: ServerSyncMeta }> {
  const res = await fetch('/api/sheets/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ webhookUrl: webhookUrl.trim() }),
  });
  if (!res.ok) {
    throw new Error(`Gagal menyimpan konfigurasi (${res.status})`);
  }
  return await res.json();
}

/**
 * 1-Click Multi-Sheet Workbook (.xlsx) Generation
 */
export const exportAllSheetsToExcel = (data: FullAppSyncData) => {
  const wb = XLSX.utils.book_new();
  const matrices = buildAllSheetsMatrix(data);

  Object.entries(matrices).forEach(([sheetName, aoa]) => {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  const filename = `SIMONSU_8_Sheets_Lengkap_${getLocalDateString()}.xlsx`;
  XLSX.writeFile(wb, filename);
};
