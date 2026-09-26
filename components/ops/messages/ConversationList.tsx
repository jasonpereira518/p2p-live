/**
 * Manager-side conversation list with search and unread badges.
 */

import React from 'react';
import { Search } from 'lucide-react';
import { Avatar } from '../Avatar';
import { getRosterAvatar } from '../../../data/opsRoster';
import type { ChatConversation } from '../../../types/messaging';

interface ConversationListProps {
  conversations: ChatConversation[];
  activeId: string | null;
  search: string;
  onSearchChange: (s: string) => void;
  onSelect: (id: string) => void;
  onStartNew?: () => void;
}

function formatTimeAgo(ts?: number | null): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return new Date(ts).toLocaleDateString();
}

export function ConversationList({
  conversations,
  activeId,
  search,
  onSearchChange,
  onSelect,
  onStartNew,
}: ConversationListProps) {
  const filtered = conversations.filter((c) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      c.driverName.toLowerCase().includes(q) ||
      c.driverId.toLowerCase().includes(q) ||
      (c.lastMessagePreview || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 border-b border-gray-100 space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search drivers…"
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-p2p-blue focus:ring-2 focus:ring-p2p-blue/20 outline-none"
          />
        </div>
        {onStartNew && (
          <button
            type="button"
            onClick={onStartNew}
            className="w-full px-3 py-2 rounded-lg text-sm font-medium bg-p2p-blue/10 text-p2p-blue hover:bg-p2p-blue/20 focus:outline-none focus:ring-2 focus:ring-p2p-blue/30"
          >
            + New conversation
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">No conversations yet.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {filtered.map((c) => {
              const isActive = c.id === activeId;
              const unread = c.unreadCount;
              const avatar = getRosterAvatar(c.driverId);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    className={`w-full text-left px-3 py-3 flex items-start gap-3 hover:bg-gray-50 focus:outline-none focus:bg-gray-50 ${
                      isActive ? 'bg-p2p-blue/5' : ''
                    }`}
                  >
                    <Avatar src={avatar} alt={c.driverName} name={c.driverName} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p
                          className={`truncate text-sm ${
                            unread > 0 ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'
                          }`}
                        >
                          {c.driverName}
                        </p>
                        <span className="text-[11px] text-gray-400 shrink-0">
                          {formatTimeAgo(c.lastMessageAt ?? c.updatedAt)}
                        </span>
                      </div>
                      <p
                        className={`mt-0.5 text-xs truncate ${
                          unread > 0 ? 'text-gray-700 font-medium' : 'text-gray-500'
                        }`}
                      >
                        {c.lastMessagePreview || 'No messages yet'}
                      </p>
                    </div>
                    {unread > 0 && (
                      <span className="ml-2 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-p2p-red text-white text-xs font-bold shrink-0">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
