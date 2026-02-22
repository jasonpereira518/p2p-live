/**
 * Status chip/badge for complaints, sessions, etc.
 */

import React from 'react';

type Variant = 'new' | 'in_progress' | 'resolved' | 'active' | 'ended' | 'on-time' | 'warning' | 'critical';

const variantClasses: Record<Variant, string> = {
  new: 'bg-amber-500/20 text-amber-800 border-amber-500/30',
  in_progress: 'bg-p2p-blue/20 text-p2p-blue border-p2p-blue/30',
  resolved: 'bg-emerald-500/20 text-emerald-800 border-emerald-500/30',
  active: 'bg-emerald-500/20 text-emerald-800 border-emerald-500/30',
  ended: 'bg-gray-200 text-gray-700 border-gray-300',
  'on-time': 'bg-emerald-500/20 text-emerald-800 border-emerald-500/30',
  warning: 'bg-amber-500/20 text-amber-800 border-amber-500/30',
  critical: 'bg-p2p-red/20 text-p2p-red border-p2p-red/30',
};

interface StatusChipProps {
  status: Variant | string;
  label?: string;
}

function getClass(status: string): string {
  if (status in variantClasses) return variantClasses[status as Variant];
  return 'bg-gray-100 text-gray-700 border-gray-200';
}

export function StatusChip({ status, label }: StatusChipProps) {
  const display = label ?? (status === 'in_progress' ? 'In progress' : status.replace('_', ' '));
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border capitalize ${getClass(status)}`}>
      {display}
    </span>
  );
}
