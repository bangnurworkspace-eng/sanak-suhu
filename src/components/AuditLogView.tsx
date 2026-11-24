import React, { useState } from 'react';
import { History, User, Clock, Search } from 'lucide-react';
import { AuditLog } from '../types/simonsu';
import { formatDateIndonesia, getLocalDateString } from '../utils/storage';

interface AuditLogViewProps {
  logs: AuditLog[];
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ logs }) => {
  const [search, setSearch] = useState('');

  const filteredLogs = logs.filter(
    (l) =>
      l.details.toLowerCase().includes(search.toLowerCase()) ||
      l.user_name.toLowerCase().includes(search.toLowerCase()) ||
      l.action.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-cyan-500 to-blue-600 text-white rounded-xl shadow-md shadow-cyan-500/20">
            <History className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white font-poppins">Audit Log Aktivitas</h2>
              <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-mono text-[10px] font-bold border border-amber-200 dark:border-amber-800">
                Sheet: Audit_Log
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Catatan rekam jejak transparansi setiap perubahan data dan aktivitas pengguna.
            </p>
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari aktivitas atau nama..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-cyan-500 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none"
          />
        </div>
      </div>

      {/* Audit Log Timeline List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-xl space-y-4 transition-colors">
        {filteredLogs.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-xs">
            Belum ada rekam jejak audit log.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLogs.map((log) => {
              const dt = new Date(log.created_at);
              const isValidDt = !isNaN(dt.getTime());
              const timestampLabel = isValidDt
                ? `${formatDateIndonesia(getLocalDateString(dt))} • ${dt.toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })} WITA`
                : log.created_at || '-';

              return (
                <div
                  key={log.id}
                  className="p-4 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 rounded-xl hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">{log.user_name}</span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-cyan-800 dark:text-cyan-300 font-mono">
                          {log.action}
                        </span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 mt-1">{log.details}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 text-slate-500 dark:text-slate-400 font-mono text-[11px] self-end sm:self-auto">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {timestampLabel}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
