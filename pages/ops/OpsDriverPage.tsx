/**
 * Driver Dashboard — mobile-first: assignment, clock in/out, shift history, daily notes.
 * TODO: Replace mock assignment with /api/ops/assignments; persist shifts/notes via API.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { OpsLayout } from '../../ops/OpsLayout';
import { getMockAssignment } from '../../data/mockAssignments';
import {
  getDriverShifts,
  addShift,
  updateShift,
  deleteShift,
  setDriverDailyNote,
  getDriverDailyNote,
  type Shift,
} from '../../storage/opsStorage';
import { getDriverProfile, setDriverProfile, type DriverProfile } from '../../storage/opsProfileStore';
import { getRosterPerson } from '../../data/opsRoster';
import { getSession } from '../../ops/auth';
import { DriverLocationMap } from '../../components/ops/DriverLocationMap';
import { Modal } from '../../components/ops/Modal';
import { User } from 'lucide-react';

const NOTE_DEBOUNCE_MS = 500;
const NOTE_TAGS = ['GPS issue', 'Overcrowding', 'Detour', 'Maintenance', 'Other'];

function generateId(): string {
  return `shift-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function OpsDriverPage() {
  const session = getSession();
  const driverId = session?.user.id ?? '';
  const assignment = getMockAssignment(driverId);

  const [shifts, setShifts] = useState<Shift[]>(() => getDriverShifts(driverId));
  const [clockedInShift, setClockedInShift] = useState<Shift | null>(() => {
    const list = getDriverShifts(driverId);
    return list.find((s) => !s.clockOutAt) ?? null;
  });
  const [elapsed, setElapsed] = useState(0);
  const [notes, setNotes] = useState('');
  const [noteTags, setNoteTags] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const profileButtonRef = React.useRef<HTMLButtonElement>(null);
  const [profileForm, setProfileForm] = useState<DriverProfile>(() => {
    const p = getDriverProfile(driverId);
    const roster = getRosterPerson(driverId);
    return p ?? {
      fullName: roster?.fullName ?? session?.user.name ?? driverId,
      displayName: undefined,
      phone: undefined,
      avatarUrl: roster?.avatarUrl,
      bio: undefined,
      updatedAt: Date.now(),
    };
  });

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (driverId && !getDriverProfile(driverId)) {
      const roster = getRosterPerson(driverId);
      if (roster) setDriverProfile(driverId, { fullName: roster.fullName, avatarUrl: roster.avatarUrl, updatedAt: Date.now() });
    }
  }, [driverId]);

  const refreshProfileForm = useCallback(() => {
    const p = getDriverProfile(driverId);
    const roster = getRosterPerson(driverId);
    setProfileForm(p ?? {
      fullName: roster?.fullName ?? session?.user.name ?? driverId,
      displayName: undefined,
      phone: undefined,
      avatarUrl: roster?.avatarUrl,
      bio: undefined,
      updatedAt: Date.now(),
    });
  }, [driverId, session?.user.name]);

  // Load persisted note for today
  useEffect(() => {
    const stored = getDriverDailyNote(driverId, today);
    if (stored) {
      setNotes(stored.text);
      setNoteTags(stored.tags ?? []);
    }
  }, [driverId, today]);

  // Persist notes (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      if (notes.trim() || noteTags.length > 0) {
        setDriverDailyNote(driverId, today, {
          text: notes,
          updatedAt: Date.now(),
          tags: noteTags.length ? noteTags : undefined,
        });
      }
    }, NOTE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [driverId, today, notes, noteTags]);

  // Elapsed timer when clocked in
  useEffect(() => {
    if (!clockedInShift) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - clockedInShift.clockInAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [clockedInShift]);

  const handleClockIn = useCallback(() => {
    const now = Date.now();
    const shift: Shift = {
      id: generateId(),
      driverId,
      routeName: assignment.routeName,
      busId: assignment.busId,
      clockInAt: now,
      clockOutAt: null,
      createdAt: now,
    };
    addShift(driverId, shift);
    setClockedInShift(shift);
    setShifts(getDriverShifts(driverId));
  }, [driverId, assignment.routeName, assignment.busId]);

  const handleClockOut = useCallback(() => {
    if (!clockedInShift) return;
    const now = Date.now();
    updateShift(driverId, clockedInShift.id, { clockOutAt: now });
    setClockedInShift(null);
    setElapsed(0);
    setShifts(getDriverShifts(driverId));
  }, [driverId, clockedInShift]);

  const handleDeleteShift = useCallback((shiftId: string) => {
    deleteShift(driverId, shiftId);
    setShifts(getDriverShifts(driverId));
    if (clockedInShift?.id === shiftId) setClockedInShift(null);
    setDeleteConfirm(null);
  }, [driverId, clockedInShift]);

  const toggleTag = (tag: string) => {
    setNoteTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const formatElapsed = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const handleSaveProfile = () => {
    setDriverProfile(driverId, profileForm);
    setProfileModalOpen(false);
  };

  const avatarPresets = [
    'https://randomuser.me/api/portraits/men/12.jpg',
    'https://randomuser.me/api/portraits/women/23.jpg',
    'https://randomuser.me/api/portraits/men/32.jpg',
    'https://randomuser.me/api/portraits/women/41.jpg',
    'https://randomuser.me/api/portraits/men/67.jpg',
  ];

  return (
    <OpsLayout title="Driver">
      <div className="max-w-lg mx-auto p-4 pb-12">
        <div className="flex items-center justify-between mb-4">
          <span className="text-lg font-semibold text-gray-900">Driver</span>
          <button
            ref={profileButtonRef}
            type="button"
            onClick={() => { refreshProfileForm(); setProfileModalOpen(true); }}
            className="p-2 rounded-xl bg-p2p-light-blue/50 text-p2p-blue hover:bg-p2p-light-blue/70 focus:outline-none focus:ring-2 focus:ring-p2p-blue"
            aria-label="Edit profile"
          >
            <User size={22} />
          </button>
        </div>
        {/* Today's Assignment */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">Today&apos;s Assignment</h2>
          <p className="font-bold text-gray-900 text-lg">{assignment.routeName}</p>
          <p className="text-gray-600">{assignment.busId}</p>
          <p className="text-sm text-gray-500 mt-1">Shift: {assignment.shiftStartWindow}</p>
          <p className="text-sm text-gray-500">Contact: {assignment.managerContact}</p>
        </section>

        {/* Clock In / Out */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">Shift</h2>
          <div className="flex gap-3">
            {!clockedInShift ? (
              <button
                type="button"
                onClick={handleClockIn}
                className="flex-1 py-4 rounded-xl bg-p2p-blue text-white font-bold text-lg focus:outline-none focus:ring-2 focus:ring-p2p-blue focus:ring-offset-2 active:scale-[0.98]"
              >
                Clock In
              </button>
            ) : (
              <button
                type="button"
                onClick={handleClockOut}
                className="flex-1 py-4 rounded-xl bg-p2p-red text-white font-bold text-lg focus:outline-none focus:ring-2 focus:ring-p2p-red focus:ring-offset-2 active:scale-[0.98]"
              >
                Clock Out
              </button>
            )}
          </div>
          {clockedInShift && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-500">Clocked in at {new Date(clockedInShift.clockInAt).toLocaleTimeString()}</p>
              <p className="text-xl font-bold text-p2p-blue mt-1 font-mono tabular-nums">{formatElapsed(elapsed)}</p>
            </div>
          )}
        </section>

        {/* My Location map widget */}
        <section className="mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-2">My Location</h2>
          <DriverLocationMap height={260} />
        </section>

        {/* Shift History */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          <h2 className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">Shift History</h2>
          {shifts.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-500">No shifts recorded yet.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {shifts.map((s) => (
                <li key={s.id} className="px-4 py-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900">{new Date(s.clockInAt).toLocaleDateString()} · {s.routeName}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(s.clockInAt).toLocaleTimeString()} – {s.clockOutAt ? new Date(s.clockOutAt).toLocaleTimeString() : '—'}
                      {s.clockOutAt && ` · ${Math.round((s.clockOutAt - s.clockInAt) / 60000)}m`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(s.id)}
                    className="shrink-0 p-2 rounded-lg text-gray-400 hover:bg-p2p-light-red/30 hover:text-p2p-red focus:outline-none focus:ring-2 focus:ring-p2p-red/30"
                    aria-label="Delete shift"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Daily Notes */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          <h2 className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">Daily Notes / Issues</h2>
          <div className="p-4">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes, issues, or comments for the day..."
              rows={4}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-p2p-blue focus:ring-2 focus:ring-p2p-blue/20 outline-none text-sm resize-none"
            />
            <p className="text-xs text-gray-500 mt-2">Quick tags (optional):</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {NOTE_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-p2p-blue/30 ${
                    noteTags.includes(tag) ? 'bg-p2p-blue text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">Auto-saved. Visible to Manager.</p>
          </div>
        </section>
      </div>

      {/* Profile edit modal — portal overlay so map is covered and non-interactive */}
      <Modal
        open={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        title="Edit profile"
        triggerRef={profileButtonRef}
      >
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full my-8 p-6">
            <h2 id="modal-title" className="text-lg font-bold text-gray-900 mb-4">Edit profile</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Full name</label>
                <input
                  type="text"
                  value={profileForm.fullName}
                  onChange={(e) => setProfileForm((f) => ({ ...f, fullName: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-p2p-blue focus:ring-2 focus:ring-p2p-blue/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Display name (optional)</label>
                <input
                  type="text"
                  value={profileForm.displayName ?? ''}
                  onChange={(e) => setProfileForm((f) => ({ ...f, displayName: e.target.value || undefined }))}
                  placeholder="e.g. Marcus W."
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-p2p-blue focus:ring-2 focus:ring-p2p-blue/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Phone (optional)</label>
                <input
                  type="tel"
                  value={profileForm.phone ?? ''}
                  onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value || undefined }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-p2p-blue focus:ring-2 focus:ring-p2p-blue/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Avatar</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {avatarPresets.map((url) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setProfileForm((f) => ({ ...f, avatarUrl: url }))}
                      className={`rounded-full overflow-hidden border-2 ${profileForm.avatarUrl === url ? 'border-p2p-blue' : 'border-transparent'}`}
                    >
                      <img src={url} alt="" className="w-10 h-10 object-cover" />
                    </button>
                  ))}
                </div>
                <input
                  type="url"
                  value={profileForm.avatarUrl ?? ''}
                  onChange={(e) => setProfileForm((f) => ({ ...f, avatarUrl: e.target.value || undefined }))}
                  placeholder="Or paste image URL"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-p2p-blue focus:ring-2 focus:ring-p2p-blue/20 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Bio / note (optional)</label>
                <textarea
                  value={profileForm.bio ?? ''}
                  onChange={(e) => setProfileForm((f) => ({ ...f, bio: e.target.value || undefined }))}
                  rows={3}
                  placeholder="Short bio or note"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-p2p-blue focus:ring-2 focus:ring-p2p-blue/20 outline-none text-sm resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setProfileModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                className="flex-1 py-2.5 rounded-xl bg-p2p-blue text-white font-medium focus:outline-none focus:ring-2 focus:ring-p2p-blue focus:ring-offset-2"
              >
                Save
              </button>
            </div>
          </div>
      </Modal>

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <p className="font-medium text-gray-900">Delete this shift?</p>
            <p className="text-sm text-gray-500 mt-1">This cannot be undone.</p>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteShift(deleteConfirm)}
                className="flex-1 py-2 rounded-xl bg-p2p-red text-white font-medium focus:outline-none focus:ring-2 focus:ring-p2p-red focus:ring-offset-2"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </OpsLayout>
  );
}
