/**
 * Single row for "Who's Driving" table: driver, bus, status, duration (live for active).
 */

import React from 'react';
import { StatusChip } from './StatusChip';
import { Avatar } from './Avatar';

interface DriverSessionRowProps {
  driverName: string;
  busAssignment: string;
  status: 'active' | 'ended';
  clockInAt: number;
  clockOutAt?: number | null;
  durationMs?: number;
  avatarUrl?: string;
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function DriverSessionRow({
  driverName,
  busAssignment,
  status,
  clockInAt,
  clockOutAt,
  durationMs,
  avatarUrl,
}: DriverSessionRowProps) {
  const duration =
    durationMs ?? (clockOutAt != null ? clockOutAt - clockInAt : Date.now() - clockInAt);
  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50">
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <Avatar src={avatarUrl} alt={driverName} name={driverName} size="sm" />
          <span className="font-medium text-gray-900">{driverName}</span>
        </div>
      </td>
      <td className="py-3 px-4 text-gray-600">{busAssignment}</td>
      <td className="py-3 px-4">
        <StatusChip status={status} />
      </td>
      <td className="py-3 px-4 text-gray-600 tabular-nums">
        {status === 'active' ? (
          <span className="text-p2p-blue font-medium">{formatDuration(duration)}</span>
        ) : (
          formatDuration(duration)
        )}
      </td>
    </tr>
  );
}
