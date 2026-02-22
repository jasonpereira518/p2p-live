/**
 * Persistent people store (admins, managers, drivers). Single source of truth for display + manager CRUD.
 * Driver self-edits and manager edits both update the same driver record.
 * TODO: Replace with /api/ops/people.
 */

const KEY = 'p2p_people_store_v1';

export type PersonRole = 'admin' | 'manager' | 'driver' | 'student';

export interface Person {
  id: string;
  fullName: string;
  displayName?: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  bio?: string;
  role: PersonRole;
  updatedAt: number;
  lastUpdatedBy?: string; // optional: 'manager' | driverId
}

interface PeopleState {
  admins: Person[];
  managers: Person[];
  drivers: Person[];
}

const AVATAR = (g: 'men' | 'women', n: number) =>
  `https://randomuser.me/api/portraits/${g}/${n}.jpg`;

const DEFAULT_STATE: PeopleState = {
  admins: [
    { id: 'admin-1', fullName: 'Morgan Reeves', email: 'mreeves@p2plive.unc.edu', role: 'admin', avatarUrl: AVATAR('women', 44), updatedAt: Date.now() },
  ],
  managers: [
    { id: 'manager-1', fullName: 'James Chen', email: 'jchen@p2plive.unc.edu', role: 'manager', avatarUrl: AVATAR('men', 32), updatedAt: Date.now() },
  ],
  drivers: [
    { id: 'driver-1', fullName: 'Marcus Williams', email: 'mwilliams@p2plive.unc.edu', role: 'driver', avatarUrl: AVATAR('men', 12), updatedAt: Date.now() },
    { id: 'driver-2', fullName: 'Elena Vasquez', email: 'evasquez@p2plive.unc.edu', role: 'driver', avatarUrl: AVATAR('women', 23), updatedAt: Date.now() },
    { id: 'driver-3', fullName: 'David Okonkwo', email: 'dokonkwo@p2plive.unc.edu', role: 'driver', avatarUrl: AVATAR('men', 67), updatedAt: Date.now() },
    { id: 'driver-4', fullName: 'Priya Sharma', email: 'psharma@p2plive.unc.edu', role: 'driver', avatarUrl: AVATAR('women', 41), updatedAt: Date.now() },
    { id: 'driver-5', fullName: 'Ryan Foster', email: 'rfoster@p2plive.unc.edu', role: 'driver', avatarUrl: AVATAR('men', 8), updatedAt: Date.now() },
  ],
};

function load(): PeopleState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return {
      admins: parsed.admins ?? DEFAULT_STATE.admins,
      managers: parsed.managers ?? DEFAULT_STATE.managers,
      drivers: parsed.drivers ?? DEFAULT_STATE.drivers,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function save(state: PeopleState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (_) {}
}

function getState(): PeopleState {
  return load();
}

export function listAdmins(): Person[] {
  return getState().admins;
}

export function listManagers(): Person[] {
  return getState().managers;
}

export function listDrivers(): Person[] {
  return getState().drivers;
}

export function getPerson(id: string): Person | undefined {
  const s = getState();
  return s.admins.find((p) => p.id === id) ?? s.managers.find((p) => p.id === id) ?? s.drivers.find((p) => p.id === id);
}

export function addDriver(driver: Omit<Person, 'id' | 'role' | 'updatedAt'>): { id: string; error?: string } {
  const state = getState();
  const trimmedName = driver.fullName?.trim() ?? '';
  const trimmedEmail = driver.email?.trim()?.toLowerCase() ?? '';
  if (!trimmedName) return { id: '', error: 'Name is required' };
  if (!trimmedEmail) return { id: '', error: 'Email is required' };
  const allEmails = [
    ...state.admins.map((p) => p.email.toLowerCase()),
    ...state.managers.map((p) => p.email.toLowerCase()),
    ...state.drivers.map((p) => p.email.toLowerCase()),
  ];
  if (allEmails.includes(trimmedEmail)) return { id: '', error: 'Email already in use' };
  const id = `driver-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const now = Date.now();
  const newDriver: Person = {
    id,
    fullName: trimmedName,
    displayName: driver.displayName?.trim() || undefined,
    email: trimmedEmail,
    phone: driver.phone?.trim() || undefined,
    avatarUrl: driver.avatarUrl?.trim() || undefined,
    bio: driver.bio?.trim() || undefined,
    role: 'driver',
    updatedAt: now,
    lastUpdatedBy: 'manager',
  };
  state.drivers = [...state.drivers, newDriver];
  save(state);
  return { id };
}

export function updateDriver(driverId: string, patch: Partial<Pick<Person, 'fullName' | 'displayName' | 'email' | 'phone' | 'avatarUrl' | 'bio'>>, updatedBy?: string): { error?: string } {
  const state = getState();
  const idx = state.drivers.findIndex((p) => p.id === driverId);
  if (idx === -1) return { error: 'Driver not found' };
  const existing = state.drivers[idx];
  if (patch.email !== undefined) {
    const trimmed = patch.email.trim().toLowerCase();
    if (!trimmed) return { error: 'Email is required' };
    const others = [...state.admins, ...state.managers, ...state.drivers].filter((p) => p.id !== driverId);
    if (others.some((p) => p.email.toLowerCase() === trimmed)) return { error: 'Email already in use' };
    existing.email = trimmed;
  }
  if (patch.fullName !== undefined) {
    const t = patch.fullName.trim();
    if (!t) return { error: 'Name is required' };
    existing.fullName = t;
  }
  existing.displayName = patch.displayName !== undefined ? (patch.displayName.trim() || undefined) : existing.displayName;
  existing.phone = patch.phone !== undefined ? (patch.phone.trim() || undefined) : existing.phone;
  existing.avatarUrl = patch.avatarUrl !== undefined ? (patch.avatarUrl.trim() || undefined) : existing.avatarUrl;
  existing.bio = patch.bio !== undefined ? (patch.bio.trim() || undefined) : existing.bio;
  existing.updatedAt = Date.now();
  if (updatedBy) existing.lastUpdatedBy = updatedBy;
  state.drivers = [...state.drivers];
  save(state);
  return {};
}

export function removeDriver(driverId: string): void {
  const state = getState();
  state.drivers = state.drivers.filter((p) => p.id !== driverId);
  save(state);
}

/** Resolve display name for a person (driver: displayName or fullName). */
export function getDisplayName(person: Person): string {
  if (person.role === 'driver' && person.displayName) return person.displayName;
  return person.fullName;
}

/** Resolve avatar URL; safe fallback is handled by Avatar component. */
export function getAvatarUrl(person: Person): string | undefined {
  return person.avatarUrl;
}
