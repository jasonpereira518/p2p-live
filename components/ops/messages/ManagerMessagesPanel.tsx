/**
 * Manager dashboard "Messages" tab: conversation list (left) + chat thread (right).
 * Supports starting a new conversation with any on-roster driver.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Wifi, WifiOff, Plus, ChevronLeft } from 'lucide-react';
import { useRealtimeMessages } from '../../../hooks/useRealtimeMessages';
import { ChatThread } from './ChatThread';
import { MessageComposer } from './MessageComposer';
import { ConversationList } from './ConversationList';
import { Avatar } from '../Avatar';
import { listDrivers } from '../../../ops/peopleStore';
import { getDriverAssignment } from '../../../storage/opsAssignments';
import { getDriverDisplayName, getDriverAvatarUrl } from '../../../storage/opsProfileStore';
import { getRosterAvatar } from '../../../data/opsRoster';
import { startConversationWithDriver } from '../../../utils/messagesApi';
import { getSession } from '../../../ops/auth';

const QUICK_REPLIES = [
  'Acknowledged',
  'On my way',
  'Please clarify',
  'Stand by',
];

interface ManagerMessagesPanelProps {
  active: boolean;
}

function statusDisplay(status: ReturnType<typeof useRealtimeMessages>['status']) {
  switch (status) {
    case 'connected':
      return { icon: <Wifi size={12} />, label: 'Live', tone: 'text-emerald-600' };
    case 'connecting':
      return { icon: <Wifi size={12} className="animate-pulse" />, label: 'Connecting…', tone: 'text-gray-500' };
    case 'reconnecting':
      return { icon: <WifiOff size={12} />, label: 'Reconnecting…', tone: 'text-amber-600' };
    case 'offline':
      return { icon: <WifiOff size={12} />, label: 'Offline', tone: 'text-gray-500' };
    default:
      return { icon: <WifiOff size={12} />, label: 'Polling', tone: 'text-amber-600' };
  }
}

export function ManagerMessagesPanel({ active }: ManagerMessagesPanelProps) {
  const session = getSession();
  const isManager = session?.user.role === 'manager';
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showStart, setShowStart] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<'list' | 'thread'>('list');

  const {
    status,
    conversations,
    messagesByConversation,
    typing,
    sendChatMessage,
    markRead,
    emitTypingStart,
    emitTypingStop,
    reload,
  } = useRealtimeMessages({
    enabled: active && isManager,
    activeConversationId,
  });

  useEffect(() => {
    if (!active) return;
    if (!activeConversationId && conversations.length > 0) {
      setActiveConversationId(conversations[0].id);
    }
  }, [active, conversations, activeConversationId]);

  const conversation = conversations.find((c) => c.id === activeConversationId) || null;
  const messages = activeConversationId ? messagesByConversation[activeConversationId] || [] : [];

  useEffect(() => {
    if (!active || !activeConversationId) return;
    const conv = conversations.find((c) => c.id === activeConversationId);
    if (conv && conv.unreadCount > 0) markRead(activeConversationId);
  }, [active, activeConversationId, conversations, markRead]);

  const handleSelect = (id: string) => {
    setActiveConversationId(id);
    setMobilePane('thread');
  };

  const handleSend = async (body: string) => {
    if (!activeConversationId) return;
    await sendChatMessage(activeConversationId, body);
  };

  const drivers = listDrivers();
  const assignmentByDriver = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of drivers) {
      try {
        const a = getDriverAssignment(d.id);
        if (a) map.set(d.id, `${a.busId} · ${a.routeName}`);
      } catch (_) {}
    }
    return map;
  }, [drivers]);

  const handleStartConversation = async (driverId: string, driverName: string) => {
    setStartError(null);
    try {
      const data = await startConversationWithDriver(driverId, driverName);
      setShowStart(false);
      setActiveConversationId(data.conversation.id);
      setMobilePane('thread');
      reload();
    } catch (e: any) {
      setStartError(e?.message || 'Could not start conversation');
    }
  };

  const display = statusDisplay(status);
  const offline = status !== 'connected';
  const filteredTyping = activeConversationId
    ? typing.filter((t) => t.conversationId === activeConversationId && t.userId !== session?.user.id)
    : [];

  if (!isManager) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 text-sm text-gray-500">
        Messaging is available to managers only.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Messages</h2>
          <p className="text-xs text-gray-500">
            Encrypted in transit and at rest. Drivers ↔ Manager / Dispatch.
          </p>
        </div>
        <div className={`flex items-center gap-1 text-xs ${display.tone}`}>
          {display.icon}
          <span>{display.label}</span>
        </div>
      </div>
      {offline && (
        <div className="px-4 py-1.5 text-[11px] bg-amber-50 text-amber-800 border-b border-amber-100">
          {status === 'reconnecting'
            ? 'Reconnecting realtime channel… falling back to polling.'
            : 'Realtime offline. Showing polled updates every few seconds.'}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] h-[600px] max-h-[80vh]">
        <div
          className={`border-r border-gray-100 bg-gray-50/30 min-h-0 ${
            mobilePane === 'list' ? 'block' : 'hidden md:block'
          }`}
        >
          <ConversationList
            conversations={conversations}
            activeId={activeConversationId}
            search={search}
            onSearchChange={setSearch}
            onSelect={handleSelect}
            onStartNew={() => setShowStart(true)}
          />
        </div>
        <div className={`flex flex-col min-h-0 ${mobilePane === 'thread' ? 'block' : 'hidden md:flex'}`}>
          {conversation ? (
            <>
              <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                <button
                  type="button"
                  onClick={() => setMobilePane('list')}
                  className="md:hidden p-1 -ml-1 rounded hover:bg-gray-100"
                  aria-label="Back to list"
                >
                  <ChevronLeft size={18} />
                </button>
                <Avatar
                  src={getDriverAvatarUrl(conversation.driverId, getRosterAvatar(conversation.driverId))}
                  alt={conversation.driverName}
                  name={conversation.driverName}
                  size="md"
                />
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {getDriverDisplayName(conversation.driverId, conversation.driverName)}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {assignmentByDriver.get(conversation.driverId) || 'Driver'}
                  </p>
                </div>
              </header>
              <ChatThread
                messages={messages}
                viewerId={session?.user.id || ''}
                typing={filteredTyping}
                emptyText="No messages yet."
                onRetry={(_id, body) => handleSend(body)}
              />
              <MessageComposer
                onSend={handleSend}
                onTypingStart={() => activeConversationId && emitTypingStart(activeConversationId)}
                onTypingStop={() => activeConversationId && emitTypingStop(activeConversationId)}
                quickReplies={QUICK_REPLIES}
                placeholder={`Message ${conversation.driverName}…`}
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-sm text-gray-500 p-6 text-center">
              <p>Select a conversation to start.</p>
              <button
                type="button"
                onClick={() => setShowStart(true)}
                className="mt-3 inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-p2p-blue text-white text-sm font-semibold"
              >
                <Plus size={14} /> New conversation
              </button>
            </div>
          )}
        </div>
      </div>

      {showStart && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowStart(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-gray-900 mb-3">Start a conversation</h3>
            {startError && (
              <p className="text-sm text-p2p-red bg-p2p-light-red/30 rounded px-2 py-1 mb-2">{startError}</p>
            )}
            <ul className="max-h-80 overflow-y-auto divide-y divide-gray-50 -mx-2">
              {drivers.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => handleStartConversation(d.id, d.fullName)}
                    className="w-full text-left flex items-center gap-3 px-2 py-2.5 hover:bg-gray-50 rounded-lg"
                  >
                    <Avatar src={d.avatarUrl} alt={d.fullName} name={d.fullName} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{d.fullName}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {assignmentByDriver.get(d.id) || d.email}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowStart(false)}
                className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
