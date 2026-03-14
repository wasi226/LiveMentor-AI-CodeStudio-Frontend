import React from 'react';
import { Link } from 'react-router-dom';
import { 
  LayoutDashboard, BarChart3, 
  LogOut, ChevronLeft, ChevronRight, Terminal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const studentNav = [
  { label: 'Dashboard', icon: LayoutDashboard, page: '/student-dashboard' },
  { label: 'Analytics', icon: BarChart3, page: '/analytics' },
];

const facultyNav = [
  { label: 'Dashboard', icon: LayoutDashboard, page: '/faculty-dashboard' },
  { label: 'Analytics', icon: BarChart3, page: '/analytics' },
];

export default function Sidebar({ role, currentPage, collapsed, onToggle, onLogout }) {
  const navItems = role === 'admin' ? facultyNav : studentNav;

  return (
    <motion.aside
      animate={{ width: collapsed ? 68 : 240 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      className="h-screen bg-[#0a0f1a] border-r border-slate-800/50 flex flex-col fixed left-0 top-0 z-40 overflow-hidden"
    >
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-slate-800/50 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/20">
            <Terminal className="w-4 h-4 text-white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className="flex items-baseline gap-0.5 whitespace-nowrap overflow-hidden"
              >
                <span className="text-[15px] font-bold text-white tracking-tight">CodeClass</span>
                <span className="text-indigo-400 text-[15px] font-bold">.ai</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Role badge */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-3 pt-3 pb-1 overflow-hidden"
          >
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-800/80">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${role === 'admin' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
                {role === 'admin' ? 'Faculty' : 'Student'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav items */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = currentPage === item.page;
          return (
            <Link
              key={item.label}
              to={item.page}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group relative
                ${isActive 
                  ? 'bg-indigo-500/12 text-indigo-400' 
                  : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebarActiveIndicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-indigo-400"
                />
              )}
              <item.icon className={`w-4.5 h-4.5 flex-shrink-0 transition-colors ${isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`} style={{ width: 18, height: 18 }} />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1 }}
                    className="text-[13px] font-medium whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="px-2 py-3 border-t border-slate-800/50 space-y-0.5 flex-shrink-0">
        <button
          onClick={onToggle}
          title={collapsed ? 'Expand' : 'Collapse'}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-slate-800/40 w-full transition-all"
        >
          {collapsed 
            ? <ChevronRight style={{ width: 18, height: 18 }} className="flex-shrink-0" />
            : <ChevronLeft style={{ width: 18, height: 18 }} className="flex-shrink-0" />
          }
          {!collapsed && <span className="text-[13px] font-medium whitespace-nowrap">Collapse</span>}
        </button>
        <button
          onClick={onLogout}
          title={collapsed ? 'Sign Out' : undefined}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/8 w-full transition-all"
        >
          <LogOut style={{ width: 18, height: 18 }} className="flex-shrink-0" />
          {!collapsed && <span className="text-[13px] font-medium whitespace-nowrap">Sign Out</span>}
        </button>
      </div>
    </motion.aside>
  );
}