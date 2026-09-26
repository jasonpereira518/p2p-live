/**
 * Ops auth — backend-authoritative session.
 * Frontend calls /api/auth/login to obtain a signed JWT; it is stored alongside the
 * cached user payload so RoleGuard can render synchronously, but every privileged API
 * call MUST send the bearer token. The JWT is the source of truth for the server.
 */

import { listDrivers } from './peopleStore';
import { apiFetch, setAuthToken, getAuthToken, ApiError } from '../utils/api';

export type Role = 'student' | 'admin' | 'manager' | 'driver';

export interface OpsUser {
  id: string;
  name: string;
  role: Role;
  email?: string;
}

export interface OpsSession {
  user: OpsUser;
  expiresAt: number;
}

const SESSION_KEY = 'p2p-ops-session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

interface LoginResponse {
  token: string;
  expiresIn: number;
  user: OpsUser;
}

const FALLBACK_USERS: (OpsUser & { password: string })[] = [
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
      setAuthToken(null);
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

function localFallbackLogin(usernameRaw: string, password: string): OpsUser | null {
  const u = usernameRaw.trim().toLowerCase();
  const found = FALLBACK_USERS.find(
    (x) =>
      (x.role === u || x.id === u || (x.email || '').toLowerCase() === u || x.name.toLowerCase().includes(u)) &&
      x.password === password
  );
  if (found) return { id: found.id, name: found.name, role: found.role, email: found.email };
  const driver = listDrivers().find((d) => d.email.toLowerCase() === u);
  if (driver && password === 'driver') {
    return { id: driver.id, name: driver.fullName, role: 'driver', email: driver.email };
  }
  return null;
}

/**
 * Asynchronous login — first attempts the server `/api/auth/login` so the JWT can be issued.
 * If the backend is unreachable (offline dev), we fall back to the same in-memory credentials
 * so RoleGuard / the public app continue to work; messaging endpoints will simply be unavailable
 * because no token will be present.
 */
export async function login(credentials: { username: string; password: string }): Promise<OpsUser | null> {
  const username = credentials.username.trim();
  const password = credentials.password;

  try {
    const data = await apiFetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (data && data.token && data.user) {
      setAuthToken(data.token);
      const session: OpsSession = {
        user: data.user,
        expiresAt: Date.now() + (data.expiresIn ? data.expiresIn * 1000 : SESSION_TTL_MS),
      };
      setStoredSession(session);
      return data.user;
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      // Authoritative reject — do not fall back, server says invalid.
      return null;
    }
    // Network or 5xx — fall through to local fallback so the demo can still run offline.
  }

  const fallback = localFallbackLogin(username, password);
  if (fallback) {
    setAuthToken(null);
    const session: OpsSession = { user: fallback, expiresAt: Date.now() + SESSION_TTL_MS };
    setStoredSession(session);
    return fallback;
  }
  return null;
}

export function logout(): void {
  setStoredSession(null);
  setAuthToken(null);
}

export function getSession(): OpsSession | null {
  return getStoredSession();
}

export function getSessionToken(): string | null {
  return getAuthToken();
}

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

export function isOpsRole(role: Role): boolean {
  return role === 'admin' || role === 'manager' || role === 'driver';
}
