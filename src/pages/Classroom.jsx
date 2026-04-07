import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MessageSquare, Sparkles, Terminal, ArrowLeft, PanelLeftClose, PanelLeftOpen, CheckCircle2, History } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Link, useNavigate } from 'react-router-dom';
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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
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

export default function Classroom() {
  const urlParams = new URLSearchParams(globalThis.location.search);
  const classroomId = urlParams.get('id');
  const interventionRoomId = urlParams.get('room');
  const { user, getAuthHeaders } = useAuth();
  const navigate = useNavigate();
  const [resolvedRoomId, setResolvedRoomId] = useState(interventionRoomId || null);
  const roomType = resolvedRoomId ? 'intervention' : 'classroom';

  const [code, setCode] = useState(DEFAULT_CODE_SNIPPETS.javascript);
  const [language, setLanguage] = useState('javascript');
  const [executionInput, setExecutionInput] = useState('');
  const [interactiveSessionActive, setInteractiveSessionActive] = useState(false);
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [rightTab, setRightTab] = useState('chat');
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [isMobileLayout, setIsMobileLayout] = useState(() => isMobileViewport());
  const errorLineNumbers = useMemo(() => extractErrorLineNumbers(error), [error]);
  
  const codeChangeTimeout = useRef(null);
  const cursorSyncTimeout = useRef(null);
  const lastCodeSync = useRef('');
  const pendingCodeSync = useRef('');
  const latestCodeRef = useRef('');
  const latestLanguageRef = useRef('javascript');
  const autoSaveInitialized = useRef(false);
  const previousMobileState = useRef(isMobileLayout);
  
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
    enabled: Boolean(classroomId && user?.email),
  });

  useEffect(() => {
    setChatMessages(messageHistory);
  }, [messageHistory, classroomId]);

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
    return () => {
      if (codeChangeTimeout.current) {
        clearTimeout(codeChangeTimeout.current);
      }
      if (cursorSyncTimeout.current) {
        clearTimeout(cursorSyncTimeout.current);
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

      try {
        const response = await fetch(`${API_BASE_URL}/api/classrooms/${classroomId}/interventions/active`, {
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
  }, [classroomId, user?.email, interventionRoomId, getAuthHeaders]);

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

  // Set up collaboration event listeners
  // eslint-disable-next-line sonarjs/no-nested-functions
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribeFunctions = [];

    // Listen for code changes from other users
    const unsubscribeCodeChange = on(COLLABORATION_EVENTS.CODE_CHANGE, (data) => {
      if (data.sender_email !== user?.email && data.metadata) {
        const { code: newCode, language: newLang } = data.metadata;
        if (newCode && newCode !== lastCodeSync.current) {
          setCode((previousCode) => (previousCode === newCode ? previousCode : newCode));
          if (newLang) setLanguage(newLang);
          lastCodeSync.current = newCode;
          pendingCodeSync.current = newCode;
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
      navigate(`/classroom?id=${classroomId}`, { replace: true });
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
      unsubscribeTerminalStarted,
      unsubscribeTerminalOutput,
      unsubscribeTerminalError,
      unsubscribeTerminalEnded
    );

    return () => {
      unsubscribeFunctions.forEach(fn => fn());
    };
  }, [isConnected, on, user, COLLABORATION_EVENTS]);

  useEffect(() => {
    if (!classroom?.language) {
      return;
    }

    const normalizedLanguage = String(classroom.language).toLowerCase();
    const nextSnippet = DEFAULT_CODE_SNIPPETS[normalizedLanguage] || DEFAULT_CODE_SNIPPETS.javascript;
    const defaultSnippets = Object.values(DEFAULT_CODE_SNIPPETS);

    setLanguage(normalizedLanguage);
    setCode((previousCode) => {
      const hasUserCode = typeof previousCode === 'string' && previousCode.trim().length > 0;
      const isTemplateCode = defaultSnippets.includes(previousCode);

      if (!hasUserCode || isTemplateCode) {
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

  // Enhanced code change handler with real-time sync and version control
  const handleCodeChange = (newCode) => {
    setCode(newCode);
    pendingCodeSync.current = newCode;

    // Mark changes for version control auto-save
    versionControl.markPendingChanges();

    // Send typing indicator immediately
    if (isConnected) {
      sendTyping();
    }

    // Debounce code sync to avoid too many updates
    if (codeChangeTimeout.current) {
      clearTimeout(codeChangeTimeout.current);
    }

    codeChangeTimeout.current = setTimeout(() => {
      if (isConnected && pendingCodeSync.current === newCode && newCode !== lastCodeSync.current) {
        syncCode(newCode, language);
        lastCodeSync.current = newCode;
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
    setLanguage(newLanguage);
    
    if (isConnected) {
      emit(COLLABORATION_EVENTS.LANGUAGE_CHANGE, {
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

      const assignmentId = assignment.id || assignment._id;
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
    } catch (submitError) {
      console.error('Submission failed:', submitError);
      setError(submitError.message || 'Failed to submit code.');
    }
  };

  // Handle code restoration from version history
  const handleRestoreCode = (restoredCode, restoredLanguage) => {
    setCode(restoredCode);
    setLanguage(restoredLanguage);
    
    // Update collaboration if connected
    if (isConnected) {
      syncCode(restoredCode, restoredLanguage);
    }
  };

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

  const participants = Array.from(participantMap.values());
  const onlineCount = activeUsers.size || participants.length;
  const currentFileExtension = LANGUAGE_EXTENSIONS[language] || 'txt';

  return (
    <div className="h-screen bg-[#0a0f1a] flex flex-col overflow-hidden select-none">
      {/* IDE Title bar */}
      <div className="h-11 border-b border-slate-800/50 bg-[#070c14] backdrop-blur flex items-center justify-between px-2 sm:px-4 flex-shrink-0 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link
            to="/student-dashboard"
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors group"
          >
            <ArrowLeft style={{ width: 14, height: 14 }} className="group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-[11px] font-medium hidden sm:block">Back</span>
          </Link>

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

      {roomType === 'intervention' && (
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-3 sm:px-4 py-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-amber-200 uppercase tracking-[0.18em]">Private Intervention Active</p>
            <p className="text-[10px] text-amber-100/80 truncate">
              This session is private to the faculty and selected student.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-[10px] text-amber-100/80">
            <span className="px-2 py-1 rounded-full border border-amber-400/30 bg-amber-400/10">
              Live private room
            </span>
          </div>
        </div>
      )}

      {/* IDE body */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Left: Participants */}
        {isMobileLayout ? (
          !leftCollapsed && (
            <div className="border-b border-slate-800/50 bg-[#070c14] flex-shrink-0 h-44 overflow-hidden">
              <ParticipantsPanel participants={participants} facultyEmail={classroom?.faculty_email} />
            </div>
          )
        ) : (
          <motion.div
            animate={{ width: leftCollapsed ? 0 : 200 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="border-r border-slate-800/50 bg-[#070c14] flex-shrink-0 overflow-hidden"
          >
            <ParticipantsPanel participants={participants} facultyEmail={classroom?.faculty_email} />
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
              isRunning={isRunning || interactiveSessionActive}
              errorLineNumbers={errorLineNumbers}
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