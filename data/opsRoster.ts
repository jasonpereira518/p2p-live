/**
 * Roster accessors — delegate to peopleStore so Team, Who's Driving, complaints use one source of truth.
 */

import * as peopleStore from '../ops/peopleStore';
import type { Person } from '../ops/peopleStore';

export type RosterPerson = Person;

export function getRosterPerson(id: string): RosterPerson | undefined {
  return peopleStore.getPerson(id);
}

export function getRosterName(id: string): string {
  const p = peopleStore.getPerson(id);
  return p ? peopleStore.getDisplayName(p) : id;
}

export function getRosterAvatar(id: string): string | undefined {
  const p = peopleStore.getPerson(id);
  return p ? peopleStore.getAvatarUrl(p) : undefined;
}

export function getAdmins(): RosterPerson[] {
  return peopleStore.listAdmins();
}

export function getManagers(): RosterPerson[] {
  return peopleStore.listManagers();
}

export function getDriversRoster(): RosterPerson[] {
  return peopleStore.listDrivers();
}
