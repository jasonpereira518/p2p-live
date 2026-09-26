/**
 * Realtime hook for ops messaging.
 * Connects to Socket.IO using the current JWT, listens for message + typing events,
 * tracks connection state, and falls back to REST polling when the socket is down.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  ChatConversation,
  ChatMessage,
  ConnectionStatus,
  MessageStatus,
  TypingIndicator,
} from '../types/messaging';
import {
  fetchConversations,
  fetchMessages,
  generateClientMessageId,
  markConversationRead,
  sendMessage,
} from '../utils/messagesApi';
import { getAuthToken, REALTIME_URL } from '../utils/api';
import { getSession } from '../ops/auth';

const POLL_INTERVAL_MS = 7000;
const TYPING_TIMEOUT_MS = 3500;

export interface UseRealtimeMessagesOptions {
  enabled?: boolean;
  /** Filter for which conversation is "active" — drives messages-fetch + read receipts. */
  activeConversationId?: string | null;
  /** Whether the current user is online to send. */
  online?: boolean;
}

export interface UseRealtimeMessagesResult {
  status: ConnectionStatus;
  conversations: ChatConversation[];
  totalUnread: number;
  messagesByConversation: Record<string, ChatMessage[]>;
  typing: TypingIndicator[];
  reload: () => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  sendChatMessage: (conversationId: string, body: string) => Promise<ChatMessage | null>;
  markRead: (conversationId: string) => Promise<void>;
  emitTypingStart: (conversationId: string) => void;
  emitTypingStop: (conversationId: string) => void;
}

function dedupeMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  const byClientId = new Map<string, ChatMessage>();
  for (const m of existing) {
    byId.set(m.id, m);
    if (m.clientMessageId) byClientId.set(m.clientMessageId, m);
  }
  for (const m of incoming) {
    if (m.clientMessageId && byClientId.has(m.clientMessageId)) {
      const oldRef = byClientId.get(m.clientMessageId)!;
      byId.delete(oldRef.id);
    }
    byId.set(m.id, m);
    if (m.clientMessageId) byClientId.set(m.clientMessageId, m);
  }
  return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt);
}

