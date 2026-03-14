import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

const colorMap = {
  indigo: {
    bg: 'bg-indigo-500/8',
    border: 'border-indigo-500/15',
    iconBg: 'bg-indigo-500/12',
    icon: 'text-indigo-400',
    text: 'text-indigo-400',
    glow: 'shadow-indigo-500/5',
  },
  violet: {
    bg: 'bg-violet-500/8',
    border: 'border-violet-500/15',
    iconBg: 'bg-violet-500/12',
    icon: 'text-violet-400',
    text: 'text-violet-400',
    glow: 'shadow-violet-500/5',
  },
  emerald: {
    bg: 'bg-emerald-500/8',
    border: 'border-emerald-500/15',
    iconBg: 'bg-emerald-500/12',
    icon: 'text-emerald-400',
    text: 'text-emerald-400',
    glow: 'shadow-emerald-500/5',
  },
  amber: {
    bg: 'bg-amber-500/8',
    border: 'border-amber-500/15',
    iconBg: 'bg-amber-500/12',
    icon: 'text-amber-400',
    text: 'text-amber-400',
    glow: 'shadow-amber-500/5',
  },
  rose: {
    bg: 'bg-rose-500/8',
    border: 'border-rose-500/15',
    iconBg: 'bg-rose-500/12',
    icon: 'text-rose-400',
    text: 'text-rose-400',
    glow: 'shadow-rose-500/5',
  },
  sky: {
    bg: 'bg-sky-500/8',
    border: 'border-sky-500/15',
    iconBg: 'bg-sky-500/12',
    icon: 'text-sky-400',
    text: 'text-sky-400',
    glow: 'shadow-sky-500/5',
  },
};

export default function StatCard({ title, value, subtitle, icon: Icon, color = 'indigo', delay = 0, trend }) {
  const c = colorMap[color] || colorMap.indigo;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.4, 0, 0.2, 1] }}
      className={`relative rounded-xl border ${c.border} ${c.bg} p-5 group hover:border-opacity-30 transition-all duration-300 shadow-sm ${c.glow} overflow-hidden`}
    >
      {/* Subtle top gradient line */}
      <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-20 ${c.icon}`} />

      <div className="flex items-start justify-between">
        <div className="space-y-1 min-w-0">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
          {subtitle && (
            <p className={`text-[11px] ${c.text} font-medium flex items-center gap-1`}>
              {trend === 'up' && <TrendingUp style={{ width: 11, height: 11 }} />}
              {trend === 'down' && <TrendingDown style={{ width: 11, height: 11 }} />}
              {subtitle}
            </p>
          )}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-xl ${c.iconBg} flex-shrink-0 group-hover:scale-110 transition-transform duration-200`}>
            <Icon className={`${c.icon}`} style={{ width: 18, height: 18 }} />
          </div>
        )}
      </div>
    </motion.div>
  );
}