import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Sparkles, Terminal, ArrowLeft, PanelLeftClose, PanelLeftOpen, CheckCircle2, History } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import CodeEditor, { DEFAULT_CODE_SNIPPETS } from '@/components/classroom/CodeEditor';
import ChatPanel from '@/components/classroom/ChatPanel';
import AIAssistant from '@/components/classroom/AIAssistant';
import OutputPanel from '@/components/classroom/OutputPanel';
import ParticipantsPanel from '@/components/classroom/ParticipantsPanel';
import VersionHistoryPanel from '@/components/classroom/VersionHistoryPanel';
import codeExecutionService from '@/services/codeExecutionService';
import versionControl from '@/services/versionControl';
import { useCollaboration } from '@/contexts/CollaborationContext';
import { useAuth } from '@/lib/AuthContext';
import { API_BASE_URL } from '@/lib/apiBaseUrl';

const CHAT_CACHE_KEY_PREFIX = 'lm_chat_cache_v1';
const CHAT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CODE_CACHE_KEY_PREFIX = 'lm_code_cache_v2';
const LANGUAGE_EXTENSIONS = {
  javascript: 'js',
  python: 'py',
  cpp: 'cpp',
  java: 'java',
  typescript: 'ts',
  go: 'go',
  rust: 'rs'
};

const isMobileViewport = () => {
  const viewportWidth = globalThis.window?.innerWidth;
  if (!viewportWidth) {
    return false;
  }

  return viewportWidth < 1024;
};

const normalizeMessage = (message) => {
  const metadata = (() => {
    if (!message?.metadata) return {};
    if (typeof message.metadata === 'object') return message.metadata;
    try {
      return JSON.parse(message.metadata);
    } catch {
      return {};
    }
  })();

  return {
    id: message?.id || message?._id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sender_email: message?.sender_email,
    sender_name: message?.sender_name || message?.sender_email?.split('@')[0] || 'User',
    message: message?.message || metadata?.message || '',
    type: message?.type || metadata?.type || 'message',
    created_date: message?.created_date || message?.created_at || new Date().toISOString(),
    metadata
  };
};

const getChatCacheKey = (classroomId, userEmail) => {
  if (!classroomId || !userEmail) {
    return null;
  }

  return `${CHAT_CACHE_KEY_PREFIX}:${classroomId}:${userEmail}`;
};

const getCodeCacheKey = (classroomId, userEmail, scope = 'personal') => {
  if (!classroomId || !userEmail) {
    return null;
  }

  return `${CODE_CACHE_KEY_PREFIX}:${classroomId}:${userEmail}:${scope}`;
};

const getDisplayNameFromEmail = (email, classroom) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    return 'Unknown user';
  }

  if (String(classroom?.faculty_email || '').trim().toLowerCase() === normalizedEmail) {
    return 'Faculty';
  }

  const studentDetails = Array.isArray(classroom?.student_details) ? classroom.student_details : [];
  const matchedStudent = studentDetails.find((student) => (
    String(student?.email || '').trim().toLowerCase() === normalizedEmail
  ));

  if (matchedStudent?.full_name) {
    return matchedStudent.full_name;
  }

  return normalizedEmail.split('@')[0] || normalizedEmail;
};

const getMessageTimestamp = (message) => {
  const rawDate = message?.created_date || message?.created_at;
  const timestamp = rawDate ? new Date(rawDate).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : Number.NaN;
};

const filterMessagesWithinTtl = (messages, now = Date.now()) => {
  return (Array.isArray(messages) ? messages : []).filter((message) => {
    const timestamp = getMessageTimestamp(message);
    return Number.isFinite(timestamp) && now - timestamp <= CHAT_CACHE_TTL_MS;
  });
};

const mergeUniqueMessages = (currentMessages, incomingMessages) => {
  const merged = [...(Array.isArray(currentMessages) ? currentMessages : [])];
  const seenIds = new Set(merged.map((message) => message.id).filter(Boolean));

  (Array.isArray(incomingMessages) ? incomingMessages : []).forEach((message) => {
    if (!message) {
      return;
    }

    if (message.id && seenIds.has(message.id)) {
      return;
    }

    if (message.id) {
      seenIds.add(message.id);
    }

    merged.push(message);
  });

  return merged.sort((a, b) => {
    const left = getMessageTimestamp(a);
    const right = getMessageTimestamp(b);

    if (!Number.isFinite(left) && !Number.isFinite(right)) {
      return 0;
    }

    if (!Number.isFinite(left)) {
      return 1;
    }

    if (!Number.isFinite(right)) {
      return -1;
    }

    return left - right;
  });
};

const extractErrorLineNumbers = (errorText) => {
  const normalizedError = String(errorText || '');
  if (!normalizedError.trim()) {
    return [];
  }

  const lineMatches = [
    ...normalizedError.matchAll(/line\s+(\d+)/gi),
    ...normalizedError.matchAll(/:(\d+):(\d+)?/g),
    ...normalizedError.matchAll(/\((\d+)\)/g)
  ];

  const uniqueLines = lineMatches
    .map((match) => Number(match[1]))
    .filter((lineNumber) => Number.isFinite(lineNumber) && lineNumber > 0);

  return Array.from(new Set(uniqueLines)).slice(0, 15);
};

