import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, BookOpen, Users, BarChart3, AlertTriangle, Copy, Check, Hash, TrendingUp, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import StatCard from '@/components/ui-custom/StatCard';
import ClassroomCard from '@/components/ui-custom/ClassroomCard';
import TopBar from '@/components/ui-custom/TopBar';
import { useAuth } from '@/lib/AuthContext';
import moment from 'moment';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const normalizeClassroom = (classroom) => ({
  ...classroom,
  id: classroom.id || classroom._id,
  student_emails: classroom.student_emails || [],
  created_date: classroom.created_date || classroom.createdAt || classroom.created_at,
  updated_date: classroom.updated_date || classroom.updatedAt || classroom.updated_at,
  max_students: classroom.max_students ?? classroom.maxStudents ?? 30,
});

const parseApiResponse = async (response) => {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || data.error || 'Request failed');
  }

  return data;
};

export default function FacultyDashboard() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', language: 'javascript', max_students: 30 });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user, logout, getAuthHeaders, handleUnauthorizedResponse } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };



  const { data: classrooms = [], isLoading } = useQuery({
    queryKey: ['facultyClassrooms', user?.email],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/classrooms`, {
        headers: getAuthHeaders(),
      });

      if (await handleUnauthorizedResponse(response, 'Your session is invalid. Please sign in again.')) {
        throw new Error('Your session is invalid. Please sign in again.');
      }

      const data = await parseApiResponse(response);
      return (data.classrooms || []).map(normalizeClassroom);
    },
    enabled: !!user,
    retry: false,
  });

  const { data: allSubmissions = [] } = useQuery({
    queryKey: ['facultySubmissions'],
    queryFn: () => Promise.resolve([]),
  });

  const totalStudents = classrooms.reduce((sum, c) => sum + (c.student_emails?.length || 0), 0);
  const errorSubmissions = allSubmissions.filter(s => s.error_count > 0);
  const avgScore = allSubmissions.length > 0
    ? Math.round(allSubmissions.reduce((sum, s) => sum + (s.score || 0), 0) / allSubmissions.length)
    : 0;
  const hasClassrooms = classrooms.length > 0;
  const classroomLabel = classrooms.length === 1 ? 'classroom' : 'classrooms';

  let classroomsContent;

  if (isLoading) {
    classroomsContent = (
      <div className="grid sm:grid-cols-2 gap-3">
        {[1, 2].map(i => <div key={i} className="rounded-xl border border-slate-800/60 p-5 animate-pulse h-36 bg-slate-900/20" />)}
      </div>
    );
  } else if (hasClassrooms) {
    classroomsContent = (
      <div className="grid sm:grid-cols-2 gap-3">
        {classrooms.map((c, i) => <ClassroomCard key={c.id} classroom={c} delay={i * 0.07} />)}
      </div>
    );
  } else {
    classroomsContent = (
      <div className="rounded-xl border border-dashed border-slate-800/60 p-10 text-center bg-slate-900/10">
        <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-3">
          <BookOpen style={{ width: 18, height: 18 }} className="text-slate-700" />
        </div>
        <p className="text-[13px] text-slate-500 font-medium">No classrooms yet</p>
        <p className="text-[11px] text-slate-700 mt-1">Create your first classroom to get started</p>
        <Button size="sm" onClick={() => setDialogOpen(true)} className="mt-4 bg-indigo-600 hover:bg-indigo-500 h-8 text-[12px]">
          <Plus style={{ width: 12, height: 12 }} /> Create Now
        </Button>
      </div>
    );
  }

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await fetch(`${API_BASE_URL}/api/classrooms`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: data.name.trim(),
          description: data.description.trim(),
          language: data.language,
          maxStudents: data.max_students,
        }),
      });

      if (await handleUnauthorizedResponse(response, 'Your session is invalid. Please sign in again.')) {
        throw new Error('Your session is invalid. Please sign in again.');
      }

      const payload = await parseApiResponse(response);
      return normalizeClassroom(payload.classroom);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facultyClassrooms'] });
      setDialogOpen(false);
      setForm({ name: '', description: '', language: 'javascript', max_students: 30 });
    },
  });

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const langColors = {
    javascript: 'text-yellow-400', python: 'text-blue-400', java: 'text-orange-400',
    cpp: 'text-cyan-400', typescript: 'text-sky-400', go: 'text-teal-400', rust: 'text-rose-400',
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <TopBar
        user={user}
        title={`Faculty Dashboard - ${user?.full_name || 'Professor'}`}
        subtitle={`Welcome, ${user?.full_name || 'Professor'}`}
        actions={
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                createMutation.reset();
              }
            }}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 h-8 text-[12px] px-2 sm:px-3 gap-1.5">
                  <Plus style={{ width: 13, height: 13 }} />
                  <span className="hidden sm:inline">New Classroom</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#0d1117] border-slate-800 text-white max-w-sm">
                <DialogHeader>
                  <DialogTitle className="text-[15px]">Create Classroom</DialogTitle>
                  <DialogDescription className="text-slate-500 text-[12px]">A unique invite code will be auto-generated.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 mt-2">
                  <input
                    placeholder="Classroom name *"
                    value={form.name}
                    onChange={(e) => {
                      createMutation.reset();
                      setForm(p => ({ ...p, name: e.target.value }));
                    }}
                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-[13px] placeholder:text-slate-600 outline-none focus:border-indigo-500/50 transition-colors"
                  />
                  <textarea
                    placeholder="Description (optional)"
                    value={form.description}
                    onChange={(e) => {
                      createMutation.reset();
                      setForm(p => ({ ...p, description: e.target.value }));
                    }}
                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-[13px] placeholder:text-slate-600 outline-none focus:border-indigo-500/50 transition-colors resize-none h-20"
                  />
                  <Select value={form.language} onValueChange={(v) => {
                    createMutation.reset();
                    setForm(p => ({ ...p, language: v }));
                  }}>
                    <SelectTrigger className="bg-slate-900 border-slate-800 text-white h-10 text-[13px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      {['javascript', 'python', 'java', 'cpp', 'typescript', 'go', 'rust'].map(l => (
                        <SelectItem key={l} value={l} className="text-slate-200 focus:bg-slate-800 focus:text-white text-[13px]">{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {createMutation.isError && (
                    <p className="text-rose-400 text-[11px]">{createMutation.error.message}</p>
                  )}
                  <Button
                    onClick={() => createMutation.mutate(form)}
                    disabled={form.name.trim().length < 3 || createMutation.isPending}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 h-9 text-[13px]"
                  >
                    {createMutation.isPending ? 'Creating...' : 'Create Classroom'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              size="sm"
              variant="outline"
              onClick={handleLogout}
              className="h-8 text-[12px] px-2 sm:px-3 gap-1.5 border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-600 hover:border-rose-500 hover:text-white transition-colors"
            >
              <LogOut style={{ width: 13, height: 13 }} />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        }
      />

      <main className="p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="Classrooms" value={classrooms.length} icon={BookOpen} color="indigo" delay={0} subtitle="Total active" />
          <StatCard title="Students" value={totalStudents} icon={Users} color="violet" delay={0.05} subtitle="Enrolled" />
          <StatCard title="Avg Score" value={avgScore > 0 ? `${avgScore}%` : '—'} icon={TrendingUp} color="emerald" delay={0.1} subtitle="Class average" />
          <StatCard title="Errors" value={errorSubmissions.length} icon={AlertTriangle} color="rose" delay={0.15} subtitle="Need attention" />
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          {/* Left: Classrooms */}
          <div className="lg:col-span-2 space-y-5">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-[14px] font-semibold text-white">Your Classrooms</h2>
                  <p className="text-[11px] text-slate-600 mt-0.5">{classrooms.length} {classroomLabel}</p>
                </div>
              </div>

              {classroomsContent}
            </div>

            {/* Invite codes */}
            {hasClassrooms && (
              <div className="rounded-xl border border-slate-800/60 bg-slate-900/20 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800/50">
                  <Hash style={{ width: 13, height: 13 }} className="text-slate-500" />
                  <h3 className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider">Invite Codes</h3>
                </div>
                <div className="divide-y divide-slate-800/40">
                  {classrooms.map(c => (
                    <div key={c.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 hover:bg-slate-800/20 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center">
                          <BookOpen style={{ width: 12, height: 12 }} className={langColors[c.language] || 'text-slate-500'} />
                        </div>
                        <div>
                          <p className="text-[12px] font-medium text-slate-300">{c.name}</p>
                          <p className="text-[10px] text-slate-600">{c.student_emails?.length || 0} students</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 self-end sm:self-auto">
                        <span className="text-[11px] sm:text-[12px] font-mono font-bold text-indigo-400 bg-indigo-500/8 border border-indigo-500/15 px-2.5 py-1 rounded-md">{c.code}</span>
                        <button
                          onClick={() => copyCode(c.code)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
                        >
                          {copiedCode === c.code
                            ? <Check style={{ width: 13, height: 13 }} className="text-emerald-400" />
                            : <Copy style={{ width: 13, height: 13 }} />
                          }
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-5">
            {/* Student Progress */}
            <div>
              <h2 className="text-[14px] font-semibold text-white mb-3">Student Progress</h2>
              <div className="rounded-xl border border-slate-800/60 bg-slate-900/20 overflow-hidden divide-y divide-slate-800/40">
                {allSubmissions.length > 0 ? allSubmissions.slice(0, 6).map((s, i) => (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className="flex items-center gap-3 px-3 py-2.5"
                  >
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] text-white font-bold">{(s.student_email || '?')[0].toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-slate-300 font-medium truncate">{s.student_email?.split('@')[0]}</p>
                      <p className="text-[10px] text-slate-600">{s.language} · {moment(s.created_date).fromNow()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${(s.score || 0) >= 70 ? 'bg-emerald-400' : 'bg-amber-400'}`}
                          style={{ width: `${s.score || 0}%` }}
                        />
                      </div>
                      <span className={`text-[11px] font-bold tabular-nums w-8 text-right ${(s.score || 0) >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {s.score || 0}%
                      </span>
                    </div>
                  </motion.div>
                )) : (
                  <div className="p-6 text-center">
                    <BarChart3 style={{ width: 20, height: 20 }} className="text-slate-800 mx-auto mb-2" />
                    <p className="text-[11px] text-slate-600">No submissions yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* Error Alerts */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[14px] font-semibold text-white">Error Alerts</h2>
                {errorSubmissions.length > 0 && (
                  <span className="text-[10px] font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                    {errorSubmissions.length} students
                  </span>
                )}
              </div>
              <div className={`rounded-xl border p-4 space-y-3 ${errorSubmissions.length > 0 ? 'border-rose-500/15 bg-rose-500/4' : 'border-slate-800/60 bg-slate-900/20'}`}>
                {errorSubmissions.length > 0 ? (
                  errorSubmissions.slice(0, 4).map((s, i) => (
                    <div key={s.id} className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-lg bg-rose-500/15 border border-rose-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <AlertTriangle style={{ width: 10, height: 10 }} className="text-rose-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-slate-300 truncate">{s.student_email?.split('@')[0]}</p>
                        <p className="text-[10px] text-slate-600">{s.error_count} error{s.error_count === 1 ? '' : 's'} · {s.language}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center mx-auto mb-2">
                      <Check style={{ width: 14, height: 14 }} className="text-emerald-400" />
                    </div>
                    <p className="text-[11px] text-slate-500">All clear! No errors found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}