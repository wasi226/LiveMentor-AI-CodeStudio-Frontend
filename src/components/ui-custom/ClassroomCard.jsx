import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Code2, Clock, ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';
import moment from 'moment';

const langConfig = {
  javascript: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', dot: '#facc15' },
  python:     { color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   dot: '#60a5fa' },
  java:       { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', dot: '#fb923c' },
  cpp:        { color: 'text-cyan-400',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20',   dot: '#22d3ee' },
  typescript: { color: 'text-sky-400',    bg: 'bg-sky-500/10',    border: 'border-sky-500/20',    dot: '#38bdf8' },
  go:         { color: 'text-teal-400',   bg: 'bg-teal-500/10',   border: 'border-teal-500/20',   dot: '#2dd4bf' },
  rust:       { color: 'text-rose-400',   bg: 'bg-rose-500/10',   border: 'border-rose-500/20',   dot: '#fb7185' },
};

const avatarGradients = [
  'from-indigo-500 to-violet-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-sky-500 to-blue-600',
];

export default function ClassroomCard({ classroom, delay = 0 }) {
  const studentCount = classroom.student_emails?.length || 0;
  const lang = langConfig[classroom.language] || langConfig.javascript;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.4, 0, 0.2, 1] }}
    >
      <Link to={`/classroom?id=${classroom.id}`} className="block group">
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5 hover:border-indigo-500/25 hover:bg-slate-900/60 transition-all duration-250 relative overflow-hidden">
          {/* Hover glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-violet-600/0 group-hover:from-indigo-500/3 group-hover:to-violet-600/3 transition-all duration-300 rounded-xl" />

          <div className="relative">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-lg ${lang.bg} border ${lang.border} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <Code2 className={`${lang.color}`} style={{ width: 14, height: 14 }} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[13px] font-semibold text-slate-100 truncate group-hover:text-white transition-colors leading-snug">
                    {classroom.name}
                  </h3>
                  <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-1">{classroom.description || 'No description'}</p>
                </div>
              </div>
              <ArrowUpRight
                className="text-slate-700 group-hover:text-indigo-400 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 flex-shrink-0 ml-2"
                style={{ width: 14, height: 14 }}
              />
            </div>

            {/* Meta */}
            <div className="flex items-center gap-3 text-[11px] text-slate-600">
              <span className={`flex items-center gap-1 font-medium ${lang.color}`}>
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: lang.dot }} />
                {classroom.language}
              </span>
              <span className="flex items-center gap-1">
                <Users style={{ width: 11, height: 11 }} />
                {studentCount}
              </span>
              <span className="flex items-center gap-1">
                <Clock style={{ width: 11, height: 11 }} />
                {moment(classroom.created_date).fromNow()}
              </span>
            </div>

            {/* Avatars */}
            {studentCount > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-800/40 flex items-center justify-between">
                <div className="flex items-center">
                  {[...Array(Math.min(studentCount, 4))].map((_, i) => (
                    <div
                      key={i}
                      className={`w-5 h-5 rounded-full bg-gradient-to-br ${avatarGradients[i % avatarGradients.length]} border border-slate-900 flex items-center justify-center`}
                      style={{ marginLeft: i === 0 ? 0 : -6 }}
                    >
                      <span className="text-[8px] text-white font-semibold">{String.fromCharCode(65 + i)}</span>
                    </div>
                  ))}
                  {studentCount > 4 && (
                    <div className="w-5 h-5 rounded-full bg-slate-700 border border-slate-900 flex items-center justify-center" style={{ marginLeft: -6 }}>
                      <span className="text-[8px] text-slate-400">+{studentCount - 4}</span>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-600">{studentCount} enrolled</span>
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}