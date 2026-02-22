/**
 * Driver profile — thin wrapper over peopleStore so driver self-edits and manager edits share one source.
 */

import * as peopleStore from '../ops/peopleStore';
import type { Person } from '../ops/peopleStore';

export interface DriverProfile {
  fullName: string;
  displayName?: string;
  phone?: string;
  avatarUrl?: string;
  bio?: string;
  updatedAt: number;
}

function personToProfile(p: Person): DriverProfile {
  return {
    fullName: p.fullName,
    displayName: p.displayName,
    phone: p.phone,
    avatarUrl: p.avatarUrl,
    bio: p.bio,
    updatedAt: p.updatedAt,
  };
}

export function getDriverProfile(driverId: string): DriverProfile | null {
  const p = peopleStore.getPerson(driverId);
  if (!p || p.role !== 'driver') return null;
  return personToProfile(p);
}

export function setDriverProfile(driverId: string, profile: Partial<DriverProfile>): void {
  peopleStore.updateDriver(
    driverId,
    {
      fullName: profile.fullName,
      displayName: profile.displayName,
      phone: profile.phone,
      avatarUrl: profile.avatarUrl,
      bio: profile.bio,
    },
    driverId
  );
}

export function getDriverDisplayName(driverId: string, rosterName?: string): string {
  const p = peopleStore.getPerson(driverId);
  if (p) return peopleStore.getDisplayName(p);
  return rosterName ?? driverId;
}

export function getDriverAvatarUrl(driverId: string, rosterAvatar?: string): string | undefined {
  const p = peopleStore.getPerson(driverId);
  if (p?.avatarUrl) return p.avatarUrl;
  return rosterAvatar;
}