export function useRealtimeMessages(opts: UseRealtimeMessagesOptions = {}): UseRealtimeMessagesResult {
  const { enabled = true, activeConversationId = null } = opts;
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, ChatMessage[]>>({});
  const [typing, setTyping] = useState<TypingIndicator[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const typingTimersRef = useRef<Record<string, number>>({});
  const activeConvRef = useRef<string | null>(activeConversationId);
  activeConvRef.current = activeConversationId;

  const loadConversations = useCallback(async () => {
    try {
      const data = await fetchConversations();
      setConversations(data.conversations);
      setTotalUnread(data.totalUnread);
    } catch (e) {
      // Silent — caller may not be authed; surface via status.
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    if (!conversationId) return;
    try {
      const data = await fetchMessages(conversationId, { limit: 200 });
      setMessagesByConversation((prev) => ({
        ...prev,
        [conversationId]: dedupeMessages(prev[conversationId] || [], data.messages),
      }));
    } catch (e) {
      /* ignore */
    }
  }, []);

  const reload = useCallback(async () => {
    await loadConversations();
    if (activeConvRef.current) await loadMessages(activeConvRef.current);
  }, [loadConversations, loadMessages]);

  // Polling loop runs whenever socket is not connected.
  useEffect(() => {
    if (!enabled) return;
    if (status === 'connected') {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }
    if (pollTimerRef.current) return;
    pollTimerRef.current = window.setInterval(() => {
      reload();
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [enabled, status, reload]);

  // Initial load.
  useEffect(() => {
    if (!enabled) return;
    reload();
  }, [enabled, reload]);

  // Reload messages when active conversation changes.
  useEffect(() => {
    if (!enabled) return;
    if (activeConversationId) loadMessages(activeConversationId);
  }, [enabled, activeConversationId, loadMessages]);

  // Socket lifecycle
  useEffect(() => {
    if (!enabled) {
      setStatus('disconnected');
      return;
    }
    const token = getAuthToken();
    if (!token) {
      setStatus('offline');
      return;
    }

    let socket: Socket;
    try {
      socket = io(REALTIME_URL || undefined, {
        path: '/socket.io',
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1500,
        reconnectionDelayMax: 8000,
        timeout: 8000,
      });
    } catch (e) {
      setStatus('disconnected');
      return;
    }

    socketRef.current = socket;
    setStatus('connecting');

    socket.on('connect', () => {
      setStatus('connected');
    });
    socket.on('disconnect', () => {
      setStatus('reconnecting');
    });
    socket.on('connect_error', () => {
      setStatus('reconnecting');
    });
    socket.on('reconnect_attempt', () => {
      setStatus('reconnecting');
    });
    socket.on('reconnect_failed', () => {
      setStatus('disconnected');
    });

    socket.on('connection:ready', () => {
      reload();
    });

    socket.on('message:new', (payload: { conversationId: string; message: ChatMessage; clientMessageId?: string }) => {
      if (!payload || !payload.conversationId || !payload.message) return;
      const incoming: ChatMessage = {
        ...payload.message,
        clientMessageId: payload.clientMessageId,
      };
      setMessagesByConversation((prev) => ({
        ...prev,
        [payload.conversationId]: dedupeMessages(prev[payload.conversationId] || [], [incoming]),
      }));
      // Refresh conversation summary so unread count and preview stay in sync.
      loadConversations();
      // Acknowledge delivery for messages we are about to display.
      if (activeConvRef.current === payload.conversationId) {
        socket.emit('message:delivered', {
          conversationId: payload.conversationId,
          messageIds: [incoming.id],
        });
      }
    });

    socket.on('message:delivered', (payload: { conversationId: string; messageIds: string[]; at: number }) => {
      if (!payload?.conversationId) return;
      setMessagesByConversation((prev) => {
        const list = prev[payload.conversationId];
        if (!list) return prev;
        const ids = new Set(payload.messageIds || []);
        const next = list.map((m) =>
          ids.has(m.id)
            ? {
                ...m,
                deliveredAt: m.deliveredAt ?? payload.at,
                status: m.status === 'sent' ? ('delivered' as MessageStatus) : m.status,
              }
            : m
        );
        return { ...prev, [payload.conversationId]: next };
      });
    });

    socket.on('message:read', (payload: { conversationId: string; readerRole: string; at: number }) => {
      if (!payload?.conversationId) return;
      setMessagesByConversation((prev) => {
        const list = prev[payload.conversationId];
        if (!list) return prev;
        const next = list.map((m) =>
          (payload.readerRole === 'driver' ? m.senderRole !== 'driver' : m.senderRole === 'driver')
            ? { ...m, readAt: m.readAt ?? payload.at, status: 'read' as MessageStatus }
            : m
        );
        return { ...prev, [payload.conversationId]: next };
      });
      loadConversations();
    });

    socket.on('typing:start', (payload: TypingIndicator) => {
      if (!payload?.conversationId || !payload.userId) return;
      const key = `${payload.conversationId}:${payload.userId}`;
      setTyping((prev) => {
        const filtered = prev.filter((t) => `${t.conversationId}:${t.userId}` !== key);
        return [...filtered, { ...payload, startedAt: Date.now() }];
      });
      if (typingTimersRef.current[key]) window.clearTimeout(typingTimersRef.current[key]);
      typingTimersRef.current[key] = window.setTimeout(() => {
        setTyping((prev) => prev.filter((t) => `${t.conversationId}:${t.userId}` !== key));
        delete typingTimersRef.current[key];
      }, TYPING_TIMEOUT_MS);
    });

    socket.on('typing:stop', (payload: { conversationId: string; userId: string }) => {
      if (!payload?.conversationId || !payload.userId) return;
      const key = `${payload.conversationId}:${payload.userId}`;
      setTyping((prev) => prev.filter((t) => `${t.conversationId}:${t.userId}` !== key));
      if (typingTimersRef.current[key]) {
        window.clearTimeout(typingTimersRef.current[key]);
        delete typingTimersRef.current[key];
      }
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      Object.values(typingTimersRef.current).forEach((t) => window.clearTimeout(t));
      typingTimersRef.current = {};
    };
  }, [enabled, loadConversations, reload]);

  const sendChatMessage = useCallback(
    async (conversationId: string, body: string): Promise<ChatMessage | null> => {
      const trimmed = body.trim();
      if (!trimmed) return null;
      const clientMessageId = generateClientMessageId();
      const now = Date.now();
      const session = getSession();
      const senderRole = (session?.user.role === 'manager' ? 'manager' : 'driver') as ChatMessage['senderRole'];
      const optimistic: ChatMessage = {
        id: clientMessageId,
        clientMessageId,
        conversationId,
        senderId: session?.user.id || 'me',
        senderName: session?.user.name || 'You',
        senderRole,
        body: trimmed,
        createdAt: now,
        status: 'sending',
        deliveredAt: null,
        readAt: null,
      };
      setMessagesByConversation((prev) => ({
        ...prev,
        [conversationId]: dedupeMessages(prev[conversationId] || [], [optimistic]),
      }));
      try {
        const data = await sendMessage(conversationId, trimmed, clientMessageId);
        const sent = { ...data.message, clientMessageId, status: 'sent' as MessageStatus };
        setMessagesByConversation((prev) => ({
          ...prev,
          [conversationId]: dedupeMessages(prev[conversationId] || [], [sent]),
        }));
        loadConversations();
        return sent;
      } catch (e) {
        setMessagesByConversation((prev) => {
          const list = prev[conversationId];
          if (!list) return prev;
          return {
            ...prev,
            [conversationId]: list.map((m) =>
              m.id === clientMessageId ? { ...m, status: 'failed' as MessageStatus } : m
            ),
          };
        });
        return null;
      }
    },
    [loadConversations]
  );

  const markRead = useCallback(
    async (conversationId: string) => {
      try {
        await markConversationRead(conversationId);
      } catch (_) {}
      loadConversations();
    },
    [loadConversations]
  );

  const emitTypingStart = useCallback((conversationId: string) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;
    socket.emit('typing:start', { conversationId });
  }, []);

  const emitTypingStop = useCallback((conversationId: string) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;
    socket.emit('typing:stop', { conversationId });
  }, []);

  return useMemo(
    () => ({
      status,
      conversations,
      totalUnread,
      messagesByConversation,
      typing,
      reload,
      loadMessages,
      sendChatMessage,
      markRead,
      emitTypingStart,
      emitTypingStop,
    }),
    [status, conversations, totalUnread, messagesByConversation, typing, reload, loadMessages, sendChatMessage, markRead, emitTypingStart, emitTypingStop]
  );
}
