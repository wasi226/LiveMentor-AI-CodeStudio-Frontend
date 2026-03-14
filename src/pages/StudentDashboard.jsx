import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, BookOpen, FileCode, TrendingUp, Activity, Clock, Zap, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import StatCard from '@/components/ui-custom/StatCard';
import ClassroomCard from '@/components/ui-custom/ClassroomCard';
import AssignmentCard from '@/components/ui-custom/AssignmentCard';
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

export default function StudentDashboard() {
  const [joinCode, setJoinCode] = useState('');
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [joinError, setJoinError] = useState('');
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



  const { data: classrooms = [], isLoading: loadingClassrooms } = useQuery({
    queryKey: ['studentClassrooms', user?.email],
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

  const { data: assignments = [] } = useQuery({
    queryKey: ['studentAssignments'],
    queryFn: () => Promise.resolve([]),
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ['studentSubmissions', user?.email],
    queryFn: () => Promise.resolve([]),
    enabled: !!user,
  });

  const joinMutation = useMutation({
    mutationFn: async (code) => {
      setJoinError('');

      const response = await fetch(`${API_BASE_URL}/api/classrooms/join`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
        }),
      });

      if (await handleUnauthorizedResponse(response, 'Your session is invalid. Please sign in again.')) {
        throw new Error('Your session is invalid. Please sign in again.');
      }

      const data = await parseApiResponse(response);
      return normalizeClassroom(data.classroom);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studentClassrooms'] });
      setJoinDialogOpen(false);
      setJoinCode('');
      setJoinError('');
    },
    onError: (err) => setJoinError(err.message),
  });

  const avgScore = submissions.length > 0
    ? Math.round(submissions.reduce((sum, s) => sum + (s.score || 0), 0) / submissions.length)
    : 0;

  const gradedCount = submissions.filter(s => s.status === 'graded').length;
  const hasClassrooms = classrooms.length > 0;
  const displayName = user?.full_name || 'Student Dashboard';
  const title = user?.rollNumber ? `${displayName} (${user.rollNumber})` : displayName;
  const firstName = user?.full_name?.split(' ')[0] || 'Student';
  const currentHour = new Date().getHours();
  let greetingTime = 'evening';

  if (currentHour < 12) {
    greetingTime = 'morning';
  } else if (currentHour < 18) {
    greetingTime = 'afternoon';
  }

  const subtitle = `Good ${greetingTime}, ${firstName} 👋`;
  const quickTips = [
    'Use the AI tutor to debug code instantly',
    'Submit early to get feedback sooner',
    'Check the Output panel after running',
  ];

  const getSubmissionAccentClass = (submission) => {
    if (submission.status !== 'graded') {
      return 'bg-indigo-400';
    }

    return submission.score >= 70 ? 'bg-emerald-400' : 'bg-amber-400';
  };

  let classroomsContent;

  if (loadingClassrooms) {
    classroomsContent = (
      <div className="grid sm:grid-cols-2 gap-3">
        {[1, 2].map(i => (
          <div key={i} className="rounded-xl border border-slate-800/60 p-5 animate-pulse h-36 bg-slate-900/20" />
        ))}
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
        <p className="text-[11px] text-slate-700 mt-1">Use an invite code from your instructor</p>
        <Button
          size="sm"
          onClick={() => setJoinDialogOpen(true)}
          className="mt-4 bg-indigo-600 hover:bg-indigo-500 h-8 text-[12px]"
        >
          <Plus style={{ width: 12, height: 12 }} />
          Join Now
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <TopBar
        user={user}
        title={title}
        subtitle={subtitle}
        actions={
          <div className="flex items-center gap-2">
            <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 h-8 text-[12px] px-3 gap-1.5">
                  <Plus style={{ width: 13, height: 13 }} />
                  Join Classroom
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#0d1117] border-slate-800 text-white max-w-sm">
                <DialogHeader>
                  <DialogTitle className="text-[15px]">Join a Classroom</DialogTitle>
                  <DialogDescription className="text-slate-500 text-[12px]">Enter the invite code provided by your instructor.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <div>
                    <input
                      placeholder="e.g. DSA101"
                      value={joinCode}
                      onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError(''); }}
                      onKeyDown={(e) => e.key === 'Enter' && joinCode.trim() && joinMutation.mutate(joinCode)}
                      className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-[13px] font-mono placeholder:text-slate-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-colors"
                    />
                    {joinError && <p className="text-rose-400 text-[11px] mt-1.5 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-rose-400" />{joinError}</p>}
                  </div>
                  <Button
                    onClick={() => joinMutation.mutate(joinCode)}
                    disabled={!joinCode.trim() || joinMutation.isPending}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 h-9 text-[13px]"
                  >
                    {joinMutation.isPending ? 'Joining...' : 'Join Classroom'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleLogout}
              className="h-8 text-[12px] px-3 gap-1.5 border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-600 hover:border-rose-500 hover:text-white transition-colors"
            >
              <LogOut style={{ width: 13, height: 13 }} />
              Logout
            </Button>
          </div>
        }
      />

      <main className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="Classrooms" value={classrooms.length} icon={BookOpen} color="indigo" delay={0} subtitle="Enrolled" />
          <StatCard title="Assignments" value={assignments.length} icon={FileCode} color="violet" delay={0.05} subtitle="Active" />
          <StatCard title="Avg Score" value={avgScore > 0 ? `${avgScore}%` : '—'} icon={TrendingUp} color="emerald" delay={0.1} subtitle="Across submissions" trend={avgScore >= 70 ? 'up' : undefined} />
          <StatCard title="Submissions" value={submissions.length} icon={Activity} color="amber" delay={0.15} subtitle={`${gradedCount} graded`} />
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          {/* Classrooms */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[14px] font-semibold text-white">My Classrooms</h2>
                <p className="text-[11px] text-slate-600 mt-0.5">{classrooms.length} enrolled</p>
              </div>
            </div>

            {classroomsContent}

            {/* Assignments section */}
            {assignments.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-[14px] font-semibold text-white">Active Assignments</h2>
                  <span className="text-[11px] text-slate-600">{assignments.length} open</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  {assignments.slice(0, 4).map((a, i) => <AssignmentCard key={a.id} assignment={a} delay={i * 0.07} />)}
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-5">
            {/* Activity Feed */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[14px] font-semibold text-white">Recent Activity</h2>
                <Clock style={{ width: 13, height: 13 }} className="text-slate-600" />
              </div>
              <div className="rounded-xl border border-slate-800/60 bg-slate-900/20 overflow-hidden divide-y divide-slate-800/40">
                {submissions.length > 0 ? submissions.slice(0, 5).map((s, i) => (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className="flex items-center gap-3 p-3"
                  >
                    <div className={`w-1.5 h-6 rounded-full flex-shrink-0 ${getSubmissionAccentClass(s)}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-slate-300 font-medium truncate">
                        {s.language?.charAt(0).toUpperCase() + s.language?.slice(1)} Submission
                      </p>
                      <p className="text-[10px] text-slate-600 mt-0.5">{moment(s.created_date).fromNow()}</p>
                    </div>
                    {s.score !== undefined && s.score !== null && (
                      <span className={`text-[12px] font-bold tabular-nums ${s.score >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {s.score}%
                      </span>
                    )}
                  </motion.div>
                )) : (
                  <div className="p-6 text-center">
                    <Activity style={{ width: 20, height: 20 }} className="text-slate-800 mx-auto mb-2" />
                    <p className="text-[11px] text-slate-600">No activity yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick tips */}
            <div className="rounded-xl border border-indigo-500/15 bg-indigo-500/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap style={{ width: 13, height: 13 }} className="text-indigo-400" />
                <h3 className="text-[12px] font-semibold text-indigo-400">Quick Tips</h3>
              </div>
              <ul className="space-y-2">
                {quickTips.map((tip) => (
                  <li key={tip} className="flex items-start gap-2 text-[11px] text-slate-500">
                    <span className="w-1 h-1 rounded-full bg-indigo-500/60 flex-shrink-0 mt-1.5" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}