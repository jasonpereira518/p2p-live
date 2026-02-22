const STORAGE_KEY = 'p2p_recent_searches_v1';
const MAX_ITEMS = 6;
const EXPIRE_DAYS = 14;

export interface RecentSearchItem {
  label: string;
  timestamp: number;
  lat?: number;
  lon?: number;
}

function getExpiryCutoff(): number {
  const d = new Date();
  d.setDate(d.getDate() - EXPIRE_DAYS);
  return d.getTime();
}

function loadRaw(): RecentSearchItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentSearchItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Returns recent searches, most recent first, deduped, expired removed, max 6. */
export function getRecentSearches(): RecentSearchItem[] {
  const cutoff = getExpiryCutoff();
  const items = loadRaw()
    .filter((item) => item.timestamp >= cutoff && item.label?.trim())
    .slice(0, MAX_ITEMS);
  return items;
}

/** Add or move-to-top by label. Dedupes by label, keeps max 6, writes to localStorage. */
export function addRecentSearch(item: Omit<RecentSearchItem, 'timestamp'>): void {
  const ts = Date.now();
  const next: RecentSearchItem = { ...item, timestamp: ts };
  const cutoff = getExpiryCutoff();
  const existing = loadRaw().filter((i) => i.timestamp >= cutoff);
  const without = existing.filter((i) => i.label.trim().toLowerCase() !== next.label.trim().toLowerCase());
  const merged = [next, ...without].slice(0, MAX_ITEMS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // quota or disabled
  }
}

/** Remove all recent searches. */
export function clearRecentSearches(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
