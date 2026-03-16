import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MessageSquare, Sparkles, Terminal, ArrowLeft, PanelLeftClose, PanelLeftOpen, CheckCircle2, History } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import CodeEditor from '@/components/classroom/CodeEditor';
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

export default function Classroom() {
  const urlParams = new URLSearchParams(globalThis.location.search);
  const classroomId = urlParams.get('id');
  const { user, getAuthHeaders } = useAuth();

  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [rightTab, setRightTab] = useState('chat');
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [isMobileLayout, setIsMobileLayout] = useState(() => isMobileViewport());
  
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
    if (user?.email && classroomId) {
      connect(classroomId, user);
    }

    return () => {
      disconnect();
    };
  }, [user?.email, classroomId, connect, disconnect]);

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

  // Set up collaboration event listeners
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
      if (data.sender_email !== user?.email) {
        setRightTab('output');
        // Show who is running code
        setOutput(prev => `${prev}\n🔄 ${data.sender_name} is running code...`);
      }
    });

    const unsubscribeExecutionResult = on(COLLABORATION_EVENTS.EXECUTION_RESULT, (data) => {
      if (data.sender_email !== user?.email && data.metadata) {
        setRightTab('output');
        if (data.metadata.success) {
          setOutput(`🟢 ${data.sender_name}'s result:\n${data.metadata.output}`);
          setError('');
        } else {
          setError(`🔴 ${data.sender_name}'s error:\n${data.metadata.error}`);
          setOutput('');
        }
      }
    });

    const unsubscribeChatMessage = on(COLLABORATION_EVENTS.CHAT_MESSAGE, (data) => {
      const metadata = data.metadata || {};
      const messageText = metadata.message || data.message;

      if (!messageText) {
        return;
      }

      setChatMessages((previous) => {
        const message = normalizeMessage({
          id: data.id,
          sender_email: data.sender_email,
          sender_name: data.sender_name,
          message: messageText,
          type: metadata.type || 'message',
          metadata,
          created_date: data.created_date
        });

        const exists = previous.some((existing) => existing.id === message.id);
        return exists ? previous : [...previous, message];
      });
    });

    unsubscribeFunctions.push(
      unsubscribeCodeChange,
      unsubscribeLanguage, 
      unsubscribeExecution,
      unsubscribeExecutionResult,
      unsubscribeChatMessage
    );

    return () => {
      unsubscribeFunctions.forEach(fn => fn());
    };
  }, [isConnected, on, user, COLLABORATION_EVENTS]);

  useEffect(() => {
    if (classroom?.language) setLanguage(classroom.language);
  }, [classroom]);

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

  // Enhanced run handler with collaboration
  const handleRun = async () => {
    setIsRunning(true);
    setOutput('');
    setError('');
    setRightTab('output');

    // Notify other users that execution started
    if (isConnected) {
      await emit(COLLABORATION_EVENTS.EXECUTION_START, {
        language,
        timestamp: Date.now()
      });
    }

    try {
      // Validate code for security issues
      const validation = codeExecutionService.validateCode(code, language);
      if (!validation.isValid) {
        const errorMsg = `Code validation failed:\n${validation.errors.join('\n')}`;
        setError(errorMsg);
        
        // Share error with other users
        if (isConnected) {
          await emit(COLLABORATION_EVENTS.EXECUTION_RESULT, {
            success: false,
            error: errorMsg,
            timestamp: Date.now()
          });
        }
        
        setIsRunning(false);
        return;
      }

      // Show warnings if any
      if (validation.warnings.length > 0) {
        console.warn('Code validation warnings:', validation.warnings);
      }

      // Execute code securely
      const result = await codeExecutionService.executeCode(code, language);
      
      if (result.success) {
        let outputText = result.output;
        if (result.executionTime || result.memory) {
          outputText += `\n\n🔹 Execution Time: ${result.executionTime}ms | Memory: ${(result.memory / 1024).toFixed(2)}KB`;
        }
        setOutput(outputText);
        
        // Share successful result
        if (isConnected) {
          await emit(COLLABORATION_EVENTS.EXECUTION_RESULT, {
            success: true,
            output: outputText,
            executionTime: result.executionTime,
            memory: result.memory,
            timestamp: Date.now()
          });
        }
      } else {
        setError(result.error);
        
        // Share error result
        if (isConnected) {
          await emit(COLLABORATION_EVENTS.EXECUTION_RESULT, {
            success: false,
            error: result.error,
            timestamp: Date.now()
          });
        }
      }
    } catch (error) {
      console.error('Code execution failed:', error);
      const errorMsg = `Execution failed: ${error.message}`;
      setError(errorMsg);
      
      // Share execution failure
      if (isConnected) {
        await emit(COLLABORATION_EVENTS.EXECUTION_RESULT, {
          success: false,
          error: errorMsg,
          timestamp: Date.now()
        });
      }
    }

    setIsRunning(false);
  };

  const handleSubmit = async () => {
    // Mock submission - disabled
    console.log('Submission functionality is currently disabled');

    // Save submission version for version control
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
              isRunning={isRunning}
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
              <OutputPanel output={output} error={error} isRunning={isRunning} />
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