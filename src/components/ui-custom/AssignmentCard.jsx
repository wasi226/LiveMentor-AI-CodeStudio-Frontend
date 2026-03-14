import React from 'react';
import { FileCode, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import moment from 'moment';
import { motion } from 'framer-motion';

const difficultyConfig = {
  easy:   { label: 'Easy',   color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  medium: { label: 'Medium', color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  hard:   { label: 'Hard',   color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20' },
};

const statusConfig = {
  published: { icon: FileCode,      color: 'text-indigo-400' },
  draft:     { icon: AlertCircle,   color: 'text-amber-400' },
  closed:    { icon: CheckCircle2,  color: 'text-slate-500' },
};

export default function AssignmentCard({ assignment, delay = 0, onClick }) {
  const diff = difficultyConfig[assignment.difficulty] || difficultyConfig.medium;
  const status = statusConfig[assignment.status] || statusConfig.draft;
  const StatusIcon = status.icon;
  const isOverdue = assignment.due_date && moment(assignment.due_date).isBefore(moment());
  const daysLeft = assignment.due_date ? moment(assignment.due_date).diff(moment(), 'days') : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.4, 0, 0.2, 1] }}
      onClick={onClick}
      className="group rounded-lg border border-slate-800/60 bg-slate-900/30 p-4 hover:border-slate-700/60 hover:bg-slate-900/60 transition-all duration-200 cursor-pointer"
    >
      <div className="flex items-start gap-3">
        <div className={`w-7 h-7 rounded-lg ${diff.bg} border ${diff.border} flex items-center justify-center flex-shrink-0 mt-0.5`}>
          <StatusIcon className={status.color} style={{ width: 13, height: 13 }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-[13px] font-semibold text-slate-200 group-hover:text-white transition-colors line-clamp-1">{assignment.title}</h4>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${diff.bg} ${diff.color} ${diff.border} border flex-shrink-0`}>
              {diff.label}
            </span>
          </div>
          <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-1">{assignment.description || 'No description'}</p>

          {assignment.due_date && (
            <div className={`flex items-center gap-1.5 mt-2 text-[11px] font-medium ${isOverdue ? 'text-rose-400' : daysLeft !== null && daysLeft <= 2 ? 'text-amber-400' : 'text-slate-600'}`}>
              <Clock style={{ width: 11, height: 11 }} />
              {isOverdue
                ? `Overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''}`
                : daysLeft === 0 ? 'Due today'
                : daysLeft === 1 ? 'Due tomorrow'
                : `Due ${moment(assignment.due_date).format('MMM D')}`
              }
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}