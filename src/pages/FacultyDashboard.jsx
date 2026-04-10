import React, { useMemo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, BookOpen, Users, BarChart3, AlertTriangle, Copy, Check, Hash, TrendingUp, LogOut, Activity, Eye, Code2, XCircle, LayoutGrid, FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { io } from 'socket.io-client';
import StatCard from '@/components/ui-custom/StatCard';
import ClassroomCard from '@/components/ui-custom/ClassroomCard';
import TopBar from '@/components/ui-custom/TopBar';
import { useAuth } from '@/lib/AuthContext';
import { getAuthToken } from '@/lib/authStorage';
import moment from 'moment';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const SOCKET_IO_PATH = import.meta.env.VITE_SOCKET_IO_PATH || '/socket.io';
const LIVE_CODE_ACTIVITY_WINDOW_MS = 5 * 60 * 1000;

const normalizeClassroom = (classroom) => ({
  ...classroom,
  id: classroom.id || classroom._id,
  student_emails: classroom.student_emails || [],
  student_details: classroom.student_details || [],
  created_date: classroom.created_date || classroom.createdAt || classroom.created_at,
  updated_date: classroom.updated_date || classroom.updatedAt || classroom.updated_at,
  max_students: classroom.max_students ?? classroom.maxStudents ?? 30,
});

const getStudentName = (student) => {
  if (student?.full_name) {
    return student.full_name;
  }

  if (student?.email) {
    return student.email.split('@')[0];
  }

  return 'Student';
};

const parseApiResponse = async (response) => {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || data.error || 'Request failed');
  }

  return data;
};

const formatActivityType = (type) => {
  const labels = {
    code_change: 'Code edit',
    execution_start: 'Run started',
    execution_result: 'Run finished',
    chat_message: 'Chat',
    user_typing: 'Typing',
    user_join: 'Joined',
    user_leave: 'Left',
    idle: 'No activity'
  };

  return labels[type] || type;
};

const detectInlineIssues = (code, language) => {
  const source = String(code || '');
  if (!source.trim()) {
    return [];
  }

  const patternsByLanguage = {
    java: [
      {
        regex: /\bSystem\.out\.(pirntln|prnitln|printn|prinltn|pritnln)\b/g,
        message: 'Did you mean System.out.println ?'
      },
      {
        regex: /\bSytem\.out\.println\b/g,
        message: 'Did you mean System.out.println ?'
      }
    ],
    javascript: [
      {
        regex: /\bconsole\.(lg|olg|logg)\b/g,
        message: 'Did you mean console.log ?'
      }
    ],
    typescript: [
      {
        regex: /\bconsole\.(lg|olg|logg)\b/g,
        message: 'Did you mean console.log ?'
      }
    ]
  };

  const normalizedLanguage = String(language || '').toLowerCase();
  const diagnostics = [];
  const lines = source.split('\n');

  lines.forEach((line, lineIndex) => {
    const activePatterns = patternsByLanguage[normalizedLanguage] || [];

    activePatterns.forEach(({ regex, message }) => {
      for (const match of line.matchAll(regex)) {
        const token = String(match[0] || '');
        if (!token) {
          continue;
        }

        diagnostics.push({
          line: lineIndex + 1,
          start: match.index || 0,
          end: (match.index || 0) + token.length,
          token,
          message
        });
      }
    });
  });

  return diagnostics;
};

const renderLineWithIssues = (line, issues = [], keyPrefix = 'line') => {
  if (!issues.length) {
    return <span>{line || ' '}</span>;
  }

  const sorted = [...issues].sort((a, b) => a.start - b.start);
  const parts = [];
  let cursor = 0;

  sorted.forEach((issue, index) => {
    if (issue.start > cursor) {
      parts.push(
        <span key={`${keyPrefix}_plain_${index}_${cursor}`}>
          {line.slice(cursor, issue.start)}
        </span>
      );
    }

    const highlightedToken = line.slice(issue.start, issue.end) || issue.token;
    parts.push(
      <span
        key={`${keyPrefix}_issue_${index}_${issue.start}`}
        className="underline decoration-rose-400 decoration-2 underline-offset-2 bg-rose-500/10 rounded-[2px]"
        title={issue.message}
      >
        {highlightedToken}
      </span>
    );

    cursor = Math.max(cursor, issue.end);
  });

  if (cursor < line.length) {
    parts.push(
      <span key={`${keyPrefix}_tail_${cursor}`}>
        {line.slice(cursor)}
      </span>
    );
  }

  return parts;
};

