/**
 * Mock data for Admin and Manager dashboards.
 * TODO: Replace with /api/ops/* endpoints.
 */

// --- Admin dashboard (tech metrics) ---

export const MOCK_SYSTEM_HEALTH = {
  apiStatus: 'healthy' as const,
  uptimePercent: 99.98,
  lastIncidentAt: '2025-02-20T14:00:00Z',
  lastIncidentMessage: 'Brief latency spike (resolved in 2m)',
};

export const MOCK_LATENCY = {
  p50Ms: 42,
  p95Ms: 120,
  p99Ms: 280,
  errorRatePercent: 0.02,
  sparklineData: [40, 45, 42, 48, 41, 43, 44],
};

export const MOCK_TRAFFIC = {
  activeUsers: 124,
  requestsPerMin: 340,
  topEndpoints: [
    { path: '/api/vehicles', count: 180 },
    { path: '/api/stops', count: 92 },
    { path: '/api/routes', count: 68 },
  ],
};

export const MOCK_ALERTS = [
  { id: 'a1', severity: 'warning' as const, message: 'Elevated p99 latency on /api/vehicles', at: '2025-02-21T10:15:00Z' },
  { id: 'a2', severity: 'info' as const, message: 'Scheduled deploy completed', at: '2025-02-21T09:00:00Z' },
  { id: 'a3', severity: 'critical' as const, message: 'GPS feed delayed >30s (recovered)', at: '2025-02-20T14:02:00Z' },
];

// --- Fleet status (capacity bars, off-route) ---

export interface FleetStatusRow {
  busId: string;
  busLabel: string;
  routeName: string;
  runLabel: string;
  capacityCurrent: number;
  capacityMax: number;
  isOffRoute: boolean;
  lastUpdated: string;
}

export const MOCK_FLEET_STATUS_ROWS: FleetStatusRow[] = [
  { busId: 'bus-101', busLabel: 'Bus 101', routeName: 'P2P Express', runLabel: 'Regular', capacityCurrent: 18, capacityMax: 24, isOffRoute: false, lastUpdated: new Date(Date.now() - 2 * 60 * 1000).toISOString() },
  { busId: 'bus-102', busLabel: 'Bus 102', routeName: 'Baity Hill', runLabel: 'Regular', capacityCurrent: 22, capacityMax: 24, isOffRoute: false, lastUpdated: new Date(Date.now() - 1 * 60 * 1000).toISOString() },
  { busId: 'bus-104', busLabel: 'Bus 104', routeName: 'P2P Express', runLabel: 'Basketball', capacityCurrent: 20, capacityMax: 24, isOffRoute: true, lastUpdated: new Date(Date.now() - 3 * 60 * 1000).toISOString() },
  { busId: 'bus-202', busLabel: 'Bus 202', routeName: 'Baity Hill', runLabel: 'Football', capacityCurrent: 24, capacityMax: 24, isOffRoute: true, lastUpdated: new Date(Date.now() - 90 * 1000).toISOString() },
  { busId: 'bus-108', busLabel: 'Bus 108', routeName: 'P2P Express', runLabel: 'Regular', capacityCurrent: 12, capacityMax: 24, isOffRoute: false, lastUpdated: new Date(Date.now() - 5 * 60 * 1000).toISOString() },
];

// --- Counts per bus per day ---

export interface CountsRow {
  busId: string;
  routeName: string;
  boardings: number;
  alightings: number;
  trips: number;
}

export const MOCK_COUNTS_DATE = '2026-02-22'; // Sun, Feb 22, 2026
export const MOCK_COUNTS_ROWS: CountsRow[] = [
  { busId: 'Bus 101', routeName: 'P2P Express', boardings: 142, alightings: 138, trips: 12 },
  { busId: 'Bus 102', routeName: 'Baity Hill', boardings: 98, alightings: 95, trips: 10 },
  { busId: 'Bus 104', routeName: 'P2P Express', boardings: 156, alightings: 152, trips: 14 },
  { busId: 'Bus 202', routeName: 'Baity Hill', boardings: 87, alightings: 84, trips: 9 },
  { busId: 'Bus 108', routeName: 'P2P Express', boardings: 120, alightings: 118, trips: 11 },
];

// --- Who's driving (sessions: from mock + live driver shifts) ---

export interface DriverSessionRow {
  id: string;
  driverName: string;
  driverId: string;
  busAssignment: string; // e.g. "Bus 101 · Baity Hill"
  status: 'active' | 'ended';
  clockInAt: number;
  clockOutAt?: number | null;
  durationMs?: number;
}

// --- Team directory ---

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'driver';
  avatarUrl?: string;
}

export const MOCK_ADMINS: TeamMember[] = [
  { id: 'admin-1', name: 'Morgan Reeves', email: 'mreeves@p2plive.unc.edu', role: 'admin', avatarUrl: 'https://randomuser.me/api/portraits/women/44.jpg' },
];

