/**
 * Mock driver assignment for today.
 * TODO: Replace with /api/ops/assignments or schedule API.
 */

export interface DriverAssignment {
  routeName: string;
  busId: string;
  shiftStartWindow: string; // e.g. "06:00 – 14:00"
  managerContact: string;
}

export function getMockAssignment(_driverId: string): DriverAssignment {
  return {
    routeName: 'P2P Express',
    busId: 'bus-104',
    shiftStartWindow: '06:00 – 14:00',
    managerContact: 'Fleet Manager · (919) 555-0100',
  };
}
