/**
 * Driver profile (editable): name, displayName, phone, avatarUrl, bio.
 * Persisted in localStorage; used everywhere driver appears (sessions, complaints, team).
 * TODO: Replace with /api/ops/drivers/:id/profile.
 */

const KEY = 'p2p-ops-driver-profiles';

export interface DriverProfile {
  fullName: string;
  displayName?: string;
  phone?: string;
  avatarUrl?: string;
  bio?: string;
  updatedAt: number;
}

export function getDriverProfile(driverId: string): DriverProfile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const all: Record<string, DriverProfile> = JSON.parse(raw);
    return all[driverId] ?? null;
  } catch {
    return null;
  }
}

export function setDriverProfile(driverId: string, profile: Partial<DriverProfile>): void {
  try {
    const raw = localStorage.getItem(KEY);
    const all: Record<string, DriverProfile> = raw ? JSON.parse(raw) : {};
    const existing = all[driverId];
    const updated: DriverProfile = {
      fullName: profile.fullName ?? existing?.fullName ?? driverId,
      displayName: profile.displayName !== undefined ? profile.displayName : existing?.displayName,
      phone: profile.phone !== undefined ? profile.phone : existing?.phone,
      avatarUrl: profile.avatarUrl !== undefined ? profile.avatarUrl : existing?.avatarUrl,
      bio: profile.bio !== undefined ? profile.bio : existing?.bio,
      updatedAt: Date.now(),
    };
    all[driverId] = updated;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch (_) {}
}

/** Display name for a driver: profile displayName or fullName, else roster, else id. */
export function getDriverDisplayName(driverId: string, rosterName?: string): string {
  const p = getDriverProfile(driverId);
  if (p?.displayName) return p.displayName;
  if (p?.fullName) return p.fullName;
  return rosterName ?? driverId;
}

/** Avatar URL for a driver: profile avatarUrl else roster. */
export function getDriverAvatarUrl(driverId: string, rosterAvatar?: string): string | undefined {
  const p = getDriverProfile(driverId);
  if (p?.avatarUrl) return p.avatarUrl;
  return rosterAvatar;
}
