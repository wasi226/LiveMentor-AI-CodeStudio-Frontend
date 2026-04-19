// @ts-nocheck
/* eslint-disable react/prop-types */
/**
 * Enhanced Real-Time Collaboration Context
 * Provides Socket.IO-based collaboration functionality
 * Supports live code syncing, cursor tracking, and real-time chat
 */

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { getAuthToken } from '@/lib/authStorage';

const CollaborationContext = createContext();
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const SOCKET_IO_PATH = import.meta.env.VITE_SOCKET_IO_PATH || '/socket.io';

// Real-time collaboration events
export const COLLABORATION_EVENTS = {
  CODE_CHANGE: 'code_change',
  PERSONAL_CODE_CHANGE: 'personal_code_change',
  CURSOR_MOVE: 'cursor_move', 
  USER_TYPING: 'user_typing',
  CHAT_MESSAGE: 'chat_message',
  USER_JOIN: 'user_join',
  USER_LEAVE: 'user_leave',
  LANGUAGE_CHANGE: 'language_change',
  EXECUTION_START: 'execution_start',
  EXECUTION_RESULT: 'execution_result',
  TERMINAL_STARTED: 'terminal:started',
  TERMINAL_OUTPUT: 'terminal:output',
  TERMINAL_ERROR: 'terminal:error',
  TERMINAL_ENDED: 'terminal:ended'
};

