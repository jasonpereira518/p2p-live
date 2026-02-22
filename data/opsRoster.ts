/**
 * Realistic roster: admins, managers, drivers. Used for Team, Who's Driving, complaints reporter.
 * avatarUrl: public URLs; fallback to initials if image fails.
 */

export interface RosterPerson {
  id: string;
  fullName: string;
  role: 'admin' | 'manager' | 'driver' | 'student';
  email: string;
  avatarUrl: string;
}

// Using stable public avatar URLs (randomuser.me style; replace with /public/avatars/* if preferred)
const AVATAR = (g: 'men' | 'women', n: number) =>
  `https://randomuser.me/api/portraits/${g}/${n}.jpg`;

export const OPS_ROSTER: RosterPerson[] = [
  { id: 'admin-1', fullName: 'Morgan Reeves', role: 'admin', email: 'mreeves@p2plive.unc.edu', avatarUrl: AVATAR('women', 44) },
  { id: 'manager-1', fullName: 'James Chen', role: 'manager', email: 'jchen@p2plive.unc.edu', avatarUrl: AVATAR('men', 32) },
  { id: 'driver-1', fullName: 'Marcus Williams', role: 'driver', email: 'mwilliams@p2plive.unc.edu', avatarUrl: AVATAR('men', 12) },
  { id: 'driver-2', fullName: 'Elena Vasquez', role: 'driver', email: 'evasquez@p2plive.unc.edu', avatarUrl: AVATAR('women', 23) },
  { id: 'driver-3', fullName: 'David Okonkwo', role: 'driver', email: 'dokonkwo@p2plive.unc.edu', avatarUrl: AVATAR('men', 67) },
  { id: 'driver-4', fullName: 'Priya Sharma', role: 'driver', email: 'psharma@p2plive.unc.edu', avatarUrl: AVATAR('women', 41) },
  { id: 'driver-5', fullName: 'Ryan Foster', role: 'driver', email: 'rfoster@p2plive.unc.edu', avatarUrl: AVATAR('men', 8) },
  { id: 'student-1', fullName: 'Alex Rivera', role: 'student', email: 'arivera@unc.edu', avatarUrl: AVATAR('men', 22) },
];

const byId = new Map<string, RosterPerson>(OPS_ROSTER.map((p) => [p.id, p]));

export function getRosterPerson(id: string): RosterPerson | undefined {
  return byId.get(id);
}

export function getRosterName(id: string): string {
  return byId.get(id)?.fullName ?? id;
}

export function getRosterAvatar(id: string): string | undefined {
  return byId.get(id)?.avatarUrl;
}

export function getAdmins(): RosterPerson[] {
  return OPS_ROSTER.filter((p) => p.role === 'admin');
}

export function getManagers(): RosterPerson[] {
  return OPS_ROSTER.filter((p) => p.role === 'manager');
}

export function getDriversRoster(): RosterPerson[] {
  return OPS_ROSTER.filter((p) => p.role === 'driver');
}
