/**
 * Enhanced Real-Time Collaboration Context
 * Provides real-time collaboration functionality
 * Supports live code syncing, cursor tracking, and real-time chat
 */

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const CollaborationContext = createContext();

// Real-time collaboration events
export const COLLABORATION_EVENTS = {
  CODE_CHANGE: 'code_change',
  CURSOR_MOVE: 'cursor_move', 
  USER_TYPING: 'user_typing',
  CHAT_MESSAGE: 'chat_message',
  USER_JOIN: 'user_join',
  USER_LEAVE: 'user_leave',
  LANGUAGE_CHANGE: 'language_change',
  EXECUTION_START: 'execution_start',
  EXECUTION_RESULT: 'execution_result'
};

export const CollaborationProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState(new Map());
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [lastSeen, setLastSeen] = useState(Date.now());
  
  const queryClient = useQueryClient();
  const pollInterval = useRef(null);
  const heartbeatInterval = useRef(null);
  const eventListeners = useRef(new Map());
  const currentUser = useRef(null);
  const currentClassroom = useRef(null);
  
  // Enhanced polling mechanism (much faster than 6s)
  const POLL_INTERVAL = 1500; // 1.5 seconds for near real-time
  const HEARTBEAT_INTERVAL = 10000; // 10 seconds
  const USER_TIMEOUT = 30000; // 30 seconds to consider user offline

  /**
   * Initialize collaboration session for a classroom
   */
  const connect = useCallback(async (classroomId, user) => {
    if (!classroomId || !user) return;

    currentClassroom.current = classroomId;
    currentUser.current = user;
    
    try {
      // TODO: Replace with actual backend API call
      console.log('User joined:', {
        classroom_id: classroomId,
        sender_email: user.email,
        sender_name: user.full_name,
        message: `${user.full_name} joined the session`,
        type: 'system_join',
        metadata: JSON.stringify({
          user_id: user.email,
          timestamp: Date.now(),
          action: 'join'
        })
      });

      setIsConnected(true);
      startPolling();
      startHeartbeat();
      
      emit(COLLABORATION_EVENTS.USER_JOIN, {
        user: user,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('Failed to connect to collaboration session:', error);
    }
  }, []);

  /**
   * Disconnect from collaboration session
   */
  const disconnect = useCallback(async () => {
    if (!currentClassroom.current || !currentUser.current) return;

    try {
      // TODO: Replace with actual backend API call
      console.log('User left:', {
        classroom_id: currentClassroom.current,
        sender_email: currentUser.current.email,
        sender_name: currentUser.current.full_name,
        message: `${currentUser.current.full_name} left the session`,
        type: 'system_leave',
        metadata: JSON.stringify({
          user_id: currentUser.current.email,
          timestamp: Date.now(),
          action: 'leave'
        })
      });

    } catch (error) {
      console.error('Failed to send leave message:', error);
    }

    stopPolling();
    stopHeartbeat();
    setIsConnected(false);
    setActiveUsers(new Map());
    setTypingUsers(new Set());
    
    currentClassroom.current = null;
    currentUser.current = null;
  }, []);

  /**
   * Start enhanced polling for real-time updates
   */
  const startPolling = useCallback(() => {
    if (pollInterval.current) return;

    const poll = async () => {
      if (!currentClassroom.current) return;

      try {
        // Get recent messages and presence updates (mock)
        const messages = [];

        // Parse recent events
        const recentEvents = messages
          .filter(msg => new Date(msg.created_date).getTime() > lastSeen)
          .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));

        recentEvents.forEach(event => {
          processRealtimeEvent(event);
        });

        if (recentEvents.length > 0) {
          setLastSeen(Date.now());
        }

        // Update active users based on recent activity
        updateActiveUsers(messages);

      } catch (error) {
        console.error('Polling error:', error);
      }
    };

    poll(); // Initial poll
    pollInterval.current = setInterval(poll, POLL_INTERVAL);
  }, []);

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
      pollInterval.current = null;
    }
  }, []);

  /**
   * Start heartbeat to maintain presence
   */
  const startHeartbeat = useCallback(() => {
    if (heartbeatInterval.current) return;

    const sendHeartbeat = async () => {
      if (!currentClassroom.current || !currentUser.current) return;

      try {
        // Mock heartbeat - disabled
        console.log('Heartbeat disabled - collaboration features not available');
      } catch (error) {
        console.error('Heartbeat error:', error);
      }
    };

    heartbeatInterval.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
  }, []);

  /**
   * Stop heartbeat
   */
  const stopHeartbeat = useCallback(() => {
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
      heartbeatInterval.current = null;
    }
  }, []);

  /**
   * Process real-time events from polling
   */
  const processRealtimeEvent = useCallback((event) => {
    const eventType = event.type;
    const data = {
      ...event,
      metadata: event.metadata ? JSON.parse(event.metadata) : {}
    };

    // Emit to registered listeners
    const listeners = eventListeners.current.get(eventType) || [];
    listeners.forEach(callback => callback(data));

    // Handle specific event types
    switch (eventType) {
      case 'code_sync':
        queryClient.invalidateQueries({ queryKey: ['classroomCode'] });
        break;
      case 'text':
        queryClient.invalidateQueries({ queryKey: ['classroomMessages'] });
        break;
      case 'user_typing':
        handleUserTyping(data);
        break;
    }
  }, [queryClient]);

  /**
   * Handle user typing indicators
   */
  const handleUserTyping = useCallback((data) => {
    const { sender_email } = data;
    if (sender_email === currentUser.current?.email) return;

    setTypingUsers(prev => {
      const newSet = new Set(prev);
      newSet.add(sender_email);
      return newSet;
    });

    // Clear typing indicator after 3 seconds
    setTimeout(() => {
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(sender_email);
        return newSet;
      });
    }, 3000);
  }, []);

  /**
   * Update active users based on recent messages
   */
  const updateActiveUsers = useCallback((messages) => {
    const now = Date.now();
    const activeUserMap = new Map();

    // Get recent activity (last 5 minutes)
    const recentActivity = messages.filter(msg => {
      const msgTime = new Date(msg.created_date).getTime();
      return now - msgTime < USER_TIMEOUT;
    });

    recentActivity.forEach(msg => {
      if (msg.sender_email && msg.sender_name) {
        activeUserMap.set(msg.sender_email, {
          email: msg.sender_email,
          name: msg.sender_name,
          lastSeen: new Date(msg.created_date).getTime(),
          isTyping: typingUsers.has(msg.sender_email)
        });
      }
    });

    setActiveUsers(activeUserMap);
  }, [typingUsers]);

  /**
   * Emit a collaboration event
   */
  const emit = useCallback(async (eventType, data) => {
    if (!currentClassroom.current || !currentUser.current) return;

    try {
      const eventData = {
        classroom_id: currentClassroom.current,
        sender_email: currentUser.current.email,
        sender_name: currentUser.current.full_name,
        message: data.message || JSON.stringify(data),
        type: eventType,
        metadata: JSON.stringify({
          ...data,
          timestamp: Date.now(),
          user_id: currentUser.current.email
        })
      };

      // Mock event creation - disabled
      console.log('Event emission disabled:', eventType, data);
      
      // Immediately notify local listeners
      const listeners = eventListeners.current.get(eventType) || [];
      listeners.forEach(callback => callback({ ...eventData, metadata: data }));

    } catch (error) {
      console.error('Failed to emit event:', error);
    }
  }, []);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const contextValue = {
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
    
    // Constants
    COLLABORATION_EVENTS
  };

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