/**
 * Ops auth module — fake auth for MVP.
 * TODO: Replace with real auth (e.g. /api/auth/login, JWT, refresh).
 */

export type Role = 'student' | 'admin' | 'manager' | 'driver';

export interface OpsUser {
  id: string;
  name: string;
  role: Role;
  email?: string;
}

export interface OpsSession {
  user: OpsUser;
  expiresAt: number; // timestamp
}

const SESSION_KEY = 'p2p-ops-session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// MVP: simple test logins. Names match opsRoster; TODO: replace with API call.
const USERS: (OpsUser & { password: string })[] = [
  { id: 'student-1', name: 'Alex Rivera', role: 'student', password: 'student', email: 'arivera@unc.edu' },
  { id: 'admin-1', name: 'Morgan Reeves', role: 'admin', password: 'admin', email: 'mreeves@p2plive.unc.edu' },
  { id: 'manager-1', name: 'James Chen', role: 'manager', password: 'manager', email: 'jchen@p2plive.unc.edu' },
  { id: 'driver-1', name: 'Marcus Williams', role: 'driver', password: 'driver', email: 'mwilliams@p2plive.unc.edu' },
  { id: 'driver-2', name: 'Elena Vasquez', role: 'driver', password: 'driver', email: 'evasquez@p2plive.unc.edu' },
  { id: 'driver-3', name: 'David Okonkwo', role: 'driver', password: 'driver', email: 'dokonkwo@p2plive.unc.edu' },
  { id: 'driver-4', name: 'Priya Sharma', role: 'driver', password: 'driver', email: 'psharma@p2plive.unc.edu' },
  { id: 'driver-5', name: 'Ryan Foster', role: 'driver', password: 'driver', email: 'rfoster@p2plive.unc.edu' },
];

function getStoredSession(): OpsSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session: OpsSession = JSON.parse(raw);
    if (session.expiresAt < Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function setStoredSession(session: OpsSession | null): void {
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

/**
 * Login with username (or role) and password.
 * MVP: accepts "student"/"student", "admin"/"admin", "manager"/"manager", "driver"/"driver".
 */
export function login(credentials: { username: string; password: string }): OpsUser | null {
  const u = credentials.username.trim().toLowerCase();
  const p = credentials.password;
  const found = USERS.find(
    (x) => (x.role === u || x.id === u || x.name.toLowerCase().includes(u)) && x.password === p
  );
  if (!found) return null;
  const user: OpsUser = { id: found.id, name: found.name, role: found.role, email: found.email };
  const session: OpsSession = { user, expiresAt: Date.now() + SESSION_TTL_MS };
  setStoredSession(session);
  return user;
}

export function logout(): void {
  setStoredSession(null);
}

/**
 * Returns current session or null if expired/missing.
 */
export function getSession(): OpsSession | null {
  return getStoredSession();
}

/**
 * Get dashboard path for role (for post-login redirect).
 * Student goes to main app root.
 */
export function getDashboardPath(role: Role): string {
  switch (role) {
    case 'student':
      return '/';
    case 'admin':
      return '/ops/admin';
    case 'manager':
      return '/ops/manager';
    case 'driver':
      return '/ops/driver';
  }
}

/** True if role is an ops role (admin/manager/driver). */
export function isOpsRole(role: Role): boolean {
  return role === 'admin' || role === 'manager' || role === 'driver';
}
