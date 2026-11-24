import React from 'react';
import { UserCheck, Mail, BadgeCheck, Building2 } from 'lucide-react';
import { User, Room } from '../types/simonsu';
import { getUserAssignedRooms, isUserUnrestrictedRooms } from '../utils/storage';

interface ProfileViewProps {
  currentUser: User;
  rooms?: Room[];
  users?: User[];
  onSelectUser?: (user: User) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ currentUser, rooms = [] }) => {
  const isUnrestricted = isUserUnrestrictedRooms(currentUser);
  const assignedRooms = getUserAssignedRooms(currentUser, rooms, true);

  return (
    <div className="w-full space-y-6">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-xl transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-cyan-500 to-blue-600 text-white rounded-xl shadow-md shadow-cyan-500/20">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white font-poppins">Profil Pengguna</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Informasi identitas akun petugas UPT Laboratorium Kesehatan Kota Bontang.
            </p>
          </div>
        </div>
      </div>

      {/* Active User Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-xl space-y-6 transition-colors">
        <div className="flex flex-col sm:flex-row items-center gap-5 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white text-3xl shadow-xl shadow-cyan-500/20">
            {currentUser.name.charAt(0)}
          </div>

          <div className="text-center sm:text-left space-y-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">{currentUser.name}</h3>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                currentUser.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700' : 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-300'
              }`}>
                {currentUser.role}
              </span>
            </div>
            <p className="text-xs text-cyan-600 dark:text-cyan-400 font-semibold">{currentUser.position}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">UPT Laboratorium Kesehatan Kota Bontang</p>
          </div>
        </div>

        {/* Profile Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-bold uppercase tracking-wider">
              <BadgeCheck className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /> NIP (Nomor Induk Pegawai)
            </span>
            <p className="text-sm font-mono font-bold text-slate-900 dark:text-white">{currentUser.nip}</p>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-bold uppercase tracking-wider">
              <Mail className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /> Email Resmi
            </span>
            <p className="text-sm font-mono font-bold text-slate-900 dark:text-white">{currentUser.email}</p>
          </div>

          <div className="sm:col-span-2 p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-bold uppercase tracking-wider">
              <Building2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /> Tanggung Jawab Ruangan
            </span>
            {isUnrestricted ? (
              <p className="text-xs font-bold text-cyan-600 dark:text-cyan-400">
                Semua Ruangan Laboratorium (Akses Penuh)
              </p>
            ) : assignedRooms.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {assignedRooms.map((r) => (
                  <span
                    key={r.id}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-cyan-50 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800"
                  >
                    [{r.code}] {r.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                Belum ada ruangan yang ditugaskan. Hubungi Administrator.
              </p>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