function CodePreview({ code, language, maxLines = 40, heightClass = 'max-h-40' }) {
  const safeCode = String(code || '');

  const diagnostics = useMemo(
    () => detectInlineIssues(safeCode, language),
    [safeCode, language]
  );

  const issueMap = useMemo(() => {
    const map = new Map();

    diagnostics.forEach((issue) => {
      const list = map.get(issue.line) || [];
      list.push(issue);
      map.set(issue.line, list);
    });

    return map;
  }, [diagnostics]);

  const lines = safeCode.split('\n').slice(0, maxLines);

  return (
    <div className={`text-[10px] leading-4 text-slate-300 overflow-auto ${heightClass}`}>
      {lines.map((line, index) => {
        const lineNumber = index + 1;
        const lineIssues = issueMap.get(lineNumber) || [];

        return (
          <div key={`preview_line_${lineNumber}`} className="font-mono whitespace-pre">
            {renderLineWithIssues(line || ' ', lineIssues, `preview_${lineNumber}`)}
          </div>
        );
      })}
      {diagnostics.length > 0 && (
        <p className="text-[10px] text-rose-300 mt-2 border-t border-rose-500/20 pt-1.5">
          Potential issue: {diagnostics[0].message} (line {diagnostics[0].line})
        </p>
      )}
    </div>
  );
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export default function FacultyDashboard() {
  const dashboardParams = new URLSearchParams(globalThis.location.search);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  const [selectedClassroomId, setSelectedClassroomId] = useState(dashboardParams.get('classroomId') || '');
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [liveFeed, setLiveFeed] = useState([]);
  const [studentActivity, setStudentActivity] = useState({});
  const [presenceMap, setPresenceMap] = useState({});
  const [inspectedStudentEmail, setInspectedStudentEmail] = useState('');
  const [isCodeWallOpen, setIsCodeWallOpen] = useState(false);
  const [activityFilters, setActivityFilters] = useState({
    onlyErrors: false,
    onlyActive: false,
    topStruggling: false
  });
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [expandedAssignmentId, setExpandedAssignmentId] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', language: 'javascript', max_students: 30 });
  const [assignmentForm, setAssignmentForm] = useState({
    title: '',
    description: '',
    due_date: '',
    with_test_cases: false,
    test_cases: []
  });
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
    queryKey: ['facultySubmissions', classrooms.map((c) => c.id).join(',')],
    queryFn: async () => {
      if (!classrooms.length) {
        return [];
      }

      const responses = await Promise.all(
        classrooms.map(async (classroom) => {
          const response = await fetch(
            `${API_BASE_URL}/api/submissions?classroom_id=${encodeURIComponent(classroom.id)}&limit=200`,
            { headers: getAuthHeaders() }
          );

          if (await handleUnauthorizedResponse(response, 'Your session is invalid. Please sign in again.')) {
            throw new Error('Your session is invalid. Please sign in again.');
          }

          if (!response.ok) {
            return [];
          }

          const payload = await response.json().catch(() => ({}));
          return payload.submissions || [];
        })
      );

      return responses.flat();
    },
    enabled: !!user && classrooms.length > 0,
    retry: false,
    refetchInterval: 15000,
  });

  const { data: allAssignments = [] } = useQuery({
    queryKey: ['facultyAssignments', classrooms.map((c) => c.id).join(',')],
    queryFn: async () => {
      if (!classrooms.length) {
        return [];
      }

      const assignmentResponses = await Promise.all(
        classrooms.map(async (classroom) => {
          const response = await fetch(
            `${API_BASE_URL}/api/assignments?classroom_id=${encodeURIComponent(classroom.id)}&limit=200&sort=desc&sortBy=createdAt`,
            { headers: getAuthHeaders() }
          );

          if (await handleUnauthorizedResponse(response, 'Your session is invalid. Please sign in again.')) {
            throw new Error('Your session is invalid. Please sign in again.');
          }

          if (!response.ok) {
            return [];
          }

          const payload = await response.json().catch(() => ({}));
          return payload.assignments || [];
        })
      );

      return assignmentResponses.flat();
    },
    enabled: !!user && classrooms.length > 0,
    retry: false,
    refetchInterval: 20000
  });

  useEffect(() => {
    if (!classrooms.length) {
      setSelectedClassroomId('');
      return;
    }

    const selectedExists = classrooms.some((classroom) => classroom.id === selectedClassroomId);
    if (!selectedClassroomId || !selectedExists) {
      setSelectedClassroomId(classrooms[0].id);
    }
  }, [classrooms, selectedClassroomId]);

  const selectedClassroom = useMemo(
    () => classrooms.find((classroom) => classroom.id === selectedClassroomId) || null,
    [classrooms, selectedClassroomId]
  );

  const assignmentTitleById = useMemo(() => {
    const map = new Map();
    allAssignments.forEach((assignment) => {
      const id = assignment.id || assignment._id;
      if (id) {
        map.set(String(id), assignment.title || 'Untitled Assignment');
      }
    });
    return map;
  }, [allAssignments]);

  const recentSubmittedForSelectedClassroom = useMemo(() => {
    return allSubmissions
      .filter((submission) => String(submission.classroom_id) === String(selectedClassroomId))
      .sort((a, b) => {
        const aTime = new Date(a.submitted_at || a.created_at || a.created_date || 0).getTime();
        const bTime = new Date(b.submitted_at || b.created_at || b.created_date || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 20);
  }, [allSubmissions, selectedClassroomId]);

  const getSubmissionsForAssignment = (assignmentId) => {
    return allSubmissions
      .filter((submission) => String(submission.assignment_id) === String(assignmentId))
      .sort((a, b) => {
        const aTime = new Date(a.submitted_at || a.created_at || a.created_date || 0).getTime();
        const bTime = new Date(b.submitted_at || b.created_at || b.created_date || 0).getTime();
        return bTime - aTime;
      });
  };

  const getSubmissionCountForAssignment = (assignmentId) => {
    return allSubmissions.filter((submission) => String(submission.assignment_id) === String(assignmentId)).length;
  };

  const { data: persistedActivity } = useQuery({
    queryKey: [
      'facultyActivityHistory',
      selectedClassroomId,
      activityFilters.onlyErrors,
      activityFilters.onlyActive,
      activityFilters.topStruggling
    ],
    queryFn: async () => {
      if (!selectedClassroomId) {
        return { students: [], events: [] };
      }

      const query = new URLSearchParams({
        limit: '250',
        only_errors: String(activityFilters.onlyErrors),
        only_active: String(activityFilters.onlyActive),
        top_struggling: String(activityFilters.topStruggling)
      });

      const response = await fetch(
        `${API_BASE_URL}/api/classrooms/${selectedClassroomId}/activity-history?${query.toString()}`,
        { headers: getAuthHeaders() }
      );

      if (await handleUnauthorizedResponse(response, 'Your session is invalid. Please sign in again.')) {
        throw new Error('Your session is invalid. Please sign in again.');
      }

      if (!response.ok) {
        return { students: [], events: [] };
      }

      const payload = await response.json().catch(() => ({}));
      return {
        students: payload.students || [],
        events: payload.events || []
      };
    },
    enabled: !!user && !!selectedClassroomId,
    retry: false,
    refetchInterval: 20000
  });

  const { data: activeInterventionRoom = null, refetch: refetchActiveInterventionRoom } = useQuery({
    queryKey: ['activeInterventionRoom', selectedClassroomId, inspectedStudentEmail],
    queryFn: async () => {
      if (!selectedClassroomId || !inspectedStudentEmail) {
        return null;
      }

      const query = new URLSearchParams({
        student_email: inspectedStudentEmail
      });

      const response = await fetch(
        `${API_BASE_URL}/api/classrooms/${selectedClassroomId}/interventions/active?${query.toString()}`,
        { headers: getAuthHeaders() }
      );

      if (await handleUnauthorizedResponse(response, 'Your session is invalid. Please sign in again.')) {
        throw new Error('Your session is invalid. Please sign in again.');
      }

      if (!response.ok) {
        return null;
      }

      const payload = await response.json().catch(() => ({}));
      return payload.room || null;
    },
    enabled: !!user && !!selectedClassroomId && !!inspectedStudentEmail,
    retry: false,
    refetchInterval: 15000
  });

  useEffect(() => {
    if (!persistedActivity) {
      return;
    }

    const historyStudentMap = {};
    (persistedActivity.students || []).forEach((student) => {
      if (!student?.email) {
        return;
      }

      historyStudentMap[student.email] = {
        totalEvents: student.total_events || 0,
        problemsCount: student.issues || 0,
        lastCode: student.last_code || '',
        lastCodeUpdatedAt: student.last_seen || null,
        lastLanguage: student.last_language || selectedClassroom?.language || 'javascript',
        lastError: student.last_error || '',
        lastOutput: '',
        lastEventType: student.last_event_type || 'idle',
        lastSeen: student.last_seen || null
      };
    });

    setStudentActivity((previous) => ({
      ...historyStudentMap,
      ...previous
    }));

    setLiveFeed((previous) => {
      const fromDb = (persistedActivity.events || []).map((event) => ({
        id: event.id || `db_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        sender_email: event.sender_email,
        sender_name: event.sender_name || event.sender_email?.split('@')[0] || 'Student',
        type: event.type || 'activity',
        metadata: event.metadata || {},
        created_date: event.created_date || new Date().toISOString()
      }));

      const merged = [...previous, ...fromDb];
      const unique = new Map();
      merged.forEach((item) => {
        if (!unique.has(item.id)) {
          unique.set(item.id, item);
        }
      });

      return Array.from(unique.values())
        .sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime())
        .slice(0, 80);
    });
  }, [persistedActivity, selectedClassroom?.language]);

  useEffect(() => {
    setLiveFeed([]);
    setStudentActivity({});
    setPresenceMap({});
    setInspectedStudentEmail('');
  }, [selectedClassroomId]);

  const parseMetadata = (metadata) => {
    if (!metadata) {
      return {};
    }

    if (typeof metadata === 'object') {
      return metadata;
    }

    try {
      return JSON.parse(metadata);
    } catch {
      return {};
    }
  };

  const toggleFilter = (filterName) => {
    setActivityFilters((previous) => ({
      ...previous,
      [filterName]: !previous[filterName]
    }));
  };

  const handleSubmissionSocketEvent = (event) => {
    if (event?.classroomId && String(event.classroomId) === String(selectedClassroomId)) {
      queryClient.invalidateQueries({ queryKey: ['facultySubmissions'] });
    }
  };

  const handleIntervene = async (studentEmail) => {
    if (!selectedClassroomId || !studentEmail) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/classrooms/${selectedClassroomId}/interventions`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ student_email: studentEmail })
      });

      if (await handleUnauthorizedResponse(response, 'Your session is invalid. Please sign in again.')) {
        throw new Error('Your session is invalid. Please sign in again.');
      }

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.room?.room_id) {
        throw new Error(payload.message || payload.error || 'Failed to create intervention room');
      }

      const returnTo = `/faculty-dashboard?classroomId=${encodeURIComponent(selectedClassroomId)}`;
      navigate(`/classroom?id=${selectedClassroomId}&room=${encodeURIComponent(payload.room.room_id)}&focusStudent=${encodeURIComponent(studentEmail)}&returnTo=${encodeURIComponent(returnTo)}`);
    } catch (error) {
      console.error('Intervention room creation failed:', error);
    }
  };

  const handleCloseIntervention = async () => {
    if (!selectedClassroomId || !activeInterventionRoom?.room_id) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/classrooms/${selectedClassroomId}/interventions/${encodeURIComponent(activeInterventionRoom.room_id)}/close`,
        {
          method: 'POST',
          headers: getAuthHeaders()
        }
      );

      if (await handleUnauthorizedResponse(response, 'Your session is invalid. Please sign in again.')) {
        throw new Error('Your session is invalid. Please sign in again.');
      }

      if (!response.ok) {
        throw new Error('Failed to close intervention room');
      }

      await refetchActiveInterventionRoom();
      queryClient.invalidateQueries({ queryKey: ['facultyActivityHistory', selectedClassroomId] });
    } catch (error) {
      console.error('Close intervention failed:', error);
    }
  };

  useEffect(() => {
    const token = getAuthToken();

    if (!token || !user?.email || !selectedClassroomId) {
      setIsRealtimeConnected(false);
      return undefined;
    }

    const socket = io(API_BASE_URL, {
      path: SOCKET_IO_PATH,
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      setIsRealtimeConnected(true);
      socket.emit('collaboration:join', { classroomId: selectedClassroomId });
    });

    socket.on('disconnect', () => {
      setIsRealtimeConnected(false);
    });

    socket.on('connect_error', () => {
      setIsRealtimeConnected(false);
    });

    socket.on('collaboration:presence', (payload) => {
      const nextPresence = {};

      (payload?.participants || []).forEach((participant) => {
        if (participant?.email) {
          nextPresence[participant.email] = participant;
        }
      });

      setPresenceMap(nextPresence);
    });

    socket.on('collaboration:event', (event) => {
      if (!event?.sender_email) {
        return;
      }

      const metadata = parseMetadata(event.metadata);
      const senderEmail = event.sender_email;

      setLiveFeed((previous) => {
        const next = [
          {
            id: event.id || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            sender_email: senderEmail,
            sender_name: event.sender_name || senderEmail.split('@')[0],
            type: event.type || 'activity',
            metadata,
            created_date: event.created_date || new Date().toISOString()
          },
          ...previous
        ];

        return next.slice(0, 60);
      });

      setStudentActivity((previous) => {
        const current = previous[senderEmail] || {
          totalEvents: 0,
          problemsCount: 0,
          lastCode: '',
          lastCodeUpdatedAt: null,
          lastLanguage: selectedClassroom?.language || 'javascript',
          lastError: '',
          lastOutput: '',
          lastEventType: 'activity',
          lastSeen: null
        };

        const nextState = {
          ...current,
          totalEvents: current.totalEvents + 1,
          lastEventType: event.type || 'activity',
          lastSeen: event.created_date || new Date().toISOString()
        };

        if (event.type === 'code_change') {
          nextState.lastCode = typeof metadata.code === 'string' ? metadata.code : current.lastCode;
          nextState.lastLanguage = metadata.language || current.lastLanguage;
          nextState.lastCodeUpdatedAt = event.created_date || new Date().toISOString();
        }

        if (event.type === 'execution_result') {
          const failed = metadata.success === false;
          if (failed) {
            nextState.lastError = typeof metadata.error === 'string' ? metadata.error : current.lastError;
            nextState.problemsCount = current.problemsCount + 1;
          } else {
            nextState.lastOutput = typeof metadata.output === 'string' ? metadata.output : current.lastOutput;
            nextState.lastError = '';
          }
        }

        return {
          ...previous,
          [senderEmail]: nextState
        };
      });
    });

    socket.on('submission:updated', handleSubmissionSocketEvent);
    socket.on('submission:created', handleSubmissionSocketEvent);

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      setIsRealtimeConnected(false);
    };
  }, [selectedClassroomId, user?.email, selectedClassroom?.language]);

  const totalStudents = classrooms.reduce((sum, c) => sum + (c.student_emails?.length || 0), 0);
  const errorSubmissions = allSubmissions.filter(s => s.error_count > 0);
  const avgScore = allSubmissions.length > 0
    ? Math.round(allSubmissions.reduce((sum, s) => sum + (s.score || 0), 0) / allSubmissions.length)
    : 0;
  const hasClassrooms = classrooms.length > 0;
  const classroomLabel = classrooms.length === 1 ? 'classroom' : 'classrooms';
  const selectedClassroomStudents = selectedClassroom?.student_details || [];

  const monitoredStudents = useMemo(() => {
    let students = selectedClassroomStudents.map((student) => {
      const email = student.email;
      const activity = studentActivity[email] || null;
      const presence = presenceMap[email] || null;

      return {
        email,
        name: getStudentName(student),
        role: student.role || 'student',
        isOnline: Boolean(presence),
        lastSeen: activity?.lastSeen || null,
        totalEvents: activity?.totalEvents || 0,
        problemsCount: activity?.problemsCount || 0,
        lastEventType: activity?.lastEventType || 'idle',
        lastLanguage: activity?.lastLanguage || selectedClassroom?.language || 'javascript',
        lastCode: activity?.lastCode || '',
        lastCodeUpdatedAt: activity?.lastCodeUpdatedAt || null,
        lastError: activity?.lastError || '',
        lastOutput: activity?.lastOutput || ''
      };
    });

    if (activityFilters.onlyErrors) {
      students = students.filter((student) => student.problemsCount > 0 || Boolean(student.lastError));
    }

    if (activityFilters.onlyActive) {
      students = students.filter((student) => student.isOnline);
    }

    students = students.sort((a, b) => {
      if (activityFilters.topStruggling) {
        if (a.problemsCount !== b.problemsCount) {
          return b.problemsCount - a.problemsCount;
        }
      }

      if (a.isOnline !== b.isOnline) {
        return a.isOnline ? -1 : 1;
      }

      return (b.totalEvents || 0) - (a.totalEvents || 0);
    });

    if (activityFilters.topStruggling) {
      students = students.slice(0, 10);
    }

    return students;
  }, [selectedClassroomStudents, studentActivity, presenceMap, selectedClassroom?.language, activityFilters]);

  const inspectedStudent = monitoredStudents.find((student) => student.email === inspectedStudentEmail) || monitoredStudents[0] || null;
  const studentsWithSnapshots = monitoredStudents.filter((student) => {
    if (!student.isOnline || !student.lastCode) {
      return false;
    }

    const codeUpdatedAt = student.lastCodeUpdatedAt ? new Date(student.lastCodeUpdatedAt).getTime() : 0;
    if (!codeUpdatedAt) {
      return false;
    }

    return (Date.now() - codeUpdatedAt) <= LIVE_CODE_ACTIVITY_WINDOW_MS;
  });

  const liveStudentsList = (() => {
    if (!selectedClassroom) {
      return null;
    }

    if (monitoredStudents.length === 0) {
      return <p className="text-[11px] text-slate-600">No students joined this classroom yet.</p>;
    }

    return (
      <div className="space-y-2 max-h-56 overflow-auto pr-1">
        {monitoredStudents.map((student) => (
          <button
            key={student.email}
            onClick={() => setInspectedStudentEmail(student.email)}
            className={`w-full text-left rounded-lg border px-2.5 py-2 transition-colors ${inspectedStudent?.email === student.email ? 'border-indigo-500/35 bg-indigo-500/10' : 'border-slate-800/60 bg-slate-900/35 hover:bg-slate-800/25'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-200 truncate">{student.name}</p>
                <p className="text-[10px] text-slate-500 truncate">{student.email}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`w-2 h-2 rounded-full ${student.isOnline ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                <span className="text-[10px] text-slate-500">{student.totalEvents}</span>
              </div>
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px] text-slate-400">{formatActivityType(student.lastEventType)}</span>
              <span className={`text-[10px] ${student.problemsCount > 0 ? 'text-rose-300' : 'text-slate-500'}`}>
                {student.problemsCount > 0 ? `${student.problemsCount} issues` : 'No issues'}
              </span>
            </div>
          </button>
        ))}
      </div>
    );
  })();

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

  const createAssignmentMutation = useMutation({
    mutationFn: async (data) => {
      const normalizedTestCases = data.with_test_cases
        ? (data.test_cases || [])
            .filter((testCase) => String(testCase.expectedOutput || '').trim().length > 0)
            .map((testCase) => ({
              input: String(testCase.input || ''),
              expectedOutput: String(testCase.expectedOutput || '').trim(),
              weight: 1
            }))
        : [];

      const response = await fetch(`${API_BASE_URL}/api/assignments`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title: data.title.trim(),
          description: data.description.trim(),
          classroom_id: selectedClassroomId,
          difficulty: 'medium',
          max_score: 100,
          due_date: data.due_date || undefined,
          auto_grade: data.with_test_cases,
          test_cases: normalizedTestCases,
          starter_code: '',
          solution_code: ''
        }),
      });

      if (await handleUnauthorizedResponse(response, 'Your session is invalid. Please sign in again.')) {
        throw new Error('Your session is invalid. Please sign in again.');
      }

      const payload = await parseApiResponse(response);
      return payload.assignment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facultyAssignments'] });
      setAssignmentDialogOpen(false);
      setAssignmentForm({
        title: '',
        description: '',
        due_date: '',
        with_test_cases: false,
        test_cases: []
      });
    },
  });

  const assignmentHasValidTestCases = !assignmentForm.with_test_cases
    || assignmentForm.test_cases.some((testCase) => String(testCase.expectedOutput || '').trim().length > 0);

  const handleToggleTestCases = (checked) => {
    createAssignmentMutation.reset();
    setAssignmentForm((prev) => {
      const nextForm = {
        ...prev,
        with_test_cases: checked
      };

      if (checked && prev.test_cases.length === 0) {
        nextForm.test_cases = [{ input: '', expectedOutput: '' }];
      }

      return nextForm;
    });
  };

  const updateAssignmentTestCaseField = (index, field, value) => {
    createAssignmentMutation.reset();
    setAssignmentForm((prev) => ({
      ...prev,
      test_cases: prev.test_cases.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        return {
          ...item,
          [field]: value
        };
      })
    }));
  };

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

            {/* Joined students */}
            {hasClassrooms && (
              <div className="rounded-xl border border-slate-800/60 bg-slate-900/20 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800/50">
                  <Users style={{ width: 13, height: 13 }} className="text-slate-500" />
                  <h3 className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider">Joined Students</h3>
                </div>
                <div className="divide-y divide-slate-800/40">
                  {classrooms.map((classroom) => (
                    <div key={`${classroom.id}-students`} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[12px] font-medium text-slate-300">{classroom.name}</p>
                        <span className="text-[10px] text-slate-500">{classroom.student_details.length} joined</span>
                      </div>

                      {classroom.student_details.length > 0 ? (
                        <div className="space-y-2">
                          {classroom.student_details.map((student) => (
                            <div key={`${classroom.id}-${student.email}`} className="rounded-lg border border-slate-800/60 bg-slate-900/35 px-3 py-2">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[11px] font-semibold text-slate-200 truncate">{getStudentName(student)}</p>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${student.is_active ? 'text-emerald-300 bg-emerald-500/10 border border-emerald-500/20' : 'text-slate-400 bg-slate-500/10 border border-slate-500/20'}`}>
                                  {student.is_active ? 'active' : 'inactive'}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 truncate mt-1">{student.email}</p>
                              <div className="flex items-center gap-3 mt-1.5">
                                <p className="text-[10px] text-slate-600">Roll: {student.roll_number || 'N/A'}</p>
                                <p className="text-[10px] text-slate-600">Role: {student.role || 'student'}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-600">No students joined this classroom yet.</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Assignments Section */}
            {hasClassrooms && (
              <div className="rounded-xl border border-slate-800/60 bg-slate-900/20 overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-800/50">
                  <div className="flex items-center gap-2">
                    <FileCode style={{ width: 13, height: 13 }} className="text-slate-500" />
                    <h3 className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider">Assignments</h3>
                  </div>
                  <span className="text-[10px] text-slate-500">{allAssignments.length} total</span>
                </div>
                <div className="p-4 space-y-3">
                  {selectedClassroom && (
                    <Dialog open={assignmentDialogOpen} onOpenChange={(open) => {
                      setAssignmentDialogOpen(open);
                      if (!open) {
                        createAssignmentMutation.reset();
                        setAssignmentForm({
                          title: '',
                          description: '',
                          due_date: '',
                          with_test_cases: false,
                          test_cases: []
                        });
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button className="w-full bg-indigo-600 hover:bg-indigo-500 h-8 text-[12px]">
                          <Plus style={{ width: 12, height: 12 }} />
                          Create Assignment
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-[#0d1117] border-slate-800 text-white max-w-sm">
                        <DialogHeader>
                          <DialogTitle className="text-[15px]">Create Assignment</DialogTitle>
                          <DialogDescription className="text-slate-500 text-[12px]">Create a new assignment for {selectedClassroom?.name}</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 mt-2">
                          <input
                            placeholder="Assignment title *"
                            value={assignmentForm.title}
                            onChange={(e) => {
                              createAssignmentMutation.reset();
                              setAssignmentForm(p => ({ ...p, title: e.target.value }));
                            }}
                            className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-[13px] placeholder:text-slate-600 outline-none focus:border-indigo-500/50 transition-colors"
                          />
                          <textarea
                            placeholder="Description (optional)"
                            value={assignmentForm.description}
                            onChange={(e) => {
                              createAssignmentMutation.reset();
                              setAssignmentForm(p => ({ ...p, description: e.target.value }));
                            }}
                            className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-[13px] placeholder:text-slate-600 outline-none focus:border-indigo-500/50 transition-colors resize-none h-20"
                          />
                          <input
                            placeholder="Deadline date & time *"
                            type="datetime-local"
                            value={assignmentForm.due_date}
                            onChange={(e) => {
                              createAssignmentMutation.reset();
                              setAssignmentForm(p => ({ ...p, due_date: e.target.value }));
                            }}
                            className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-[13px] placeholder:text-slate-600 outline-none focus:border-indigo-500/50 transition-colors"
                          />
                          <label className="flex items-center gap-2 text-[12px] text-slate-300">
                            <input
                              type="checkbox"
                              checked={assignmentForm.with_test_cases}
                              onChange={(e) => {
                                handleToggleTestCases(e.target.checked);
                              }}
                              className="w-4 h-4 rounded border-slate-700 bg-slate-900"
                            />
                            With test cases
                          </label>

                          {assignmentForm.with_test_cases && (
                            <div className="space-y-2 rounded-lg border border-slate-800/70 bg-slate-950/40 p-2.5">
                              <div className="flex items-center justify-between">
                                <p className="text-[11px] text-slate-400">Add test cases (if all pass, score = 100%)</p>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-6 px-2 text-[10px] border-slate-700 text-slate-300 hover:bg-slate-800"
                                  onClick={() => {
                                    createAssignmentMutation.reset();
                                    setAssignmentForm((prev) => ({
                                      ...prev,
                                      test_cases: [...prev.test_cases, { input: '', expectedOutput: '' }]
                                    }));
                                  }}
                                >
                                  Add Case
                                </Button>
                              </div>

                              {assignmentForm.test_cases.map((testCase, index) => (
                                <div key={`test_case_${index}`} className="space-y-1.5 rounded border border-slate-800/60 p-2">
                                  <input
                                    placeholder={`Input #${index + 1} (optional)`}
                                    value={testCase.input}
                                    onChange={(e) => {
                                      updateAssignmentTestCaseField(index, 'input', e.target.value);
                                    }}
                                    className="w-full px-2 py-2 bg-slate-900 border border-slate-800 rounded text-white text-[12px] placeholder:text-slate-600 outline-none focus:border-indigo-500/50 transition-colors"
                                  />
                                  <input
                                    placeholder={`Expected output #${index + 1} *`}
                                    value={testCase.expectedOutput}
                                    onChange={(e) => {
                                      updateAssignmentTestCaseField(index, 'expectedOutput', e.target.value);
                                    }}
                                    className="w-full px-2 py-2 bg-slate-900 border border-slate-800 rounded text-white text-[12px] placeholder:text-slate-600 outline-none focus:border-indigo-500/50 transition-colors"
                                  />
                                  {assignmentForm.test_cases.length > 1 && (
                                    <div className="flex justify-end">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        className="h-6 px-2 text-[10px] text-rose-300 hover:text-rose-200 hover:bg-rose-500/10"
                                        onClick={() => {
                                          createAssignmentMutation.reset();
                                          setAssignmentForm((prev) => ({
                                            ...prev,
                                            test_cases: prev.test_cases.filter((_, itemIndex) => itemIndex !== index)
                                          }));
                                        }}
                                      >
                                        Remove
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {createAssignmentMutation.isError && (
                            <p className="text-rose-400 text-[11px]">{createAssignmentMutation.error.message}</p>
                          )}
                          <Button
                            onClick={() => createAssignmentMutation.mutate(assignmentForm)}
                            disabled={assignmentForm.title.trim().length < 3 || !assignmentForm.due_date || !assignmentHasValidTestCases || createAssignmentMutation.isPending}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 h-9 text-[13px]"
                          >
                            {createAssignmentMutation.isPending ? 'Creating...' : 'Create Assignment'}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}

                  {selectedClassroom && allAssignments.some(a => String(a.classroom_id) === String(selectedClassroom.id)) ? (
                    <div className="space-y-2 max-h-96 overflow-auto">
                      {allAssignments
                        .filter(a => String(a.classroom_id) === String(selectedClassroom.id))
                        .sort((a, b) => new Date(b.createdAt || b.created_date) - new Date(a.createdAt || a.created_date))
                        .map((assignment) => {
                          const assignmentId = assignment.id || assignment._id;
                          const submissionCount = getSubmissionCountForAssignment(assignmentId);
                          const isExpanded = expandedAssignmentId === assignmentId;
                          const submissions = isExpanded ? getSubmissionsForAssignment(assignmentId) : [];
                          const hasAssignmentTestCases = Array.isArray(assignment.test_cases) && assignment.test_cases.length > 0;
                          const isTestCaseGraded = assignment.auto_grade === true || assignment?.metadata?.auto_grade === true || hasAssignmentTestCases;
                          
                          return (
                            <div key={assignmentId} className="rounded-lg border border-slate-800/60 bg-slate-900/40 overflow-hidden">
                              <button
                                onClick={() => setExpandedAssignmentId(isExpanded ? null : assignmentId)}
                                className="w-full p-3 hover:bg-slate-900/60 transition-colors text-left"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-semibold text-slate-200 truncate">{assignment.title}</p>
                                    <p className="text-[10px] text-slate-500 truncate mt-0.5">{assignment.description || 'No description'}</p>
                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${assignment.is_assigned ? 'text-emerald-300 bg-emerald-500/10' : 'text-amber-300 bg-amber-500/10'}`}>
                                        {assignment.is_assigned ? '✓ Assigned' : 'Draft'}
                                      </span>
                                      {assignment.due_date && (
                                        <span className="text-[9px] text-slate-600">Due: {moment(assignment.due_date).format('MM/DD')}</span>
                                      )}
                                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${isTestCaseGraded ? 'text-cyan-300 bg-cyan-500/10 border border-cyan-500/20' : 'text-slate-400 bg-slate-800/30 border border-slate-700/40'}`}>
                                        {isTestCaseGraded ? 'Test-case graded' : 'Manual review'}
                                      </span>
                                      {assignment.is_assigned && (
                                        <span className={`text-[9px] px-2 py-0.5 rounded font-semibold ${submissionCount > 0 ? 'text-blue-300 bg-blue-500/15 border border-blue-500/20' : 'text-slate-500 bg-slate-800/30'}`}>
                                          📤 {submissionCount} submission{submissionCount !== 1 ? 's' : ''}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {!assignment.is_assigned ? (
                                    <Button
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        fetch(`${API_BASE_URL}/api/assignments/${assignmentId}/assign-to-class`, {
                                          method: 'POST',
                                          headers: getAuthHeaders(),
                                          body: JSON.stringify({})
                                        })
                                          .then(r => r.json())
                                          .then(() => {
                                            queryClient.invalidateQueries({ queryKey: ['facultyAssignments'] });
                                          })
                                          .catch(err => console.error('Assignment error:', err));
                                      }}
                                      className="h-6 text-[10px] px-2 bg-emerald-600 hover:bg-emerald-500 flex-shrink-0"
                                    >
                                      Assign
                                    </Button>
                                  ) : (
                                    <div className="text-[11px] text-slate-500 flex-shrink-0">
                                      {isExpanded ? '▼' : '▶'}
                                    </div>
                                  )}
                                </div>
                              </button>

                              {isExpanded && assignment.is_assigned && submissionCount > 0 && (
                                <div className="border-t border-slate-800/40 bg-slate-950/30 p-2 space-y-1.5 max-h-48 overflow-auto">
                                  <p className="text-[10px] text-slate-400 px-1 py-1">Who Submitted:</p>
                                  {submissions.map((submission) => (
                                    <button
                                      key={submission.id || submission._id}
                                      onClick={() => setSelectedSubmission(submission)}
                                      className="w-full text-left rounded px-2 py-1.5 hover:bg-slate-800/40 transition-colors border border-slate-800/30 bg-slate-900/20"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                          <p className="text-[10px] font-semibold text-slate-200 truncate">{submission.student_email}</p>
                                          <p className="text-[9px] text-slate-500">{submission.language} · {moment(submission.submitted_at || submission.created_at || submission.created_date).fromNow()}</p>
                                        </div>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${(submission.score || 0) >= 70 ? 'text-green-300 bg-green-500/15' : (submission.score || 0) >= 50 ? 'text-yellow-300 bg-yellow-500/15' : 'text-slate-400 bg-slate-700/20'}`}>
                                          {submission.score ?? '—'}%
                                        </span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}

                              {isExpanded && assignment.is_assigned && submissionCount === 0 && (
                                <div className="border-t border-slate-800/40 bg-slate-950/30 p-3 text-center">
                                  <p className="text-[10px] text-slate-500">No submissions yet</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-600 text-center py-4">No assignments yet. Create one to get started!</p>
                  )}
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

            {/* Submission Review */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[14px] font-semibold text-white">Submission Review</h2>
                <span className="text-[10px] text-slate-500">{recentSubmittedForSelectedClassroom.length} latest</span>
              </div>

              <div className="rounded-xl border border-slate-800/60 bg-slate-900/20 p-3 space-y-2 max-h-72 overflow-auto">
                {recentSubmittedForSelectedClassroom.length > 0 ? (
                  recentSubmittedForSelectedClassroom.map((submission) => {
                    const submissionId = submission.id || submission._id;
                    const assignmentId = submission.assignment_id;
                    const assignmentTitle = assignmentTitleById.get(String(assignmentId)) || 'Assignment';
                    const submittedAt = submission.submitted_at || submission.created_at || submission.created_date;

                    return (
                      <button
                        key={`submission_preview_${submissionId}`}
                        onClick={() => setSelectedSubmission(submission)}
                        className="w-full text-left rounded-lg border border-slate-800/50 bg-slate-900/40 px-2.5 py-2 hover:bg-slate-800/35 transition-colors"
                      >
                        <p className="text-[11px] font-semibold text-slate-200 truncate">{submission.student_email}</p>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">{assignmentTitle}</p>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[10px] text-slate-400">{submission.language}</span>
                          <span className="text-[10px] text-slate-600">{submittedAt ? moment(submittedAt).format('MMM D, h:mm A') : 'N/A'}</span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <p className="text-[11px] text-slate-600">No submissions yet for selected classroom.</p>
                )}
              </div>

              <Dialog open={Boolean(selectedSubmission)} onOpenChange={(open) => {
                if (!open) {
                  setSelectedSubmission(null);
                }
              }}>
                <DialogContent className="bg-[#0d1117] border-slate-800 text-white max-w-4xl w-[95vw] max-h-[85vh] overflow-hidden">
                  <DialogHeader>
                    <DialogTitle className="text-[15px]">Submitted Code Details</DialogTitle>
                    <DialogDescription className="text-slate-500 text-[12px]">
                      {selectedSubmission
                        ? `${selectedSubmission.student_email} • ${assignmentTitleById.get(String(selectedSubmission.assignment_id)) || 'Assignment'}`
                        : ''}
                    </DialogDescription>
                  </DialogHeader>

                  {selectedSubmission && (
                    <div className="space-y-3 overflow-auto pr-1 pb-1">
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="rounded-lg border border-slate-800/60 bg-slate-900/40 px-2.5 py-2">
                          <p className="text-slate-500">Submitted At</p>
                          <p className="text-slate-200 mt-0.5">
                            {selectedSubmission.submitted_at || selectedSubmission.created_at || selectedSubmission.created_date
                              ? moment(selectedSubmission.submitted_at || selectedSubmission.created_at || selectedSubmission.created_date).format('MMMM D, YYYY h:mm:ss A')
                              : 'N/A'}
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-800/60 bg-slate-900/40 px-2.5 py-2">
                          <p className="text-slate-500">Status / Score</p>
                          <p className="text-slate-200 mt-0.5">{selectedSubmission.status || 'draft'} / {selectedSubmission.score ?? 0}%</p>
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-800/70 bg-slate-950/70 p-2.5">
                        <pre className="text-[11px] leading-5 text-slate-300 whitespace-pre-wrap max-h-[50vh] overflow-auto">{selectedSubmission.code || 'No code submitted.'}</pre>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>

            {/* Live Activity Monitor */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[14px] font-semibold text-white">Live Activity</h2>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${isRealtimeConnected ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-300 bg-amber-500/10 border-amber-500/20'}`}>
                  {isRealtimeConnected ? 'connected' : 'offline'}
                </span>
              </div>

              <div className="rounded-xl border border-slate-800/60 bg-slate-900/20 p-3 space-y-3">
                {hasClassrooms ? (
                  <Select value={selectedClassroomId || undefined} onValueChange={setSelectedClassroomId}>
                    <SelectTrigger className="bg-slate-900 border-slate-800 text-white h-9 text-[12px]">
                      <SelectValue placeholder="Select classroom" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      {classrooms.map((classroom) => (
                        <SelectItem key={classroom.id} value={classroom.id} className="text-slate-200 focus:bg-slate-800 focus:text-white text-[12px]">
                          {classroom.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-[11px] text-slate-600">Create a classroom to enable live monitoring.</p>
                )}

                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => toggleFilter('onlyErrors')}
                    className={`text-[10px] px-2 py-1 rounded border transition-colors ${activityFilters.onlyErrors ? 'text-rose-200 bg-rose-500/15 border-rose-500/30' : 'text-slate-500 bg-slate-900 border-slate-800 hover:bg-slate-800/40'}`}
                  >
                    Only errors
                  </button>
                  <button
                    onClick={() => toggleFilter('onlyActive')}
                    className={`text-[10px] px-2 py-1 rounded border transition-colors ${activityFilters.onlyActive ? 'text-emerald-200 bg-emerald-500/15 border-emerald-500/30' : 'text-slate-500 bg-slate-900 border-slate-800 hover:bg-slate-800/40'}`}
                  >
                    Only active
                  </button>
                  <button
                    onClick={() => toggleFilter('topStruggling')}
                    className={`text-[10px] px-2 py-1 rounded border transition-colors ${activityFilters.topStruggling ? 'text-amber-200 bg-amber-500/15 border-amber-500/30' : 'text-slate-500 bg-slate-900 border-slate-800 hover:bg-slate-800/40'}`}
                  >
                    Top struggling
                  </button>
                </div>

                {liveStudentsList}

                {selectedClassroom && (
                  <Dialog open={isCodeWallOpen} onOpenChange={setIsCodeWallOpen}>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-8 text-[11px] border-indigo-500/30 bg-indigo-500/10 text-indigo-100 hover:bg-indigo-500/20"
                      >
                        <LayoutGrid style={{ width: 12, height: 12 }} /> Open Live Code Wall
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#0d1117] border-slate-800 text-white max-w-7xl w-[96vw] max-h-[92vh] overflow-hidden p-0">
                      <div className="flex h-[92vh] flex-col min-h-0">
                        <div className="px-5 pt-5 pb-3 border-b border-slate-800/70 flex-shrink-0">
                          <DialogHeader>
                            <DialogTitle className="text-[15px]">Live Code Wall · {selectedClassroom.name}</DialogTitle>
                            <DialogDescription className="text-slate-500 text-[12px]">
                              See every student's latest code, scroll through longer files, and open an intervention session when needed.
                            </DialogDescription>
                          </DialogHeader>
                        </div>

                        <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-4 min-h-0">
                        {studentsWithSnapshots.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
                            {studentsWithSnapshots.map((student) => (
                              <div key={`wall_${student.email}`} className="rounded-xl border border-slate-800/70 bg-slate-950/50 p-3 space-y-2.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-[12px] font-semibold text-slate-200 truncate">{student.name}</p>
                                    <p className="text-[10px] text-slate-500 truncate">{student.email}</p>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className={`w-2 h-2 rounded-full ${student.isOnline ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                                    <span className="text-[10px] text-slate-500">{student.lastLanguage}</span>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="text-slate-500">{student.totalEvents} events</span>
                                  <span className={student.problemsCount > 0 ? 'text-rose-300' : 'text-emerald-300'}>
                                    {student.problemsCount > 0 ? `${student.problemsCount} issues` : 'Healthy'}
                                  </span>
                                </div>

                                <div className="rounded-lg border border-slate-800/70 bg-slate-950/70 p-2">
                                  {student.lastCode ? (
                                    <CodePreview
                                      code={student.lastCode}
                                      language={student.lastLanguage}
                                      maxLines={120}
                                      heightClass="h-56"
                                    />
                                  ) : (
                                    <p className="text-[10px] text-slate-600">Waiting for first code snapshot...</p>
                                  )}
                                </div>

                                {student.lastError && (
                                  <div className="rounded-lg border border-rose-500/25 bg-rose-500/10 p-2">
                                    <p className="text-[10px] text-rose-200 whitespace-pre-wrap max-h-20 overflow-auto">{student.lastError}</p>
                                  </div>
                                )}

                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setInspectedStudentEmail(student.email);
                                      setIsCodeWallOpen(false);
                                    }}
                                    variant="outline"
                                    className="h-7 text-[10px] px-2 border-slate-700 bg-slate-900 hover:bg-slate-800"
                                  >
                                    <Eye style={{ width: 10, height: 10 }} /> Inspect
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleIntervene(student.email)}
                                    className="h-7 text-[10px] px-2 bg-indigo-600 hover:bg-indigo-500"
                                  >
                                    <Activity style={{ width: 10, height: 10 }} /> Intervene
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-lg border border-slate-800/70 bg-slate-900/35 px-3 py-6 text-center">
                            <p className="text-[12px] text-slate-500">No live coding activity right now.</p>
                            <p className="text-[10px] text-slate-600 mt-1">Cards appear only for students who are online and actively writing code.</p>
                          </div>
                        )}
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>

            {/* Student Code Inspector */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[14px] font-semibold text-white">Code Inspector</h2>
                <Eye style={{ width: 13, height: 13 }} className="text-slate-500" />
              </div>

              <div className="rounded-xl border border-slate-800/60 bg-slate-900/20 p-3 space-y-3">
                {inspectedStudent ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-slate-200 truncate">{inspectedStudent.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">{inspectedStudent.email}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          onClick={() => handleIntervene(inspectedStudent.email)}
                          className="h-7 text-[11px] px-2 bg-indigo-600 hover:bg-indigo-500"
                        >
                          <Activity style={{ width: 11, height: 11 }} /> Intervene
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCloseIntervention}
                          disabled={!activeInterventionRoom?.room_id}
                          className="h-7 text-[11px] px-2 border-rose-500/25 bg-rose-500/8 text-rose-200 hover:bg-rose-500/15 hover:text-white"
                        >
                          <XCircle style={{ width: 11, height: 11 }} /> Close
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Code2 style={{ width: 11, height: 11 }} /> {inspectedStudent.lastLanguage}
                      </span>
                      <span>{inspectedStudent.lastSeen ? moment(inspectedStudent.lastSeen).fromNow() : 'No events yet'}</span>
                    </div>

                    <div className="rounded-lg border border-slate-800/70 bg-slate-950/60 p-2.5">
                      {inspectedStudent.lastCode ? (
                        <CodePreview
                          code={inspectedStudent.lastCode.slice(0, 2400)}
                          language={inspectedStudent.lastLanguage}
                          maxLines={44}
                          heightClass="max-h-40"
                        />
                      ) : (
                        <p className="text-[10px] text-slate-600">No code snapshots yet. It will appear when the student starts typing.</p>
                      )}
                    </div>

                    {inspectedStudent.lastError && (
                      <div className="rounded-lg border border-rose-500/25 bg-rose-500/8 p-2.5">
                        <p className="text-[10px] text-rose-200 whitespace-pre-wrap max-h-24 overflow-auto">{inspectedStudent.lastError}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-[11px] text-slate-600">Pick a classroom to inspect student code.</p>
                )}
              </div>
            </div>

            {/* Recent Live Feed */}
            <div>
              <h2 className="text-[14px] font-semibold text-white mb-3">Recent Feed</h2>
              <div className="rounded-xl border border-slate-800/60 bg-slate-900/20 p-3 space-y-2 max-h-56 overflow-auto">
                {liveFeed.length > 0 ? liveFeed.slice(0, 20).map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-800/50 bg-slate-900/40 px-2.5 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-medium text-slate-300 truncate">{item.sender_name}</p>
                      <span className="text-[9px] text-slate-600">{moment(item.created_date).fromNow()}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">{formatActivityType(item.type)}</p>
                  </div>
                )) : (
                  <p className="text-[11px] text-slate-600">No live activity yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

CodePreview.propTypes = {
  code: PropTypes.string,
  language: PropTypes.string,
  maxLines: PropTypes.number,
  heightClass: PropTypes.string
};