/**
 * Chat thread render — message bubbles + status chips, scrolls to bottom on new messages.
 * Stateless: takes a list of messages and the viewer id to align bubbles.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Check, CheckCheck, AlertCircle, Loader2 } from 'lucide-react';
import type { ChatMessage, MessageStatus, TypingIndicator } from '../../../types/messaging';

interface ChatThreadProps {
  messages: ChatMessage[];
  viewerId: string;
  typing?: TypingIndicator[];
  emptyText?: string;
  onRetry?: (clientMessageId: string, body: string) => void;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function StatusIcon({ status }: { status: MessageStatus }) {
  if (status === 'sending') return <Loader2 size={12} className="animate-spin" />;
  if (status === 'failed') return <AlertCircle size={12} className="text-p2p-red" />;
  if (status === 'read') return <CheckCheck size={12} className="text-emerald-500" />;
  if (status === 'delivered') return <CheckCheck size={12} className="text-gray-400" />;
  return <Check size={12} className="text-gray-400" />;
}

function bubbleColor(isMine: boolean, isSystem: boolean): string {
  if (isSystem) return 'bg-amber-50 text-amber-900 border border-amber-200';
  return isMine
    ? 'bg-p2p-blue text-white'
    : 'bg-gray-100 text-gray-900';
}

export function ChatThread({ messages, viewerId, typing = [], emptyText, onRetry }: ChatThreadProps) {
  const endRef = useRef<HTMLDivElement>(null);

  const grouped = useMemo(() => {
    const out: { date: string; items: ChatMessage[] }[] = [];
    let lastKey = '';
    for (const m of messages) {
      const d = new Date(m.createdAt);
      const key = d.toDateString();
      if (key !== lastKey) {
        out.push({ date: key, items: [m] });
        lastKey = key;
      } else {
        out[out.length - 1].items.push(m);
      }
    }
    return out;
  }, [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, typing.length]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-sm text-gray-500 p-6 text-center">
        {emptyText || 'No messages yet — start the conversation.'}
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2 bg-gray-50/30">
      {grouped.map((group) => (
        <div key={group.date}>
          <div className="text-center text-[11px] uppercase tracking-wider text-gray-400 my-3">
            {group.date}
          </div>
          <div className="space-y-2">
            {group.items.map((m) => {
              const isMine = m.senderId === viewerId;
              const isSystem = false;
              return (
                <div
                  key={m.id}
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 shadow-sm ${bubbleColor(isMine, isSystem)}`}>
                    {!isMine && (
                      <p className="text-[10px] uppercase tracking-wider opacity-60 mb-0.5">
                        {m.senderName}
                      </p>
                    )}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{m.body}</p>
                    <div
                      className={`mt-1 flex items-center gap-1 text-[10px] ${
                        isMine ? 'text-white/70 justify-end' : 'text-gray-400 justify-start'
                      }`}
                    >
                      <span>{formatTime(m.createdAt)}</span>
                      {isMine && (
                        <span className="ml-1 inline-flex items-center gap-0.5">
                          <StatusIcon status={m.status} />
                          {m.status === 'failed' && (
                            <button
                              type="button"
                              onClick={() => onRetry && m.clientMessageId && onRetry(m.clientMessageId, m.body)}
                              className="ml-1 text-p2p-red underline"
                            >
                              Retry
                            </button>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {typing.length > 0 && (
        <div className="flex justify-start">
          <div className="bg-gray-100 rounded-2xl px-3 py-2 text-sm text-gray-500 italic flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
            <span className="ml-1.5 text-xs">{typing[0].name || 'Someone'} typing…</span>
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