export const MOCK_MANAGERS: TeamMember[] = [
  { id: 'manager-1', name: 'James Chen', email: 'jchen@p2plive.unc.edu', role: 'manager', avatarUrl: 'https://randomuser.me/api/portraits/men/32.jpg' },
];

export const MOCK_DRIVERS_TEAM: TeamMember[] = [
  { id: 'driver-1', name: 'Marcus Williams', email: 'mwilliams@p2plive.unc.edu', role: 'driver', avatarUrl: 'https://randomuser.me/api/portraits/men/12.jpg' },
  { id: 'driver-2', name: 'Elena Vasquez', email: 'evasquez@p2plive.unc.edu', role: 'driver', avatarUrl: 'https://randomuser.me/api/portraits/women/23.jpg' },
  { id: 'driver-3', name: 'David Okonkwo', email: 'dokonkwo@p2plive.unc.edu', role: 'driver', avatarUrl: 'https://randomuser.me/api/portraits/men/67.jpg' },
  { id: 'driver-4', name: 'Priya Sharma', email: 'psharma@p2plive.unc.edu', role: 'driver', avatarUrl: 'https://randomuser.me/api/portraits/women/41.jpg' },
  { id: 'driver-5', name: 'Ryan Foster', email: 'rfoster@p2plive.unc.edu', role: 'driver', avatarUrl: 'https://randomuser.me/api/portraits/men/8.jpg' },
];

// --- Complaints & issues (with title, reporter, status for UI) ---

export interface MockComplaint {
  id: string;
  title: string;
  timestamp: string;
  route: string;
  busId: string;
  category: string;
  notes: string;
  reporter: string;
  reporterId?: string;
}

export const MOCK_COMPLAINTS: MockComplaint[] = [
  { id: 'c1', title: 'No backup', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), route: 'P2P Express', busId: 'bus-104', category: 'GPS freeze', notes: 'Tracker froze for ~5 min. No backup display.', reporter: 'Marcus Williams', reporterId: 'driver-1' },
  { id: 'c2', title: 'GPS out', timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), route: 'Baity Hill', busId: 'bus-202', category: 'Overcrowding', notes: 'Near capacity at Student Union. GPS dropped briefly.', reporter: 'Elena Vasquez', reporterId: 'driver-2' },
  { id: 'c3', title: 'Detour for event', timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), route: 'P2P Express', busId: 'bus-108', category: 'Off-route', notes: 'Detour for basketball event as scheduled.', reporter: 'Marcus Williams', reporterId: 'driver-1' },
  { id: 'c4', title: 'Door sensor', timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), route: 'Baity Hill', busId: 'bus-102', category: 'Maintenance', notes: 'Rear door sensor intermittent.', reporter: 'Elena Vasquez', reporterId: 'driver-2' },
];

// --- Manager dashboard (legacy summaries; still used for stat cards) ---

export const MOCK_FLEET_SUMMARY = {
  activeBuses: 4,
  lastUpdateAt: new Date().toISOString(),
  trackingStale: false,
};

export const MOCK_ACTIVE_ROUTES = [
  { id: 'baity-hill', name: 'Baity Hill', activeBuses: 2, nextArrivalSummary: 'Student Union in 3 min', status: 'on-time' as const },
  { id: 'p2p-express', name: 'P2P Express', activeBuses: 2, nextArrivalSummary: 'Davis Library in 5 min', status: 'on-time' as const },
];

export const MOCK_DRIVERS_CLOCKED = [
  { id: 'd1', name: 'Marcus Williams', busId: 'bus-104', routeName: 'P2P Express', clockInAt: Date.now() - 2 * 60 * 60 * 1000, status: 'clocked-in' as const },
  { id: 'd2', name: 'Elena Vasquez', busId: 'bus-202', routeName: 'Baity Hill', clockInAt: Date.now() - 1 * 60 * 60 * 1000, status: 'clocked-in' as const },
];

export const MOCK_FLEET_STATUS = {
  inService: 4,
  outOfService: 0,
  maintenance: 1,
  issuesReportedToday: 2,
};

export const MOCK_RIDERSHIP = {
  totalBoardedToday: 620,
  byRoute: [
    { routeName: 'P2P Express', boarded: 380 },
    { routeName: 'Baity Hill', boarded: 240 },
  ],
};

// --- Stat card aggregates (for top-of-dashboard) ---

export const MOCK_STAT_ACTIVE_BUSES = 4;
export const MOCK_STAT_DRIVERS_LOGGED_IN = 2;
export const MOCK_STAT_BOARDINGS_TODAY = 620;
export const MOCK_STAT_NEW_COMPLAINTS = 4;
export const MOCK_STAT_OFF_ROUTE_BUSES = 2;