export const CollaborationProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState(new Map());
  const [typingUsers, setTypingUsers] = useState(new Set());
  
  const queryClient = useQueryClient();
  const socketRef = useRef(null);
  const eventListeners = useRef(new Map());
  const typingTimeouts = useRef(new Map());
  const currentUser = useRef(null);
  const currentClassroom = useRef(null);
  const currentRoom = useRef({ roomId: null, roomType: 'classroom' });

  const parseMetadata = useCallback((metadata) => {
    if (!metadata) return {};
    if (typeof metadata === 'object') return metadata;

    try {
      return JSON.parse(metadata);
    } catch {
      return {};
    }
  }, []);

  const notifyListeners = useCallback((eventType, data) => {
    const listeners = eventListeners.current.get(eventType) || [];
    listeners.forEach(callback => callback(data));
  }, []);

  const clearTypingTimeout = useCallback((email) => {
    const timeoutId = typingTimeouts.current.get(email);
    if (timeoutId) {
      clearTimeout(timeoutId);
      typingTimeouts.current.delete(email);
    }
  }, []);

  const handleUserTyping = useCallback((event) => {
    const senderEmail = event?.sender_email;

    if (!senderEmail || senderEmail === currentUser.current?.email) {
      return;
    }

    setTypingUsers(prev => {
      const next = new Set(prev);
      next.add(senderEmail);
      return next;
    });

    clearTypingTimeout(senderEmail);
    const timeoutId = setTimeout(() => {
      setTypingUsers(prev => {
        const next = new Set(prev);
        next.delete(senderEmail);
        return next;
      });
      typingTimeouts.current.delete(senderEmail);
    }, 2500);

    typingTimeouts.current.set(senderEmail, timeoutId);
  }, [clearTypingTimeout]);

  const processRealtimeEvent = useCallback((event) => {
    if (!event?.type) {
      return;
    }

    const normalizedEvent = {
      ...event,
      metadata: parseMetadata(event.metadata)
    };

    if (normalizedEvent.type === COLLABORATION_EVENTS.USER_TYPING) {
      handleUserTyping(normalizedEvent);
    }

    if (normalizedEvent.type === COLLABORATION_EVENTS.CHAT_MESSAGE) {
      queryClient.invalidateQueries({ queryKey: ['classroomMessages', currentClassroom.current] });
    }

    notifyListeners(normalizedEvent.type, normalizedEvent);
  }, [handleUserTyping, notifyListeners, parseMetadata, queryClient]);

  const updatePresence = useCallback((participants = []) => {
    const map = new Map();

    participants.forEach((participant) => {
      if (!participant?.email) {
        return;
      }

      map.set(participant.email, {
        email: participant.email,
        name: participant.name || participant.full_name || participant.email,
        role: participant.role || 'student',
        lastSeen: Date.now()
      });
    });

    setActiveUsers(map);
  }, []);

  /**
   * Initialize collaboration session for a classroom
   */
  const connect = useCallback(async (classroomId, user, options = {}) => {
    if (!classroomId || !user) {
      return;
    }

    const token = getAuthToken();
    if (!token) {
      console.error('Cannot connect to collaboration without auth token');
      return;
    }

    const normalizedUser = {
      ...user,
      name: user.name || user.full_name || user.email,
      full_name: user.full_name || user.name || user.email
    };

    if (
      socketRef.current?.connected &&
      currentClassroom.current === classroomId &&
      currentUser.current?.email === normalizedUser.email
    ) {
      return;
    }

    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    currentClassroom.current = classroomId;
    currentUser.current = normalizedUser;
    currentRoom.current = {
      roomId: options.roomId || null,
      roomType: options.roomType || (options.roomId ? 'intervention' : 'classroom')
    };

    const socket = io(API_BASE_URL, {
      path: SOCKET_IO_PATH,
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('collaboration:join', {
        classroomId,
        roomId: currentRoom.current.roomId,
        roomType: currentRoom.current.roomType
      });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      setIsConnected(false);
      console.error('Socket.IO connection failed:', error.message);
    });

    socket.on('collaboration:presence', (payload) => {
      updatePresence(payload?.participants || []);
    });

    socket.on('collaboration:event', (event) => {
      processRealtimeEvent(event);
    });

    socket.on('collaboration:removed', (payload) => {
      notifyListeners('collaboration:removed', payload || {});
    });

    socket.on(COLLABORATION_EVENTS.TERMINAL_STARTED, (payload) => {
      notifyListeners(COLLABORATION_EVENTS.TERMINAL_STARTED, payload || {});
    });

    socket.on(COLLABORATION_EVENTS.TERMINAL_OUTPUT, (payload) => {
      notifyListeners(COLLABORATION_EVENTS.TERMINAL_OUTPUT, payload || {});
    });

    socket.on(COLLABORATION_EVENTS.TERMINAL_ERROR, (payload) => {
      notifyListeners(COLLABORATION_EVENTS.TERMINAL_ERROR, payload || {});
    });

    socket.on(COLLABORATION_EVENTS.TERMINAL_ENDED, (payload) => {
      notifyListeners(COLLABORATION_EVENTS.TERMINAL_ENDED, payload || {});
    });

    socket.on('collaboration:error', (payload) => {
      console.warn('Collaboration error:', payload?.message || payload);
    });

    socket.on('collaboration:joined', () => {
      notifyListeners(COLLABORATION_EVENTS.USER_JOIN, {
        sender_email: normalizedUser.email,
        sender_name: normalizedUser.full_name,
        metadata: { timestamp: Date.now() }
      });
    });
  }, [notifyListeners, processRealtimeEvent, updatePresence]);

  /**
   * Disconnect from collaboration session
   */
  const disconnect = useCallback(async () => {
    const socket = socketRef.current;

    if (socket) {
      try {
        if (socket.connected) {
          socket.emit('collaboration:leave');
        }
      } catch (error) {
        console.error('Failed to emit collaboration leave:', error);
      } finally {
        socket.removeAllListeners();
        socket.disconnect();
      }
    }

    socketRef.current = null;
    typingTimeouts.current.forEach((timeoutId) => clearTimeout(timeoutId));
    typingTimeouts.current.clear();

    setIsConnected(false);
    setActiveUsers(new Map());
    setTypingUsers(new Set());

    currentClassroom.current = null;
    currentRoom.current = { roomId: null, roomType: 'classroom' };
    currentUser.current = null;
  }, []);

  /**
   * Emit a collaboration event
   */
  const emit = useCallback(async (eventType, data) => {
    const socket = socketRef.current;

    if (!socket || !currentClassroom.current || !currentUser.current) {
      return;
    }

    const payload = {
      eventType,
      data: {
        ...data,
        timestamp: data?.timestamp || Date.now()
      }
    };

    socket.emit('collaboration:event', payload);

    const localEvent = {
      classroom_id: currentClassroom.current,
      sender_email: currentUser.current.email,
      sender_name: currentUser.current.full_name || currentUser.current.name,
      type: eventType,
      metadata: payload.data,
      created_date: new Date().toISOString()
    };

    if (eventType === COLLABORATION_EVENTS.USER_TYPING) {
      handleUserTyping(localEvent);
    }

    notifyListeners(eventType, localEvent);
  }, [handleUserTyping, notifyListeners]);

  /**
   * Subscribe to collaboration events
   */
  const on = useCallback((eventType, callback) => {
    if (!eventListeners.current.has(eventType)) {
      eventListeners.current.set(eventType, []);
    }
    eventListeners.current.get(eventType).push(callback);

    // Return unsubscribe function
    return () => {
      const listeners = eventListeners.current.get(eventType) || [];
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);

  /**
   * Sync code changes in real-time
   */
  const syncCode = useCallback(async (code, language, cursorPosition = 0) => {
    await emit(COLLABORATION_EVENTS.CODE_CHANGE, {
      code,
      language,
      cursorPosition,
      timestamp: Date.now()
    });
  }, [emit]);

  /**
   * Sync cursor position
   */
  const syncCursor = useCallback(async (position, selection) => {
    await emit(COLLABORATION_EVENTS.CURSOR_MOVE, {
      position,
      selection,
      timestamp: Date.now()
    });
  }, [emit]);

  /**
   * Send typing indicator
   */
  const sendTyping = useCallback(async () => {
    await emit(COLLABORATION_EVENTS.USER_TYPING, {
      timestamp: Date.now()
    });
  }, [emit]);

  const startTerminalExecution = useCallback((payload = {}) => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      return false;
    }

    socket.emit('terminal:start', payload);
    return true;
  }, []);

  const sendTerminalInput = useCallback((payload = {}) => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      return false;
    }

    socket.emit('terminal:input', payload);
    return true;
  }, []);

  const stopTerminalExecution = useCallback(() => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      return false;
    }

    socket.emit('terminal:stop');
    return true;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const contextValue = useMemo(() => ({
    // Connection state
    isConnected,
    activeUsers,
    typingUsers,

    // Connection methods
    connect,
    disconnect,

    // Event system
    emit,
    on,

    // Collaboration methods
    syncCode,
    syncCursor,
    sendTyping,
    startTerminalExecution,
    sendTerminalInput,
    stopTerminalExecution,

    // Constants
    COLLABORATION_EVENTS
  }), [
    activeUsers,
    connect,
    disconnect,
    emit,
    isConnected,
    on,
    sendTyping,
    sendTerminalInput,
    syncCode,
    syncCursor,
    startTerminalExecution,
    stopTerminalExecution,
    typingUsers
  ]);

  return (
    <CollaborationContext.Provider value={contextValue}>
      {children}
    </CollaborationContext.Provider>
  );
};

// Custom hook to use collaboration context
export const useCollaboration = () => {
  const context = useContext(CollaborationContext);
  if (!context) {
    throw new Error('useCollaboration must be used within a CollaborationProvider');
  }
  return context;
};

export default CollaborationContext;