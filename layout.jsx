import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import Sidebar from '@/components/ui-custom/Sidebar';

const NO_LAYOUT = ['Landing', 'Classroom'];

export default function Layout({ children, currentPageName }) {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  if (NO_LAYOUT.includes(currentPageName)) {
    return <div className="dark">{children}</div>;
  }

  const sidebarWidth = collapsed ? 68 : 240;

  return (
    <div className="dark">
      <style>{`
        :root {
          --background: 224 71% 4%;
          --foreground: 213 31% 91%;
          --card: 224 71% 4%;
          --card-foreground: 213 31% 91%;
          --popover: 224 71% 4%;
          --popover-foreground: 213 31% 91%;
          --primary: 210 40% 98%;
          --primary-foreground: 222.2 47.4% 11.2%;
          --secondary: 222.2 47.4% 11.2%;
          --secondary-foreground: 210 40% 98%;
          --muted: 223 47% 11%;
          --muted-foreground: 215.4 16.3% 56.9%;
          --accent: 216 34% 17%;
          --accent-foreground: 210 40% 98%;
          --destructive: 0 63% 31%;
          --destructive-foreground: 210 40% 98%;
          --border: 216 34% 17%;
          --input: 216 34% 17%;
          --ring: 216 34% 17%;
          --radius: 0.6rem;
        }
      `}</style>
      <div className="flex min-h-screen bg-slate-950">
        <Sidebar
          role={user?.role || 'user'}
          currentPage={currentPageName}
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          onLogout={logout}
        />
        <main
          className="flex-1 min-w-0 transition-all duration-200"
          style={{ marginLeft: sidebarWidth }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}