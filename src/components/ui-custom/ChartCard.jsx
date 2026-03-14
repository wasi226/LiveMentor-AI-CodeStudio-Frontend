import React from 'react';
import { motion } from 'framer-motion';

export default function ChartCard({ title, subtitle, children, delay = 0, className = '', action }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] }}
      className={`rounded-xl border border-slate-800/60 bg-slate-900/30 p-5 ${className}`}
    >
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-[13px] font-semibold text-white leading-none">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-500 mt-1">{subtitle}</p>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      {children}
    </motion.div>
  );
}