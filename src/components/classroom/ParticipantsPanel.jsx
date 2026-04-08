/* eslint-disable react/prop-types */
/* eslint-disable sonarjs/no-nested-functions */
import React from 'react';
import { Users, Crown, WifiOff, Edit3, Zap, UserX } from 'lucide-react';
import { useCollaboration } from '@/contexts/CollaborationContext';

const gradients = [
  'from-indigo-500 to-violet-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-sky-500 to-blue-600',
  'from-fuchsia-500 to-purple-600',
  'from-lime-500 to-green-600',
];

export default function ParticipantsPanel({ participants, facultyEmail, currentUserEmail, currentUserRole, onRemoveStudent, removingStudentEmail }) {
  const { isConnected, activeUsers, typingUsers } = useCollaboration();
  const canRemoveStudents = currentUserRole === 'admin' || currentUserEmail === facultyEmail;
  
  const faculty = participants.filter(p => p.email === facultyEmail);
  const students = participants.filter(p => p.email !== facultyEmail);

  const getInitials = (p) => {
    if (p.name) return p.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    return (p.email || '?')[0].toUpperCase();
  };

  const isUserActive = (email) => activeUsers.has(email);
  const isUserTyping = (email) => typingUsers.has(email);
  const getUserLastSeen = (email) => {
    const user = activeUsers.get(email);
    return user ? new Date(user.lastSeen) : null;
  };

  const PersonRow = ({ person, index, isFaculty }) => {
    const isActive = isUserActive(person.email);
    const isTyping = isUserTyping(person.email);
    const lastSeen = getUserLastSeen(person.email);
    const canRemoveThisStudent =
      !isFaculty &&
      canRemoveStudents &&
      typeof onRemoveStudent === 'function' &&
      person.email !== currentUserEmail;
    const isRemoving = removingStudentEmail === person.email;
    let presenceLabel = <span className="text-[9px] text-slate-600">Offline</span>;

    if (isActive) {
      presenceLabel = <span className="text-[9px] text-emerald-400 font-medium">• Online</span>;
    } else if (lastSeen) {
      presenceLabel = <span className="text-[9px] text-slate-500">{getTimeAgo(lastSeen)}</span>;
    }
    
    return (
      <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-800/30 transition-colors group">
        <div className="relative flex-shrink-0">
          <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${gradients[index % gradients.length]} flex items-center justify-center shadow-sm`}>
            <span className="text-[10px] text-white font-semibold">{getInitials(person)}</span>
          </div>
          {/* Status indicator */}
          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${
            isActive ? 'bg-emerald-400' : 'bg-slate-600'
          }`} />
          {/* Typing indicator */}
          {isTyping && (
            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-blue-500 flex items-center justify-center animate-pulse">
              <Edit3 style={{ width: 8, height: 8 }} className="text-white" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[12px] font-medium text-slate-300 truncate leading-none">
              {person.name || person.email?.split('@')[0]}
            </p>
            {isTyping && (
              <span className="text-[9px] text-blue-400 font-medium animate-pulse">typing...</span>
            )}
          </div>
          {isFaculty ? (
            <div className="flex items-center gap-1 mt-0.5">
              <Crown style={{ width: 9, height: 9 }} className="text-amber-400" />
              <span className="text-[10px] text-amber-400 font-medium">Instructor</span>
              {isActive && <span className="text-[9px] text-emerald-400">• Live</span>}
            </div>
          ) : (
            <div className="flex items-center justify-between mt-0.5">
              <p className="text-[10px] text-slate-600 truncate">{person.email}</p>
              {presenceLabel}
            </div>
          )}
        </div>
        {canRemoveThisStudent && (
          <button
            type="button"
            onClick={() => onRemoveStudent(person)}
            disabled={isRemoving}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-rose-400 hover:text-rose-300 disabled:opacity-50 p-1 rounded hover:bg-rose-500/10"
            title={isRemoving ? 'Removing student...' : 'Remove student from class'}
            aria-label={`Remove ${person.email} from class`}
          >
            <UserX style={{ width: 13, height: 13 }} />
          </button>
        )}
      </div>
    );
  };

  const getTimeAgo = (date) => {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return '1d+ ago';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800/60 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Users style={{ width: 13, height: 13 }} className="text-slate-500" />
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Participants</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Connection status */}
          <div className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${
            isConnected ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
          }`}>
            {isConnected ? (
              <>
                <Zap style={{ width: 10, height: 10 }} />
                <span>Live</span>
              </>
            ) : (
              <>
                <WifiOff style={{ width: 10, height: 10 }} />
                <span>Offline</span>
              </>
            )}
          </div>
          {/* Participant count */}
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <span>{activeUsers.size}</span>
            <span className="text-slate-600">/</span>
            <span>{participants.length}</span>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto p-2 min-h-0">
        {faculty.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider px-2 mb-1">Instructor</p>
            {faculty.map((p, i) => <PersonRow key={p.email} person={p} index={i} isFaculty />)}
          </div>
        )}

        {students.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider px-2 mb-1">
              Students · {students.length}
            </p>
            {students.map((p, i) => <PersonRow key={p.email} person={p} index={i + 1} isFaculty={false} />)}
          </div>
        )}

        {participants.length === 0 && (
          <div className="text-center py-8">
            <Users style={{ width: 24, height: 24 }} className="text-slate-800 mx-auto mb-2" />
            <p className="text-[11px] text-slate-600">No participants yet</p>
          </div>
        )}
      </div>
    </div>
  );
}