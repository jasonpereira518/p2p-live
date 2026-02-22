/**
 * Admin Dashboard — tech metrics + Fleet, Counts, Who's Driving, Complaints, Team.
 * TODO: Replace mockOps with /api/ops/* endpoints.
 */

import React, { useState, useMemo } from 'react';
import { OpsLayout } from '../../ops/OpsLayout';
import {
  MOCK_SYSTEM_HEALTH,
  MOCK_LATENCY,
  MOCK_TRAFFIC,
  MOCK_ALERTS,
  MOCK_FLEET_STATUS_ROWS,
  MOCK_COUNTS_DATE,
  MOCK_COUNTS_ROWS,
  MOCK_COMPLAINTS,
  MOCK_ADMINS,
  MOCK_MANAGERS,
  MOCK_DRIVERS_TEAM,
  MOCK_STAT_ACTIVE_BUSES,
  MOCK_STAT_DRIVERS_LOGGED_IN,
  MOCK_STAT_BOARDINGS_TODAY,
  MOCK_STAT_NEW_COMPLAINTS,
  MOCK_STAT_OFF_ROUTE_BUSES,
} from '../../data/mockOps';
import { StatCard } from '../../components/ops/StatCard';
import { OpsTabs, type OpsTabId } from '../../components/ops/OpsTabs';
import { CapacityBar } from '../../components/ops/CapacityBar';
import { DriverSessionRow } from '../../components/ops/DriverSessionRow';
import { ComplaintCard } from '../../components/ops/ComplaintCard';
import { clearOpsLocalCache } from '../../storage/opsStorage';
import { getComplaintStates, setComplaintStatus, setComplaintInternalNote, getAllDriverShifts, getAllDriverNotes } from '../../storage/opsStorage';
import { getDriverDisplayName, getDriverAvatarUrl } from '../../storage/opsProfileStore';
import { getRosterName, getRosterAvatar } from '../../data/opsRoster';
import { Avatar } from '../../components/ops/Avatar';
import { Bus, Users, TrendingUp, AlertCircle, MapPin } from 'lucide-react';

const FEATURE_FLAG_KEY = 'p2p-ops-use-mock-data';

