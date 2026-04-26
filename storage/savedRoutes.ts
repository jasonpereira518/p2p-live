const STORAGE_KEY = 'p2p_saved_routes_v1';
const MAX_ITEMS = 20;

export interface SavedRouteItem {
  id: string;
  fromName: string;
  fromLat: number;
  fromLon: number;
  fromIsCurrent: boolean;
  toName: string;
  toAddress?: string;
  toLat: number;
  toLon: number;
  favorite: boolean;
  useCount: number;
  lastUsedAt: number;
  lastRouteLabel?: string;
}

interface RecordRouteInput {
  fromName: string;
  fromLat: number;
  fromLon: number;
  fromIsCurrent: boolean;
  toName: string;
  toAddress?: string;
  toLat: number;
  toLon: number;
  routeLabel?: string;
}

function loadRaw(): SavedRouteItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedRouteItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRaw(items: SavedRouteItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // ignore localStorage quota/availability issues
  }
}

function normalize(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function keyForRoute(input: Pick<RecordRouteInput, 'fromName' | 'toName'>): string {
  return `${normalize(input.fromName)}=>${normalize(input.toName)}`;
}

export function getSavedRoutes(): SavedRouteItem[] {
  return loadRaw().sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
    return b.lastUsedAt - a.lastUsedAt;
  });
}

export function recordRouteUsage(input: RecordRouteInput): void {
  const now = Date.now();
  const existing = loadRaw();
  const targetKey = keyForRoute(input);
  const idx = existing.findIndex((item) => keyForRoute(item) === targetKey);

  if (idx >= 0) {
    const updated: SavedRouteItem = {
      ...existing[idx],
      fromName: input.fromName,
      fromLat: input.fromLat,
      fromLon: input.fromLon,
      fromIsCurrent: input.fromIsCurrent,
      toName: input.toName,
      toAddress: input.toAddress ?? existing[idx].toAddress,
      toLat: input.toLat,
      toLon: input.toLon,
      useCount: existing[idx].useCount + 1,
      lastUsedAt: now,
      lastRouteLabel: input.routeLabel ?? existing[idx].lastRouteLabel,
    };
    const without = existing.filter((_, i) => i !== idx);
    saveRaw([updated, ...without]);
    return;
  }

  const next: SavedRouteItem = {
    id: `saved-route-${now}-${Math.random().toString(36).slice(2, 9)}`,
    fromName: input.fromName,
    fromLat: input.fromLat,
    fromLon: input.fromLon,
    fromIsCurrent: input.fromIsCurrent,
    toName: input.toName,
    toAddress: input.toAddress,
    toLat: input.toLat,
    toLon: input.toLon,
    favorite: false,
    useCount: 1,
    lastUsedAt: now,
    lastRouteLabel: input.routeLabel,
  };
  saveRaw([next, ...existing]);
}

export function toggleSavedRouteFavorite(routeId: string): void {
  const existing = loadRaw();
  const next = existing.map((item) =>
    item.id === routeId ? { ...item, favorite: !item.favorite } : item
  );
  saveRaw(next);
}
