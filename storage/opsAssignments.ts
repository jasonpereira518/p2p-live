/**
 * Driver assignment storage (route + bus + shift window + manager contact).
 * TODO: Replace with /api/ops/assignments.
 */

import { MOCK_FLEET_STATUS_ROWS } from '../data/mockOps';
import { ROUTE_CONFIGS } from '../data/routeConfig';

const KEY_ASSIGNMENTS = 'p2p-ops-driver-assignments';

export interface DriverAssignment {
  routeName: string;
  busId: string;
  shiftStartWindow: string;
  managerContact: string;
}

const DEFAULT_ASSIGNMENT: DriverAssignment = {
  routeName: ROUTE_CONFIGS[0]?.routeName ?? 'P2P Express',
  busId: MOCK_FLEET_STATUS_ROWS[0]?.busId ?? 'bus-101',
  shiftStartWindow: '06:00 – 14:00',
  managerContact: 'Fleet Manager · (919) 555-0100',
};

function readAll(): Record<string, DriverAssignment> {
  try {
    const raw = localStorage.getItem(KEY_ASSIGNMENTS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, DriverAssignment>): void {
  try {
    localStorage.setItem(KEY_ASSIGNMENTS, JSON.stringify(all));
  } catch (_) {}
}

export function getDriverAssignment(driverId: string): DriverAssignment {
  const all = readAll();
  return all[driverId] ?? DEFAULT_ASSIGNMENT;
}

export function getAllDriverAssignments(): Record<string, DriverAssignment> {
  return readAll();
}

export function setDriverAssignment(driverId: string, assignment: DriverAssignment): void {
  const all = readAll();
  all[driverId] = assignment;
  writeAll(all);
}

export function clearDriverAssignment(driverId: string): void {
  const all = readAll();
  if (!(driverId in all)) return;
  delete all[driverId];
  writeAll(all);
}
