import React from 'react';
import { Bell, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export default function TopBar({ user, title, subtitle, actions }) {
  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <header className="h-14 border-b border-slate-800/50 bg-[#0a0f1a]/90 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="min-w-0">
        <h1 className="text-[15px] font-semibold text-white leading-none">{title}</h1>
        {subtitle && <p className="text-[11px] text-slate-500 mt-1">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative hidden lg:block">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <Input
            placeholder="Search..."
            className="w-56 pl-8 h-8 bg-slate-900/80 border-slate-800/80 text-slate-300 text-[13px] placeholder:text-slate-600 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500/40 rounded-lg"
          />
        </div>

        {actions && <div className="flex items-center">{actions}</div>}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="relative p-2 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800/50 transition-colors">
                <Bell style={{ width: 16, height: 16 }} />
                <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-indigo-500 ring-2 ring-[#0a0f1a]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-slate-800 border-slate-700 text-xs">Notifications</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-800/60">
          <Avatar className="w-7 h-7 border border-slate-700/80">
            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-[10px] font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:block">
            <p className="text-[12px] font-medium text-slate-300 leading-none">{user?.full_name || 'User'}</p>
            <p className="text-[10px] text-slate-600 mt-0.5 truncate max-w-[120px]">{user?.email || ''}</p>
          </div>
        </div>
      </div>
    </header>
  );
}