const codeLikelyNeedsInput = (sourceCode, language) => {
  const text = String(sourceCode || '');
  const normalizedLanguage = String(language || '').toLowerCase();

  switch (normalizedLanguage) {
    case 'java':
      return /\bScanner\b|\bnextInt\s*\(|\bnextLine\s*\(|\bnextDouble\s*\(|\bnext\s*\(/.test(text);
    case 'python':
      return /\binput\s*\(/.test(text);
    case 'cpp':
    case 'c':
      return /\bcin\s*>>|\bscanf\s*\(/.test(text);
    case 'javascript':
    case 'typescript':
      return /process\.stdin|readline\.createInterface|fs\.readFileSync\s*\(\s*0\s*[,)]/.test(text);
    case 'go':
      return /fmt\.Scanf\s*\(|fmt\.Scan\s*\(|bufio\.NewScanner\s*\(/.test(text);
    case 'rust':
      return /std::io::stdin\s*\(\)|read_line\s*\(/.test(text);
    default:
      return false;
  }
};

const isMissingInputRuntimeError = (errorText) => {
  const normalizedError = String(errorText || '').toLowerCase();

  return (
    normalizedError.includes('nosuchelementexception') ||
    normalizedError.includes('no line found') ||
    normalizedError.includes('eoferror') ||
    normalizedError.includes('end of file') ||
    normalizedError.includes('unexpected eof') ||
    normalizedError.includes('input mismatch')
  );
};

const MISSING_INPUT_HELP = 'Program expected more input. Add all required values in Program Input (stdin) and run again.';

const isSubmissionFinalized = (submission) => {
  const normalizedStatus = String(submission?.status || '').toLowerCase();
  if (normalizedStatus) {
    return !['draft', 'pending'].includes(normalizedStatus);
  }

  return Boolean(submission?.submitted_at || submission?.submittedAt);
};

export default function Classroom() {
  const urlParams = new URLSearchParams(globalThis.location.search);
  const classroomId = urlParams.get('id');
  const assignmentIdFromUrl = urlParams.get('assignment');
  const interventionRoomId = urlParams.get('room');
  const focusStudentFromUrl = String(urlParams.get('focusStudent') || '').trim().toLowerCase();
  const returnTo = urlParams.get('returnTo');
  const { user, getAuthHeaders } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [resolvedRoomId, setResolvedRoomId] = useState(interventionRoomId || null);
  const roomType = resolvedRoomId ? 'intervention' : 'classroom';
  const isFacultyOrAdmin = user?.role === 'faculty' || user?.role === 'admin';
  const facultyDashboardTarget = classroomId
    ? `/faculty-dashboard?classroomId=${encodeURIComponent(classroomId)}`
    : '/faculty-dashboard';
  const defaultDashboardTarget = isFacultyOrAdmin
    ? facultyDashboardTarget
    : '/student-dashboard';
  const interventionReturnTarget = returnTo || defaultDashboardTarget;
  const classroomTeachingTarget = (() => {
    if (!classroomId) {
      return '/classroom';
    }

    const params = new URLSearchParams({ id: classroomId });
    if (assignmentIdFromUrl) {
      params.set('assignment', assignmentIdFromUrl);
    }

    return `/classroom?${params.toString()}`;
  })();

  const [code, setCode] = useState(DEFAULT_CODE_SNIPPETS.javascript);
  const [language, setLanguage] = useState('javascript');
  const [executionInput, setExecutionInput] = useState('');
  const [interactiveSessionActive, setInteractiveSessionActive] = useState(false);
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rightTab, setRightTab] = useState('chat');
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [facultyEditNotice, setFacultyEditNotice] = useState({ active: false, editorName: 'Faculty', lastEditedAt: 0 });
  const [sharedTeachingNotice, setSharedTeachingNotice] = useState({ active: false, teacherName: 'Faculty' });
  const [facultyEditNow, setFacultyEditNow] = useState(() => Date.now());
  const [codeViewMode, setCodeViewMode] = useState(isFacultyOrAdmin ? 'shared' : 'personal');
  const [isMobileLayout, setIsMobileLayout] = useState(() => isMobileViewport());
  const errorLineNumbers = useMemo(() => extractErrorLineNumbers(error), [error]);
  
  const codeChangeTimeout = useRef(null);
  const cursorSyncTimeout = useRef(null);
  const codeStateSaveTimeout = useRef(null);
  const lastCodeSync = useRef('');
  const pendingCodeSync = useRef('');
  const latestCodeRef = useRef('');
  const latestLanguageRef = useRef('javascript');
  const latestSharedClassroomSnapshot = useRef({ code: '', language: '' });
  const autoSaveInitialized = useRef(false);
  const previousMobileState = useRef(isMobileLayout);
  const loadedServerState = useRef(false);
  const activeCodeSource = useRef('server');
  const facultyEditNoticeTimeout = useRef(null);
  const sharedTeachingNoticeTimeout = useRef(null);
  const chatCacheKey = useMemo(() => getChatCacheKey(classroomId, user?.email), [classroomId, user?.email]);
  const codeCacheScopeKey = useMemo(() => {
    const normalizedFocusStudent = String(focusStudentFromUrl || '').trim().toLowerCase();

    if (codeViewMode === 'shared' && roomType === 'intervention' && normalizedFocusStudent) {
      return `intervention:${normalizedFocusStudent}`;
    }

    return codeViewMode;
  }, [codeViewMode, roomType, focusStudentFromUrl]);
  const codeCacheKey = useMemo(() => getCodeCacheKey(classroomId, user?.email, codeCacheScopeKey), [classroomId, user?.email, codeCacheScopeKey]);
  const codeRestoredFromCache = useRef(false);
  
  // Real-time collaboration
  const { 
    connect, 
    disconnect, 
    isConnected, 
    activeUsers, 
    syncCode, 
    syncCursor,
    sendTyping, 
    on, 
    emit,
    COLLABORATION_EVENTS 
  } = useCollaboration();

  const { data: classroom } = useQuery({
    queryKey: ['classroom', classroomId],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/classrooms/${classroomId}`, {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to load classroom details');
      }

      const payload = await response.json();
      return payload.classroom;
    },
    enabled: Boolean(classroomId && user?.email),
  });

  const { data: studentSubmissions = [] } = useQuery({
    queryKey: ['studentAssignmentSubmissions', classroomId, user?.email],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/submissions?classroom_id=${encodeURIComponent(classroomId)}&limit=200&sort=desc&sortBy=createdAt`,
        { headers: getAuthHeaders() }
      );

      if (!response.ok) {
        return [];
      }

      const payload = await response.json().catch(() => ({}));
      return payload.submissions || [];
    },
    enabled: Boolean(classroomId && user?.email),
    refetchInterval: 15000,
  });

  const { data: classroomAssignmentId = null } = useQuery({
    queryKey: ['classroomAssignmentId', classroomId],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/assignments?classroom_id=${encodeURIComponent(classroomId)}&limit=1&sort=desc&sortBy=createdAt`,
        { headers: getAuthHeaders() }
      );

      if (!response.ok) {
        return null;
      }

      const payload = await response.json().catch(() => ({}));
      const assignment = (payload.assignments || [])[0];
      return assignment?.id || assignment?._id || null;
    },
    enabled: Boolean(classroomId && user?.email),
  });

  const canBroadcastCodeChanges = useMemo(() => {
    const userEmail = String(user?.email || '').trim().toLowerCase();
    const classroomFacultyEmail = String(classroom?.faculty_email || '').trim().toLowerCase();

    if (!userEmail) {
      return false;
    }

    if (user.role === 'admin') {
      return true;
    }

    return Boolean(classroomFacultyEmail && classroomFacultyEmail === userEmail);
  }, [classroom?.faculty_email, user?.email, user?.role]);

  const canEditCode = useMemo(() => {
    return canBroadcastCodeChanges || codeViewMode === 'personal';
  }, [canBroadcastCodeChanges, codeViewMode]);

  const participants = useMemo(() => {
    const participantMap = new Map();

    if (classroom?.faculty_email) {
      participantMap.set(classroom.faculty_email, {
        email: classroom.faculty_email,
        name: 'Professor',
        role: 'faculty'
      });
    }

    (classroom?.student_emails || []).forEach((email) => {
      participantMap.set(email, {
        email,
        name: email.split('@')[0],
        role: 'student'
      });
    });

    activeUsers.forEach((participant, email) => {
      participantMap.set(email, {
        email,
        name: participant.name || participantMap.get(email)?.name || email.split('@')[0],
        role: participant.role || participantMap.get(email)?.role || 'student'
      });
    });

    return Array.from(participantMap.values());
  }, [activeUsers, classroom?.faculty_email, classroom?.student_emails]);

  const focusedStudentParticipant = useMemo(() => {
    if (!focusStudentFromUrl) {
      return null;
    }

    return participants.find((participant) => (
      String(participant?.email || '').trim().toLowerCase() === focusStudentFromUrl
    )) || null;
  }, [focusStudentFromUrl, participants]);

  const activeStudentParticipant = useMemo(() => {
    return participants.find((participant) => participant.role === 'student') || null;
  }, [participants]);

  const interventionStudentParticipant = focusedStudentParticipant || activeStudentParticipant;

  const effectiveAssignmentId = assignmentIdFromUrl || classroomAssignmentId;

  const codeStateScope = codeViewMode;
  const interventionTargetStudentEmail = roomType === 'intervention' && focusStudentFromUrl
    ? String(focusStudentFromUrl).trim().toLowerCase()
    : '';

  const hasSubmittedCurrentAssignment = useMemo(() => {
    if (!effectiveAssignmentId) {
      return false;
    }

    return studentSubmissions.some((submission) => (
      String(submission?.assignment_id || '') === String(effectiveAssignmentId) &&
      isSubmissionFinalized(submission)
    ));
  }, [effectiveAssignmentId, studentSubmissions]);

  const { data: messageHistory = [] } = useQuery({
    queryKey: ['classroomMessages', classroomId],
    queryFn: async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/chat/messages?classroom_id=${encodeURIComponent(classroomId)}&limit=100`,
          { headers: getAuthHeaders() }
        );

        if (!response.ok) {
          return [];
        }

        const payload = await response.json();
        return (payload.messages || []).map(normalizeMessage);
      } catch (fetchError) {
        console.warn('Unable to fetch chat history, continuing with real-time only mode.', fetchError);
        return [];
      }
    },
    enabled: Boolean((classroom?.id || classroom?._id) && user?.email),
  });

  const { data: serverCodeState = null } = useQuery({
    queryKey: ['classroomCodeState', classroomId, user?.email, codeStateScope, interventionTargetStudentEmail],
    queryFn: async () => {
      const query = new URLSearchParams({ scope: codeStateScope });
      if (interventionTargetStudentEmail) {
        query.set('targetStudentEmail', interventionTargetStudentEmail);
      }

      const response = await fetch(
        `${API_BASE_URL}/api/classrooms/${classroomId}/code-state?${query.toString()}`,
        { headers: getAuthHeaders() }
      );

      if (!response.ok) {
        return null;
      }

      const payload = await response.json().catch(() => ({}));
      return payload?.state || null;
    },
    enabled: Boolean(classroomId && user?.email),
    staleTime: 15_000,
    refetchOnWindowFocus: false
  });

  useEffect(() => {
    if (!chatCacheKey) {
      return;
    }

    try {
      const rawCache = globalThis.localStorage?.getItem(chatCacheKey);
      if (!rawCache) {
        return;
      }

      const parsedCache = JSON.parse(rawCache);
      let cachedMessages = [];
      if (Array.isArray(parsedCache?.messages)) {
        cachedMessages = parsedCache.messages;
      } else if (Array.isArray(parsedCache)) {
        cachedMessages = parsedCache;
      }

      const normalizedCachedMessages = cachedMessages.map(normalizeMessage);
      const ttlMessages = filterMessagesWithinTtl(normalizedCachedMessages);

      if (ttlMessages.length === 0) {
        globalThis.localStorage?.removeItem(chatCacheKey);
        return;
      }

      setChatMessages(ttlMessages);
    } catch (cacheError) {
      console.warn('Failed to restore cached classroom chat messages:', cacheError);
    }
  }, [chatCacheKey]);

  useEffect(() => {
    setChatMessages((previousMessages) => {
      const previousWithinTtl = filterMessagesWithinTtl(previousMessages);
      const mergedMessages = mergeUniqueMessages(previousWithinTtl, messageHistory);
      return filterMessagesWithinTtl(mergedMessages);
    });
  }, [messageHistory, classroomId]);

  useEffect(() => {
    if (!chatCacheKey) {
      return;
    }

    const messagesWithinTtl = filterMessagesWithinTtl(chatMessages);

    try {
      if (messagesWithinTtl.length === 0) {
        globalThis.localStorage?.removeItem(chatCacheKey);
        return;
      }

      globalThis.localStorage?.setItem(chatCacheKey, JSON.stringify({
        cachedAt: new Date().toISOString(),
        messages: messagesWithinTtl
      }));
    } catch (cacheError) {
      console.warn('Failed to persist classroom chat messages to cache:', cacheError);
    }
  }, [chatCacheKey, chatMessages]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileLayout(isMobileViewport());
    };

    handleResize();
    globalThis.window?.addEventListener('resize', handleResize);

    return () => {
      globalThis.window?.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (isMobileLayout !== previousMobileState.current) {
      setLeftCollapsed(isMobileLayout);
      previousMobileState.current = isMobileLayout;
    }
  }, [isMobileLayout]);

  useEffect(() => {
    latestCodeRef.current = code;
    latestLanguageRef.current = language;
  }, [code, language]);

  useEffect(() => {
    codeRestoredFromCache.current = false;
    loadedServerState.current = false;
  }, [codeCacheKey]);

  useEffect(() => {
    if (!codeCacheKey || codeRestoredFromCache.current) {
      return;
    }

    const fallbackLanguage = String(classroom?.language || language || 'javascript').toLowerCase();
    const fallbackCode = DEFAULT_CODE_SNIPPETS[fallbackLanguage] || DEFAULT_CODE_SNIPPETS.javascript;

    try {
      const rawCache = globalThis.localStorage?.getItem(codeCacheKey);
      if (!rawCache) {
        setCode(fallbackCode);
        pendingCodeSync.current = fallbackCode;
        lastCodeSync.current = fallbackCode;
        if (fallbackLanguage) {
          setLanguage(fallbackLanguage);
        }
        activeCodeSource.current = 'server';
        codeRestoredFromCache.current = true;
        return;
      }

      const parsedCache = JSON.parse(rawCache);
      const cachedCode = typeof parsedCache?.code === 'string' ? parsedCache.code : '';
      const cachedLanguage = typeof parsedCache?.language === 'string' ? parsedCache.language : null;

      if (cachedCode) {
        setCode(cachedCode);
        pendingCodeSync.current = cachedCode;
        lastCodeSync.current = cachedCode;
        activeCodeSource.current = 'local';
      }

      if (cachedLanguage) {
        setLanguage(cachedLanguage);
      }
    } catch (cacheError) {
      console.warn('Failed to restore cached classroom code:', cacheError);
      setCode(fallbackCode);
      pendingCodeSync.current = fallbackCode;
      lastCodeSync.current = fallbackCode;
      if (fallbackLanguage) {
        setLanguage(fallbackLanguage);
      }
      activeCodeSource.current = 'server';
    } finally {
      codeRestoredFromCache.current = true;
    }
  }, [codeCacheKey, classroom?.language, language]);

  useEffect(() => {
    if (!codeCacheKey || !codeRestoredFromCache.current) {
      return;
    }

    try {
      globalThis.localStorage?.setItem(codeCacheKey, JSON.stringify({
        cachedAt: new Date().toISOString(),
        code,
        language
      }));
    } catch (cacheError) {
      console.warn('Failed to persist classroom code cache:', cacheError);
    }
  }, [codeCacheKey, code, language]);

  useEffect(() => {
    if (loadedServerState.current || !serverCodeState) {
      return;
    }

    if (codeViewMode === 'personal' && activeCodeSource.current === 'local') {
      loadedServerState.current = true;
      return;
    }

    const serverCode = typeof serverCodeState?.code === 'string' ? serverCodeState.code : '';
    const serverLanguage = typeof serverCodeState?.language === 'string' ? serverCodeState.language : null;

    if (serverCode || serverLanguage) {
      if (serverCode) {
        setCode(serverCode);
        pendingCodeSync.current = serverCode;
        lastCodeSync.current = serverCode;
      }

      if (serverLanguage) {
        setLanguage(serverLanguage);
      }
    }

    loadedServerState.current = true;
  }, [serverCodeState]);

  useEffect(() => {
    if (!classroomId || !user?.email || !codeRestoredFromCache.current || (!canBroadcastCodeChanges && codeViewMode === 'shared')) {
      return;
    }

    if (codeStateSaveTimeout.current) {
      clearTimeout(codeStateSaveTimeout.current);
    }

    codeStateSaveTimeout.current = setTimeout(async () => {
      try {
        const targetStudentEmail = isFacultyOrAdmin && roomType === 'intervention' && interventionStudentParticipant?.email
          ? String(interventionStudentParticipant.email).trim().toLowerCase()
          : '';

        const requestBody = {
          code,
          language,
          scope: codeStateScope
        };

        if (targetStudentEmail) {
          requestBody.targetStudentEmail = targetStudentEmail;
        }

        await fetch(`${API_BASE_URL}/api/classrooms/${classroomId}/code-state`, {
          method: 'PUT',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });
      } catch (saveError) {
        console.warn('Failed to save classroom code state to backend:', saveError);
      }
    }, 1200);

    return () => {
      if (codeStateSaveTimeout.current) {
        clearTimeout(codeStateSaveTimeout.current);
      }
    };
  }, [classroomId, user?.email, code, language, codeStateScope, getAuthHeaders, canBroadcastCodeChanges, codeViewMode]);

  useEffect(() => {
    setCodeViewMode(isFacultyOrAdmin ? 'shared' : 'personal');
  }, [classroomId, isFacultyOrAdmin, user?.email]);

  useEffect(() => {
    latestSharedClassroomSnapshot.current = { code: '', language: '' };
  }, [classroomId]);

  useEffect(() => {
    return () => {
      if (codeChangeTimeout.current) {
        clearTimeout(codeChangeTimeout.current);
      }
      if (cursorSyncTimeout.current) {
        clearTimeout(cursorSyncTimeout.current);
      }
      if (codeStateSaveTimeout.current) {
        clearTimeout(codeStateSaveTimeout.current);
      }
      if (facultyEditNoticeTimeout.current) {
        clearTimeout(facultyEditNoticeTimeout.current);
      }
      if (sharedTeachingNoticeTimeout.current) {
        clearTimeout(sharedTeachingNoticeTimeout.current);
      }
    };
  }, []);

  // Connect to collaboration session when user and classroom are ready
  useEffect(() => {
    setResolvedRoomId(interventionRoomId || null);
  }, [interventionRoomId]);

  useEffect(() => {
    const resolveActiveInterventionRoom = async () => {
      if (!user?.email || !classroomId || interventionRoomId) {
        return;
      }

      // For faculty/admin, only resolve intervention context when a specific student was requested.
      // This avoids auto-jumping into stale rooms when opening the generic classroom IDE.
      if (isFacultyOrAdmin && !focusStudentFromUrl) {
        return;
      }

      try {
        const querySuffix = focusStudentFromUrl
          ? `?student_email=${encodeURIComponent(focusStudentFromUrl)}`
          : '';

        const response = await fetch(`${API_BASE_URL}/api/classrooms/${classroomId}/interventions/active${querySuffix}`, {
          headers: getAuthHeaders()
        });

        if (!response.ok) {
          return;
        }

        const payload = await response.json().catch(() => ({}));
        if (payload?.room?.room_id) {
          setResolvedRoomId(payload.room.room_id);
        }
      } catch (error) {
        console.warn('Failed to resolve active intervention room:', error);
      }
    };

    void resolveActiveInterventionRoom();
  }, [classroomId, user?.email, interventionRoomId, getAuthHeaders, isFacultyOrAdmin, focusStudentFromUrl]);

  const handleExitRoom = async () => {
    if (roomType !== 'intervention') {
      navigate(defaultDashboardTarget);
      return;
    }

    const roomIdToClose = resolvedRoomId || interventionRoomId;

    if (classroomId && roomIdToClose) {
      try {
        await fetch(`${API_BASE_URL}/api/classrooms/${classroomId}/interventions/${encodeURIComponent(roomIdToClose)}/close`, {
          method: 'POST',
          headers: getAuthHeaders()
        });
      } catch (error) {
        console.warn('Failed to close intervention room before leaving:', error);
      }
    }

    navigate(interventionReturnTarget, { replace: true });
  };

  const handleOpenStudentCode = async (participant) => {
    const studentEmail = String(participant?.email || '').trim().toLowerCase();
    if (!classroomId || !studentEmail) {
      return;
    }

    if (!canBroadcastCodeChanges) {
      setError('Only faculty can open private student code sessions.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/classrooms/${classroomId}/interventions`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ student_email: studentEmail })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.room?.room_id) {
        throw new Error(payload?.message || payload?.error || 'Failed to open student intervention room.');
      }

      const sharedClassroomPath = `/classroom?id=${encodeURIComponent(classroomId)}`;
      navigate(
        `/classroom?id=${encodeURIComponent(classroomId)}&room=${encodeURIComponent(payload.room.room_id)}&focusStudent=${encodeURIComponent(studentEmail)}&returnTo=${encodeURIComponent(sharedClassroomPath)}`,
        { replace: true }
      );
    } catch (openError) {
      console.error('Failed to open student code session:', openError);
      setError(openError?.message || 'Unable to open student code session.');
    }
  };

  const handleReturnToTeachingCode = async () => {
    const roomIdToClose = resolvedRoomId || interventionRoomId;

    if (classroomId && roomIdToClose) {
      try {
        await fetch(`${API_BASE_URL}/api/classrooms/${classroomId}/interventions/${encodeURIComponent(roomIdToClose)}/close`, {
          method: 'POST',
          headers: getAuthHeaders()
        });
      } catch (error) {
        console.warn('Failed to close intervention room before returning to teaching code:', error);
      }
    }

    setResolvedRoomId(null);
    navigate(classroomTeachingTarget, { replace: true });
  };

  useEffect(() => {
    if (user?.email && classroomId) {
      connect(classroomId, user, {
        roomId: resolvedRoomId,
        roomType
      });
    }

    return () => {
      disconnect();
    };
  }, [user?.email, classroomId, resolvedRoomId, roomType, connect, disconnect]);

  // Initialize version control and auto-save
  useEffect(() => {
    if (user?.email && classroomId && !autoSaveInitialized.current) {
      // Initialize version control
      versionControl.initializeVersionControl(classroomId, user.email);
      
      // Start auto-save
      versionControl.startAutoSave(classroomId, user.email, () => ({
        code: latestCodeRef.current,
        language: latestLanguageRef.current
      }));
      
      autoSaveInitialized.current = true;
    }
    
    return () => {
      if (autoSaveInitialized.current) {
        versionControl.stopAutoSave();
        autoSaveInitialized.current = false;
      }
    };
  }, [user?.email, classroomId]);

  const appendUniqueChatMessage = (previousMessages, realtimeData) => {
    const metadata = realtimeData.metadata || {};
    const messageText = metadata.message || realtimeData.message;

    if (!messageText) {
      return previousMessages;
    }

    const message = normalizeMessage({
      id: realtimeData.id,
      sender_email: realtimeData.sender_email,
      sender_name: realtimeData.sender_name,
      message: messageText,
      type: metadata.type || 'message',
      metadata,
      created_date: realtimeData.created_date
    });

    const exists = previousMessages.some((existing) => existing.id === message.id);
    return exists ? previousMessages : [...previousMessages, message];
  };

  const showFacultyEditNotice = (senderName) => {
    if (canBroadcastCodeChanges) {
      return;
    }

    const editorName = (senderName || 'Faculty').toString();
    setFacultyEditNotice({ active: true, editorName, lastEditedAt: Date.now() });

    if (facultyEditNoticeTimeout.current) {
      clearTimeout(facultyEditNoticeTimeout.current);
    }

    facultyEditNoticeTimeout.current = setTimeout(() => {
      setFacultyEditNotice((previous) => ({ ...previous, active: false }));
    }, 5500);
  };

  const showSharedTeachingNotice = (senderName) => {
    if (canBroadcastCodeChanges) {
      return;
    }

    const teacherName = (senderName || 'Faculty').toString();
    setSharedTeachingNotice({ active: true, teacherName });

    if (sharedTeachingNoticeTimeout.current) {
      clearTimeout(sharedTeachingNoticeTimeout.current);
    }

    sharedTeachingNoticeTimeout.current = setTimeout(() => {
      setSharedTeachingNotice((previous) => ({ ...previous, active: false }));
    }, 6500);
  };

  const handleCodeViewModeChange = (nextMode) => {
    if (nextMode === 'shared' || nextMode === 'personal') {
      setCodeViewMode(nextMode);

      if (nextMode === 'shared' && !canBroadcastCodeChanges) {
        const snapshotCode = String(latestSharedClassroomSnapshot.current?.code || '');
        const snapshotLanguage = String(latestSharedClassroomSnapshot.current?.language || '').toLowerCase();

        if (snapshotCode && snapshotCode !== lastCodeSync.current) {
          setCode((previousCode) => (previousCode === snapshotCode ? previousCode : snapshotCode));
          if (snapshotLanguage) {
            setLanguage(snapshotLanguage);
          }
          lastCodeSync.current = snapshotCode;
          pendingCodeSync.current = snapshotCode;
        }

        setSharedTeachingNotice((previous) => ({ ...previous, active: false }));
      }
    }
  };

  useEffect(() => {
    if (!facultyEditNotice.active) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      setFacultyEditNow(Date.now());
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [facultyEditNotice.active]);

  const facultyLastEditedLabel = useMemo(() => {
    if (!facultyEditNotice.active || !facultyEditNotice.lastEditedAt) {
      return '';
    }

    const elapsedMs = Math.max(0, facultyEditNow - facultyEditNotice.lastEditedAt);
    if (elapsedMs < 2000) {
      return 'Last edited just now';
    }

    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    if (elapsedSeconds < 60) {
      return `Last edited ${elapsedSeconds}s ago`;
    }

    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    return `Last edited ${elapsedMinutes}m ago`;
  }, [facultyEditNotice.active, facultyEditNotice.lastEditedAt, facultyEditNow]);

  // Set up collaboration event listeners
  // eslint-disable-next-line sonarjs/no-nested-functions
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribeFunctions = [];

    // Listen for code changes from other users
    const unsubscribeCodeChange = on(COLLABORATION_EVENTS.CODE_CHANGE, (data) => {
      const senderEmail = data?.sender_email;
      const senderRole = data?.sender_role;
      const targetStudentEmail = typeof data?.metadata?.target_student_email === 'string'
        ? data.metadata.target_student_email.trim().toLowerCase()
        : '';
      const isTrustedCodeAuthor =
        senderRole === 'faculty' ||
        senderRole === 'admin' ||
        senderEmail === classroom?.faculty_email;
      const isDirectedStudentEdit = Boolean(targetStudentEmail);
      const { code: newCode, language: newLang } = data?.metadata || {};

      if (!isDirectedStudentEdit && isTrustedCodeAuthor && typeof newCode === 'string' && newCode) {
        latestSharedClassroomSnapshot.current = {
          code: newCode,
          language: typeof newLang === 'string' ? newLang : language
        };
      }

      const shouldApplySharedTeachingUpdate =
        canBroadcastCodeChanges ||
        codeViewMode === 'shared';

      if (targetStudentEmail && targetStudentEmail !== String(user?.email || '').trim().toLowerCase()) {
        return;
      }

      if (senderEmail !== user?.email && data.metadata && isTrustedCodeAuthor) {
        if (!isDirectedStudentEdit && !shouldApplySharedTeachingUpdate) {
          // Students in personal mode should keep their own draft untouched while faculty teaches on shared code.
          showSharedTeachingNotice(data?.sender_name);
          return;
        }

        if (newCode && newCode !== lastCodeSync.current) {
          setCode((previousCode) => (previousCode === newCode ? previousCode : newCode));
          if (newLang) setLanguage(newLang);
          lastCodeSync.current = newCode;
          pendingCodeSync.current = newCode;
        }

        if (targetStudentEmail) {
          showFacultyEditNotice(data?.sender_name);
        }
      }
    });

    // Listen for language changes
    const unsubscribeLanguage = on(COLLABORATION_EVENTS.LANGUAGE_CHANGE, (data) => {
      if (data.sender_email !== user?.email && data.metadata) {
        setLanguage(data.metadata.language);
      }
    });

    // Listen for execution events
    const unsubscribeExecution = on(COLLABORATION_EVENTS.EXECUTION_START, (data) => {
      const senderEmail = data?.sender_email;
      if (!senderEmail || senderEmail === user?.email) {
        return;
      }

      if (senderEmail !== user?.email) {
        setRightTab('output');
        // Show who is running code
        const senderName = data?.sender_name || senderEmail;
        setOutput(prev => `${prev}\n🔄 ${senderName} is running code...`);
      }
    });

    const unsubscribeExecutionResult = on(COLLABORATION_EVENTS.EXECUTION_RESULT, (data) => {
      const senderEmail = data?.sender_email;
      const metadata = data?.metadata;

      if (!senderEmail || senderEmail === user?.email || !metadata || typeof metadata !== 'object') {
        return;
      }

      setRightTab('output');
      if (metadata.success) {
        const externalOutput = typeof metadata.output === 'string' ? metadata.output : '';
        const senderName = data?.sender_name || senderEmail;
        setOutput(`🟢 ${senderName}'s result:\n${externalOutput || 'Program executed successfully (no console output).'}`);
        setError('');
      } else {
        const externalError = typeof metadata.error === 'string' ? metadata.error : 'Execution failed.';
        const senderName = data?.sender_name || senderEmail;
        setError(`🔴 ${senderName}'s error:\n${externalError}`);
        setOutput('');
      }
    });

    const unsubscribeChatMessage = on(COLLABORATION_EVENTS.CHAT_MESSAGE, (data) => {
      setChatMessages((previous) => appendUniqueChatMessage(previous, data));
    });

    const unsubscribeInterventionClosed = on('intervention_closed', (data) => {
      const closedRoomId = data?.metadata?.room_id;

      if (!closedRoomId || closedRoomId !== resolvedRoomId || roomType !== 'intervention') {
        return;
      }

      setResolvedRoomId(null);
      navigate(interventionReturnTarget, { replace: true });
    });

    const unsubscribeInterventionOpened = on('intervention_opened', (data) => {
      if (isFacultyOrAdmin) {
        return;
      }

      const openedRoomId = String(data?.metadata?.room_id || '').trim();
      const targetStudentEmail = String(data?.metadata?.student_email || '').trim().toLowerCase();
      const currentUserEmail = String(user?.email || '').trim().toLowerCase();

      if (!openedRoomId || !targetStudentEmail || targetStudentEmail !== currentUserEmail) {
        return;
      }

      setResolvedRoomId((previousRoomId) => (previousRoomId === openedRoomId ? previousRoomId : openedRoomId));
    });

    const unsubscribePersonalCodeChange = on(COLLABORATION_EVENTS.PERSONAL_CODE_CHANGE, (data) => {
      if (!canBroadcastCodeChanges || roomType !== 'intervention') {
        return;
      }

      const senderEmail = String(data?.sender_email || '').trim().toLowerCase();
      const expectedStudentEmail = String(interventionStudentParticipant?.email || '').trim().toLowerCase();

      if (!senderEmail || !expectedStudentEmail || senderEmail !== expectedStudentEmail) {
        return;
      }

      const incomingCode = typeof data?.metadata?.code === 'string' ? data.metadata.code : '';
      const incomingLanguage = typeof data?.metadata?.language === 'string' ? data.metadata.language : '';

      if (incomingCode && incomingCode !== lastCodeSync.current) {
        setCode((previousCode) => (previousCode === incomingCode ? previousCode : incomingCode));
        if (incomingLanguage) {
          setLanguage(incomingLanguage);
        }
        lastCodeSync.current = incomingCode;
        pendingCodeSync.current = incomingCode;
      }
    });

    const unsubscribeRemoved = on('collaboration:removed', (data) => {
      const removedClassroomId = String(data?.classroomId || '');
      if (!removedClassroomId || removedClassroomId !== String(classroomId || '')) {
        return;
      }

      setError('You were removed from this classroom by faculty.');
      navigate('/student-dashboard', { replace: true });
    });

    const unsubscribeTerminalStarted = on(COLLABORATION_EVENTS.TERMINAL_STARTED, () => {
      setInteractiveSessionActive(true);
      setIsRunning(true);
      setRightTab('output');
    });

    const unsubscribeTerminalOutput = on(COLLABORATION_EVENTS.TERMINAL_OUTPUT, (payload) => {
      const chunk = typeof payload?.chunk === 'string' ? payload.chunk : '';
      const stream = payload?.stream;

      if (!chunk) {
        return;
      }

      if (stream === 'stderr') {
        if (isMissingInputRuntimeError(chunk)) {
          setError((previous) => {
            const merged = `${previous || ''}${chunk}`;
            return merged.includes(MISSING_INPUT_HELP) ? merged : `${merged}\n${MISSING_INPUT_HELP}`;
          });
          return;
        }
        setError((previous) => `${previous || ''}${chunk}`);
        return;
      }

      setOutput((previous) => `${previous || ''}${chunk}`);
    });

    const unsubscribeTerminalError = on(COLLABORATION_EVENTS.TERMINAL_ERROR, (payload) => {
      const message = typeof payload?.message === 'string' ? payload.message : 'Interactive terminal error.';
      setError((previous = '') => (previous ? `${previous}\n${message}` : message));
      setIsRunning(false);
      setInteractiveSessionActive(false);
    });

    const unsubscribeTerminalEnded = on(COLLABORATION_EVENTS.TERMINAL_ENDED, (payload) => {
      const exitCode = Number.isFinite(payload?.exitCode) ? payload.exitCode : 0;
      const signal = payload?.signal ? ` (${payload.signal})` : '';

      setIsRunning(false);
      setInteractiveSessionActive(false);

      setOutput((previous = '') => {
        const normalized = previous;
        const suffix = `\n\n[Process exited with code ${exitCode}${signal}]`;
        return normalized.includes('[Process exited with code') ? normalized : `${normalized}${suffix}`;
      });
    });

    unsubscribeFunctions.push(
      unsubscribeCodeChange,
      unsubscribeLanguage, 
      unsubscribeExecution,
      unsubscribeExecutionResult,
      unsubscribeChatMessage,
      unsubscribeInterventionClosed,
      unsubscribeInterventionOpened,
      unsubscribePersonalCodeChange,
      unsubscribeRemoved,
      unsubscribeTerminalStarted,
      unsubscribeTerminalOutput,
      unsubscribeTerminalError,
      unsubscribeTerminalEnded
    );

    return () => {
      unsubscribeFunctions.forEach(fn => fn());
    };
  }, [isConnected, on, user, classroom?.faculty_email, classroomId, navigate, COLLABORATION_EVENTS, isFacultyOrAdmin, interventionReturnTarget, canBroadcastCodeChanges, codeViewMode, roomType, interventionStudentParticipant?.email]);

  useEffect(() => {
    if (!classroom?.language) {
      return;
    }

    const normalizedLanguage = String(classroom.language).toLowerCase();
    const nextSnippet = DEFAULT_CODE_SNIPPETS[normalizedLanguage] || DEFAULT_CODE_SNIPPETS.javascript;
    const defaultSnippets = Object.values(DEFAULT_CODE_SNIPPETS);

    if (!codeRestoredFromCache.current) {
      setLanguage(normalizedLanguage);
    }
    setCode((previousCode) => {
      const hasUserCode = typeof previousCode === 'string' && previousCode.trim().length > 0;
      const isTemplateCode = defaultSnippets.includes(previousCode);

      if ((!hasUserCode || isTemplateCode) && !codeRestoredFromCache.current) {
        return nextSnippet;
      }

      return previousCode;
    });
  }, [classroom?.language]);

  const sendMessageMutation = useMutation({
    mutationFn: async (message) => {
      await emit(COLLABORATION_EVENTS.CHAT_MESSAGE, {
        message,
        type: 'message',
        timestamp: Date.now()
      });
    },
    onError: (mutationError) => {
      console.error('Failed to send classroom message:', mutationError);
    },
  });

  const removeStudentMutation = useMutation({
    mutationFn: async (studentEmail) => {
      const response = await fetch(`${API_BASE_URL}/api/classrooms/${classroomId}/students/remove`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ student_email: studentEmail })
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || 'Failed to remove student from classroom.');
      }

      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom', classroomId] });
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      queryClient.invalidateQueries({ queryKey: ['facultyClassrooms'] });
    },
    onError: (mutationError) => {
      setError(mutationError?.message || 'Failed to remove student from classroom.');
    }
  });

  const handleRemoveStudent = async (participant) => {
    const studentEmail = String(participant?.email || '').trim().toLowerCase();

    if (!studentEmail || !classroomId) {
      return;
    }

    const confirmed = globalThis.window?.confirm(`Remove ${studentEmail} from this classroom?`);
    if (!confirmed) {
      return;
    }

    setError('');
    await removeStudentMutation.mutateAsync(studentEmail);
  };

  const handleResetCode = () => {
    if (!canEditCode) {
      return;
    }

    const defaultCode = DEFAULT_CODE_SNIPPETS[language] || DEFAULT_CODE_SNIPPETS.javascript;

    activeCodeSource.current = 'server';
    setCode(defaultCode);
    pendingCodeSync.current = defaultCode;
    lastCodeSync.current = defaultCode;

    if (codeCacheKey) {
      try {
        globalThis.localStorage?.removeItem(codeCacheKey);
      } catch (cacheError) {
        console.warn('Failed to clear classroom code cache:', cacheError);
      }
    }
  };

  // Enhanced code change handler with real-time sync and version control
  const handleCodeChange = (newCode) => {
    if (!canEditCode) {
      return;
    }

    activeCodeSource.current = 'local';
    setCode(newCode);
    pendingCodeSync.current = newCode;

    // Mark changes for version control auto-save
    versionControl.markPendingChanges();

    if (isConnected) {
      sendTyping();
    }

    // Debounce code sync to avoid too many updates
    if (codeChangeTimeout.current) {
      clearTimeout(codeChangeTimeout.current);
    }

    codeChangeTimeout.current = setTimeout(() => {
      if (isConnected && canBroadcastCodeChanges && codeViewMode === 'shared' && pendingCodeSync.current === newCode && newCode !== lastCodeSync.current) {
        const targetStudentEmail = roomType === 'intervention' && interventionStudentParticipant?.email
          ? String(interventionStudentParticipant.email).trim().toLowerCase()
          : '';

        syncCode(newCode, language, 0, targetStudentEmail ? { target_student_email: targetStudentEmail } : {});
        lastCodeSync.current = newCode;
      } else if (isConnected && !canBroadcastCodeChanges && codeViewMode === 'personal' && pendingCodeSync.current === newCode) {
        emit(COLLABORATION_EVENTS.PERSONAL_CODE_CHANGE, {
          code: newCode,
          language,
          timestamp: Date.now()
        });
      }
    }, 800); // 800ms debounce
  };

  const handleCursorChange = (position, selection) => {
    if (!isConnected) {
      return;
    }

    if (cursorSyncTimeout.current) {
      clearTimeout(cursorSyncTimeout.current);
    }

    cursorSyncTimeout.current = setTimeout(() => {
      syncCursor(position, selection);
    }, 60);
  };

  // Handle language change with sync
  const handleLanguageChange = (newLanguage) => {
    if (!canEditCode) {
      return;
    }

    activeCodeSource.current = 'local';
    setLanguage(newLanguage);
    
    if (isConnected && canBroadcastCodeChanges && codeViewMode === 'shared') {
      emit(COLLABORATION_EVENTS.LANGUAGE_CHANGE, {
        language: newLanguage,
        timestamp: Date.now()
      });
    } else if (isConnected && !canBroadcastCodeChanges && codeViewMode === 'personal') {
      emit(COLLABORATION_EVENTS.PERSONAL_CODE_CHANGE, {
        code,
        language: newLanguage,
        timestamp: Date.now()
      });
    }
  };

  const safeEmit = async (eventType, payload) => {
    if (!isConnected) {
      return;
    }

    try {
      await emit(eventType, payload);
    } catch (collaborationError) {
      // Collaboration should never block local execution UX.
      console.warn(`Failed to emit ${eventType}:`, collaborationError);
    }
  };

  // Enhanced run handler with collaboration
  // eslint-disable-next-line sonarjs/cognitive-complexity
  const handleRun = async () => {
    if (isRunning) {
      return;
    }

    const codeToRun = typeof code === 'string' ? code : '';

    if (!codeToRun.trim()) {
      setRightTab('output');
      setOutput('');
      setError('Code is empty. Please write some code before running.');
      return;
    }

    const stdinToUse = String(executionInput || '').replaceAll('\r\n', '\n');

    setIsRunning(true);
    setOutput('');
    setError('');
    setRightTab('output');

    // Notify other users that execution started
    void safeEmit(COLLABORATION_EVENTS.EXECUTION_START, {
      language,
      timestamp: Date.now()
    });

    try {
      // Validate code for security issues
      const validation = codeExecutionService.validateCode(codeToRun, language);
      if (!validation.isValid) {
        const errorMsg = `Code validation failed:\n${validation.errors.join('\n')}`;
        setError(errorMsg);
        
        // Share error with other users
        void safeEmit(COLLABORATION_EVENTS.EXECUTION_RESULT, {
          success: false,
          error: errorMsg,
          timestamp: Date.now()
        });

        return;
      }

      // Show warnings if any
      if (validation.warnings.length > 0) {
        console.warn('Code validation warnings:', validation.warnings);
      }

      // Execute code securely
      const result = await codeExecutionService.executeCode(codeToRun, language, stdinToUse);
      console.log('[DEBUG] Classroom execution result:', {
        success: result.success,
        outputLength: result.output?.length || 0,
        errorLength: result.error?.length || 0
      });
      const hasOutput = typeof result.output === 'string' && result.output.trim().length > 0;
      const shouldDisplayOutput = result.success || (hasOutput && !result.error);
      
      if (shouldDisplayOutput) {
        const hasVisibleOutput = typeof result.output === 'string' && result.output.trim().length > 0;
        let outputText = hasVisibleOutput
          ? result.output
          : 'Program executed successfully (no console output).';

        if (result.executionTime || result.memory) {
          outputText += `\n\n🔹 Execution Time: ${result.executionTime}ms | Memory: ${(result.memory / 1024).toFixed(2)}KB`;
        }

        setOutput(outputText);
        setError('');
        setRightTab('output');
        
        // Share successful result
        void safeEmit(COLLABORATION_EVENTS.EXECUTION_RESULT, {
          success: true,
          output: outputText,
          executionTime: result.executionTime,
          memory: result.memory,
          timestamp: Date.now()
        });
      } else {
        const executionErrorMessage = result.error || 'Execution completed without output. Check your code and try again.';
        const missingInputDetected =
          !stdinToUse.trim() &&
          codeLikelyNeedsInput(codeToRun, language) &&
          isMissingInputRuntimeError(executionErrorMessage);
        const explanationText = typeof result.explanation === 'string' && result.explanation.trim().length > 0
          ? `\n\nWhy this happened:\n${result.explanation}`
          : '';
        const failureOutput = typeof result.output === 'string' ? result.output.trim() : '';

        if (missingInputDetected) {
          setOutput(failureOutput);
          setError('Program expected more input. Add required values in Program Input (stdin), then click Run Code again.');
          setRightTab('output');
          return;
        }

        setError(`${executionErrorMessage}${explanationText}`);
        setOutput(failureOutput);
        setRightTab('output');
        
        // Share error result
        void safeEmit(COLLABORATION_EVENTS.EXECUTION_RESULT, {
          success: false,
          error: executionErrorMessage,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Code execution failed:', error);
      const errorMsg = `Execution failed: ${error.message}`;
      setError(errorMsg);
      setOutput('');
      setRightTab('output');
      
      // Share execution failure
      void safeEmit(COLLABORATION_EVENTS.EXECUTION_RESULT, {
        success: false,
        error: errorMsg,
        timestamp: Date.now()
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!user?.email || !classroomId) {
      setError('You must be signed in to submit code.');
      return;
    }

    if (isSubmitting) {
      return;
    }

    if (hasSubmittedCurrentAssignment) {
      setError('Assignment already submitted. You cannot submit it again.');
      return;
    }

    setIsSubmitting(true);

    try {
      const assignmentsResponse = await fetch(
        `${API_BASE_URL}/api/assignments?classroom_id=${encodeURIComponent(classroomId)}&limit=1&sort=desc&sortBy=createdAt`,
        { headers: getAuthHeaders() }
      );

      if (!assignmentsResponse.ok) {
        const assignmentsErrorPayload = await assignmentsResponse.json().catch(() => ({}));
        throw new Error(
          assignmentsErrorPayload.message ||
          assignmentsErrorPayload.error ||
          'Unable to load the classroom assignment for submission.'
        );
      }

      const assignmentsPayload = await assignmentsResponse.json().catch(() => ({}));
      const assignment = (assignmentsPayload.assignments || [])[0];

      if (!assignment?.id && !assignment?._id) {
        throw new Error('No assignment is available for this classroom yet.');
      }

      const assignmentId = effectiveAssignmentId || assignment.id || assignment._id;
      const submissionResponse = await fetch(`${API_BASE_URL}/api/submissions`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          assignment_id: assignmentId,
          classroom_id: classroomId,
          code,
          language
        })
      });

      if (!submissionResponse.ok) {
        const payload = await submissionResponse.json().catch(() => ({}));
        throw new Error(payload.message || payload.error || 'Failed to create submission.');
      }

      const submissionPayload = await submissionResponse.json().catch(() => ({}));
      const submissionId = submissionPayload?.submission?.id || submissionPayload?.submission?._id;

      if (!submissionId) {
        throw new Error('Submission was created but the server did not return an id.');
      }

      const submitResponse = await fetch(`${API_BASE_URL}/api/submissions/${submissionId}/submit`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (!submitResponse.ok) {
        const payload = await submitResponse.json().catch(() => ({}));
        throw new Error(payload.message || payload.error || 'Failed to submit code.');
      }

      if (user?.email && classroomId) {
        await versionControl.saveSubmissionVersion(
          classroomId,
          user.email,
          code,
          language,
          `manual_submission_${Date.now()}`
        );
      }

      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
      queryClient.invalidateQueries({ queryKey: ['studentAssignmentSubmissions'] });
      queryClient.invalidateQueries({ queryKey: ['studentSubmissions'] });
    } catch (submitError) {
      console.error('Submission failed:', submitError);
      setError(submitError.message || 'Failed to submit code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle code restoration from version history
  const handleRestoreCode = (restoredCode, restoredLanguage) => {
    if (!canEditCode) {
      return;
    }

    activeCodeSource.current = 'local';
    setCode(restoredCode);
    setLanguage(restoredLanguage);
    
    // Update collaboration if connected
    if (isConnected && canBroadcastCodeChanges && codeViewMode === 'shared') {
      syncCode(restoredCode, restoredLanguage);
    } else if (isConnected && !canBroadcastCodeChanges && codeViewMode === 'personal') {
      emit(COLLABORATION_EVENTS.PERSONAL_CODE_CHANGE, {
        code: restoredCode,
        language: restoredLanguage,
        timestamp: Date.now()
      });
    }
  };

  const onlineCount = activeUsers.size || participants.length;
  const currentFileExtension = LANGUAGE_EXTENSIONS[language] || 'txt';
  const currentUserDisplayName = (() => {
    const userName = String(user?.full_name || user?.fullName || user?.name || '').trim();
    if (userName) {
      return userName;
    }

    const userEmail = String(user?.email || '').trim();
    return userEmail ? userEmail.split('@')[0] : 'My';
  })();
  const codeOwnerLabel = (() => {
    if (roomType === 'intervention' && interventionStudentParticipant && canBroadcastCodeChanges) {
      return `Student code: ${interventionStudentParticipant.name}`;
    }

    if (canBroadcastCodeChanges && codeViewMode === 'shared') {
      return `${currentUserDisplayName} · Faculty teaching code`;
    }

    if (!canBroadcastCodeChanges && codeViewMode === 'shared') {
      const facultyName = getDisplayNameFromEmail(classroom?.faculty_email, classroom);
      return `Classroom code (read-only) · ${facultyName}`;
    }

    return `${currentUserDisplayName}'s code (editable)`;
  })();

  let submitButtonLabel = 'Submit';
  if (isSubmitting) {
    submitButtonLabel = 'Submitting...';
  }
  if (hasSubmittedCurrentAssignment) {
    submitButtonLabel = 'Submitted';
  }

  return (
    <div className="h-screen bg-[#0a0f1a] flex flex-col overflow-hidden select-none">
      {/* IDE Title bar */}
      <div className="h-11 border-b border-slate-800/50 bg-[#070c14] backdrop-blur flex items-center justify-between px-2 sm:px-4 flex-shrink-0 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={handleExitRoom}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors group"
          >
            <ArrowLeft style={{ width: 14, height: 14 }} className="group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-[11px] font-medium hidden sm:block">
              {roomType === 'intervention' ? 'End Intervention' : 'Back'}
            </span>
          </button>

          <div className="w-px h-4 bg-slate-800 hidden sm:block" />

          <div className="min-w-0">
            <h1 className="text-[12px] font-semibold text-slate-200 leading-none truncate max-w-[38vw] sm:max-w-none">{classroom?.name || 'Loading...'}</h1>
            <p className="text-[10px] text-slate-600 font-mono mt-0.5 truncate">{classroom?.code}</p>
          </div>
        </div>

        {/* Center: collaborative avatars */}
        <div className="hidden md:flex items-center gap-3">
          <div className="hidden sm:flex -space-x-1.5">
            {participants.slice(0, 5).map((p, i) => (
              <div
                key={p.email}
                className="w-5 h-5 rounded-full border-2 border-[#070c14] flex items-center justify-center text-[8px] text-white font-bold"
                style={{
                  background: `hsl(${(i * 60) % 360}, 70%, 55%)`,
                }}
                title={p.name || p.email}
              >
                {(p.name || p.email)[0].toUpperCase()}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 font-medium">{onlineCount} online</span>
          </div>
        </div>

        {submitted && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="hidden sm:flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full"
          >
            <CheckCircle2 style={{ width: 12, height: 12 }} />
            Submitted!
          </motion.div>
        )}
      </div>

      {facultyEditNotice.active && !canBroadcastCodeChanges && (
        <div className="border-b border-cyan-500/25 bg-cyan-500/10 px-3 sm:px-4 py-1.5 flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-pulse" />
            <p className="text-[10px] sm:text-[11px] text-cyan-100 truncate">
              {facultyEditNotice.editorName || 'Faculty'} is editing your code in real time
            </p>
          </div>
          <span className="hidden sm:inline text-[10px] text-cyan-200/80">{facultyLastEditedLabel || 'Live sync active'}</span>
        </div>
      )}

      {sharedTeachingNotice.active && !canBroadcastCodeChanges && roomType !== 'intervention' && codeViewMode === 'personal' && (
        <div className="border-b border-indigo-500/25 bg-indigo-500/10 px-3 sm:px-4 py-2 flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 animate-pulse" />
            <p className="text-[10px] sm:text-[11px] text-indigo-100 truncate">
              {sharedTeachingNotice.teacherName || 'Faculty'} is teaching on Classroom Code. Switch to Classroom Code to follow live.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleCodeViewModeChange('shared')}
            className="text-[10px] sm:text-[11px] font-medium text-indigo-100 bg-indigo-500/20 border border-indigo-400/30 hover:bg-indigo-500/30 rounded-md px-2.5 py-1 transition-colors whitespace-nowrap"
          >
            Switch Now
          </button>
        </div>
      )}

      {roomType === 'intervention' && (
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-3 sm:px-4 py-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-amber-200 uppercase tracking-[0.18em]">Private Intervention Active</p>
            <p className="text-[10px] text-amber-100/80 truncate">
              This session is private to the faculty and selected student.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-amber-100/80">
            <span className="hidden sm:inline px-2 py-1 rounded-full border border-amber-400/30 bg-amber-400/10">
              Live private room
            </span>
            {canBroadcastCodeChanges && (
              <button
                type="button"
                onClick={handleReturnToTeachingCode}
                className="px-2.5 py-1 rounded-md border border-cyan-400/30 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25 transition-colors whitespace-nowrap"
              >
                Return to Teaching Code
              </button>
            )}
          </div>
        </div>
      )}

      {/* IDE body */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Left: Participants */}
        {isMobileLayout ? (
          !leftCollapsed && (
            <div className="border-b border-slate-800/50 bg-[#070c14] flex-shrink-0 h-44 overflow-hidden">
              <ParticipantsPanel
                participants={participants}
                facultyEmail={classroom?.faculty_email}
                currentUserEmail={user?.email}
                currentUserRole={user?.role}
                onRemoveStudent={handleRemoveStudent}
                onOpenStudentCode={handleOpenStudentCode}
                removingStudentEmail={removeStudentMutation.isPending ? removeStudentMutation.variables : null}
              />
            </div>
          )
        ) : (
          <motion.div
            animate={{ width: leftCollapsed ? 0 : 200 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="border-r border-slate-800/50 bg-[#070c14] flex-shrink-0 overflow-hidden"
          >
            <ParticipantsPanel
              participants={participants}
              facultyEmail={classroom?.faculty_email}
              currentUserEmail={user?.email}
              currentUserRole={user?.role}
              onRemoveStudent={handleRemoveStudent}
              onOpenStudentCode={handleOpenStudentCode}
              removingStudentEmail={removeStudentMutation.isPending ? removeStudentMutation.variables : null}
            />
          </motion.div>
        )}

        {/* Center: Code Editor */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#0d1117]">
          {/* Mini toolbar */}
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-800/40 bg-slate-950/40 flex-shrink-0">
            <button
              onClick={() => setLeftCollapsed(!leftCollapsed)}
              className="p-1.5 rounded text-slate-600 hover:text-slate-300 hover:bg-slate-800/50 transition-colors"
              title={leftCollapsed ? 'Show participants' : 'Hide participants'}
            >
              {leftCollapsed
                ? <PanelLeftOpen style={{ width: 13, height: 13 }} />
                : <PanelLeftClose style={{ width: 13, height: 13 }} />
              }
            </button>
            <div className="w-px h-3.5 bg-slate-800 mx-1" />
            <span className="text-[10px] font-mono text-slate-600">main.{currentFileExtension}</span>
            {!canBroadcastCodeChanges && (
              <div className="ml-auto flex items-center gap-1 rounded-lg border border-slate-800/70 bg-slate-900/50 p-0.5">
                <button
                  type="button"
                  onClick={() => handleCodeViewModeChange('shared')}
                  className={`h-6 px-2 rounded-md text-[10px] transition-colors ${codeViewMode === 'shared' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-200'}`}
                >
                  Classroom Code
                </button>
                <button
                  type="button"
                  onClick={() => handleCodeViewModeChange('personal')}
                  className={`h-6 px-2 rounded-md text-[10px] transition-colors ${codeViewMode === 'personal' ? 'bg-cyan-600 text-white' : 'text-slate-500 hover:text-slate-200'}`}
                >
                  My Code
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 p-2 sm:p-3 overflow-hidden min-h-[260px]">
            <CodeEditor
              language={language}
              onLanguageChange={handleLanguageChange}
              code={code}  
              onCodeChange={handleCodeChange}
              onCursorChange={handleCursorChange}
              onRun={handleRun}
              onSubmit={handleSubmit}
              onReset={handleResetCode}
              isRunning={isRunning || interactiveSessionActive}
              readOnly={!canEditCode || (!canBroadcastCodeChanges && codeViewMode === 'shared')}
              ownerLabel={codeOwnerLabel}
              errorLineNumbers={errorLineNumbers}
              submitDisabled={hasSubmittedCurrentAssignment || isSubmitting}
              submitLabel={submitButtonLabel}
            />
          </div>
        </div>

        {/* Right: Panels */}
        <div className="w-full lg:w-72 h-[42vh] min-h-[260px] lg:h-auto border-t lg:border-t-0 lg:border-l border-slate-800/50 bg-[#070c14] flex-shrink-0 flex flex-col">
          <Tabs value={rightTab} onValueChange={setRightTab} className="flex flex-col h-full">
            <TabsList className="bg-transparent border-b border-slate-800/50 rounded-none h-10 px-2 gap-0.5 flex-shrink-0 w-full justify-start overflow-x-auto">
              <TabsTrigger
                value="chat"
                className="shrink-0 text-[11px] font-medium data-[state=active]:bg-slate-800/60 data-[state=active]:text-white text-slate-500 rounded-md h-7 px-3 gap-1.5"
              >
                <MessageSquare style={{ width: 12, height: 12 }} /> Chat
              </TabsTrigger>
              <TabsTrigger
                value="ai"
                className="shrink-0 text-[11px] font-medium data-[state=active]:bg-violet-500/15 data-[state=active]:text-violet-400 text-slate-500 rounded-md h-7 px-3 gap-1.5"
              >
                <Sparkles style={{ width: 12, height: 12 }} /> AI
              </TabsTrigger>
              <TabsTrigger
                value="output"
                className="shrink-0 text-[11px] font-medium data-[state=active]:bg-slate-800/60 data-[state=active]:text-white text-slate-500 rounded-md h-7 px-3 gap-1.5"
              >
                <Terminal style={{ width: 12, height: 12 }} /> Output
                {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
              </TabsTrigger>
              <TabsTrigger
                value="versions"
                className="shrink-0 text-[11px] font-medium data-[state=active]:bg-blue-500/15 data-[state=active]:text-blue-400 text-slate-500 rounded-md h-7 px-3 gap-1.5"
              >
                <History style={{ width: 12, height: 12 }} /> Versions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="flex-1 mt-0 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
              <ChatPanel messages={chatMessages} currentUser={user} onSendMessage={(msg) => sendMessageMutation.mutate(msg)} />
            </TabsContent>
            <TabsContent value="ai" className="flex-1 mt-0 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
              <AIAssistant code={code} language={language} />
            </TabsContent>
            <TabsContent value="output" className="flex-1 mt-0 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
              <OutputPanel
                output={output}
                error={error}
                isRunning={isRunning}
                inputValue={executionInput}
                onInputChange={setExecutionInput}
                onRun={handleRun}
                language={language}
              />
            </TabsContent>
            <TabsContent value="versions" className="flex-1 mt-0 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
              <VersionHistoryPanel 
                classroomId={classroomId}
                userEmail={user?.email}
                currentCode={code}
                currentLanguage={language}
                onRestoreCode={handleRestoreCode}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}