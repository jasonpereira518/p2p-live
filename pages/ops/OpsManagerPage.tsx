/**
 * Manager Dashboard — Fleet, Counts, Who's Driving, Complaints, Team, Driver Notes.
 * TODO: Replace mock data with /api/ops/* endpoints.
 */

import React, { useState, useMemo } from 'react';
import { OpsLayout } from '../../ops/OpsLayout';
import {
  MOCK_FLEET_SUMMARY,
  MOCK_ACTIVE_ROUTES,
  MOCK_FLEET_STATUS,
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
  MOCK_RIDERSHIP,
} from '../../data/mockOps';
import { StatCard } from '../../components/ops/StatCard';
import { OpsTabs, type OpsTabId } from '../../components/ops/OpsTabs';
import { CapacityBar } from '../../components/ops/CapacityBar';
import { DriverSessionRow } from '../../components/ops/DriverSessionRow';
import { ComplaintCard } from '../../components/ops/ComplaintCard';
import { getAllDriverNotes, getComplaintStates, setComplaintStatus, setComplaintInternalNote, getAllDriverShifts } from '../../storage/opsStorage';
import { getDriverDisplayName, getDriverAvatarUrl } from '../../storage/opsProfileStore';
import { getRosterName, getRosterAvatar } from '../../data/opsRoster';
import { ComplaintsSummaryCard } from '../../components/ops/ComplaintsSummaryCard';
import { Avatar } from '../../components/ops/Avatar';
import { Bus, Users, TrendingUp, AlertCircle, MapPin } from 'lucide-react';
import { VEHICLES } from '../../data/mockTransit';

