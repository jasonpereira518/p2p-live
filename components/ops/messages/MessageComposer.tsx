/**
 * Composer with quick-reply chips, optimistic-send wiring, and typing indicators.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';

interface MessageComposerProps {
  onSend: (body: string) => Promise<unknown> | void;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  disabled?: boolean;
  quickReplies?: string[];
  placeholder?: string;
  helperText?: string;
}

const TYPING_STOP_DELAY_MS = 1200;

export function MessageComposer({
  onSend,
  onTypingStart,
  onTypingStop,
  disabled,
  quickReplies = [],
  placeholder = 'Type a message…',
  helperText,
}: MessageComposerProps) {
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const stopTypingTimer = useRef<number | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (stopTypingTimer.current) window.clearTimeout(stopTypingTimer.current);
      if (isTypingRef.current) onTypingStop && onTypingStop();
    };
  }, [onTypingStop]);

  const triggerTyping = () => {
    if (!onTypingStart) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      onTypingStart();
    }
    if (stopTypingTimer.current) window.clearTimeout(stopTypingTimer.current);
    stopTypingTimer.current = window.setTimeout(() => {
      isTypingRef.current = false;
      onTypingStop && onTypingStop();
    }, TYPING_STOP_DELAY_MS);
  };

  const submit = async (text: string) => {
    const body = text.trim();
    if (!body || sending || disabled) return;
    setSending(true);
    try {
      if (stopTypingTimer.current) window.clearTimeout(stopTypingTimer.current);
      if (isTypingRef.current) {
        isTypingRef.current = false;
        onTypingStop && onTypingStop();
      }
      await onSend(body);
      setValue('');
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit(value);
  };

  return (
    <div className="border-t border-gray-100 bg-white px-3 pt-2 pb-3">
      {quickReplies.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {quickReplies.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => submit(q)}
              disabled={disabled || sending}
              className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-p2p-blue/30 disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            triggerTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit(value);
            }
          }}
          rows={1}
          disabled={disabled || sending}
          placeholder={placeholder}
          className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-p2p-blue focus:ring-2 focus:ring-p2p-blue/20 outline-none max-h-32 disabled:bg-gray-50 disabled:text-gray-400"
        />
        <button
          type="submit"
          disabled={disabled || sending || !value.trim()}
          aria-label="Send message"
          className="p-2.5 rounded-xl bg-p2p-blue text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-p2p-blue/90 focus:outline-none focus:ring-2 focus:ring-p2p-blue focus:ring-offset-2"
        >
          <Send size={16} />
        </button>
      </form>
      {helperText && <p className="text-[11px] text-gray-500 mt-1.5">{helperText}</p>}
    </div>
  );
}
