/**
 * Capacity bar with optional "Near capacity" badge (>85%).
 */

import React from 'react';

interface CapacityBarProps {
  current: number;
  max: number;
  showBadge?: boolean;
  className?: string;
}

const NEAR_CAPACITY_THRESHOLD = 0.85;

export function CapacityBar({ current, max, showBadge = true, className = '' }: CapacityBarProps) {
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
  const nearCapacity = showBadge && max > 0 && current / max >= NEAR_CAPACITY_THRESHOLD;
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              pct >= 100 ? 'bg-p2p-red' : nearCapacity ? 'bg-amber-500' : 'bg-p2p-blue'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-sm font-medium text-gray-700 tabular-nums shrink-0">
          {current} / {max}
        </span>
      </div>
      {nearCapacity && (
        <span className="inline-block mt-1 text-xs font-semibold text-amber-700">Near capacity</span>
      )}
    </div>
  );
}
