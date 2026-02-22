/**
 * Complaint card with status chip, reporter, time, description, and manager actions (status + internal note).
 */

import React, { useState } from 'react';
import { StatusChip } from './StatusChip';
import { Avatar } from './Avatar';
import type { ComplaintStatus } from '../../storage/opsStorage';
import type { MockComplaint } from '../../data/mockOps';

interface ComplaintCardProps {
  complaint: MockComplaint;
  status: ComplaintStatus;
  internalNote?: string;
  onStatusChange: (complaintId: string, status: ComplaintStatus) => void;
  onInternalNoteChange: (complaintId: string, note: string) => void;
  reporterAvatarUrl?: string;
}

const STATUS_OPTIONS: { value: ComplaintStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
];

function timeAgo(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

export function ComplaintCard({
  complaint,
  status,
  internalNote = '',
  onStatusChange,
  onInternalNoteChange,
  reporterAvatarUrl,
}: ComplaintCardProps) {
  const [noteInput, setNoteInput] = useState(internalNote);

  const handleBlur = () => {
    if (noteInput !== internalNote) onInternalNoteChange(complaint.id, noteInput);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-50">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold text-gray-900">{complaint.title}</h3>
          <StatusChip status={status} />
          {status === 'new' && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-800">new</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Avatar src={reporterAvatarUrl} alt={complaint.reporter} name={complaint.reporter} size="sm" />
          <p className="text-xs text-gray-500">
            {complaint.reporter} · {timeAgo(complaint.timestamp)}
          </p>
        </div>
        <p className="text-sm text-gray-700 mt-2">{complaint.notes}</p>
        <p className="text-xs text-gray-500 mt-1">{complaint.route} · {complaint.busId}</p>
      </div>
      <div className="p-4 bg-gray-50/50">
        <label className="block text-xs font-semibold text-gray-500 mb-2">Status</label>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onStatusChange(complaint.id, opt.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-p2p-blue/30 ${
                status === opt.value ? 'bg-p2p-blue text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <label className="block text-xs font-semibold text-gray-500 mt-3 mb-1">Internal note</label>
        <textarea
          value={noteInput}
          onChange={(e) => setNoteInput(e.target.value)}
          onBlur={handleBlur}
          placeholder="Add note (saved locally)..."
          rows={2}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-p2p-blue focus:ring-1 focus:ring-p2p-blue outline-none text-sm resize-none"
        />
      </div>
    </div>
  );
}