export function OpsAdminPage() {
  const [activeTab, setActiveTab] = useState<OpsTabId>('dashboard');
  const [useMockData, setUseMockData] = useState(() => localStorage.getItem(FEATURE_FLAG_KEY) !== 'false');
  const [cacheCleared, setCacheCleared] = useState(false);
  const [complaintStates, setComplaintStates] = useState(() => getComplaintStates());

  const unresolvedCount = useMemo(() => {
    return MOCK_COMPLAINTS.filter((c) => (complaintStates[c.id]?.status ?? 'new') !== 'resolved').length;
  }, [complaintStates]);

  const handleStatusChange = (complaintId: string, status: 'new' | 'in_progress' | 'resolved') => {
    setComplaintStatus(complaintId, status);
    setComplaintStates(getComplaintStates());
  };
  const handleNoteChange = (complaintId: string, note: string) => {
    setComplaintInternalNote(complaintId, note);
    setComplaintStates(getComplaintStates());
  };

  const allSessions = useMemo(() => {
    return getAllDriverShifts().map(({ driverId, shift }) => ({
      id: shift.id,
      driverName: getDriverDisplayName(driverId, getRosterName(driverId)),
      avatarUrl: getDriverAvatarUrl(driverId, getRosterAvatar(driverId)),
      busAssignment: `${shift.busId} · ${shift.routeName}`,
      status: (shift.clockOutAt ? 'ended' : 'active') as 'active' | 'ended',
      clockInAt: shift.clockInAt,
      clockOutAt: shift.clockOutAt,
      durationMs: shift.clockOutAt ? shift.clockOutAt - shift.clockInAt : undefined,
    }));
  }, [activeTab]); // re-compute when tab changes to refresh live duration

  const handleToggleMock = () => {
    const next = !useMockData;
    setUseMockData(next);
    localStorage.setItem(FEATURE_FLAG_KEY, String(next));
  };
  const handleClearCache = () => {
    if (window.confirm('Clear all ops-related localStorage (shifts, notes, session)?')) {
      clearOpsLocalCache();
      setCacheCleared(true);
      setTimeout(() => setCacheCleared(false), 3000);
    }
  };

  const health = MOCK_SYSTEM_HEALTH;
  const latency = MOCK_LATENCY;
  const traffic = MOCK_TRAFFIC;
  const alerts = MOCK_ALERTS;

  return (
    <OpsLayout title="Admin">
      <div className="flex flex-col h-full min-h-0 flex-1">
        <OpsTabs active={activeTab} onSelect={setActiveTab} complaintCount={unresolvedCount} />
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6 pb-8">
            {/* Stat cards (all tabs) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              <StatCard label="Active buses" value={MOCK_STAT_ACTIVE_BUSES} accent="blue" icon={<Bus size={24} />} />
              <StatCard label="Drivers logged in" value={MOCK_STAT_DRIVERS_LOGGED_IN} accent="green" icon={<Users size={24} />} />
              <StatCard label="Boardings today" value={MOCK_STAT_BOARDINGS_TODAY} accent="purple" icon={<TrendingUp size={24} />} />
              <StatCard label="New complaints" value={MOCK_STAT_NEW_COMPLAINTS} accent="red" icon={<AlertCircle size={24} />} />
              <StatCard label="Off-route buses" value={MOCK_STAT_OFF_ROUTE_BUSES} subtext="bus(es) off route" accent="amber" icon={<MapPin size={24} />} />
            </div>

            {activeTab === 'dashboard' && (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">System Health</h2>
                    <ul className="space-y-2 text-sm">
                      <li className="flex justify-between"><span className="text-gray-600">API status</span><span className="font-medium text-emerald-600">{health.apiStatus}</span></li>
                      <li className="flex justify-between"><span className="text-gray-600">Uptime</span><span className="font-medium text-gray-900">{health.uptimePercent}%</span></li>
                      <li className="text-gray-500 text-xs mt-2">Last incident: {new Date(health.lastIncidentAt).toLocaleString()}</li>
                      <li className="text-gray-600 text-xs">{health.lastIncidentMessage}</li>
                    </ul>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">Latency</h2>
                    <ul className="space-y-2 text-sm">
                      <li className="flex justify-between"><span className="text-gray-600">p50</span><span className="font-mono font-medium text-p2p-blue">{latency.p50Ms} ms</span></li>
                      <li className="flex justify-between"><span className="text-gray-600">p95</span><span className="font-mono font-medium">{latency.p95Ms} ms</span></li>
                      <li className="flex justify-between"><span className="text-gray-600">p99</span><span className="font-mono font-medium text-amber-600">{latency.p99Ms} ms</span></li>
                      <li className="flex justify-between"><span className="text-gray-600">Error rate</span><span className="font-medium">{latency.errorRatePercent}%</span></li>
                    </ul>
                    <div className="mt-3 h-8 flex items-end gap-0.5">
                      {latency.sparklineData.map((v, i) => (
                        <div key={i} className="flex-1 rounded-t bg-p2p-blue/60 min-w-[4px]" style={{ height: `${(v / 50) * 100}%` }} title={`${v} ms`} />
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">Traffic</h2>
                    <ul className="space-y-2 text-sm">
                      <li className="flex justify-between"><span className="text-gray-600">Active users</span><span className="font-medium">{traffic.activeUsers}</span></li>
                      <li className="flex justify-between"><span className="text-gray-600">Requests/min</span><span className="font-medium">{traffic.requestsPerMin}</span></li>
                    </ul>
                    <p className="text-xs font-medium text-gray-500 mt-3 mb-1">Top endpoints</p>
                    <ul className="space-y-1 text-xs">
                      {traffic.topEndpoints.map((e) => (
                        <li key={e.path} className="flex justify-between font-mono"><span className="text-gray-600 truncate">{e.path}</span><span>{e.count}</span></li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <h2 className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">Logs / Alerts</h2>
                  <ul className="divide-y divide-gray-50">
                    {alerts.map((a) => (
                      <li key={a.id} className="px-4 py-3 flex items-center gap-3">
                        <span className={`shrink-0 w-2 h-2 rounded-full ${a.severity === 'critical' ? 'bg-p2p-red' : a.severity === 'warning' ? 'bg-amber-500' : 'bg-p2p-blue'}`} />
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${a.severity === 'critical' ? 'bg-p2p-red/20 text-p2p-red' : a.severity === 'warning' ? 'bg-amber-500/20 text-amber-800' : 'bg-p2p-blue/20 text-p2p-blue'}`}>{a.severity}</span>
                        <span className="text-sm text-gray-700 flex-1">{a.message}</span>
                        <span className="text-xs text-gray-400">{new Date(a.at).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">Developer Tools</h2>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={useMockData} onChange={handleToggleMock} className="rounded border-gray-300 text-p2p-blue focus:ring-p2p-blue" />
                      <span className="text-sm font-medium text-gray-700">Use mock data</span>
                    </label>
                    <button type="button" onClick={handleClearCache} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-p2p-blue/30">Clear local cache</button>
                    {cacheCleared && <span className="text-sm text-green-600">Cache cleared.</span>}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'fleet' && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <h2 className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">Fleet status</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Bus</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Route · Run</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Capacity</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MOCK_FLEET_STATUS_ROWS.map((row) => (
                        <tr key={row.busId} className="border-b border-gray-50">
                          <td className="py-3 px-4 font-medium text-gray-900">{row.busLabel}</td>
                          <td className="py-3 px-4 text-gray-600">{row.routeName} · {row.runLabel}</td>
                          <td className="py-3 px-4 w-40"><CapacityBar current={row.capacityCurrent} max={row.capacityMax} /></td>
                          <td className="py-3 px-4">{row.isOffRoute ? <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-800">Off route</span> : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="px-4 py-3 text-xs text-gray-500 border-t border-gray-50">Bars show capacity; &apos;Off route&apos; indicates special runs (e.g. basketball, football).</p>
              </div>
            )}

            {activeTab === 'counts' && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <h2 className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">Counts · {new Date(MOCK_COUNTS_DATE).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Bus</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Route</th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700">Boardings</th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700">Alightings</th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700">Trips</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MOCK_COUNTS_ROWS.map((row) => (
                        <tr key={row.busId} className="border-b border-gray-50">
                          <td className="py-3 px-4 font-medium text-gray-900">{row.busId}</td>
                          <td className="py-3 px-4 text-gray-600">{row.routeName}</td>
                          <td className="py-3 px-4 text-right tabular-nums">{row.boardings}</td>
                          <td className="py-3 px-4 text-right tabular-nums">{row.alightings}</td>
                          <td className="py-3 px-4 text-right tabular-nums">{row.trips}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'driving' && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <h2 className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">Who&apos;s driving</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Driver</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Bus · Route</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allSessions.length === 0 ? (
                        <tr><td colSpan={4} className="py-8 px-4 text-center text-gray-500">No driver sessions yet. Clock in from the Driver dashboard.</td></tr>
                      ) : (
                        allSessions.map((s) => (
                          <DriverSessionRow key={s.id} driverName={s.driverName} busAssignment={s.busAssignment} status={s.status} clockInAt={s.clockInAt} clockOutAt={s.clockOutAt} durationMs={s.durationMs} avatarUrl={s.avatarUrl} />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'complaints' && (
              <div className="space-y-4">
                {MOCK_COMPLAINTS.map((c) => (
                  <ComplaintCard
                    key={c.id}
                    complaint={c}
                    status={complaintStates[c.id]?.status ?? 'new'}
                    internalNote={complaintStates[c.id]?.internalNote}
                    onStatusChange={handleStatusChange}
                    onInternalNoteChange={handleNoteChange}
                    reporterAvatarUrl={c.reporterId ? getDriverAvatarUrl(c.reporterId, getRosterAvatar(c.reporterId)) : undefined}
                  />
                ))}
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <h2 className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">Driver Notes</h2>
                {(() => {
                  const notes = getAllDriverNotes().map((n) => ({ ...n, driverName: getDriverDisplayName(n.driverId, getRosterName(n.driverId)) }));
                  return notes.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-gray-500">No driver notes yet.</p>
                  ) : (
                    <ul className="divide-y divide-gray-50">
                      {notes.map((n) => (
                        <li key={`${n.driverId}-${n.date}`} className="px-4 py-3">
                          <p className="font-medium text-gray-900">{n.driverName}</p>
                          <p className="text-xs text-gray-500">{n.date}</p>
                          <p className="text-sm text-gray-700 mt-1">{n.note.text}</p>
                          {n.note.tags?.length ? (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {n.note.tags.map((t) => (
                                <span key={t} className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">{t}</span>
                              ))}
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </div>
            )}

            {activeTab === 'team' && (
              <div className="grid gap-6 md:grid-cols-3">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-p2p-blue mb-3">Admins</h2>
                  <ul className="space-y-2">
                    {MOCK_ADMINS.map((m) => (
                      <li key={m.id} className="flex items-center gap-3">
                        <Avatar src={m.avatarUrl} alt={m.name} name={m.name} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900">{m.name}</p>
                          <p className="text-xs text-gray-500">{m.email}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-p2p-blue/20 text-p2p-blue shrink-0">Admin</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-600 mb-3">Managers</h2>
                  <ul className="space-y-2">
                    {MOCK_MANAGERS.map((m) => (
                      <li key={m.id} className="flex items-center gap-3">
                        <Avatar src={m.avatarUrl} alt={m.name} name={m.name} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900">{m.name}</p>
                          <p className="text-xs text-gray-500">{m.email}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-800 shrink-0">Manager</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-600 mb-3">Drivers</h2>
                  <ul className="space-y-2">
                    {MOCK_DRIVERS_TEAM.map((m) => (
                      <li key={m.id} className="flex items-center gap-3">
                        <Avatar src={getDriverAvatarUrl(m.id, m.avatarUrl)} alt={m.name} name={m.name} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900">{getDriverDisplayName(m.id, m.name)}</p>
                          <p className="text-xs text-gray-500">{m.email}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-800 shrink-0">Driver</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
        <footer className="shrink-0 px-4 py-2 bg-gray-100 border-t border-gray-200 text-center text-xs text-gray-500">
          P2P Admin · Demo data · UNC Late-Night Transportation
        </footer>
      </div>
    </OpsLayout>
  );
}