export function OpsManagerPage() {
  const [activeTab, setActiveTab] = useState<OpsTabId>('dashboard');
  const [complaintStates, setComplaintStates] = useState(() => getComplaintStates());
  const [flaggedNotes, setFlaggedNotes] = useState<Record<string, boolean>>({});
  const [noteSearch, setNoteSearch] = useState('');
  const [selectedNote, setSelectedNote] = useState<{ driverId: string; driverName: string; date: string; text: string; updatedAt: number; tags?: string[] } | null>(null);

  const unresolvedCount = useMemo(() => MOCK_COMPLAINTS.filter((c) => (complaintStates[c.id]?.status ?? 'new') !== 'resolved').length, [complaintStates]);

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
  }, [activeTab]);

  const allNotes = useMemo(() => getAllDriverNotes(), [activeTab]);
  const notesWithNames = allNotes.map((n) => ({ ...n, driverName: getDriverDisplayName(n.driverId, getRosterName(n.driverId)) }));
  const filteredNotes = noteSearch.trim()
    ? notesWithNames.filter((n) => n.note.text.toLowerCase().includes(noteSearch.toLowerCase()) || n.driverName.toLowerCase().includes(noteSearch.toLowerCase()))
    : notesWithNames;

  const toggleFlag = (key: string) => setFlaggedNotes((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <OpsLayout title="Manager">
      <div className="flex flex-col h-full min-h-0 flex-1">
        <OpsTabs active={activeTab} onSelect={setActiveTab} complaintCount={unresolvedCount} />
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6 pb-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              <StatCard label="Active buses" value={MOCK_STAT_ACTIVE_BUSES} accent="blue" icon={<Bus size={24} />} />
              <StatCard label="Drivers logged in" value={MOCK_STAT_DRIVERS_LOGGED_IN} accent="green" icon={<Users size={24} />} />
              <StatCard label="Boardings today" value={MOCK_STAT_BOARDINGS_TODAY} accent="purple" icon={<TrendingUp size={24} />} />
              <StatCard label="New complaints" value={MOCK_STAT_NEW_COMPLAINTS} accent="red" icon={<AlertCircle size={24} />} />
              <StatCard label="Off-route buses" value={MOCK_STAT_OFF_ROUTE_BUSES} subtext="bus(es) off route" accent="amber" icon={<MapPin size={24} />} />
            </div>

            {activeTab === 'dashboard' && (
              <>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">Live Fleet</h2>
                  <div className="flex flex-wrap items-center gap-4">
                    <p className="text-2xl font-bold text-gray-900">{MOCK_FLEET_SUMMARY.activeBuses} active buses</p>
                    <p className="text-sm text-gray-500">Last update: {new Date(MOCK_FLEET_SUMMARY.lastUpdateAt).toLocaleTimeString()}</p>
                    {MOCK_FLEET_SUMMARY.trackingStale && <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-800">Tracking stale</span>}
                  </div>
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <ul className="text-sm text-gray-600 space-y-1">
                      {VEHICLES.slice(0, 4).map((v) => (
                        <li key={v.id}>{v.id} · {v.routeName}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">Active Routes</h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    {MOCK_ACTIVE_ROUTES.map((r) => (
                      <div key={r.id} className="p-4 rounded-xl border border-gray-100 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-gray-900">{r.name}</p>
                          <p className="text-sm text-gray-500">{r.activeBuses} buses · {r.nextArrivalSummary}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-800">{r.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">Fleet Status</h2>
                    <ul className="space-y-2 text-sm">
                      <li className="flex justify-between"><span className="text-gray-600">In service</span><span className="font-medium text-emerald-600">{MOCK_FLEET_STATUS.inService}</span></li>
                      <li className="flex justify-between"><span className="text-gray-600">Out of service</span><span className="font-medium">{MOCK_FLEET_STATUS.outOfService}</span></li>
                      <li className="flex justify-between"><span className="text-gray-600">Maintenance</span><span className="font-medium">{MOCK_FLEET_STATUS.maintenance}</span></li>
                      <li className="flex justify-between"><span className="text-gray-600">Issues today</span><span className="font-medium">{MOCK_FLEET_STATUS.issuesReportedToday}</span></li>
                    </ul>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">Ridership (Boarded Today)</h2>
                    <p className="text-2xl font-bold text-p2p-blue">{MOCK_RIDERSHIP.totalBoardedToday}</p>
                    <ul className="mt-3 space-y-1 text-sm text-gray-600">
                      {MOCK_RIDERSHIP.byRoute.map((r) => (
                        <li key={r.routeName}>{r.routeName}: {r.boarded}</li>
                      ))}
                    </ul>
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
                        <tr><td colSpan={4} className="py-8 px-4 text-center text-gray-500">No driver sessions yet.</td></tr>
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
                <ComplaintsSummaryCard complaints={MOCK_COMPLAINTS} />
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
                <div className="p-4 border-b border-gray-50">
                  <input
                    type="search"
                    placeholder="Search notes..."
                    value={noteSearch}
                    onChange={(e) => setNoteSearch(e.target.value)}
                    className="w-full max-w-md px-3 py-2 rounded-lg border border-gray-200 focus:border-p2p-blue focus:ring-1 focus:ring-p2p-blue outline-none text-sm"
                  />
                </div>
                {filteredNotes.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-gray-500">No driver notes yet.</p>
                ) : (
                  <ul className="divide-y divide-gray-50">
                    {filteredNotes.map((n) => {
                      const key = `${n.driverId}-${n.date}`;
                      return (
                        <li
                          key={key}
                          className="px-4 py-3 flex items-start justify-between gap-3 cursor-pointer hover:bg-gray-50/50"
                          onClick={() => setSelectedNote({ ...n, text: n.note.text, updatedAt: n.note.updatedAt, tags: n.note.tags })}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-gray-900">{n.driverName}</p>
                            <p className="text-xs text-gray-500">{n.date} · {new Date(n.note.updatedAt).toLocaleString()}</p>
                            <p className="text-sm text-gray-700 mt-1 line-clamp-2">{n.note.text}</p>
                            {n.note.tags?.length ? (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {n.note.tags.map((t) => (
                                  <span key={t} className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">{t}</span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          <label className="shrink-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={!!flaggedNotes[key]} onChange={() => toggleFlag(key)} className="rounded border-gray-300 text-p2p-blue focus:ring-p2p-blue" />
                            <span className="text-xs text-gray-500">Flag</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
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
                          <p className="font-medium text-gray-900">{getDriverDisplayName(m.id, m.name)}</p>
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
      </div>

      {selectedNote && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setSelectedNote(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900">{selectedNote.driverName} · {selectedNote.date}</h3>
            <p className="text-xs text-gray-500 mt-1">Updated {new Date(selectedNote.updatedAt).toLocaleString()}</p>
            <p className="text-gray-700 mt-3 whitespace-pre-wrap">{selectedNote.text}</p>
            {selectedNote.tags?.length ? (
              <div className="flex flex-wrap gap-2 mt-3">
                {selectedNote.tags.map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-sm">{t}</span>
                ))}
              </div>
            ) : null}
            <button type="button" onClick={() => setSelectedNote(null)} className="mt-4 w-full py-2 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-p2p-blue/30">Close</button>
          </div>
        </div>
      )}
    </OpsLayout>
  );
}
