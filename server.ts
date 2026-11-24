import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as XLSX from 'xlsx';
import type {
  Room,
  TemperatureRecord,
  User,
  AuditLog,
  RoleConfig,
} from './src/types/simonsu.ts';
import {
  SPREADSHEET_ID,
  SPREADSHEET_URL,
  SIMONSU_SHEETS,
  buildAllSheetsMatrix,
  getRecordAllKeys,
  getRecordUniqueKey,
  parseRecordsFromRows,
  parseRoomsFromRows,
  parseUsersFromRows,
  parseAuditLogsFromRows,
  parseRoleConfigsFromRows,
  type FullAppSyncData,
} from './src/utils/sheetsMatrix.ts';

const PORT = Number(process.env.PORT || 3000);

// Clean up any legacy local files if present so zero local data or config files exist on disk
if (!process.env.VERCEL) {
  for (const legacyPath of [
    path.resolve(process.cwd(), '.simonsu-data'),
    path.resolve(process.cwd(), '.simonsu-bridge.json'),
  ]) {
    try {
      if (fs.existsSync(legacyPath)) {
        fs.rmSync(legacyPath, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup issues
    }
  }
}

export type WriteMode = 'service_account' | 'apps_script' | 'read_only';

let runtimeWebhookOverride: string | null = null;

function loadConfiguredWebhookUrl(): string {
  if (runtimeWebhookOverride !== null) return runtimeWebhookOverride;
  return (process.env.APPS_SCRIPT_WEBHOOK_URL || '').trim();
}

function saveConfiguredWebhookUrl(url: string): void {
  runtimeWebhookOverride = url.trim();
}

// Service Account JWT token cache (if valid GOOGLE_SERVICE_ACCOUNT_JSON is provided)
let cachedSaToken: { token: string; expiresAt: number } | null = null;

interface ServiceAccountCreds {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

function parseServiceAccountCreds(): ServiceAccountCreds | null {
  const raw = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
  if (!raw) return null;

  let candidate = raw;
  if (!candidate.startsWith('{') && candidate.endsWith('.json')) {
    try {
      if (fs.existsSync(candidate)) {
        candidate = fs.readFileSync(candidate, 'utf-8').trim();
      }
    } catch {
      return null;
    }
  }

  if (!candidate.startsWith('{') && /^[A-Za-z0-9+/=]+$/.test(candidate) && candidate.length > 40) {
    try {
      const decoded = Buffer.from(candidate, 'base64').toString('utf-8').trim();
      if (decoded.startsWith('{')) {
        candidate = decoded;
      }
    } catch {
      return null;
    }
  }

  if (!candidate.startsWith('{')) {
    return null;
  }

  try {
    const creds = JSON.parse(candidate) as Partial<ServiceAccountCreds>;
    if (
      creds &&
      typeof creds.client_email === 'string' &&
      creds.client_email.includes('@') &&
      typeof creds.private_key === 'string' &&
      creds.private_key.includes('BEGIN')
    ) {
      return {
        client_email: creds.client_email,
        private_key: creds.private_key.replace(/\\n/g, '\n'),
        token_uri: creds.token_uri,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf-8') : input;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getServiceAccountAccessToken(): Promise<string | null> {
  const creds = parseServiceAccountCreds();
  if (!creds) return null;

  if (cachedSaToken && Date.now() < cachedSaToken.expiresAt - 60000) {
    return cachedSaToken.token;
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = base64UrlEncode(
      JSON.stringify({
        iss: creds.client_email,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: creds.token_uri || 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
      })
    );

    const signingInput = `${header}.${payload}`;
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signingInput);
    const signature = base64UrlEncode(sign.sign(creds.private_key));
    const jwt = `${signingInput}.${signature}`;

    const tokenRes = await fetch(creds.token_uri || 'https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!tokenRes.ok) return null;
    const tokenJson = (await tokenRes.json()) as { access_token?: string; expires_in?: number };
    if (!tokenJson.access_token) return null;

    cachedSaToken = {
      token: tokenJson.access_token,
      expiresAt: Date.now() + (tokenJson.expires_in || 3600) * 1000,
    };
    return cachedSaToken.token;
  } catch {
    return null;
  }
}

function getEffectiveWebhookUrl(): string {
  return loadConfiguredWebhookUrl();
}

function getCurrentWriteMode(): WriteMode {
  if (parseServiceAccountCreds()) return 'service_account';
  if (getEffectiveWebhookUrl()) return 'apps_script';
  return 'read_only';
}

// Ephemeral in-memory write-through propagation status (never saved to disk)
let lastSheetPullAt: string | null = null;
let lastSheetPushAt: string | null = null;
let lastSyncMessage = 'Membaca langsung dari Google Spreadsheet (tanpa penyimpanan lokal)';

interface GvizPropagationGuard {
  committedData: FullAppSyncData;
  committedFingerprint: string;
  staleFingerprints: Set<string>;
  expiresAt: number;
}
let gvizPropagationGuard: GvizPropagationGuard | null = null;

function computeStateFingerprint(data: FullAppSyncData): string {
  const canonical = {
    r: [...data.records]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((r) => [r.id, r.date, r.time, r.room_id, r.temperature, r.humidity ?? null, r.notes ?? '']),
    m: [...data.rooms]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((rm) => [rm.id, rm.code, rm.name, rm.min_temperature, rm.max_temperature, rm.is_active]),
    u: [...data.users]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((u) => [u.id, u.username, u.role, u.is_active]),
    l: data.auditLogs.slice(0, 5).map((l) => l.id),
  };
  return crypto.createHash('sha1').update(JSON.stringify(canonical)).digest('hex');
}

function getSyncMeta() {
  const writeMode = getCurrentWriteMode();
  return {
    spreadsheetId: SPREADSHEET_ID,
    spreadsheetUrl: SPREADSHEET_URL,
    writeMode,
    hasWriteBridge: writeMode !== 'read_only',
    webhookUrl: getEffectiveWebhookUrl(),
    pendingSpreadsheetPush: false,
    lastSheetPullAt,
    lastSheetPushAt,
    lastSyncMessage,
  };
}

// Serialized write mutex so rapid concurrent mutations never interleave out-of-order
let syncMutationQueue: Promise<void> = Promise.resolve();
function enqueueSyncMutation<T>(task: () => Promise<T>): Promise<T> {
  const resultPromise = syncMutationQueue.then(task, task);
  syncMutationQueue = resultPromise.then(
    () => undefined,
    () => undefined
  );
  return resultPromise;
}

/**
 * Fetch all sheet tabs accurately in one request via Google Spreadsheet XLSX export.
 * Unlike GVIZ JSON, XLSX export never drops string cells (e.g., "admin123") to null
 * when another row in the same column contains digits (e.g., "123456").
 */
async function fetchSpreadsheetViaXlsx(
  maxAttempts = 2
): Promise<{ ok: boolean; sheets: Partial<Record<string, any[][]>> }> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=xlsx&t=${Date.now()}`;
      const res = await fetch(url, {
        cache: 'no-store',
        redirect: 'follow',
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const wb = XLSX.read(buf, { type: 'buffer', raw: false });
        const hasCoreTabs =
          wb.SheetNames.includes(SIMONSU_SHEETS.DATA_SUHU) &&
          wb.SheetNames.includes(SIMONSU_SHEETS.MASTER_RUANGAN) &&
          wb.SheetNames.includes(SIMONSU_SHEETS.DATA_PENGGUNA);

        if (hasCoreTabs) {
          const sheets: Partial<Record<string, any[][]>> = {};
          for (const sheetName of Object.values(SIMONSU_SHEETS)) {
            const ws = wb.Sheets[sheetName];
            if (ws) {
              const allRows = XLSX.utils.sheet_to_json<any[]>(ws, {
                header: 1,
                defval: '',
                raw: false,
              });
              sheets[sheetName] = allRows.slice(1);
            }
          }
          return { ok: true, sheets };
        }
      }
    } catch {
      // Fall back or retry
    }
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 350));
    }
  }
  return { ok: false, sheets: {} };
}

/**
 * Fetch a single sheet tab via GVIZ endpoint with headers=1 and automatic retry on transient failure
 */
async function fetchGvizTab(sheetName: string, maxAttempts = 2): Promise<{ ok: boolean; rows: any[] }> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent(sheetName)}&t=${Date.now()}`;
      const res = await fetch(url, {
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const text = await res.text();
        const startIdx = text.indexOf('(');
        const endIdx = text.lastIndexOf(')');
        if (startIdx !== -1 && endIdx !== -1) {
          const json = JSON.parse(text.slice(startIdx + 1, endIdx));
          if (json.status !== 'error') {
            return { ok: true, rows: json?.table?.rows || [] };
          }
        }
      }
    } catch {
      // Retry on transient timeout/network error
    }
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  return { ok: false, rows: [] };
}

/**
 * Fetch live data directly from Google Spreadsheet (no local DB fallback).
 */
async function fetchLiveFromSpreadsheet(): Promise<{
  ok: boolean;
  data: FullAppSyncData;
  source: 'service_account' | 'apps_script_doget' | 'xlsx_export' | 'gviz';
}> {
  const saToken = await getServiceAccountAccessToken();
  const webhookUrl = getEffectiveWebhookUrl();

  let rawSheets: Partial<Record<string, any[]>> = {};
  let readSucceeded = false;
  let source: 'service_account' | 'apps_script_doget' | 'xlsx_export' | 'gviz' = 'xlsx_export';

  // 1. Strongly-consistent Service Account read
  if (saToken) {
    try {
      const sheetNames = Object.values(SIMONSU_SHEETS);
      const rangesQuery = sheetNames
        .map((n) => `ranges=${encodeURIComponent(`'${n}'!A2:Z2000`)}`)
        .join('&');
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchGet?${rangesQuery}`,
        { headers: { Authorization: `Bearer ${saToken}` } }
      );
      if (res.ok) {
        const json = (await res.json()) as { valueRanges?: Array<{ values?: any[][] }> };
        (json.valueRanges || []).forEach((vr, idx) => {
          rawSheets[sheetNames[idx]] = vr.values || [];
        });
        readSucceeded = true;
        source = 'service_account';
      }
    } catch {
      // Fall through to Apps Script / XLSX / GVIZ
    }
  }

  // 2. Strongly-consistent Apps Script doGet read (if script supports action=read_all)
  if (!readSucceeded && webhookUrl) {
    try {
      const res = await fetch(`${webhookUrl}?action=read_all&t=${Date.now()}`, {
        method: 'GET',
        redirect: 'follow',
      });
      if (res.ok) {
        const text = await res.text();
        if (text.trim().startsWith('{')) {
          const json = JSON.parse(text);
          if (json.status === 'success' && json.sheets) {
            rawSheets = json.sheets;
            readSucceeded = true;
            source = 'apps_script_doget';
          }
        }
      }
    } catch {
      // Fall through to XLSX / GVIZ
    }
  }

  // 3. Direct XLSX export read (preserves mixed string/numeric cells like Password & NIP accurately)
  let roleTabFailed = false;
  let logTabFailed = false;
  if (!readSucceeded) {
    const xlsxRes = await fetchSpreadsheetViaXlsx();
    if (xlsxRes.ok) {
      rawSheets = xlsxRes.sheets;
      roleTabFailed = !rawSheets[SIMONSU_SHEETS.HAK_AKSES_ROLE];
      logTabFailed = !rawSheets[SIMONSU_SHEETS.AUDIT_LOG];
      readSucceeded = true;
      source = 'xlsx_export';
    }
  }

  // 4. GVIZ live read fallback directly from Google Spreadsheet (require all 3 core tabs to succeed)
  if (!readSucceeded) {
    const [suhuRes, roomRes, userRes, logRes, roleRes] = await Promise.all([
      fetchGvizTab(SIMONSU_SHEETS.DATA_SUHU),
      fetchGvizTab(SIMONSU_SHEETS.MASTER_RUANGAN),
      fetchGvizTab(SIMONSU_SHEETS.DATA_PENGGUNA),
      fetchGvizTab(SIMONSU_SHEETS.AUDIT_LOG),
      fetchGvizTab(SIMONSU_SHEETS.HAK_AKSES_ROLE),
    ]);

    if (suhuRes.ok) rawSheets[SIMONSU_SHEETS.DATA_SUHU] = suhuRes.rows;
    if (roomRes.ok) rawSheets[SIMONSU_SHEETS.MASTER_RUANGAN] = roomRes.rows;
    if (userRes.ok) rawSheets[SIMONSU_SHEETS.DATA_PENGGUNA] = userRes.rows;
    if (logRes.ok) rawSheets[SIMONSU_SHEETS.AUDIT_LOG] = logRes.rows;
    if (roleRes.ok) rawSheets[SIMONSU_SHEETS.HAK_AKSES_ROLE] = roleRes.rows;

    roleTabFailed = !roleRes.ok;
    logTabFailed = !logRes.ok;

    // NEVER treat a partial failure of core sheets as empty data (which would overwrite sheets on next write)
    readSucceeded = suhuRes.ok && roomRes.ok && userRes.ok;
    source = 'gviz';
  }

  if (!readSucceeded) {
    return {
      ok: false,
      data: { records: [], rooms: [], users: [], auditLogs: [], roleConfigs: {} },
      source,
    };
  }

  const roomRows = rawSheets[SIMONSU_SHEETS.MASTER_RUANGAN];
  const rooms: Room[] = roomRows ? parseRoomsFromRows(roomRows) : [];

  const userRows = rawSheets[SIMONSU_SHEETS.DATA_PENGGUNA];
  const users: User[] = userRows ? parseUsersFromRows(userRows) : [];

  const roleRows = rawSheets[SIMONSU_SHEETS.HAK_AKSES_ROLE];
  const roleConfigs: Record<string, RoleConfig> = roleTabFailed
    ? gvizPropagationGuard?.committedData.roleConfigs || {}
    : roleRows
      ? parseRoleConfigsFromRows(roleRows) || {}
      : {};

  const auditRows = rawSheets[SIMONSU_SHEETS.AUDIT_LOG];
  const auditLogs: AuditLog[] = logTabFailed
    ? gvizPropagationGuard?.committedData.auditLogs || []
    : auditRows
      ? parseAuditLogsFromRows(auditRows).sort((a, b) => b.created_at.localeCompare(a.created_at))
      : [];

  const suhuRows = rawSheets[SIMONSU_SHEETS.DATA_SUHU];
  const records: TemperatureRecord[] = suhuRows
    ? parseRecordsFromRows(suhuRows, rooms).sort((a, b) =>
        `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)
      )
    : [];

  const parsedLive: FullAppSyncData = { records, rooms, users, auditLogs, roleConfigs };

  // If reading via public export/GVIZ shortly after an Apps Script write, protect against Google CDN caching
  // returning stale pre-write snapshots while still allowing external manual spreadsheet edits through.
  if ((source === 'xlsx_export' || source === 'gviz') && gvizPropagationGuard) {
    if (Date.now() >= gvizPropagationGuard.expiresAt) {
      gvizPropagationGuard = null;
    } else {
      const liveFp = computeStateFingerprint(parsedLive);
      if (liveFp === gvizPropagationGuard.committedFingerprint) {
        gvizPropagationGuard = null;
      } else if (gvizPropagationGuard.staleFingerprints.has(liveFp)) {
        lastSheetPullAt = new Date().toISOString();
        return {
          ok: true,
          data: gvizPropagationGuard.committedData,
          source,
        };
      } else {
        // External change detected directly in Spreadsheet; trust live sheet
        gvizPropagationGuard = null;
      }
    }
  } else if (source !== 'xlsx_export' && source !== 'gviz') {
    gvizPropagationGuard = null;
  }

  lastSheetPullAt = new Date().toISOString();

  return {
    ok: true,
    data: parsedLive,
    source,
  };
}

/**
 * Push all 8 sheets directly to Google Spreadsheet without any local DB storage
 */
async function pushAllSheetsToSpreadsheet(
  data: FullAppSyncData,
  deletedRecordKeys: string[] = [],
  preWriteData?: FullAppSyncData
): Promise<{ success: boolean; message: string }> {
  const matrices = buildAllSheetsMatrix(data, deletedRecordKeys);

  // Path 1: Google Service Account
  const saToken = await getServiceAccountAccessToken();
  if (saToken) {
    try {
      const metaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties`,
        { headers: { Authorization: `Bearer ${saToken}` } }
      );
      if (metaRes.ok) {
        const metaJson = (await metaRes.json()) as {
          sheets?: Array<{ properties?: { title?: string } }>;
        };
        const existingTitles = (metaJson.sheets || []).map((s) => s.properties?.title || '');
        const requiredTabs = Object.values(SIMONSU_SHEETS);
        const missingTabs = requiredTabs.filter((t) => !existingTitles.includes(t));

        if (missingTabs.length > 0) {
          await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${saToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              requests: missingTabs.map((title) => ({
                addSheet: {
                  properties: {
                    title,
                    gridProperties: { rowCount: 1000, columnCount: 20, frozenRowCount: 1 },
                  },
                },
              })),
            }),
          });
        }

        const allTabsToClear = Array.from(new Set([...requiredTabs, ...existingTitles]));
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchClear`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${saToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ranges: allTabsToClear.map((n) => `'${n.replace(/'/g, "''")}'!A1:Z5000`),
            }),
          }
        );

        const valueData = Object.entries(matrices).map(([sheetName, values]) => ({
          range: `'${sheetName.replace(/'/g, "''")}'!A1`,
          majorDimension: 'ROWS',
          values,
        }));

        const updRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchUpdate`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${saToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: valueData }),
          }
        );

        if (updRes.ok) {
          lastSheetPushAt = new Date().toISOString();
          lastSyncMessage = 'Semua 8 sheet tersinkronisasi langsung ke Google Spreadsheet.';
          gvizPropagationGuard = null;
          return { success: true, message: lastSyncMessage };
        }
      }
    } catch {
      // Fall through to Apps Script
    }
  }

  // Path 2: Google Apps Script Web App Bridge (with 1 automatic retry & strict JSON check)
  const webhookUrl = getEffectiveWebhookUrl();
  if (webhookUrl) {
    const sheetsObject: Record<string, Record<string, string | number>[]> = {};
    const headersObject: Record<string, string[]> = {};
    Object.entries(matrices).forEach(([sheetName, rows]) => {
      const headers = rows[0] as string[];
      headersObject[sheetName] = headers;
      const bodyRows = rows.slice(1);
      sheetsObject[sheetName] = bodyRows.map((r) => {
        const obj: Record<string, string | number> = {};
        headers.forEach((h, i) => {
          obj[h] = r[i] !== undefined ? r[i] : '-';
        });
        return obj;
      });
    });

    const bodyJson = JSON.stringify({
      spreadsheetId: SPREADSHEET_ID,
      action: 'sync_all_sheets',
      headers: headersObject,
      sheets: sheetsObject,
    });

    let lastErrMsg = 'gagal kirim ke Apps Script';
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(webhookUrl, {
          method: 'POST',
          redirect: 'follow',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: bodyJson,
          signal: AbortSignal.timeout(25000),
        });

        const responseText = await res.text();
        const trimmed = responseText.trim();
        let parsedOk = false;
        if (trimmed.startsWith('{')) {
          const json = JSON.parse(trimmed) as { status?: string; error?: string };
          if (json.status === 'error') {
            throw new Error(json.error || 'Apps Script error');
          }
          parsedOk = res.ok && (json.status === 'success' || json.status === 'ok');
        } else {
          throw new Error(`Respon Apps Script tidak valid (HTTP ${res.status})`);
        }

        if (parsedOk) {
          lastSheetPushAt = new Date().toISOString();
          lastSyncMessage =
            'Semua 8 sheet tersinkronisasi langsung ke Google Spreadsheet via Apps Script.';
          const staleSet = new Set<string>(
            gvizPropagationGuard ? Array.from(gvizPropagationGuard.staleFingerprints).slice(-9) : []
          );
          if (preWriteData) {
            staleSet.add(computeStateFingerprint(preWriteData));
          }
          gvizPropagationGuard = {
            committedData: data,
            committedFingerprint: computeStateFingerprint(data),
            staleFingerprints: staleSet,
            expiresAt: Date.now() + 300_000,
          };
          return { success: true, message: lastSyncMessage };
        }
      } catch (err: any) {
        lastErrMsg = err?.message || 'gagal kirim';
      }

      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 450));
      }
    }

    lastSyncMessage = `Gagal menulis ke Google Spreadsheet (${lastErrMsg}).`;
    return { success: false, message: lastSyncMessage };
  }

  lastSyncMessage =
    'Bridge tulis ke Google Spreadsheet belum dikonfigurasi. Pasang URL Web App Apps Script di menu Pengaturan.';
  return { success: false, message: lastSyncMessage };
}

export function createApiApp() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, syncMeta: getSyncMeta() });
  });

  // Live Google Spreadsheet read (zero local database)
  app.get('/api/sheets/state', async (_req, res) => {
    const live = await fetchLiveFromSpreadsheet();
    if (!live.ok) {
      res.status(502).json({
        success: false,
        message: 'Gagal memuat data langsung dari Google Spreadsheet.',
        ...live.data,
        syncMeta: getSyncMeta(),
      });
      return;
    }

    res.json({
      success: true,
      ...live.data,
      syncMeta: getSyncMeta(),
    });
  });

  // Direct mutation write-through to Google Spreadsheet (serialized queue + wipe protection)
  app.post('/api/sheets/sync', async (req, res) => {
    try {
      await enqueueSyncMutation(async () => {
        const body = req.body as Partial<FullAppSyncData> & {
          deletedRecordKeys?: string[];
          clearAll?: boolean;
        };

        const currentLive = await fetchLiveFromSpreadsheet();
        const hasAllSlicesInBody =
          Array.isArray(body.records) &&
          Array.isArray(body.rooms) &&
          Array.isArray(body.users) &&
          Array.isArray(body.auditLogs) &&
          !!body.roleConfigs &&
          Object.keys(body.roleConfigs).length > 0;

        if (!currentLive.ok && !hasAllSlicesInBody) {
          res.status(502).json({
            success: false,
            spreadsheetSynced: false,
            message:
              'Gagal memverifikasi data terkini dari Google Spreadsheet sebelum menyimpan. Silakan coba lagi.',
            ...currentLive.data,
            syncMeta: getSyncMeta(),
          });
          return;
        }

        const baseData = currentLive.data;

        let nextRecords: TemperatureRecord[] = Array.isArray(body.records)
          ? body.records
          : baseData.records;
        const nextRooms: Room[] = Array.isArray(body.rooms) ? body.rooms : baseData.rooms;
        const nextUsers: User[] = Array.isArray(body.users) ? body.users : baseData.users;
        let nextAuditLogs: AuditLog[] = Array.isArray(body.auditLogs)
          ? body.auditLogs
          : baseData.auditLogs;
        const nextRoleConfigs: Record<string, RoleConfig> =
          body.roleConfigs && Object.keys(body.roleConfigs).length > 0
            ? body.roleConfigs
            : baseData.roleConfigs;

        // Guard against accidental user wipe locking out system
        if (currentLive.ok && baseData.users.length > 0 && nextUsers.length === 0) {
          res.status(409).json({
            success: false,
            spreadsheetSynced: false,
            message: 'Operasi ditolak: seluruh daftar pengguna tidak dapat dihapus sekaligus.',
            ...baseData,
            syncMeta: getSyncMeta(),
          });
          return;
        }

        // Guard against accidental mass record wipe without explicit clearAll flag
        if (
          currentLive.ok &&
          baseData.records.length > 1 &&
          nextRecords.length === 0 &&
          !body.clearAll
        ) {
          res.status(409).json({
            success: false,
            spreadsheetSynced: false,
            message:
              'Operasi ditolak: penghapusan seluruh data suhu memerlukan konfirmasi eksplisit.',
            ...baseData,
            syncMeta: getSyncMeta(),
          });
          return;
        }

        const deletedRecordKeys: string[] = Array.isArray(body.deletedRecordKeys)
          ? body.deletedRecordKeys
          : [];

        if (body.clearAll) {
          baseData.records.forEach((r) => {
            getRecordAllKeys(r).forEach((k) => {
              if (!deletedRecordKeys.includes(k)) deletedRecordKeys.push(k);
            });
          });
          nextRecords = [];
          nextAuditLogs = [];
        } else if (deletedRecordKeys.length > 0) {
          const delSet = new Set(deletedRecordKeys);
          nextRecords = nextRecords.filter(
            (r) =>
              !delSet.has(r.id) &&
              !delSet.has(getRecordUniqueKey(r)) &&
              !getRecordAllKeys(r).some((k) => delSet.has(k))
          );
        }

        const payload: FullAppSyncData = {
          records: nextRecords,
          rooms: nextRooms,
          users: nextUsers,
          auditLogs: nextAuditLogs,
          roleConfigs: nextRoleConfigs,
        };

        const pushResult = await pushAllSheetsToSpreadsheet(payload, deletedRecordKeys, baseData);

        if (!pushResult.success) {
          res.status(502).json({
            success: false,
            spreadsheetSynced: false,
            message: pushResult.message,
            ...baseData,
            syncMeta: getSyncMeta(),
          });
          return;
        }

        res.json({
          success: true,
          spreadsheetSynced: true,
          message: pushResult.message,
          ...payload,
          syncMeta: getSyncMeta(),
        });
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message || 'Sync error' });
    }
  });

  // Save Apps Script Web App bridge URL
  app.post('/api/sheets/config', async (req, res) => {
    try {
      await enqueueSyncMutation(async () => {
        const url = typeof req.body?.webhookUrl === 'string' ? req.body.webhookUrl.trim() : '';
        saveConfiguredWebhookUrl(url);

        if (url) {
          const live = await fetchLiveFromSpreadsheet();
          if (!live.ok) {
            res.status(502).json({
              success: false,
              message:
                'URL Web App tersimpan, namun gagal membaca state Google Spreadsheet saat sinkronisasi awal.',
              syncMeta: getSyncMeta(),
            });
            return;
          }
          const pushRes = await pushAllSheetsToSpreadsheet(live.data);
          res.json({
            success: pushRes.success,
            message: pushRes.message,
            syncMeta: getSyncMeta(),
          });
        } else {
          res.json({
            success: true,
            message: 'URL Web App Apps Script dihapus dari konfigurasi server.',
            syncMeta: getSyncMeta(),
          });
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message || 'Config error' });
    }
  });

  return app;
}

async function startServer() {
  const app = createApiApp();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SIMONSU Server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}
