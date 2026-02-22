/**
 * Colorful stat card for Admin/Manager dashboards.
 */

import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
  accent?: 'blue' | 'green' | 'amber' | 'red' | 'purple';
}

const accentClasses = {
  blue: 'bg-p2p-blue/10 text-p2p-blue border-p2p-blue/20',
  green: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  amber: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  red: 'bg-p2p-red/10 text-p2p-red border-p2p-red/20',
  purple: 'bg-violet-500/10 text-violet-700 border-violet-500/20',
};

export function StatCard({ label, value, subtext, icon, accent = 'blue' }: StatCardProps) {
  return (
    <div className={`rounded-xl border p-4 sm:p-5 ${accentClasses[accent]} flex items-start justify-between gap-3`}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider opacity-80">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {subtext && <p className="text-xs mt-1 opacity-80">{subtext}</p>}
      </div>
      {icon && <div className="shrink-0 opacity-80">{icon}</div>}
    </div>
  );
}
