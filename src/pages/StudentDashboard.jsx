import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, BookOpen, FileCode, TrendingUp, Activity, Clock, Zap, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import StatCard from '@/components/ui-custom/StatCard';
import ClassroomCard from '@/components/ui-custom/ClassroomCard';
import TopBar from '@/components/ui-custom/TopBar';
import { useAuth } from '@/lib/AuthContext';
import { useCollaboration } from '@/contexts/CollaborationContext';
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

const normalizeAssignment = (assignment, classroomId) => ({
  ...assignment,
  id: assignment.id || assignment._id,
  classroom_id: assignment.classroom_id || classroomId,
  due_date: assignment.due_date || assignment.dueDate || null,
  status: assignment.is_published ? 'published' : 'draft'
});

const normalizeSubmission = (submission) => ({
  ...submission,
  id: submission.id || submission._id,
  created_date: submission.created_date || submission.created_at || submission.createdAt,
  updated_date: submission.updated_date || submission.updated_at || submission.updatedAt,
  submitted_at: submission.submitted_at || submission.submittedAt || null
});

const isSubmissionFinalized = (submission) => {
  const normalizedStatus = String(submission?.status || '').toLowerCase();
  if (normalizedStatus) {
    return !['draft', 'pending'].includes(normalizedStatus);
  }

  return Boolean(submission?.submitted_at || submission?.submittedAt);
};

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
  const [selectedPreviewClassroomId, setSelectedPreviewClassroomId] = useState('');
  const [livePreview, setLivePreview] = useState({
    code: '',
    language: 'javascript',
    senderName: '',
    updatedAt: null
  });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user, logout, getAuthHeaders, handleUnauthorizedResponse } = useAuth();
  const {
    connect,
    disconnect,
    isConnected,
    on,
    COLLABORATION_EVENTS
  } = useCollaboration();

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
    queryKey: ['studentAssignments', classrooms.map((c) => c.id).join(',')],
    queryFn: async () => {
      if (!classrooms.length) {
        return [];
      }

      const assignmentResponses = await Promise.all(
        classrooms.map(async (classroom) => {
          // Fetch assigned assignments specifically
          const response = await fetch(
            `${API_BASE_URL}/api/assignments/classroom/${encodeURIComponent(classroom.id)}/assigned?limit=100`,
            { headers: getAuthHeaders() }
          );

          if (await handleUnauthorizedResponse(response, 'Your session is invalid. Please sign in again.')) {
            throw new Error('Your session is invalid. Please sign in again.');
          }

          if (!response.ok) {
            return [];
          }

          const payload = await response.json().catch(() => ({}));
          return (payload.assignments || []).map((assignment) => normalizeAssignment(assignment, classroom.id));
        })
      );

      return assignmentResponses.flat();
    },
    enabled: !!user && classrooms.length > 0,
    retry: false,
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ['studentSubmissions', user?.email],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/submissions?limit=200&sort=desc&sortBy=createdAt`, {
        headers: getAuthHeaders()
      });

      if (await handleUnauthorizedResponse(response, 'Your session is invalid. Please sign in again.')) {
        throw new Error('Your session is invalid. Please sign in again.');
      }

      if (!response.ok) {
        return [];
      }

      const payload = await response.json().catch(() => ({}));
      return (payload.submissions || []).map(normalizeSubmission);
    },
    enabled: !!user,
    retry: false,
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (!classrooms.length) {
      setSelectedPreviewClassroomId('');
      return;
    }

    const isCurrentSelectionValid = classrooms.some((classroom) => String(classroom.id) === String(selectedPreviewClassroomId));
    if (!isCurrentSelectionValid) {
      setSelectedPreviewClassroomId(String(classrooms[0].id));
    }
  }, [classrooms, selectedPreviewClassroomId]);

  useEffect(() => {
    if (!user?.email || !selectedPreviewClassroomId) {
      disconnect();
      return;
    }

    connect(selectedPreviewClassroomId, user);

    return () => {
      disconnect();
    };
  }, [selectedPreviewClassroomId, user, connect, disconnect]);

  useEffect(() => {
    if (!selectedPreviewClassroomId) {
      return () => {};
    }

    const selectedClassroom = classrooms.find(
      (classroom) => String(classroom.id) === String(selectedPreviewClassroomId)
    );
    const facultyEmail = selectedClassroom?.faculty_email;

    const unsubscribeCodeChange = on(COLLABORATION_EVENTS.CODE_CHANGE, (event) => {
      const senderEmail = event?.sender_email;
      const senderRole = event?.sender_role;
      const metadata = event?.metadata;

      const isTrustedFacultyChange =
        senderRole === 'faculty' ||
        senderRole === 'admin' ||
        (facultyEmail && senderEmail === facultyEmail);

      if (!isTrustedFacultyChange || !metadata || typeof metadata.code !== 'string') {
        return;
      }

      setLivePreview((previous) => ({
        ...previous,
        code: metadata.code,
        language: metadata.language || previous.language || 'javascript',
        senderName: event?.sender_name || senderEmail || 'Faculty',
        updatedAt: new Date().toISOString()
      }));
    });

    const unsubscribeLanguageChange = on(COLLABORATION_EVENTS.LANGUAGE_CHANGE, (event) => {
      const senderEmail = event?.sender_email;
      const senderRole = event?.sender_role;
      const metadata = event?.metadata;

      const isTrustedFacultyChange =
        senderRole === 'faculty' ||
        senderRole === 'admin' ||
        (facultyEmail && senderEmail === facultyEmail);

      if (!isTrustedFacultyChange || !metadata?.language) {
        return;
      }

      setLivePreview((previous) => ({
        ...previous,
        language: metadata.language,
        updatedAt: new Date().toISOString()
      }));
    });

    return () => {
      unsubscribeCodeChange();
      unsubscribeLanguageChange();
    };
  }, [classrooms, selectedPreviewClassroomId, on, COLLABORATION_EVENTS]);

  const joinMutation = useMutation({
    mutationFn: async (code) => {
      setJoinError('');
      const normalizedCode = String(code || '').trim().replace(/\s+/g, '').toUpperCase();

      const response = await fetch(`${API_BASE_URL}/api/classrooms/join`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          code: normalizedCode,
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

  const classroomNameById = useMemo(() => {
    const map = new Map();
    classrooms.forEach((classroom) => {
      if (classroom?.id) {
        map.set(String(classroom.id), classroom.name || 'Classroom');
      }
    });
    return map;
  }, [classrooms]);

  const assignmentTitleById = useMemo(() => {
    const map = new Map();
    assignments.forEach((assignment) => {
      const assignmentId = assignment?.id || assignment?._id;
      if (assignmentId) {
        map.set(String(assignmentId), assignment.title || 'Assignment');
      }
    });
    return map;
  }, [assignments]);

  const submittedAssignmentIds = useMemo(() => {
    const ids = new Set();
    submissions.forEach((submission) => {
      if (!isSubmissionFinalized(submission)) {
        return;
      }

      const assignmentId = submission?.assignment_id;
      if (assignmentId) {
        ids.add(String(assignmentId));
      }
    });
    return ids;
  }, [submissions]);

  const selectedPreviewClassroom = useMemo(
    () => classrooms.find((classroom) => String(classroom.id) === String(selectedPreviewClassroomId)) || null,
    [classrooms, selectedPreviewClassroomId]
  );

  const previewLanguageLabel = useMemo(() => {
    const rawLanguage = String(livePreview.language || 'javascript');
    return rawLanguage.charAt(0).toUpperCase() + rawLanguage.slice(1);
  }, [livePreview.language]);

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
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 h-8 text-[12px] px-2 sm:px-3 gap-1.5">
                  <Plus style={{ width: 13, height: 13 }} />
                  <span className="hidden sm:inline">Join Classroom</span>
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
                      onChange={(e) => { setJoinCode(e.target.value.toUpperCase().replace(/\s+/g, '')); setJoinError(''); }}
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
                  <h2 className="text-[14px] font-semibold text-white">Assigned Assignments</h2>
                  <span className="text-[11px] text-slate-600">{assignments.length} assigned to you</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  {assignments.slice(0, 4).map((a, i) => {
                    const isSubmitted = submittedAssignmentIds.has(String(a.id));

                    return (
                    <div
                      key={a.id}
                      className="group rounded-lg border border-slate-800/60 bg-slate-900/30 p-4 hover:border-slate-700/60 hover:bg-slate-900/60 transition-all duration-200 cursor-pointer"
                      onClick={() => navigate(`/classroom?id=${encodeURIComponent(a.classroom_id)}&assignment=${encodeURIComponent(a.id)}`)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <FileCode style={{ width: 13, height: 13 }} className="text-indigo-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[13px] font-semibold text-slate-200 group-hover:text-white transition-colors line-clamp-1">{a.title}</h4>
                          <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-1">{a.description || 'No description'}</p>

                          {isSubmitted ? (
                            <div className="flex items-center gap-1.5 mt-2.5 text-[12px] font-bold px-2.5 py-1.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Assignment Submitted
                            </div>
                          ) : a.due_date && (
                            <div className={`flex items-center gap-1.5 mt-2.5 text-[12px] font-bold px-2.5 py-1.5 rounded-md ${moment(a.due_date).isBefore(moment()) ? 'bg-red-500/20 text-red-400 border border-red-500/30' : moment(a.due_date).diff(moment(), 'days') <= 2 ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-slate-800/40 text-slate-400 border border-slate-700/40'}`}>
                              <Clock style={{ width: 12, height: 12 }} />
                              {moment(a.due_date).isBefore(moment())
                                ? `🚨 OVERDUE by ${Math.abs(moment(a.due_date).diff(moment(), 'days'))} day${Math.abs(moment(a.due_date).diff(moment(), 'days')) !== 1 ? 's' : ''}`
                                : moment(a.due_date).diff(moment(), 'days') === 0 ? '⏰ DUE TODAY'
                                : moment(a.due_date).diff(moment(), 'days') === 1 ? '⏰ DUE TOMORROW'
                                : `📅 Due ${moment(a.due_date).format('MMM D, h:mm A')}`
                              }
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-5">
            {/* Live Faculty Preview */}
            <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-b from-cyan-500/10 to-slate-900/20 p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <h2 className="text-[14px] font-semibold text-cyan-200">Live Faculty Preview</h2>
                  <p className="text-[11px] text-cyan-100/70 mt-0.5">Watch instructor code updates in real time</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${isConnected ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/40 bg-amber-500/10 text-amber-300'}`}>
                  {isConnected ? 'LIVE' : 'CONNECTING'}
                </span>
              </div>

              <div className="space-y-3">
                <select
                  value={selectedPreviewClassroomId}
                  onChange={(event) => {
                    setSelectedPreviewClassroomId(event.target.value);
                    setLivePreview({
                      code: '',
                      language: 'javascript',
                      senderName: '',
                      updatedAt: null
                    });
                  }}
                  disabled={!classrooms.length}
                  className="w-full px-3 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-[12px] text-slate-200 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
                >
                  {classrooms.length === 0 ? (
                    <option value="">No classrooms joined</option>
                  ) : (
                    classrooms.map((classroom) => (
                      <option key={classroom.id} value={classroom.id}>
                        {classroom.name}
                      </option>
                    ))
                  )}
                </select>

                <div className="rounded-lg border border-slate-800/80 bg-slate-950/80 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/80 bg-slate-900/70">
                    <span className="text-[11px] text-slate-300 font-medium">{previewLanguageLabel}</span>
                    <span className="text-[10px] text-slate-500">
                      {livePreview.updatedAt ? `Updated ${moment(livePreview.updatedAt).fromNow()}` : 'Waiting for faculty activity'}
                    </span>
                  </div>
                  <pre className="p-3 text-[11px] leading-relaxed text-slate-200 max-h-44 overflow-auto font-mono">
                    {livePreview.code || '// Live faculty code will appear here once your instructor starts typing in this classroom.'}
                  </pre>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-slate-500 truncate">
                    {livePreview.senderName ? `Streaming from: ${livePreview.senderName}` : 'Source: Faculty session'}
                  </p>
                  {selectedPreviewClassroom && (
                    <Button
                      size="sm"
                      onClick={() => navigate(`/classroom?id=${encodeURIComponent(selectedPreviewClassroom.id)}`)}
                      className="h-7 text-[11px] bg-cyan-600 hover:bg-cyan-500"
                    >
                      Open Live Classroom
                    </Button>
                  )}
                </div>
              </div>
            </div>

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
                        {assignmentTitleById.get(String(s.assignment_id || '')) || 'Assignment Submission'}
                      </p>
                      <p className="text-[12px] text-slate-300 font-medium truncate">
                        {classroomNameById.get(String(s.classroom_id || '')) || 'Classroom'} • {s.language?.charAt(0).toUpperCase() + s.language?.slice(1)}
                      </p>
                      <p className="text-[10px] text-slate-600 mt-0.5">{moment(s.submitted_at || s.created_date).fromNow()}</p>
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