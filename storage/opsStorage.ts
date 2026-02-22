/**
 * Ops localStorage wrapper — typed getters/setters for driver shifts, notes, manager state.
 * TODO: Replace with backend APIs (e.g. /api/ops/shifts, /api/ops/notes).
 */

export interface Shift {
  id: string;
  driverId: string;
  routeName: string;
  busId: string;
  clockInAt: number;
  clockOutAt: number | null;
  createdAt: number;
}

const KEY_SHIFTS = 'p2p-ops-driver-shifts';
const KEY_NOTES = 'p2p-ops-driver-daily-notes';
const KEY_ACK = 'p2p-ops-manager-ack';
const KEY_COMPLAINT_STATE = 'p2p-ops-complaint-state';

export function getDriverShifts(driverId: string): Shift[] {
  try {
    const raw = localStorage.getItem(KEY_SHIFTS);
    if (!raw) return [];
    const all: Record<string, Shift[]> = JSON.parse(raw);
    return all[driverId] ?? [];
  } catch {
    return [];
  }
}

/** All shifts across all drivers (for Manager/Admin "Who's Driving"). */
export function getAllDriverShifts(): { driverId: string; shift: Shift }[] {
  try {
    const raw = localStorage.getItem(KEY_SHIFTS);
    if (!raw) return [];
    const all: Record<string, Shift[]> = JSON.parse(raw);
    const out: { driverId: string; shift: Shift }[] = [];
    Object.entries(all).forEach(([driverId, shifts]) => {
      shifts.forEach((shift) => out.push({ driverId, shift }));
    });
    out.sort((a, b) => b.shift.clockInAt - a.shift.clockInAt);
    return out;
  } catch {
    return [];
  }
}

export function setDriverShifts(driverId: string, shifts: Shift[]): void {
  try {
    const raw = localStorage.getItem(KEY_SHIFTS);
    const all: Record<string, Shift[]> = raw ? JSON.parse(raw) : {};
    all[driverId] = shifts;
    localStorage.setItem(KEY_SHIFTS, JSON.stringify(all));
  } catch (_) {}
}

export function addShift(driverId: string, shift: Shift): void {
  const shifts = getDriverShifts(driverId);
  shifts.unshift(shift);
  setDriverShifts(driverId, shifts);
}

export function updateShift(driverId: string, shiftId: string, update: Partial<Shift>): void {
  const shifts = getDriverShifts(driverId).map((s) =>
    s.id === shiftId ? { ...s, ...update } : s
  );
  setDriverShifts(driverId, shifts);
}

export function deleteShift(driverId: string, shiftId: string): void {
  const shifts = getDriverShifts(driverId).filter((s) => s.id !== shiftId);
  setDriverShifts(driverId, shifts);
}

// --- Driver daily notes (keyed by driverId + date YYYY-MM-DD) ---

export interface DriverDailyNote {
  text: string;
  updatedAt: number;
  tags?: string[];
}

export function getDriverDailyNote(driverId: string, date: string): DriverDailyNote | null {
  try {
    const raw = localStorage.getItem(KEY_NOTES);
    if (!raw) return null;
    const byDriver: Record<string, Record<string, DriverDailyNote>> = JSON.parse(raw);
    return byDriver[driverId]?.[date] ?? null;
  } catch {
    return null;
  }
}

export function setDriverDailyNote(
  driverId: string,
  date: string,
  note: DriverDailyNote
): void {
  try {
    const raw = localStorage.getItem(KEY_NOTES);
    const byDriver: Record<string, Record<string, DriverDailyNote>> = raw ? JSON.parse(raw) : {};
    if (!byDriver[driverId]) byDriver[driverId] = {};
    byDriver[driverId][date] = note;
    localStorage.setItem(KEY_NOTES, JSON.stringify(byDriver));
  } catch (_) {}
}

/** Get all notes for manager view (all drivers, all dates). */
export function getAllDriverNotes(): { driverId: string; driverName: string; date: string; note: DriverDailyNote }[] {
  try {
    const raw = localStorage.getItem(KEY_NOTES);
    if (!raw) return [];
    const byDriver: Record<string, Record<string, DriverDailyNote>> = JSON.parse(raw);
    const out: { driverId: string; driverName: string; date: string; note: DriverDailyNote }[] = [];
    // We don't have driver names in storage; manager mock will map id -> name
    Object.keys(byDriver).forEach((driverId) => {
      Object.entries(byDriver[driverId]).forEach(([date, note]) => {
        out.push({ driverId, driverName: driverId, date, note });
      });
    });
    out.sort((a, b) => b.note.updatedAt - a.note.updatedAt);
    return out;
  } catch {
    return [];
  }
}

// --- Manager acknowledgements (complaintId -> true) ---

export function getManagerAcknowledgements(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(KEY_ACK);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setManagerAcknowledgements(ack: Record<string, boolean>): void {
  localStorage.setItem(KEY_ACK, JSON.stringify(ack));
}

export function acknowledgeComplaint(complaintId: string): void {
  const ack = getManagerAcknowledgements();
  ack[complaintId] = true;
  setManagerAcknowledgements(ack);
}

// --- Complaint status + internal note (manager workflow) ---

export type ComplaintStatus = 'new' | 'in_progress' | 'resolved';

export interface ComplaintState {
  status: ComplaintStatus;
  internalNote?: string;
}

export function getComplaintStates(): Record<string, ComplaintState> {
  try {
    const raw = localStorage.getItem(KEY_COMPLAINT_STATE);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setComplaintStatus(complaintId: string, status: ComplaintStatus): void {
  const states = getComplaintStates();
  states[complaintId] = { ...(states[complaintId] ?? { status: 'new' }), status };
  localStorage.setItem(KEY_COMPLAINT_STATE, JSON.stringify(states));
}

export function setComplaintInternalNote(complaintId: string, internalNote: string): void {
  const states = getComplaintStates();
  const current = states[complaintId] ?? { status: 'new' };
  states[complaintId] = { ...current, internalNote: internalNote || undefined };
  localStorage.setItem(KEY_COMPLAINT_STATE, JSON.stringify(states));
}

// --- Clear ops-related localStorage (for Dev Tools) ---

const OPS_KEYS = [KEY_SHIFTS, KEY_NOTES, KEY_ACK, KEY_COMPLAINT_STATE, 'p2p-ops-session', 'p2p-ops-driver-profiles'];

export function clearOpsLocalCache(): void {
  OPS_KEYS.forEach((k) => localStorage.removeItem(k));
}
