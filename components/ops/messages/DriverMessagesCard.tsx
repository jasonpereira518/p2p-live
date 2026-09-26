/**
 * Driver-side messages widget. Shows the dispatch/manager thread, status, and a composer.
 * Does not store plaintext anywhere persistent on the client.
 */

import React, { useEffect, useMemo } from 'react';
import { MessageSquare, Wifi, WifiOff } from 'lucide-react';
import { useRealtimeMessages } from '../../../hooks/useRealtimeMessages';
import { ChatThread } from './ChatThread';
import { MessageComposer } from './MessageComposer';
import { getSession } from '../../../ops/auth';

const QUICK_ISSUES = ['GPS issue', 'Bus full', 'Running late', 'Need assistance'];

interface DriverMessagesCardProps {
  driverId: string;
  driverName?: string;
}

function statusDisplay(status: ReturnType<typeof useRealtimeMessages>['status']) {
  switch (status) {
    case 'connected':
      return { icon: <Wifi size={12} />, label: 'Connected', tone: 'text-emerald-600' };
    case 'connecting':
      return { icon: <Wifi size={12} className="animate-pulse" />, label: 'Connecting…', tone: 'text-gray-500' };
    case 'reconnecting':
      return { icon: <WifiOff size={12} />, label: 'Reconnecting…', tone: 'text-amber-600' };
    case 'offline':
      return { icon: <WifiOff size={12} />, label: 'Offline', tone: 'text-gray-500' };
    case 'disconnected':
    default:
      return { icon: <WifiOff size={12} />, label: 'Offline · using polling', tone: 'text-amber-600' };
  }
}

export function DriverMessagesCard({ driverId }: DriverMessagesCardProps) {
  const session = getSession();
  const conversationId = useMemo(() => `conv-driver-${driverId}`, [driverId]);
  const enabled = Boolean(session && session.user.role === 'driver');

  const {
    status,
    conversations,
    messagesByConversation,
    typing,
    sendChatMessage,
    markRead,
    emitTypingStart,
    emitTypingStop,
  } = useRealtimeMessages({ enabled, activeConversationId: conversationId });

  const conversation = conversations.find((c) => c.id === conversationId);
  const messages = messagesByConversation[conversationId] || [];
  const unread = conversation?.unreadCount ?? 0;
  const display = statusDisplay(status);

  useEffect(() => {
    if (!enabled) return;
    if (unread > 0) markRead(conversationId);
  }, [enabled, conversationId, unread, markRead]);

  const handleSend = async (body: string) => {
    await sendChatMessage(conversationId, body);
  };

  const offline = status !== 'connected';
  const filteredTyping = typing.filter((t) => t.conversationId === conversationId && t.userId !== driverId);

  if (!enabled) {
    return null;
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare size={16} className="text-p2p-blue shrink-0" />
          <h2 className="text-sm font-semibold text-gray-900">Dispatch / Manager</h2>
          {unread > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-p2p-red text-white text-xs font-bold">
              {unread}
            </span>
          )}
        </div>
        <div className={`flex items-center gap-1 text-xs ${display.tone}`}>
          {display.icon}
          <span>{display.label}</span>
        </div>
      </header>
      {offline && (
        <div className="px-4 py-1.5 text-[11px] bg-amber-50 text-amber-800 border-b border-amber-100">
          {status === 'reconnecting' ? 'Reconnecting…' : 'Live updates offline. Messages will be delivered when you reconnect.'}
        </div>
      )}
      <div className="flex flex-col h-[420px] max-h-[60vh]">
        <ChatThread
          messages={messages}
          viewerId={driverId}
          typing={filteredTyping}
          emptyText="No messages yet. Tap a quick issue or send a note to your manager."
          onRetry={(_clientId, body) => handleSend(body)}
        />
        <MessageComposer
          onSend={handleSend}
          onTypingStart={() => emitTypingStart(conversationId)}
          onTypingStop={() => emitTypingStop(conversationId)}
          quickReplies={QUICK_ISSUES}
          placeholder="Message dispatch…"
          helperText={
            offline
              ? 'Message will be delivered when manager is available.'
              : 'Encrypted in transit and at rest. Visible to ops managers.'
          }
        />
      </div>
    </section>
  );
}
