/**
 * Accessible modal: portal to document.body, backdrop, focus trap, Escape to close, restore focus.
 * Use for Edit Profile and other overlays so they sit above map and block background scroll/interaction.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

const BACKDROP_Z = 9998;
const MODAL_Z = 9999;

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  /** Optional: element that had focus before open (for restore). */
  triggerRef?: React.RefObject<HTMLElement | null>;
}

export function Modal({ open, onClose, title, children, triggerRef }: ModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    previousActiveRef.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    document.body.style.pointerEvents = 'none';
    const root = document.getElementById('root');
    if (root) root.style.pointerEvents = 'none';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
      if (root) root.style.pointerEvents = '';
      document.removeEventListener('keydown', handleKeyDown);
      const toFocus = triggerRef?.current ?? previousActiveRef.current;
      if (toFocus && typeof toFocus.focus === 'function') toFocus.focus();
    };
  }, [open, handleKeyDown, triggerRef]);

  if (!open) return null;

  const content = (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: BACKDROP_Z,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        overflow: 'auto',
        pointerEvents: 'auto',
        backgroundColor: 'rgba(0,0,0,0.5)',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          position: 'relative',
          zIndex: MODAL_Z,
          pointerEvents: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
