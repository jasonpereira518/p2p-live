# GMV Syncromatics Live Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every piece of mock transit data in P2P Live (vehicles, ETAs, stops, route lines, fullness, alerts) with live data from the GMV Syncromatics RTPI API, falling back to the timetable when live data is unavailable.

**Architecture:** A new CommonJS module `server/gmv/` inside the existing Node `http` server calls GMV on demand and caches results in memory (static network 6 h, live snapshot 6 s, in-flight dedupe, stale-on-error). Two endpoints, `/api/live/network` and `/api/live/snapshot`, feed a React `TransitProvider` that polls every 6 s while the tab is visible. Pure selector/utility modules turn network + snapshot into what each screen needs, so screens never talk to GMV shapes directly.

**Tech Stack:** Vite 6 + React 18 + TypeScript 5.8 (client), Node 22 `http` server in CommonJS (`server/index.cjs`), mapbox-gl 3, Vitest 3 (added by this plan).

**Spec:** `docs/superpowers/specs/2026-09-14-gmv-live-data-design.md`

## Global Constraints

- `GMV_RTPI_API_KEY` is server-only: read from `process.env` in `server/`, never `VITE_`-prefixed, never returned in a response, never logged, never committed. `.env.example` lists the name with an empty value.
- GMV base URL: `https://api.syncromatics.com/portal`. Every request sends `Api-Key: <key>` and `Accept: application/json`.
- GMV data lives only in memory. No disk writes, no DB, no logging of payloads. Static data refreshes every 6 h and may be served stale for at most 18 h total (under the 24 h license limit). Test fixtures are hand-written, never recorded GMV responses.
- Live snapshot TTL is 6 s (GMV asks for ≥ 6 s between vehicle polls). A failed refresh serves the last snapshot as `degraded` for up to 30 s, then `unavailable`.
- Canonical route ids everywhere in app code: `'P2P_EXPRESS'` (GMV route 6566) and `'BAITY_HILL'` (GMV route 6564). The old `'p2p-express'` / `'baity-hill'` spellings are removed from app code.
- Stop ids are GMV stop ids as strings (e.g. `'10044065'`).
- App brand route colors stay `#418FC5` (P2P Express) and `#C33934` (Baity Hill).
- No new runtime dependencies. The only new dev dependency is `vitest@^3.2.7`.
- Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Type-check baseline:** after Task 1, `npm run typecheck` reports exactly these pre-existing errors, which are out of scope: `components/mapboxBuses3DLayer.ts` (2, missing `three`), `ops/ErrorBoundary.tsx` (6), `pages/ops/OpsManagerPage.tsx` (3, at the DriverSessionRow / ComplaintCard / ManageDrivers props), and `components/StopPopup.tsx` (3 — 2 `ServiceRouteKey` argument errors at the `isRouteOperatingNow`/`getUpcomingRouteArrivals` calls in the arrivals effect, plus 1 `LineStringGeometry` error; all three are fixed by Task 13, which deletes that whole effect). 14 baseline errors total. "Typecheck clean" in this plan means **no errors other than these** (fewer, as tasks fix them, is expected).

## Deviations from the spec (decided while planning)

1. Route colors: the app keeps its brand colors (above). GMV colors are passed through in `/api/live/network` but unused by the UI.
2. `/api/live/network` stops do **not** carry `routeIds`. Which routes serve a stop is derived on the client from the *active* pattern, so seasonal variants (Football, Halloween) never claim stops.
3. Vehicle speed is normalized server-side into `speedMps` using `SPEED_TO_MPS` in `server/gmv/config.cjs` (assumed mph until Task 19 confirms).
4. `ServiceMessage` gains a `global: boolean` flag (from GMV `assignments.global`).
5. `LiveStatusBanner` renders inline at the top of the list view; on the map it is a one-line note inside the existing route-toggle card (a floating banner would cover the map controls). Service messages use the same floating overlay as the existing "too far" banner.
6. `Accept-Encoding` is not set manually: Node's built-in fetch already requests gzip/br and decompresses.
7. Stop display names were hand-curated from a ≤ 40 m proximity match against the old `data/p2pStops.ts`; 5 GMV stops with no local match keep GMV's name.
8. `/api/live/network` returns HTTP 503 when GMV is unreachable and nothing is cached.
9. One `useTransit()` hook (plus `useStopArrivals`) replaces the spec's separate `useTransitNetwork` / `useLiveSnapshot` hooks.
10. Plan Trip `waitTimeMin` now means time waiting *at the stop after walking there*, and a bus only counts if the rider can reach the stop first. The old value was the next departure from now, ignoring the walk.

## File Map

**Server (new):**
- `server/gmv/config.cjs` — route map, default patterns, TTLs, speed unit.
- `server/gmv/polyline.cjs` — encoded-polyline decoder + geodesic length.
- `server/gmv/cache.cjs` — in-memory TTL cache with dedupe, negative caching, stale-on-error.
- `server/gmv/client.cjs` — GMV HTTP client (headers, timeout, stats).
- `server/gmv/normalize.cjs` — pure GMV → app payload mappers.
- `server/gmv/service.cjs` — builds network and snapshot payloads.

**Server (modified):** `server/index.cjs` (endpoints, diagnostics, later cleanup). **Deleted:** `server/routeWaypoints.json`.

**Client (new):**
- `data/routes.ts` — `ROUTE_IDS`, `ROUTE_NAMES`, `ROUTE_COLORS`, `routeIdFromName`.
- `data/stopDisplayNames.ts` — friendly stop names keyed by GMV stop id.
- `utils/transitApi.ts` — `fetchNetwork`, `fetchSnapshot`, `withDisplayNames`.
- `utils/transitSelectors.ts` — pattern/stop/route lookups over network + snapshot.
- `utils/livePolling.ts` — poll backoff + client-side status derivation.
- `utils/liveStatus.ts` — status → banner text.
- `utils/liveVehicleAnimation.ts` — dead-reckoning + easing for map buses.
- `utils/vehicleDisplay.ts` — load/fullness helpers.
- `utils/arrivals.ts` — live-or-scheduled arrivals for a stop.
- `utils/tripPlanning.ts` — ride distance, fallback ride time, bus-leg estimate.
- `utils/serviceMessages.ts` — banner/stop message filters.
- `utils/fleet.ts` — fleet rows, off-route check, headway.
- `context/TransitProvider.tsx` — provider + `useTransit`, `useStopArrivals`.
- `components/LiveStatusBanner.tsx`, `components/ServiceMessageBanner.tsx`, `components/ArrivalSourceTag.tsx`.
- `vitest.config.ts`, `tests/**`.

**Client (modified):** `types.ts`, `utils/format.ts`, `RouterApp.tsx`, `App.tsx`, `components/BusList.tsx`, `components/BusDetailSheet.tsx`, `components/ClosestStopCard.tsx`, `components/StopPopup.tsx`, `components/MapView.tsx`, `components/MapboxMap.tsx`, `components/PlanTripView.tsx`, `utils/multimodalRouting.ts`, `utils/adminMetrics.ts`, `pages/ops/OpsAdminPage.tsx`, `pages/ops/OpsManagerPage.tsx`, `components/ops/DriverLocationMap.tsx`, `components/ops/ManageDrivers.tsx`, `storage/opsAssignments.ts`, `data/mockTransit.ts`, `data/mockOps.ts`, `package.json`, `.env.example`, `README.md`.

**Client (deleted):** `data/p2pStops.ts`, `data/routeConfig.ts`, `utils/journey.ts`.

---

## Phase 0 — Prerequisites

### Task 1: Restore the build and add test tooling

**Files:**
- Restore: `utils/serviceSchedule.ts` (cherry-pick `22fd843`)
- Modify: `package.json`, `.env.example`, `README.md`
- Create: `vitest.config.ts`, `tests/utils/serviceSchedule.test.ts`, local `.env` (gitignored, never committed)

**Interfaces:**
- Produces: `npm test` (Vitest, `tests/**/*.test.ts`, node environment), `npm run typecheck` (`tsc --noEmit`). `utils/serviceSchedule.ts` exports `isRouteOperatingNow(route, now?)`, `getUpcomingRouteArrivals(route, now?, limit?) → number[]` (minutes), `getRouteFrequencyMin(route)`, `getServiceResumeLabel() → '7:00 PM'`. Its `route` argument accepts `'P2P_EXPRESS' | 'BAITY_HILL' | 'p2p-express' | 'baity-hill' | 'P2P Express' | 'Baity Hill'`.

- [ ] **Step 1: Install dependencies and Vitest**

The worktree has no `node_modules` of its own.

```bash
npm install
npm install -D vitest@^3.2.7
```

- [ ] **Step 2: Add scripts to `package.json`**

In `"scripts"`, after `"server": "node server/index.cjs"`, add:

```json
    "server": "node server/index.cjs",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: Write the failing test `tests/utils/serviceSchedule.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { getUpcomingRouteArrivals, isRouteOperatingNow } from '../../utils/serviceSchedule';

describe('serviceSchedule', () => {
  it('operates at 9 PM on a Monday', () => {
    expect(isRouteOperatingNow('P2P_EXPRESS', new Date(2026, 8, 14, 21, 0))).toBe(true);
  });

  it('does not operate at noon', () => {
    expect(isRouteOperatingNow('P2P_EXPRESS', new Date(2026, 8, 14, 12, 0))).toBe(false);
  });

  it('returns near-term ETAs after midnight', () => {
    const etas = getUpcomingRouteArrivals('P2P_EXPRESS', new Date(2026, 8, 15, 0, 30), 2);
    expect(etas).toHaveLength(2);
    expect(etas[0]).toBeLessThanOrEqual(20);
  });
});
```

- [ ] **Step 5: Run it and confirm it fails**

Run: `npm test`
Expected: FAIL, because the module `../../utils/serviceSchedule` cannot be resolved.

- [ ] **Step 6: Restore `utils/serviceSchedule.ts`**

```bash
git cherry-pick 22fd843
```

Expected: one new commit, "Add missing serviceSchedule module and fix post-midnight ETAs".

- [ ] **Step 7: Run tests and the type-check baseline**

Run: `npm test`
Expected: 3 passed.

Run: `npm run typecheck`
Expected: only the baseline errors listed in Global Constraints.

- [ ] **Step 8: Set up the local `.env` (never committed)**

```bash
cp ../../../.env .env
sed -i '' 's/^VITE_API_BASE_URL/# VITE_API_BASE_URL/' .env
printf '\n# GMV Syncromatics RTPI (server-only)\nGMV_RTPI_API_KEY=%s\n' "<paste the key the user provided>" >> .env
git check-ignore .env
```

Expected: `git check-ignore` prints `.env`. `VITE_API_BASE_URL` is commented out so local `/api/*` requests go through the Vite proxy to `localhost:3001`, not the production Render server.

- [ ] **Step 9: Document the variable**

Append to `.env.example`:

```bash

# GMV Syncromatics RTPI API key (server-only; never prefix with VITE_). Used by /api/live/*.
GMV_RTPI_API_KEY=
```

Append to `README.md`:

```markdown

## Live transit data

Bus positions, ETAs, stops, route lines and service messages come from the GMV Syncromatics RTPI API through the Node server (`/api/live/network`, `/api/live/snapshot`). Set `GMV_RTPI_API_KEY` in the server environment (local `.env`, Render dashboard). Never expose it to the client. GMV data is only cached in memory; the license forbids storing it for more than 24 hours.
```

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests/utils/serviceSchedule.test.ts .env.example README.md
git commit -m "$(printf 'Add Vitest tooling and document GMV_RTPI_API_KEY\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')"
```

---

## Phase 1 — Server

### Task 2: GMV config and polyline decoding

**Files:**
- Create: `server/gmv/config.cjs`, `server/gmv/polyline.cjs`
- Test: `tests/server/polyline.test.ts`

**Interfaces:**
- Produces (`config.cjs`): `GMV_BASE_URL`, `ROUTES` (`{ 6566: { id: 'P2P_EXPRESS', name: 'P2P Express' }, 6564: { id: 'BAITY_HILL', name: 'Baity Hill' } }`), `DEFAULT_PATTERN` (`{ P2P_EXPRESS: 31799, BAITY_HILL: 31798 }`), `SPEED_TO_MPS`, `NETWORK_TTL_MS`, `NETWORK_STALE_MS`, `SNAPSHOT_TTL_MS`, `SNAPSHOT_STALE_MS`, `MESSAGES_TTL_MS`, `MESSAGES_STALE_MS`, `STALE_VEHICLE_SEC`, `REQUEST_TIMEOUT_MS`.
- Produces (`polyline.cjs`): `decodePolyline(encoded: string) → [lng, lat][]`, `lineLengthMeters(coords: [lng, lat][]) → number` (haversine, R = 6 371 000 m, the same formula as `utils/routeInterpolation.ts`).

- [ ] **Step 1: Write the failing test `tests/server/polyline.test.ts`**

Server modules are CommonJS, so tests load them with `createRequire`.

```ts
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { decodePolyline, lineLengthMeters } = require('../../server/gmv/polyline.cjs');

describe('decodePolyline', () => {
  it('decodes the reference vector from the Google polyline docs as [lng, lat]', () => {
    const coords = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(coords).toHaveLength(3);
    expect(coords[0][0]).toBeCloseTo(-120.2, 5);
    expect(coords[0][1]).toBeCloseTo(38.5, 5);
    expect(coords[1][0]).toBeCloseTo(-120.95, 5);
    expect(coords[1][1]).toBeCloseTo(40.7, 5);
    expect(coords[2][0]).toBeCloseTo(-126.453, 5);
    expect(coords[2][1]).toBeCloseTo(43.252, 5);
  });

  it('returns [] for empty or non-string input', () => {
    expect(decodePolyline('')).toEqual([]);
    expect(decodePolyline(null)).toEqual([]);
  });
});

describe('lineLengthMeters', () => {
  it('measures 0.001 degrees of latitude as about 111 m', () => {
    expect(lineLengthMeters([[-79.05, 35.9], [-79.05, 35.901]])).toBeCloseTo(111.19, 1);
  });

  it('returns 0 for fewer than two points', () => {
    expect(lineLengthMeters([[-79.05, 35.9]])).toBe(0);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- tests/server/polyline.test.ts`
Expected: FAIL, because `server/gmv/polyline.cjs` cannot be found.

- [ ] **Step 3: Create `server/gmv/config.cjs`**

```js
/**
 * GMV Syncromatics integration settings for the UNC P2P portal.
 */

const GMV_BASE_URL = 'https://api.syncromatics.com/portal';

/** GMV route id → app route. */
const ROUTES = {
  6566: { id: 'P2P_EXPRESS', name: 'P2P Express' },
  6564: { id: 'BAITY_HILL', name: 'Baity Hill' },
};

/**
 * Pattern shown when no buses are running and none has been seen since the server started.
 * 31799 / 31798 are the "Granville Closed" variants; switch to 25545 / 25535 (base variants) when the detour ends.
 */
const DEFAULT_PATTERN = { P2P_EXPRESS: 31799, BAITY_HILL: 31798 };

/** Multiply GMV `speed` by this to get m/s. Assumes mph until confirmed during service hours. */
const SPEED_TO_MPS = 0.44704;

const NETWORK_TTL_MS = 6 * 60 * 60 * 1000;
/** Extra time static data may be served after a failed refresh (18 h total, under the 24 h license limit). */
const NETWORK_STALE_MS = 12 * 60 * 60 * 1000;
/** GMV asks consumers to poll vehicles no more often than every 6 seconds. */
const SNAPSHOT_TTL_MS = 6 * 1000;
/** How long the last good snapshot is served as 'degraded' after a failed refresh. */
const SNAPSHOT_STALE_MS = 30 * 1000;
const MESSAGES_TTL_MS = 60 * 1000;
const MESSAGES_STALE_MS = 5 * 60 * 1000;
/** A vehicle whose lastUpdated is older than this is marked stale. */
const STALE_VEHICLE_SEC = 90;
const REQUEST_TIMEOUT_MS = 5000;

module.exports = {
  GMV_BASE_URL,
  ROUTES,
  DEFAULT_PATTERN,
  SPEED_TO_MPS,
  NETWORK_TTL_MS,
  NETWORK_STALE_MS,
  SNAPSHOT_TTL_MS,
  SNAPSHOT_STALE_MS,
  MESSAGES_TTL_MS,
  MESSAGES_STALE_MS,
  STALE_VEHICLE_SEC,
  REQUEST_TIMEOUT_MS,
};
```

- [ ] **Step 4: Create `server/gmv/polyline.cjs`**

```js
/**
 * Google encoded-polyline decoding (precision 5) and geodesic length.
 * GMV pattern shapes use this encoding.
 */

const EARTH_RADIUS_M = 6371000;

function decodeValue(encoded, start) {
  let result = 0;
  let shift = 0;
  let index = start;
  let byte;
  do {
    byte = encoded.charCodeAt(index++) - 63;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20);
  const value = result & 1 ? ~(result >> 1) : result >> 1;
  return { value, next: index };
}

/** Decode to [lng, lat] pairs (GeoJSON order). */
function decodePolyline(encoded) {
  if (typeof encoded !== 'string' || encoded.length === 0) return [];
  const coords = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    const dLat = decodeValue(encoded, index);
    const dLng = decodeValue(encoded, dLat.next);
    index = dLng.next;
    lat += dLat.value;
    lng += dLng.value;
    coords.push([lng / 1e5, lat / 1e5]);
  }
  return coords;
}

function haversineMeters(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(toRad(a[1])) * Math.cos(toRad(b[1]));
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function lineLengthMeters(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversineMeters(coords[i - 1], coords[i]);
  return total;
}

module.exports = { decodePolyline, lineLengthMeters };
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `npm test -- tests/server/polyline.test.ts`
Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add server/gmv/config.cjs server/gmv/polyline.cjs tests/server/polyline.test.ts
git commit -m "$(printf 'Add GMV config and polyline decoder\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')"
```

### Task 3: In-memory TTL cache

**Files:**
- Create: `server/gmv/cache.cjs`
- Test: `tests/server/cache.test.ts`

**Interfaces:**
- Produces: `createTtlCache({ now?: () => number }) → { getOrFetch(key, ttlMs, fetchFn, { staleMs? }) → Promise<{ value, stale: boolean, fetchedAt: number }>, peek(key) → { value, fetchedAt } | null, stats() → { entries: number, hits: number } }`.
- Behavior:
  - A value younger than `ttlMs` is returned without calling `fetchFn`.
  - Concurrent misses share one `fetchFn` call.
  - After a failed fetch, no new fetch is attempted for `ttlMs` (negative caching). During that window, and on the failure itself, the last good value is returned with `stale: true` if it is younger than `ttlMs + staleMs`; otherwise the error is rethrown.

- [ ] **Step 1: Write the failing test `tests/server/cache.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createTtlCache } = require('../../server/gmv/cache.cjs');

function setup() {
  let t = 0;
  const cache = createTtlCache({ now: () => t });
  return { cache, advance: (ms: number) => { t += ms; } };
}

describe('createTtlCache', () => {
  it('serves a fresh value without refetching', async () => {
    const { cache, advance } = setup();
    const fetchFn = vi.fn().mockResolvedValue('v1');
    await cache.getOrFetch('k', 1000, fetchFn);
    advance(500);
    const r = await cache.getOrFetch('k', 1000, fetchFn);
    expect(r).toMatchObject({ value: 'v1', stale: false });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(cache.stats().hits).toBe(1);
  });

  it('shares one in-flight fetch between concurrent callers', async () => {
    const { cache } = setup();
    const fetchFn = vi.fn().mockResolvedValue('v1');
    const [a, b] = await Promise.all([cache.getOrFetch('k', 1000, fetchFn), cache.getOrFetch('k', 1000, fetchFn)]);
    expect(a.value).toBe('v1');
    expect(b.value).toBe('v1');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('refetches after the TTL expires', async () => {
    const { cache, advance } = setup();
    const fetchFn = vi.fn().mockResolvedValueOnce('v1').mockResolvedValueOnce('v2');
    await cache.getOrFetch('k', 1000, fetchFn);
    advance(1001);
    const r = await cache.getOrFetch('k', 1000, fetchFn);
    expect(r.value).toBe('v2');
  });

  it('returns the last value as stale when a refresh fails within the stale window', async () => {
    const { cache, advance } = setup();
    const fetchFn = vi.fn().mockResolvedValueOnce('v1').mockRejectedValueOnce(new Error('down'));
    await cache.getOrFetch('k', 1000, fetchFn, { staleMs: 5000 });
    advance(2000);
    const r = await cache.getOrFetch('k', 1000, fetchFn, { staleMs: 5000 });
    expect(r).toMatchObject({ value: 'v1', stale: true });
  });

  it('throws when the last value is older than ttl + staleMs', async () => {
    const { cache, advance } = setup();
    const fetchFn = vi.fn().mockResolvedValueOnce('v1').mockRejectedValue(new Error('down'));
    await cache.getOrFetch('k', 1000, fetchFn, { staleMs: 5000 });
    advance(7000);
    await expect(cache.getOrFetch('k', 1000, fetchFn, { staleMs: 5000 })).rejects.toThrow('down');
  });

  it('does not retry a failed fetch until the TTL has passed', async () => {
    const { cache, advance } = setup();
    const fetchFn = vi.fn().mockRejectedValue(new Error('down'));
    await expect(cache.getOrFetch('k', 1000, fetchFn)).rejects.toThrow('down');
    advance(500);
    await expect(cache.getOrFetch('k', 1000, fetchFn)).rejects.toThrow('down');
    expect(fetchFn).toHaveBeenCalledTimes(1);
    advance(600);
    await expect(cache.getOrFetch('k', 1000, fetchFn)).rejects.toThrow('down');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('peek returns the stored value or null', async () => {
    const { cache } = setup();
    expect(cache.peek('k')).toBeNull();
    await cache.getOrFetch('k', 1000, async () => 'v1');
    expect(cache.peek('k')).toMatchObject({ value: 'v1' });
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- tests/server/cache.test.ts`
Expected: FAIL, because `server/gmv/cache.cjs` cannot be found.

- [ ] **Step 3: Create `server/gmv/cache.cjs`**

```js
/**
 * In-memory TTL cache with in-flight sharing, negative caching and stale-on-error.
 * Nothing is persisted: GMV data must not be stored for more than 24 hours.
 */

function createTtlCache({ now = Date.now } = {}) {
  const entries = new Map(); // key → { value, fetchedAt }
  const failures = new Map(); // key → { at, error }
  const inFlight = new Map(); // key → Promise<{ value, stale, fetchedAt }>
  let hits = 0;

  function staleOrThrow(key, ttlMs, staleMs, error) {
    const last = entries.get(key);
    if (last && now() - last.fetchedAt < ttlMs + staleMs) {
      return { value: last.value, stale: true, fetchedAt: last.fetchedAt };
    }
    throw error;
  }

  async function getOrFetch(key, ttlMs, fetchFn, { staleMs = 0 } = {}) {
    const entry = entries.get(key);
    if (entry && now() - entry.fetchedAt < ttlMs) {
      hits += 1;
      return { value: entry.value, stale: false, fetchedAt: entry.fetchedAt };
    }

    const failure = failures.get(key);
    if (failure && now() - failure.at < ttlMs) {
      return staleOrThrow(key, ttlMs, staleMs, failure.error);
    }

    let promise = inFlight.get(key);
    if (!promise) {
      promise = (async () => {
        try {
          const value = await fetchFn();
          const fetchedAt = now();
          entries.set(key, { value, fetchedAt });
          failures.delete(key);
          return { value, stale: false, fetchedAt };
        } catch (error) {
          failures.set(key, { at: now(), error });
          throw error;
        } finally {
          inFlight.delete(key);
        }
      })();
      inFlight.set(key, promise);
    }

    try {
      return await promise;
    } catch (error) {
      return staleOrThrow(key, ttlMs, staleMs, error);
    }
  }

  function peek(key) {
    const entry = entries.get(key);
    return entry ? { value: entry.value, fetchedAt: entry.fetchedAt } : null;
  }

  return { getOrFetch, peek, stats: () => ({ entries: entries.size, hits }) };
}

module.exports = { createTtlCache };
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test -- tests/server/cache.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add server/gmv/cache.cjs tests/server/cache.test.ts
git commit -m "$(printf 'Add in-memory TTL cache for GMV data\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')"
```

### Task 4: GMV HTTP client

**Files:**
- Create: `server/gmv/client.cjs`
- Test: `tests/server/client.test.ts`

**Interfaces:**
- Consumes: `GMV_BASE_URL`, `REQUEST_TIMEOUT_MS` from `config.cjs`.
- Produces: `createGmvClient({ apiKey, baseUrl?, fetchImpl?, timeoutMs?, now? }) → { get(path) → Promise<any>, stats() → { configured, callCount, lastSuccessAt, lastErrorAt, lastError } }`, and `GmvError` (`.status: number | null`, `.code: 'MISSING_KEY' | 'TIMEOUT' | 'NETWORK' | 'GMV_ERROR'`). Error messages contain the path only, never the key.

- [ ] **Step 1: Write the failing test `tests/server/client.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createGmvClient } = require('../../server/gmv/client.cjs');

const KEY = 'test-key-123';

function okFetch(body: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body });
}

describe('createGmvClient', () => {
  it('sends Api-Key and Accept headers and returns parsed JSON', async () => {
    const fetchImpl = okFetch([{ id: 1 }]);
    const client = createGmvClient({ apiKey: KEY, baseUrl: 'https://gmv.test/portal', fetchImpl });
    await expect(client.get('/routes')).resolves.toEqual([{ id: 1 }]);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://gmv.test/portal/routes');
    expect(init.headers).toMatchObject({ 'Api-Key': KEY, Accept: 'application/json' });
    expect(client.stats()).toMatchObject({ configured: true, callCount: 1, lastError: null });
  });

  it('throws GmvError with the status on non-2xx, without leaking the key', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
    const client = createGmvClient({ apiKey: KEY, fetchImpl });
    const err = await client.get('/routes').catch((e: any) => e);
    expect(err.name).toBe('GmvError');
    expect(err.status).toBe(403);
    expect(err.message).not.toContain(KEY);
    expect(client.stats().lastError).toContain('403');
  });

  it('throws MISSING_KEY without calling fetch when no key is configured', async () => {
    const fetchImpl = okFetch([]);
    const client = createGmvClient({ apiKey: undefined, fetchImpl });
    const err = await client.get('/routes').catch((e: any) => e);
    expect(err.code).toBe('MISSING_KEY');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(client.stats().configured).toBe(false);
  });

  it('aborts and throws TIMEOUT when GMV is slow', async () => {
    const fetchImpl = vi.fn((_url: string, init: any) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        const e = new Error('aborted');
        e.name = 'AbortError';
        reject(e);
      });
    }));
    const client = createGmvClient({ apiKey: KEY, fetchImpl, timeoutMs: 10 });
    const err = await client.get('/routes/6566/vehicles').catch((e: any) => e);
    expect(err.code).toBe('TIMEOUT');
    expect(err.message).toContain('/routes/6566/vehicles');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- tests/server/client.test.ts`
Expected: FAIL, because `server/gmv/client.cjs` cannot be found.

- [ ] **Step 3: Create `server/gmv/client.cjs`**

```js
/**
 * Minimal GMV Syncromatics RTPI client. The API key is sent only in the Api-Key header
 * and never appears in errors, logs, or return values.
 * Node's fetch already sends Accept-Encoding: gzip, deflate, br and decompresses responses.
 */

const { GMV_BASE_URL, REQUEST_TIMEOUT_MS } = require('./config.cjs');

class GmvError extends Error {
  constructor(message, { status = null, code = 'GMV_ERROR' } = {}) {
    super(message);
    this.name = 'GmvError';
    this.status = status;
    this.code = code;
  }
}

function createGmvClient({
  apiKey,
  baseUrl = GMV_BASE_URL,
  fetchImpl = globalThis.fetch,
  timeoutMs = REQUEST_TIMEOUT_MS,
  now = Date.now,
} = {}) {
  const stats = { callCount: 0, lastSuccessAt: null, lastErrorAt: null, lastError: null };

  function recordError(message) {
    stats.lastErrorAt = now();
    stats.lastError = message;
  }

  async function get(path) {
    if (!apiKey) {
      const err = new GmvError('GMV_RTPI_API_KEY is not set', { code: 'MISSING_KEY' });
      recordError(err.message);
      throw err;
    }
    stats.callCount += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${baseUrl}${path}`, {
        headers: { 'Api-Key': apiKey, Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!res.ok) throw new GmvError(`GMV ${res.status} for ${path}`, { status: res.status });
      const body = await res.json();
      stats.lastSuccessAt = now();
      return body;
    } catch (err) {
      if (err instanceof GmvError) {
        recordError(err.message);
        throw err;
      }
      const isTimeout = err && err.name === 'AbortError';
      const wrapped = new GmvError(isTimeout ? `GMV timeout for ${path}` : `GMV request failed for ${path}`, {
        code: isTimeout ? 'TIMEOUT' : 'NETWORK',
      });
      recordError(wrapped.message);
      throw wrapped;
    } finally {
      clearTimeout(timer);
    }
  }

  return { get, stats: () => ({ configured: !!apiKey, ...stats }) };
}

module.exports = { createGmvClient, GmvError };
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test -- tests/server/client.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add server/gmv/client.cjs tests/server/client.test.ts
git commit -m "$(printf 'Add GMV HTTP client with timeout and stats\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')"
```

### Task 5: Normalizers

**Files:**
- Create: `server/gmv/normalize.cjs`
- Test: `tests/server/normalize.test.ts`

**Interfaces:**
- Consumes: `decodePolyline`, `lineLengthMeters`, `SPEED_TO_MPS`, `STALE_VEHICLE_SEC`.
- Produces (all pure):
  - `normalizeStop(raw) → { id: string, name: string, lat: number, lon: number }`
  - `normalizePattern(rawPattern, rawPatternStops) → { id: number, name: string, geometry: { type: 'LineString', coordinates: [lng, lat][] }, lengthMeters: number, stops: { stopId: string, sequence: number, distAlong: number }[] }`. Stops are sorted by `stopSequence`, and consecutive duplicate stop ids are dropped.
  - `normalizeVehicle(raw, route: { id, name }, nowMs) → Vehicle` with `{ id, name, routeId, routeName, patternId, lat, lon, heading, speedMps, distAlong, capacity, load, lastUpdated, stale, nextStopId: null, nextStopEtaSec: null, upcomingStops: [] }`
  - `buildArrivalIndexes(groups: { routeId, arrivals: raw[] }[]) → { byVehicle: { [vehicleId]: { stopId, etaSec }[] }, byStop: { [stopId]: { routeId, vehicleId: string | null, etaSec, scheduled: boolean }[] } }`. Both are sorted by `etaSec`.
  - `attachUpcomingStops(vehicle, byVehicle) → vehicle` with `upcomingStops`, `nextStopId` and `nextStopEtaSec` filled in.
  - `normalizeMessage(raw, routes) → { id, title, body, global, routeIds, stopIds, startsAt, endsAt }`
  - `isMessageActive(message, nowMs) → boolean`

- [ ] **Step 1: Write the failing test `tests/server/normalize.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const n = require('../../server/gmv/normalize.cjs');
const { ROUTES, SPEED_TO_MPS } = require('../../server/gmv/config.cjs');

const EXPRESS = { id: 'P2P_EXPRESS', name: 'P2P Express' };
const NOW = Date.parse('2026-09-14T23:00:00Z');

describe('normalizeStop', () => {
  it('stringifies the id and trims the name', () => {
    expect(n.normalizeStop({ id: 42, lat: 35.9, lon: -79.05, name: 'Ambulatory Care Center ' }))
      .toEqual({ id: '42', name: 'Ambulatory Care Center', lat: 35.9, lon: -79.05 });
  });
});

describe('normalizePattern', () => {
  it('decodes the shape, sorts stops and drops consecutive duplicates', () => {
    const p = n.normalizePattern(
      { id: 7, name: 'P2P Express', shape: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
      [
        { stopSequence: 1, shapeDistanceTraveled: 400.4, stop: { id: 2 } },
        { stopSequence: 0, shapeDistanceTraveled: 0, stop: { id: 1 } },
        { stopSequence: 2, shapeDistanceTraveled: 400.4, stop: { id: 2 } },
      ]
    );
    expect(p.id).toBe(7);
    expect(p.geometry.type).toBe('LineString');
    expect(p.geometry.coordinates).toHaveLength(3);
    expect(p.lengthMeters).toBeGreaterThan(0);
    expect(p.stops).toEqual([
      { stopId: '1', sequence: 0, distAlong: 0 },
      { stopId: '2', sequence: 1, distAlong: 400.4 },
    ]);
  });
});

describe('normalizeVehicle', () => {
  const raw = {
    id: 10000000001, name: 'Bus 34', lat: 35.91, lon: -79.05, headingDegrees: 216.7, speed: 20,
    capacity: 48, passengerLoad: 0.25, lastUpdated: '2026-09-14T22:59:30Z', shapeDistanceTraveled: 812.5, pattern_id: 25545,
  };

  it('maps fields and converts speed to m/s', () => {
    const v = n.normalizeVehicle(raw, EXPRESS, NOW);
    expect(v).toMatchObject({
      id: '10000000001', name: 'Bus 34', routeId: 'P2P_EXPRESS', routeName: 'P2P Express', patternId: 25545,
      heading: 216.7, capacity: 48, load: 0.25, distAlong: 812.5, stale: false,
      lastUpdated: '2026-09-14T22:59:30.000Z', nextStopId: null, nextStopEtaSec: null, upcomingStops: [],
    });
    expect(v.speedMps).toBeCloseTo(20 * SPEED_TO_MPS, 6);
  });

  it('marks vehicles stale after 90 s without an update', () => {
    const v = n.normalizeVehicle({ ...raw, lastUpdated: '2026-09-14T22:58:00Z' }, EXPRESS, NOW);
    expect(v.stale).toBe(true);
  });

  it('tolerates missing optional fields and invalid dates', () => {
    const v = n.normalizeVehicle({ id: 5, lat: 1, lon: 2, lastUpdated: '2015-02-31T21:49:48.198Z' }, EXPRESS, NOW);
    expect(v).toMatchObject({ name: 'Bus 5', patternId: null, speedMps: null, capacity: null, load: null, lastUpdated: null, stale: false, heading: 0 });
  });
});

describe('buildArrivalIndexes + attachUpcomingStops', () => {
  const groups = [{
    routeId: 'P2P_EXPRESS',
    arrivals: [
      { vehicle: { id: 9 }, stop: { id: 2 }, secondsToArrival: 400, schedulePrediction: 'false' },
      { vehicle: { id: 9 }, stop: { id: 1 }, secondsToArrival: 120.4, schedulePrediction: false },
      { vehicle: null, stop: { id: 1 }, secondsToArrival: 900, schedulePrediction: true },
      { stop: { id: 3 } },
    ],
  }];

  it('indexes by stop and by vehicle, sorted by ETA, with scheduled normalized to boolean', () => {
    const { byStop, byVehicle } = n.buildArrivalIndexes(groups);
    expect(byStop['1']).toEqual([
      { routeId: 'P2P_EXPRESS', vehicleId: '9', etaSec: 120, scheduled: false },
      { routeId: 'P2P_EXPRESS', vehicleId: null, etaSec: 900, scheduled: true },
    ]);
    expect(byStop['3']).toBeUndefined();
    expect(byVehicle['9']).toEqual([{ stopId: '1', etaSec: 120 }, { stopId: '2', etaSec: 400 }]);
  });

  it('fills a vehicle\'s next stop from the index', () => {
    const { byVehicle } = n.buildArrivalIndexes(groups);
    const v = n.attachUpcomingStops(n.normalizeVehicle({ id: 9, lat: 1, lon: 2 }, EXPRESS, NOW), byVehicle);
    expect(v.nextStopId).toBe('1');
    expect(v.nextStopEtaSec).toBe(120);
    expect(v.upcomingStops).toHaveLength(2);
  });
});

describe('messages', () => {
  it('maps GMV route ids to app ids and drops unknown routes', () => {
    const m = n.normalizeMessage({
      id: 1, name: 'Detour', text: 'Granville closed', start: '2026-09-14T00:00:00Z', end: null,
      assignments: { global: false, routes: [{ id: 6566 }, { id: 1 }], stops: [{ id: 10044065 }] },
    }, ROUTES);
    expect(m).toEqual({
      id: '1', title: 'Detour', body: 'Granville closed', global: false,
      routeIds: ['P2P_EXPRESS'], stopIds: ['10044065'], startsAt: '2026-09-14T00:00:00.000Z', endsAt: null,
    });
  });

  it('is active only between start and end', () => {
    const m = { startsAt: '2026-09-14T00:00:00.000Z', endsAt: '2026-09-15T00:00:00.000Z' };
    expect(n.isMessageActive(m, Date.parse('2026-09-14T12:00:00Z'))).toBe(true);
    expect(n.isMessageActive(m, Date.parse('2026-09-16T12:00:00Z'))).toBe(false);
    expect(n.isMessageActive({ startsAt: null, endsAt: null }, NOW)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- tests/server/normalize.test.ts`
Expected: FAIL, because `server/gmv/normalize.cjs` cannot be found.

- [ ] **Step 3: Create `server/gmv/normalize.cjs`**

```js
/**
 * Pure mappers from GMV Syncromatics payloads to the shapes served by /api/live/*.
 */

const { decodePolyline, lineLengthMeters } = require('./polyline.cjs');
const { SPEED_TO_MPS, STALE_VEHICLE_SEC } = require('./config.cjs');

function numOrNull(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function isoOrNull(v) {
  if (!v) return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/** GMV documents schedulePrediction as both "false" and false. */
function toBool(v) {
  return v === true || v === 'true';
}

function normalizeStop(raw) {
  return { id: String(raw.id), name: String(raw.name || '').trim(), lat: raw.lat, lon: raw.lon };
}

function normalizePattern(rawPattern, rawPatternStops) {
  const coordinates = decodePolyline(rawPattern.shape);
  const sorted = (rawPatternStops || [])
    .filter((e) => e && e.stop && e.stop.id != null)
    .slice()
    .sort((a, b) => (a.stopSequence ?? 0) - (b.stopSequence ?? 0));
  const stops = [];
  for (const entry of sorted) {
    const stopId = String(entry.stop.id);
    if (stops.length && stops[stops.length - 1].stopId === stopId) continue;
    stops.push({ stopId, sequence: entry.stopSequence ?? stops.length, distAlong: numOrNull(entry.shapeDistanceTraveled) ?? 0 });
  }
  return {
    id: rawPattern.id,
    name: String(rawPattern.name || '').trim(),
    geometry: { type: 'LineString', coordinates },
    lengthMeters: Math.round(lineLengthMeters(coordinates)),
    stops,
  };
}

function normalizeVehicle(raw, route, nowMs) {
  const lastUpdated = isoOrNull(raw.lastUpdated);
  const speed = numOrNull(raw.speed);
  const load = numOrNull(raw.passengerLoad);
  return {
    id: String(raw.id),
    name: raw.name ? String(raw.name) : `Bus ${raw.id}`,
    routeId: route.id,
    routeName: route.name,
    patternId: numOrNull(raw.pattern_id ?? raw.patternId),
    lat: raw.lat,
    lon: raw.lon,
    heading: numOrNull(raw.headingDegrees) ?? 0,
    speedMps: speed == null ? null : speed * SPEED_TO_MPS,
    distAlong: numOrNull(raw.shapeDistanceTraveled),
    capacity: numOrNull(raw.capacity),
    load: load == null ? null : Math.min(1, Math.max(0, load)),
    lastUpdated,
    stale: lastUpdated ? nowMs - Date.parse(lastUpdated) > STALE_VEHICLE_SEC * 1000 : false,
    nextStopId: null,
    nextStopEtaSec: null,
    upcomingStops: [],
  };
}

function buildArrivalIndexes(groups) {
  const byVehicle = {};
  const byStop = {};
  for (const { routeId, arrivals } of groups) {
    for (const a of arrivals || []) {
      if (!a || !a.stop || a.stop.id == null || typeof a.secondsToArrival !== 'number') continue;
      const stopId = String(a.stop.id);
      const vehicleId = a.vehicle && a.vehicle.id != null ? String(a.vehicle.id) : null;
      const etaSec = Math.max(0, Math.round(a.secondsToArrival));
      (byStop[stopId] ||= []).push({ routeId, vehicleId, etaSec, scheduled: toBool(a.schedulePrediction) });
      if (vehicleId) (byVehicle[vehicleId] ||= []).push({ stopId, etaSec });
    }
  }
  for (const list of Object.values(byStop)) list.sort((x, y) => x.etaSec - y.etaSec);
  for (const list of Object.values(byVehicle)) list.sort((x, y) => x.etaSec - y.etaSec);
  return { byVehicle, byStop };
}

function attachUpcomingStops(vehicle, byVehicle) {
  const upcomingStops = byVehicle[vehicle.id] || [];
  return {
    ...vehicle,
    upcomingStops,
    nextStopId: upcomingStops.length ? upcomingStops[0].stopId : null,
    nextStopEtaSec: upcomingStops.length ? upcomingStops[0].etaSec : null,
  };
}

function normalizeMessage(raw, routes) {
  const assignments = raw.assignments || {};
  return {
    id: String(raw.id),
    title: String(raw.name || '').trim(),
    body: String(raw.text || '').trim(),
    global: !!assignments.global,
    routeIds: (assignments.routes || []).map((r) => routes[r.id] && routes[r.id].id).filter(Boolean),
    stopIds: (assignments.stops || []).map((s) => String(s.id)),
    startsAt: isoOrNull(raw.start),
    endsAt: isoOrNull(raw.end),
  };
}

function isMessageActive(message, nowMs) {
  const start = message.startsAt ? Date.parse(message.startsAt) : -Infinity;
  const end = message.endsAt ? Date.parse(message.endsAt) : Infinity;
  return start <= nowMs && nowMs <= end;
}

module.exports = {
  normalizeStop,
  normalizePattern,
  normalizeVehicle,
  buildArrivalIndexes,
  attachUpcomingStops,
  normalizeMessage,
  isMessageActive,
};
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test -- tests/server/normalize.test.ts`
Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add server/gmv/normalize.cjs tests/server/normalize.test.ts
git commit -m "$(printf 'Add GMV payload normalizers\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')"
```

### Task 6: Network and snapshot service

**Files:**
- Create: `server/gmv/service.cjs`
- Test: `tests/server/service.test.ts`

**Interfaces:**
- Consumes: `createTtlCache`, the normalizers from Task 5, and the config constants.
- Produces: `createGmvService({ client, cache?, now?, routes?, defaultPattern? }) → { getNetwork(), getSnapshot(), diagnostics() }`.
  - `getNetwork()` → `{ routes: [{ id, gmvId, name, shortName, color, textColor, defaultPatternId, patterns }], stops: [{ id, name, lat, lon }] }`. It rejects if GMV is unreachable and nothing is cached.
  - `getSnapshot()` → `{ fetchedAt, status: 'live' | 'no-service' | 'degraded' | 'unavailable', activePatternIds, vehicles, arrivalsByStop, messages }`. It never rejects.
  - `diagnostics()` → `{ configured, callCount, lastSuccessAt, lastErrorAt, lastError, cacheHits }`.
- GMV calls:
  - Network: `/routes`, `/routes/{gmvId}/patterns`, `/routes/{gmvId}/patterns/{patternId}/stops`.
  - Snapshot: `/routes/{gmvId}/vehicles` per route, `/routes/{gmvId}/patterns/{patternId}/arrivals` per active pattern, and `/v2/messages`.

- [ ] **Step 1: Write the failing test `tests/server/service.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createGmvService } = require('../../server/gmv/service.cjs');
const { createTtlCache } = require('../../server/gmv/cache.cjs');

const SHAPE = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
const stop = (id: number, name: string, seq: number, dist: number) => ({
  stopSequence: seq, shapeDistanceTraveled: dist, stop: { id, name, lat: 35.9 + id / 1000, lon: -79.05 },
});

function fixtures(): Record<string, unknown> {
  return {
    '/routes': [
      { id: 6566, name: 'P2P Express', shortName: 'Express', color: '#383FFF', textColor: '#FFFFFF' },
      { id: 6564, name: 'Baity Hill', shortName: 'BH', color: '#AD42FF', textColor: '#FFFFFF' },
    ],
    '/routes/6566/patterns': [
      { id: 100, name: 'P2P Express', shape: SHAPE },
      { id: 101, name: 'Football - P2P Express', shape: SHAPE },
    ],
    '/routes/6564/patterns': [{ id: 200, name: 'Baity Hill', shape: SHAPE }],
    '/routes/6566/patterns/100/stops': [stop(1, 'Stop A', 0, 0), stop(2, 'Stop B', 1, 400)],
    '/routes/6566/patterns/101/stops': [stop(1, 'Stop A', 0, 0), stop(3, 'Stop C', 1, 700)],
    '/routes/6564/patterns/200/stops': [stop(2, 'Stop B', 0, 0), stop(4, 'Stop D', 1, 900)],
    '/routes/6566/vehicles': [{
      id: 9001, name: 'Bus 1', lat: 35.9, lon: -79.05, headingDegrees: 90, speed: 20, capacity: 40,
      passengerLoad: 0.5, lastUpdated: '2026-09-14T22:59:50Z', shapeDistanceTraveled: 100, pattern_id: 100,
    }],
    '/routes/6564/vehicles': [],
    '/routes/6566/patterns/100/arrivals': [
      { vehicle: { id: 9001 }, stop: { id: 2 }, secondsToArrival: 120, schedulePrediction: false },
      { vehicle: { id: 9001 }, stop: { id: 1 }, secondsToArrival: 400, schedulePrediction: 'false' },
      { vehicle: null, stop: { id: 1 }, secondsToArrival: 900, schedulePrediction: true },
    ],
    '/v2/messages': [
      { id: 5, name: 'Detour', text: 'Granville closed', start: null, end: null, assignments: { global: false, routes: [{ id: 6566 }], stops: [] } },
      { id: 6, name: 'Other portal', text: 'x', start: null, end: null, assignments: { global: false, routes: [{ id: 1 }], stops: [] } },
    ],
  };
}

function fakeClient(data: Record<string, unknown>) {
  const state = { failing: false, calls: [] as string[] };
  return {
    state,
    async get(path: string) {
      state.calls.push(path);
      if (state.failing) throw Object.assign(new Error('GMV down'), { code: 'NETWORK' });
      if (!(path in data)) throw Object.assign(new Error(`404 ${path}`), { status: 404 });
      return structuredClone(data[path]);
    },
    stats: () => ({ configured: true, callCount: state.calls.length, lastSuccessAt: null, lastErrorAt: null, lastError: null }),
  };
}

function setup(data = fixtures()) {
  let t = Date.parse('2026-09-14T23:00:00Z');
  const now = () => t;
  const client = fakeClient(data);
  const service = createGmvService({
    client, now, cache: createTtlCache({ now }),
    defaultPattern: { P2P_EXPRESS: 101, BAITY_HILL: 999 },
  });
  return { service, client, advance: (ms: number) => { t += ms; } };
}

describe('getNetwork', () => {
  it('builds routes with canonical ids, decoded patterns and deduped stops', async () => {
    const { service } = setup();
    const net = await service.getNetwork();
    const express = net.routes.find((r: any) => r.id === 'P2P_EXPRESS');
    expect(express).toMatchObject({ gmvId: 6566, name: 'P2P Express', shortName: 'Express', color: '#383FFF' });
    expect(express.patterns.map((p: any) => p.id)).toEqual([100, 101]);
    expect(express.patterns[0].geometry.coordinates).toHaveLength(3);
    expect(net.stops.map((s: any) => s.id).sort()).toEqual(['1', '2', '3', '4']);
  });

  it('picks the configured default pattern, falling back to the one named like the route', async () => {
    const { service } = setup();
    const net = await service.getNetwork();
    expect(net.routes.find((r: any) => r.id === 'P2P_EXPRESS').defaultPatternId).toBe(101);
    expect(net.routes.find((r: any) => r.id === 'BAITY_HILL').defaultPatternId).toBe(200);
  });

  it('prefers the pattern buses were last seen on', async () => {
    const { service } = setup();
    await service.getSnapshot();
    const net = await service.getNetwork();
    expect(net.routes.find((r: any) => r.id === 'P2P_EXPRESS').defaultPatternId).toBe(100);
  });
});

describe('getSnapshot', () => {
  it('returns live vehicles with next stops, per-stop arrivals, active patterns and messages', async () => {
    const { service } = setup();
    const snap = await service.getSnapshot();
    expect(snap.status).toBe('live');
    expect(snap.activePatternIds).toEqual({ P2P_EXPRESS: 100 });
    expect(snap.vehicles).toHaveLength(1);
    expect(snap.vehicles[0]).toMatchObject({ id: '9001', routeId: 'P2P_EXPRESS', nextStopId: '2', nextStopEtaSec: 120, stale: false });
    expect(snap.arrivalsByStop['1'].map((a: any) => a.etaSec)).toEqual([400, 900]);
    expect(snap.messages).toHaveLength(1);
    expect(snap.messages[0].routeIds).toEqual(['P2P_EXPRESS']);
  });

  it('reports no-service when GMV returns no vehicles', async () => {
    const data = fixtures();
    data['/routes/6566/vehicles'] = [];
    const { service } = setup(data);
    const snap = await service.getSnapshot();
    expect(snap.status).toBe('no-service');
    expect(snap.vehicles).toEqual([]);
  });

  it('serves the last snapshot as degraded for 30 s after a failure, then unavailable', async () => {
    const { service, client, advance } = setup();
    await service.getSnapshot();
    client.state.failing = true;
    advance(10_000);
    const degraded = await service.getSnapshot();
    expect(degraded.status).toBe('degraded');
    expect(degraded.vehicles).toHaveLength(1);
    advance(30_000);
    const unavailable = await service.getSnapshot();
    expect(unavailable.status).toBe('unavailable');
    expect(unavailable.vehicles).toEqual([]);
  });

  it('reports unavailable when the key is missing', async () => {
    const { service, client } = setup();
    client.get = async () => { throw Object.assign(new Error('GMV_RTPI_API_KEY is not set'), { code: 'MISSING_KEY' }); };
    const snap = await service.getSnapshot();
    expect(snap).toMatchObject({ status: 'unavailable', vehicles: [], arrivalsByStop: {}, messages: [] });
  });

  it('hits each vehicle endpoint at most once per 6 s across concurrent requests', async () => {
    const { service, client } = setup();
    await Promise.all([service.getSnapshot(), service.getSnapshot(), service.getSnapshot()]);
    expect(client.state.calls.filter((c) => c === '/routes/6566/vehicles')).toHaveLength(1);
  });

  it('falls back to the default pattern for arrivals when vehicles omit pattern_id', async () => {
    const data = fixtures();
    (data['/routes/6566/vehicles'] as any[])[0].pattern_id = undefined;
    data['/routes/6566/patterns/101/arrivals'] = [];
    const { service, client } = setup(data);
    await service.getSnapshot();
    expect(client.state.calls).toContain('/routes/6566/patterns/101/arrivals');
  });
});

describe('diagnostics', () => {
  it('exposes client stats and cache hits without the key', async () => {
    const { service } = setup();
    await service.getSnapshot();
    await service.getSnapshot();
    const d = service.diagnostics();
    expect(d.configured).toBe(true);
    expect(d.cacheHits).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- tests/server/service.test.ts`
Expected: FAIL, because `server/gmv/service.cjs` cannot be found.

- [ ] **Step 3: Create `server/gmv/service.cjs`**

```js
/**
 * Builds the /api/live/network and /api/live/snapshot payloads from GMV, cached in memory only.
 */

const config = require('./config.cjs');
const { createTtlCache } = require('./cache.cjs');
const {
  normalizeStop,
  normalizePattern,
  normalizeVehicle,
  buildArrivalIndexes,
  attachUpcomingStops,
  normalizeMessage,
  isMessageActive,
} = require('./normalize.cjs');

function mostCommon(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  let best = null;
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

function createGmvService({
  client,
  cache = createTtlCache(),
  now = Date.now,
  routes = config.ROUTES,
  defaultPattern = config.DEFAULT_PATTERN,
} = {}) {
  const routeList = Object.entries(routes).map(([gmvId, r]) => ({ gmvId: Number(gmvId), id: r.id, name: r.name }));
  /** Route id → pattern id most recently reported by its buses (in memory only). */
  const lastSeenPattern = {};

  async function buildNetwork() {
    const rawRoutes = await client.get('/routes');
    const stopsById = new Map();
    const builtRoutes = await Promise.all(
      routeList.map(async (route) => {
        const raw = (Array.isArray(rawRoutes) ? rawRoutes : []).find((r) => r.id === route.gmvId) || {};
        const rawPatterns = await client.get(`/routes/${route.gmvId}/patterns`);
        const patterns = await Promise.all(
          (Array.isArray(rawPatterns) ? rawPatterns : []).map(async (p) => {
            const rawStops = await client.get(`/routes/${route.gmvId}/patterns/${p.id}/stops`);
            for (const entry of Array.isArray(rawStops) ? rawStops : []) {
              if (entry && entry.stop && entry.stop.id != null) stopsById.set(String(entry.stop.id), normalizeStop(entry.stop));
            }
            return normalizePattern(p, rawStops);
          })
        );
        return {
          id: route.id,
          gmvId: route.gmvId,
          name: route.name,
          shortName: raw.shortName || route.name,
          color: raw.color || null,
          textColor: raw.textColor || null,
          patterns,
        };
      })
    );
    return { routes: builtRoutes, stops: [...stopsById.values()] };
  }

  function resolveDefaultPatternId(route) {
    const ids = route.patterns.map((p) => p.id);
    for (const candidate of [lastSeenPattern[route.id], defaultPattern[route.id]]) {
      if (candidate != null && ids.includes(candidate)) return candidate;
    }
    const named = route.patterns.find((p) => p.name === route.name);
    return named ? named.id : ids.length ? ids[0] : null;
  }

  async function getNetwork() {
    const { value } = await cache.getOrFetch('network', config.NETWORK_TTL_MS, buildNetwork, {
      staleMs: config.NETWORK_STALE_MS,
    });
    return { ...value, routes: value.routes.map((r) => ({ ...r, defaultPatternId: resolveDefaultPatternId(r) })) };
  }

  async function getMessages() {
    try {
      const { value } = await cache.getOrFetch(
        'messages',
        config.MESSAGES_TTL_MS,
        async () => {
          const raw = await client.get('/v2/messages');
          return (Array.isArray(raw) ? raw : [])
            .map((m) => normalizeMessage(m, routes))
            .filter((m) => m.global || m.routeIds.length > 0 || m.stopIds.length > 0);
        },
        { staleMs: config.MESSAGES_STALE_MS }
      );
      const t = now();
      return value.filter((m) => isMessageActive(m, t));
    } catch {
      return [];
    }
  }

  async function buildSnapshotCore() {
    const t = now();
    const perRoute = await Promise.all(
      routeList.map(async (route) => {
        const raw = await client.get(`/routes/${route.gmvId}/vehicles`);
        return { route, vehicles: (Array.isArray(raw) ? raw : []).map((v) => normalizeVehicle(v, route, t)) };
      })
    );

    const activePatternIds = {};
    const arrivalRequests = [];
    for (const { route, vehicles } of perRoute) {
      if (vehicles.length === 0) continue;
      const reported = vehicles.map((v) => v.patternId).filter((id) => id != null);
      if (reported.length > 0) lastSeenPattern[route.id] = mostCommon(reported);
      const patternIds = new Set(reported);
      if (patternIds.size === 0) {
        const fallback = lastSeenPattern[route.id] ?? defaultPattern[route.id];
        if (fallback != null) patternIds.add(fallback);
      }
      if (patternIds.size > 0) activePatternIds[route.id] = reported.length > 0 ? mostCommon(reported) : [...patternIds][0];
      for (const patternId of patternIds) arrivalRequests.push({ route, patternId });
    }

    const groups = await Promise.all(
      arrivalRequests.map(async ({ route, patternId }) => {
        try {
          return { routeId: route.id, arrivals: await client.get(`/routes/${route.gmvId}/patterns/${patternId}/arrivals`) };
        } catch {
          return { routeId: route.id, arrivals: [] };
        }
      })
    );
    const { byVehicle, byStop } = buildArrivalIndexes(groups);
    const vehicles = perRoute.flatMap((r) => r.vehicles).map((v) => attachUpcomingStops(v, byVehicle));

    return {
      fetchedAt: new Date(t).toISOString(),
      status: vehicles.length > 0 ? 'live' : 'no-service',
      activePatternIds,
      vehicles,
      arrivalsByStop: byStop,
    };
  }

  async function getSnapshot() {
    const [messages, core] = await Promise.all([
      getMessages(),
      cache
        .getOrFetch('snapshot', config.SNAPSHOT_TTL_MS, buildSnapshotCore, { staleMs: config.SNAPSHOT_STALE_MS })
        .catch(() => null),
    ]);
    if (!core) {
      return {
        fetchedAt: new Date(now()).toISOString(),
        status: 'unavailable',
        activePatternIds: {},
        vehicles: [],
        arrivalsByStop: {},
        messages,
      };
    }
    return { ...core.value, status: core.stale ? 'degraded' : core.value.status, messages };
  }

  function diagnostics() {
    return { ...client.stats(), cacheHits: cache.stats().hits };
  }

  return { getNetwork, getSnapshot, diagnostics };
}

module.exports = { createGmvService };
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test -- tests/server/service.test.ts`
Expected: 10 passed.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/gmv/service.cjs tests/server/service.test.ts
git commit -m "$(printf 'Add GMV network and snapshot service\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')"
```

### Task 7: Serve `/api/live/*` and GMV diagnostics

**Files:**
- Modify: `server/index.cjs`

**Interfaces:**
- Consumes: `createGmvClient`, `createGmvService`.
- Produces:
  - `GET /api/live/network`: 200 with JSON and `Cache-Control: public, max-age=300`, or 503 `{ error }`.
  - `GET /api/live/snapshot`: always 200 with JSON and `Cache-Control: no-store`.
  - `GET /api/admin/diagnostics` gains `env.gmvKeyConfigured` and `gmv: { configured, callCount, lastSuccessAt, lastErrorAt, lastError, cacheHits }`.
  - Query strings are ignored when matching both new paths.

- [ ] **Step 1: Wire up the service**

In `server/index.cjs`, after the `const fs = require('fs');` line, add:

```js
const { createGmvClient } = require('./gmv/client.cjs');
const { createGmvService } = require('./gmv/service.cjs');
```

After `const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;`, add:

```js
const GMV_RTPI_API_KEY = process.env.GMV_RTPI_API_KEY;
const gmv = createGmvService({ client: createGmvClient({ apiKey: GMV_RTPI_API_KEY }) });
```

- [ ] **Step 2: Add the endpoints**

Immediately before the line `if (req.url === '/api/admin/diagnostics' && req.method === 'GET') {`, add:

```js
  const pathname = (req.url || '').split('?')[0];

  if (pathname === '/api/live/network' && req.method === 'GET') {
    gmv
      .getNetwork()
      .then((network) => {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' });
        res.end(JSON.stringify(network));
      })
      .catch((err) => {
        console.error('GMV network error:', err.message);
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Transit network unavailable' }));
      });
    return;
  }

  if (pathname === '/api/live/snapshot' && req.method === 'GET') {
    gmv
      .getSnapshot()
      .then((snapshot) => {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(snapshot));
      })
      .catch((err) => {
        console.error('GMV snapshot error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Snapshot failed' }));
      });
    return;
  }

```

- [ ] **Step 3: Extend diagnostics**

In the diagnostics response, change the `env` object to:

```js
        env: {
          nodeEnv: process.env.NODE_ENV || 'development',
          mapboxTokenConfigured: !!MAPBOX_TOKEN,
          geminiKeyConfigured: !!GEMINI_API_KEY,
          geminiModel: GEMINI_MODEL,
          gmvKeyConfigured: !!GMV_RTPI_API_KEY,
        },
        gmv: gmv.diagnostics(),
```

- [ ] **Step 4: Add a startup warning**

In the `server.listen` callback, after the `MAPBOX_TOKEN` warning, add:

```js
  if (!GMV_RTPI_API_KEY) {
    console.warn('Warning: GMV_RTPI_API_KEY not set. /api/live/* will report status "unavailable".');
  }
```

- [ ] **Step 5: Verify against the live GMV API**

Start the server in the background with `npm run server`, then run:

```bash
curl -s localhost:3001/api/live/network | python3 -c "import json,sys; d=json.load(sys.stdin); print([(r['id'], r['defaultPatternId'], len(r['patterns'])) for r in d['routes']], len(d['stops']), 'stops')"
curl -s localhost:3001/api/live/snapshot | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['status'], len(d['vehicles']), 'vehicles', list(d['activePatternIds'].items()), len(d['messages']), 'messages')"
curl -s localhost:3001/api/admin/diagnostics | python3 -c "import json,sys; print(json.load(sys.stdin)['gmv'])"
set -a; source .env; set +a; curl -s localhost:3001/api/admin/diagnostics localhost:3001/api/live/snapshot localhost:3001/api/live/network | grep -c "$GMV_RTPI_API_KEY"
```

Expected:
- Network: `[('P2P_EXPRESS', 31799, 6), ('BAITY_HILL', 31798, 3)]` and roughly 45 stops.
- Snapshot outside 7 PM–3 AM: `no-service 0 vehicles`. During service: `live` with vehicles.
- Diagnostics: `configured: True` and a non-zero `callCount`.
- The final grep prints `0` (the key never appears in any response).

Stop the server.

- [ ] **Step 6: Run the tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add server/index.cjs
git commit -m "$(printf 'Serve /api/live/network and /api/live/snapshot from GMV\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')"
```

## Phase 2 — Rider map, bus list, bus detail

### Task 8: Client transit types, route constants, stop names, API and selectors

**Files:**
- Modify: `types.ts`, `utils/format.ts`
- Create: `data/routes.ts`, `data/stopDisplayNames.ts`, `utils/transitApi.ts`, `utils/transitSelectors.ts`, `tests/fixtures/transit.ts`
- Test: `tests/utils/transitSelectors.test.ts`, `tests/utils/format.test.ts`, `tests/utils/transitApi.test.ts`

**Interfaces:**
- Produces (types): `RouteId`, `PatternStop`, `RoutePattern`, `NetworkRoute`, `TransitNetwork`, `LiveStatus`, `ClientLiveStatus`, `LiveUpcomingStop`, `LiveVehicle`, `LiveStopArrival`, `ServiceMessage`, `LiveSnapshot`, `StopArrival` (exact shapes in Step 1). The existing `Stop`, `Vehicle` and `UpcomingStop` stay untouched for now; `Vehicle` and `UpcomingStop` are removed in Task 12.
- Produces (`data/routes.ts`): `ROUTE_IDS: readonly RouteId[]`, `ROUTE_NAMES: Record<RouteId, string>`, `ROUTE_COLORS: Record<RouteId, string>`, `routeIdFromName(name: string): RouteId | null`.
- Produces (`data/stopDisplayNames.ts`): `STOP_DISPLAY_NAMES`, `displayStopName(stopId: string, gmvName: string): string`.
- Produces (`utils/transitApi.ts`): `fetchNetwork(signal?) → Promise<TransitNetwork>` (display names applied), `fetchSnapshot(signal?) → Promise<LiveSnapshot>`, `withDisplayNames(network) → TransitNetwork`.
- Produces (`utils/transitSelectors.ts`):
  - `getRoute(network, routeId) → NetworkRoute | null`
  - `getPattern(network, patternId) → RoutePattern | null`
  - `getActivePattern(network, snapshot, routeId) → RoutePattern | null`
  - `getStopById(network, stopId) → Stop | null`
  - `getRouteStops(network, snapshot, routeId) → Stop[]`
  - `getActiveStops(network, snapshot) → Stop[]`
  - `getRoutesServingStop(network, snapshot, stopId) → RouteId[]`
  - `activePatternKey(snapshot) → string` (a stable memo key)
- Produces (`utils/format.ts`): `formatEta(etaSec: number | null | undefined): string`.
- Produces (tests): `tests/fixtures/transit.ts` exports `makeNetwork()`, `makeVehicle(overrides?)` and `makeSnapshot(overrides?)`, used by every later client test.

- [ ] **Step 1: Add the types to `types.ts`**

Append to the end of `types.ts`:

```ts
// ---------------------------------------------------------------------------
// Live transit (GMV Syncromatics via /api/live/*)
// ---------------------------------------------------------------------------

/** Canonical route ids (GMV routes 6566 and 6564). */
export type RouteId = 'P2P_EXPRESS' | 'BAITY_HILL';

export interface PatternStop {
  stopId: string;
  sequence: number;
  /** Meters along the pattern line from its start. */
  distAlong: number;
}

/** One GMV route variant (e.g. "P2P Express", "Football - P2P Express"). */
export interface RoutePattern {
  id: number;
  name: string;
  geometry: LineStringGeometry;
  lengthMeters: number;
  stops: PatternStop[];
}

export interface NetworkRoute {
  id: RouteId;
  gmvId: number;
  name: string;
  shortName: string;
  color: string | null;
  textColor: string | null;
  defaultPatternId: number | null;
  patterns: RoutePattern[];
}

export interface TransitNetwork {
  routes: NetworkRoute[];
  stops: Stop[];
}

export type LiveStatus = 'live' | 'no-service' | 'degraded' | 'unavailable';
/** Client-side status: adds 'loading' before the first snapshot attempt. */
export type ClientLiveStatus = LiveStatus | 'loading';

export interface LiveUpcomingStop {
  stopId: string;
  etaSec: number;
}

export interface LiveVehicle {
  id: string;
  name: string;
  routeId: RouteId;
  routeName: string;
  patternId: number | null;
  lat: number;
  lon: number;
  heading: number;
  speedMps: number | null;
  /** Meters along the vehicle's pattern line at `lastUpdated`. */
  distAlong: number | null;
  capacity: number | null;
  /** Passenger load, 0–1. */
  load: number | null;
  lastUpdated: string | null;
  /** True when GMV has not updated this vehicle for more than 90 s. */
  stale: boolean;
  nextStopId: string | null;
  nextStopEtaSec: number | null;
  upcomingStops: LiveUpcomingStop[];
}

export interface LiveStopArrival {
  routeId: RouteId;
  vehicleId: string | null;
  etaSec: number;
  /** GMV schedulePrediction: true when this is a timetable estimate, not a live prediction. */
  scheduled: boolean;
}

export interface ServiceMessage {
  id: string;
  title: string;
  body: string;
  global: boolean;
  routeIds: RouteId[];
  stopIds: string[];
  startsAt: string | null;
  endsAt: string | null;
}

export interface LiveSnapshot {
  fetchedAt: string;
  status: LiveStatus;
  activePatternIds: Partial<Record<RouteId, number>>;
  vehicles: LiveVehicle[];
  arrivalsByStop: Record<string, LiveStopArrival[]>;
  messages: ServiceMessage[];
}

/** An arrival as shown in the UI, from live data or the timetable. */
export interface StopArrival {
  routeId: RouteId;
  routeName: string;
  etaSec: number;
  source: 'live' | 'scheduled';
  vehicleId: string | null;
}
```

- [ ] **Step 2: Write the test fixtures `tests/fixtures/transit.ts`**

```ts
import type { LiveSnapshot, LiveVehicle, TransitNetwork } from '../../types';

/** A small L-shaped line near campus, [lng, lat]. */
export const LINE: [number, number][] = [
  [-79.05, 35.9],
  [-79.04, 35.9],
  [-79.04, 35.91],
  [-79.05, 35.91],
];

export function makeNetwork(): TransitNetwork {
  return {
    routes: [
      {
        id: 'P2P_EXPRESS', gmvId: 6566, name: 'P2P Express', shortName: 'Express', color: '#383FFF', textColor: '#FFFFFF',
        defaultPatternId: 10,
        patterns: [
          {
            id: 10, name: 'P2P Express', geometry: { type: 'LineString', coordinates: LINE }, lengthMeters: 3000,
            stops: [
              { stopId: 'a', sequence: 0, distAlong: 0 },
              { stopId: 'b', sequence: 1, distAlong: 900 },
              { stopId: 'c', sequence: 2, distAlong: 2000 },
            ],
          },
          {
            id: 11, name: 'Football - P2P Express', geometry: { type: 'LineString', coordinates: LINE }, lengthMeters: 3000,
            stops: [
              { stopId: 'a', sequence: 0, distAlong: 0 },
              { stopId: 'd', sequence: 1, distAlong: 2500 },
            ],
          },
        ],
      },
      {
        id: 'BAITY_HILL', gmvId: 6564, name: 'Baity Hill', shortName: 'BH', color: '#AD42FF', textColor: '#FFFFFF',
        defaultPatternId: 20,
        patterns: [
          {
            id: 20, name: 'Baity Hill', geometry: { type: 'LineString', coordinates: LINE }, lengthMeters: 2500,
            stops: [
              { stopId: 'c', sequence: 0, distAlong: 0 },
              { stopId: 'e', sequence: 1, distAlong: 1200 },
            ],
          },
        ],
      },
    ],
    stops: [
      { id: 'a', name: 'Stop A', lat: 35.9, lon: -79.05 },
      { id: 'b', name: 'Stop B', lat: 35.9, lon: -79.04 },
      { id: 'c', name: 'Stop C', lat: 35.91, lon: -79.04 },
      { id: 'd', name: 'Stop D', lat: 35.91, lon: -79.05 },
      { id: 'e', name: 'Stop E', lat: 35.905, lon: -79.045 },
    ],
  };
}

export function makeVehicle(overrides: Partial<LiveVehicle> = {}): LiveVehicle {
  return {
    id: 'v1', name: 'Bus 1', routeId: 'P2P_EXPRESS', routeName: 'P2P Express', patternId: 10,
    lat: 35.9, lon: -79.045, heading: 90, speedMps: 5, distAlong: 450, capacity: 40, load: 0.5,
    lastUpdated: '2026-09-14T23:00:00.000Z', stale: false,
    nextStopId: 'b', nextStopEtaSec: 90,
    upcomingStops: [{ stopId: 'b', etaSec: 90 }, { stopId: 'c', etaSec: 300 }],
    ...overrides,
  };
}

export function makeSnapshot(overrides: Partial<LiveSnapshot> = {}): LiveSnapshot {
  return {
    fetchedAt: '2026-09-14T23:00:05.000Z',
    status: 'live',
    activePatternIds: { P2P_EXPRESS: 10 },
    vehicles: [makeVehicle()],
    arrivalsByStop: {
      b: [{ routeId: 'P2P_EXPRESS', vehicleId: 'v1', etaSec: 90, scheduled: false }],
      c: [{ routeId: 'P2P_EXPRESS', vehicleId: 'v1', etaSec: 300, scheduled: false }],
    },
    messages: [],
    ...overrides,
  };
}
```

- [ ] **Step 3: Write the failing tests**

`tests/utils/transitSelectors.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  activePatternKey, getActivePattern, getActiveStops, getPattern, getRoute, getRouteStops, getRoutesServingStop, getStopById,
} from '../../utils/transitSelectors';
import { makeNetwork, makeSnapshot } from '../fixtures/transit';

describe('transitSelectors', () => {
  const network = makeNetwork();

  it('finds routes, patterns and stops by id', () => {
    expect(getRoute(network, 'BAITY_HILL')?.gmvId).toBe(6564);
    expect(getPattern(network, 11)?.name).toBe('Football - P2P Express');
    expect(getPattern(network, 999)).toBeNull();
    expect(getStopById(network, 'e')?.name).toBe('Stop E');
    expect(getRoute(null, 'BAITY_HILL')).toBeNull();
  });

  it('uses the snapshot active pattern, else the network default', () => {
    expect(getActivePattern(network, makeSnapshot({ activePatternIds: { P2P_EXPRESS: 11 } }), 'P2P_EXPRESS')?.id).toBe(11);
    expect(getActivePattern(network, null, 'P2P_EXPRESS')?.id).toBe(10);
    expect(getActivePattern(network, makeSnapshot({ activePatternIds: { P2P_EXPRESS: 404 } }), 'P2P_EXPRESS')?.id).toBe(10);
  });

  it('returns ordered stops of the active pattern', () => {
    expect(getRouteStops(network, null, 'P2P_EXPRESS').map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('unions active stops across routes without duplicates', () => {
    expect(getActiveStops(network, null).map((s) => s.id)).toEqual(['a', 'b', 'c', 'e']);
  });

  it('lists routes serving a stop on their active pattern only', () => {
    expect(getRoutesServingStop(network, null, 'c')).toEqual(['P2P_EXPRESS', 'BAITY_HILL']);
    expect(getRoutesServingStop(network, makeSnapshot({ activePatternIds: { P2P_EXPRESS: 11 } }), 'c')).toEqual(['BAITY_HILL']);
  });

  it('builds a stable key from active pattern ids', () => {
    expect(activePatternKey(makeSnapshot({ activePatternIds: { BAITY_HILL: 20, P2P_EXPRESS: 10 } }))).toBe('BAITY_HILL:20|P2P_EXPRESS:10');
    expect(activePatternKey(null)).toBe('');
  });
});
```

`tests/utils/format.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatEta } from '../../utils/format';

describe('formatEta', () => {
  it('says Arriving under a minute', () => {
    expect(formatEta(0)).toBe('Arriving');
    expect(formatEta(59)).toBe('Arriving');
  });
  it('floors to whole minutes', () => {
    expect(formatEta(60)).toBe('1 min');
    expect(formatEta(119)).toBe('1 min');
    expect(formatEta(600)).toBe('10 min');
  });
  it('shows a dash for missing values', () => {
    expect(formatEta(null)).toBe('—');
    expect(formatEta(undefined)).toBe('—');
    expect(formatEta(Number.NaN)).toBe('—');
  });
});
```

`tests/utils/transitApi.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { withDisplayNames } from '../../utils/transitApi';
import { displayStopName } from '../../data/stopDisplayNames';
import { routeIdFromName } from '../../data/routes';
import { makeNetwork } from '../fixtures/transit';

describe('stop display names', () => {
  it('uses the friendly name when one is defined', () => {
    expect(displayStopName('10044083', 'Williamson Lot')).toBe('Smith Center Stadium (Williamson Lot)');
  });
  it('falls back to the trimmed GMV name', () => {
    expect(displayStopName('12494424', 'Frat Court ')).toBe('Frat Court');
  });
  it('applies names to every network stop', () => {
    const network = makeNetwork();
    network.stops.push({ id: '10044065', name: 'Ehringhaus', lat: 0, lon: 0 });
    const named = withDisplayNames(network);
    expect(named.stops.find((s) => s.id === '10044065')?.name).toBe('Ehringhaus Hall');
    expect(named.stops.find((s) => s.id === 'a')?.name).toBe('Stop A');
  });
});

describe('routeIdFromName', () => {
  it('matches display names case-insensitively', () => {
    expect(routeIdFromName('p2p express')).toBe('P2P_EXPRESS');
    expect(routeIdFromName('Baity Hill')).toBe('BAITY_HILL');
    expect(routeIdFromName('Unknown')).toBeNull();
  });
});
```

- [ ] **Step 4: Run the tests and confirm they fail**

Run: `npm test -- tests/utils`
Expected: FAIL, because the modules `transitSelectors`, `transitApi`, `stopDisplayNames` and `routes` don't exist and `formatEta` isn't exported.

- [ ] **Step 5: Create `data/routes.ts`**

```ts
import type { RouteId } from '../types';

export const ROUTE_IDS: readonly RouteId[] = ['P2P_EXPRESS', 'BAITY_HILL'];

export const ROUTE_NAMES: Record<RouteId, string> = {
  P2P_EXPRESS: 'P2P Express',
  BAITY_HILL: 'Baity Hill',
};

/** App brand colors (used instead of GMV's portal colors). */
export const ROUTE_COLORS: Record<RouteId, string> = {
  P2P_EXPRESS: '#418FC5',
  BAITY_HILL: '#C33934',
};

export function routeIdFromName(name: string): RouteId | null {
  const needle = name.trim().toLowerCase();
  return ROUTE_IDS.find((id) => ROUTE_NAMES[id].toLowerCase() === needle) ?? null;
}
```

- [ ] **Step 6: Create `data/stopDisplayNames.ts`**

```ts
/**
 * Friendlier names for GMV stops, keyed by GMV stop id.
 * Seeded from the previous hand-written stop list (matched within ~40 m). Stops not listed use GMV's name.
 */
export const STOP_DISPLAY_NAMES: Record<string, string> = {
  '10042055': 'Granville Towers East',
  '10042057': 'Spencer Hall',
  '10043024': 'UNC Student Union (Student Union)',
  '10043030': 'UNC Student Union (Student Union)',
  '10043117': 'Mason Farm Rd at Ambulatory Care Center (Ambulatory Care Center)',
  '10043118': 'Craige Parking Deck (Craige Deck)',
  '10043119': 'Hinton James/Horton (Horton Residence Hall)',
  '10043122': 'Mason Farm Road at Oteys Road (1351, 1401 Mason Farm)',
  '10043124': 'Ambulatory Care Center (Marsico Hall)',
  '10043125': 'Health Sciences Library (Health Sciences)',
  '10044065': 'Ehringhaus Hall',
  '10044068': 'Fetzer Gym (SRC/Union)',
  '10044069': 'Connor Hall (Connor)',
  '10044070': 'Lewis Hall (Lewis)',
  '10044071': 'Alderman Hall (Alderman)',
  '10044073': 'East Franklin Street at Henderson Street (Henderson)',
  '10044074': 'Varsity Theatre',
  '10044077': 'FedEx Center (McCauley)',
  '10044080': 'Avery Hall (Avery)',
  '10044081': 'Hinton James/Horton (Horton Residence Hall)',
  '10044083': 'Smith Center Stadium (Williamson Lot)',
  '10044084': 'Bowles Drive Tennis Courts (Rams 4)',
  '10044086': 'Craige Parking Deck (Craige Deck)',
};

export function displayStopName(stopId: string, gmvName: string): string {
  return STOP_DISPLAY_NAMES[stopId] ?? gmvName.trim();
}
```

- [ ] **Step 7: Create `utils/transitApi.ts`**

```ts
import type { LiveSnapshot, TransitNetwork } from '../types';
import { API } from './api';
import { displayStopName } from '../data/stopDisplayNames';

export function withDisplayNames(network: TransitNetwork): TransitNetwork {
  return { ...network, stops: network.stops.map((s) => ({ ...s, name: displayStopName(s.id, s.name) })) };
}

export async function fetchNetwork(signal?: AbortSignal): Promise<TransitNetwork> {
  const res = await fetch(`${API}/api/live/network`, { signal });
  if (!res.ok) throw new Error(`Transit network request failed (${res.status})`);
  return withDisplayNames((await res.json()) as TransitNetwork);
}

export async function fetchSnapshot(signal?: AbortSignal): Promise<LiveSnapshot> {
  const res = await fetch(`${API}/api/live/snapshot`, { signal, cache: 'no-store' });
  if (!res.ok) throw new Error(`Live snapshot request failed (${res.status})`);
  return (await res.json()) as LiveSnapshot;
}
```

- [ ] **Step 8: Create `utils/transitSelectors.ts`**

```ts
/**
 * Pure lookups over the transit network and the latest live snapshot.
 * "Active pattern" = the variant buses are running now, else the route's default.
 */

import type { LiveSnapshot, NetworkRoute, RouteId, RoutePattern, Stop, TransitNetwork } from '../types';
import { ROUTE_IDS } from '../data/routes';

const stopIndexCache = new WeakMap<TransitNetwork, Map<string, Stop>>();

function stopIndex(network: TransitNetwork): Map<string, Stop> {
  let index = stopIndexCache.get(network);
  if (!index) {
    index = new Map(network.stops.map((s) => [s.id, s]));
    stopIndexCache.set(network, index);
  }
  return index;
}

export function getRoute(network: TransitNetwork | null, routeId: RouteId): NetworkRoute | null {
  return network?.routes.find((r) => r.id === routeId) ?? null;
}

export function getPattern(network: TransitNetwork | null, patternId: number | null | undefined): RoutePattern | null {
  if (!network || patternId == null) return null;
  for (const route of network.routes) {
    const pattern = route.patterns.find((p) => p.id === patternId);
    if (pattern) return pattern;
  }
  return null;
}

export function getActivePattern(
  network: TransitNetwork | null,
  snapshot: LiveSnapshot | null,
  routeId: RouteId
): RoutePattern | null {
  const route = getRoute(network, routeId);
  if (!route) return null;
  const activeId = snapshot?.activePatternIds?.[routeId];
  return (
    route.patterns.find((p) => p.id === activeId) ??
    route.patterns.find((p) => p.id === route.defaultPatternId) ??
    route.patterns[0] ??
    null
  );
}

export function getStopById(network: TransitNetwork | null, stopId: string): Stop | null {
  return network ? stopIndex(network).get(stopId) ?? null : null;
}

export function getRouteStops(network: TransitNetwork | null, snapshot: LiveSnapshot | null, routeId: RouteId): Stop[] {
  const pattern = getActivePattern(network, snapshot, routeId);
  if (!network || !pattern) return [];
  const index = stopIndex(network);
  const seen = new Set<string>();
  const out: Stop[] = [];
  for (const ps of pattern.stops) {
    const stop = index.get(ps.stopId);
    if (!stop || seen.has(ps.stopId)) continue;
    seen.add(ps.stopId);
    out.push(stop);
  }
  return out;
}

export function getActiveStops(network: TransitNetwork | null, snapshot: LiveSnapshot | null): Stop[] {
  const seen = new Set<string>();
  const out: Stop[] = [];
  for (const routeId of ROUTE_IDS) {
    for (const stop of getRouteStops(network, snapshot, routeId)) {
      if (seen.has(stop.id)) continue;
      seen.add(stop.id);
      out.push(stop);
    }
  }
  return out;
}

export function getRoutesServingStop(
  network: TransitNetwork | null,
  snapshot: LiveSnapshot | null,
  stopId: string
): RouteId[] {
  return ROUTE_IDS.filter((routeId) =>
    getActivePattern(network, snapshot, routeId)?.stops.some((ps) => ps.stopId === stopId)
  );
}

/** Stable memo key for "which patterns are active", so memos don't rerun on every poll. */
export function activePatternKey(snapshot: LiveSnapshot | null): string {
  if (!snapshot) return '';
  return Object.entries(snapshot.activePatternIds)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([routeId, patternId]) => `${routeId}:${patternId}`)
    .join('|');
}
```

- [ ] **Step 9: Add `formatEta` to `utils/format.ts`**

Append:

```ts
/** Live ETA label: "Arriving" under a minute, otherwise whole minutes (floored). */
export function formatEta(etaSec: number | null | undefined): string {
  if (etaSec == null || !Number.isFinite(etaSec)) return '—';
  if (etaSec < 60) return 'Arriving';
  return `${Math.floor(etaSec / 60)} min`;
}
```

- [ ] **Step 10: Run the tests and typecheck**

Run: `npm test`
Expected: all pass.

Run: `npm run typecheck`
Expected: baseline errors only.

- [ ] **Step 11: Commit**

```bash
git add types.ts data/routes.ts data/stopDisplayNames.ts utils/transitApi.ts utils/transitSelectors.ts utils/format.ts tests/fixtures/transit.ts tests/utils/transitSelectors.test.ts tests/utils/format.test.ts tests/utils/transitApi.test.ts
git commit -m "$(printf 'Add live transit types, selectors and API client\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')"
```

### Task 9: TransitProvider (shared poller)

**Files:**
- Create: `utils/livePolling.ts`, `context/TransitProvider.tsx`
- Modify: `RouterApp.tsx`
- Test: `tests/utils/livePolling.test.ts`

**Interfaces:**
- Consumes: `fetchNetwork` and `fetchSnapshot` (Task 8).
- Produces (`utils/livePolling.ts`):
  - Constants `POLL_INTERVAL_MS = 6000` and `CLIENT_STALE_AFTER_MS = 30000`.
  - `nextPollDelayMs(consecutiveFailures) → 6000 | 12000 | 30000`.
  - `deriveClientStatus(snapshot, receivedAt, nowMs, attempted) → ClientLiveStatus`.
  - `visibleVehicles(snapshot, status) → LiveVehicle[]`.
- Produces (`context/TransitProvider.tsx`): `<TransitProvider>` and `useTransit() → { network, snapshot, status: ClientLiveStatus, vehicles: LiveVehicle[], snapshotReceivedAt: number | null, refreshing: boolean, refresh(): Promise<void> }`. `vehicles` is empty unless `status` is `'live'` or `'degraded'`.

- [ ] **Step 1: Write the failing test `tests/utils/livePolling.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { deriveClientStatus, nextPollDelayMs, visibleVehicles } from '../../utils/livePolling';
import { makeSnapshot } from '../fixtures/transit';

describe('nextPollDelayMs', () => {
  it('polls every 6 s and backs off to 12 s then 30 s on failures', () => {
    expect(nextPollDelayMs(0)).toBe(6000);
    expect(nextPollDelayMs(1)).toBe(12000);
    expect(nextPollDelayMs(2)).toBe(30000);
    expect(nextPollDelayMs(9)).toBe(30000);
  });
});

describe('deriveClientStatus', () => {
  const snap = makeSnapshot({ status: 'no-service' });

  it('is loading before the first attempt and unavailable after a failed one', () => {
    expect(deriveClientStatus(null, null, 1000, false)).toBe('loading');
    expect(deriveClientStatus(null, null, 1000, true)).toBe('unavailable');
  });

  it('passes the server status through while the snapshot is fresh', () => {
    expect(deriveClientStatus(snap, 1000, 20_000, true)).toBe('no-service');
  });

  it('becomes unavailable when the last snapshot is older than 30 s', () => {
    expect(deriveClientStatus(snap, 1000, 31_001, true)).toBe('unavailable');
  });
});

describe('visibleVehicles', () => {
  it('shows vehicles only for live or degraded data', () => {
    const snap = makeSnapshot();
    expect(visibleVehicles(snap, 'live')).toHaveLength(1);
    expect(visibleVehicles(snap, 'degraded')).toHaveLength(1);
    expect(visibleVehicles(snap, 'unavailable')).toEqual([]);
    expect(visibleVehicles(null, 'live')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- tests/utils/livePolling.test.ts`
Expected: FAIL, because the module cannot be found.

- [ ] **Step 3: Create `utils/livePolling.ts`**

```ts
import type { ClientLiveStatus, LiveSnapshot, LiveVehicle } from '../types';

export const POLL_INTERVAL_MS = 6000;
/** After this long without a successful snapshot the client treats live data as unavailable. */
export const CLIENT_STALE_AFTER_MS = 30000;

const BACKOFF_MS = [POLL_INTERVAL_MS, 12000, 30000];

export function nextPollDelayMs(consecutiveFailures: number): number {
  return BACKOFF_MS[Math.min(Math.max(consecutiveFailures, 0), BACKOFF_MS.length - 1)];
}

export function deriveClientStatus(
  snapshot: LiveSnapshot | null,
  receivedAt: number | null,
  nowMs: number,
  attempted: boolean
): ClientLiveStatus {
  if (!snapshot || receivedAt == null) return attempted ? 'unavailable' : 'loading';
  if (nowMs - receivedAt > CLIENT_STALE_AFTER_MS) return 'unavailable';
  return snapshot.status;
}

export function visibleVehicles(snapshot: LiveSnapshot | null, status: ClientLiveStatus): LiveVehicle[] {
  if (!snapshot || (status !== 'live' && status !== 'degraded')) return [];
  return snapshot.vehicles;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test -- tests/utils/livePolling.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Create `context/TransitProvider.tsx`**

```tsx
/**
 * Shared live-transit state: loads the network once and polls the snapshot every 6 s
 * while the tab is visible (backing off on errors). Mounted once in RouterApp.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ClientLiveStatus, LiveSnapshot, LiveVehicle, TransitNetwork } from '../types';
import { fetchNetwork, fetchSnapshot } from '../utils/transitApi';
import { deriveClientStatus, nextPollDelayMs, visibleVehicles } from '../utils/livePolling';

const NETWORK_RETRY_MS = 30000;

export interface TransitContextValue {
  network: TransitNetwork | null;
  snapshot: LiveSnapshot | null;
  status: ClientLiveStatus;
  /** Empty unless status is 'live' or 'degraded'. */
  vehicles: LiveVehicle[];
  /** Client clock (ms) when the current snapshot arrived. */
  snapshotReceivedAt: number | null;
  refreshing: boolean;
  refresh: () => Promise<void>;
}

const TransitContext = createContext<TransitContextValue | null>(null);

export function TransitProvider({ children }: { children: React.ReactNode }) {
  const [network, setNetwork] = useState<TransitNetwork | null>(null);
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [receivedAt, setReceivedAt] = useState<number | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const inFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const next = await fetchNetwork();
        if (!cancelled) setNetwork(next);
      } catch {
        if (!cancelled) timer = setTimeout(load, NETWORK_RETRY_MS);
      }
    };
    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  /** Fetch one snapshot. Resolves true on success (or when a fetch is already running). */
  const pollOnce = useCallback(async (): Promise<boolean> => {
    if (inFlightRef.current) return true;
    inFlightRef.current = true;
    try {
      const next = await fetchSnapshot();
      setSnapshot(next);
      setReceivedAt(Date.now());
      return true;
    } catch {
      return false;
    } finally {
      inFlightRef.current = false;
      setAttempted(true);
      setClock(Date.now());
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const tick = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      const ok = await pollOnce();
      failures = ok ? 0 : failures + 1;
      if (!cancelled) timer = setTimeout(tick, nextPollDelayMs(failures));
    };
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (timer) clearTimeout(timer);
      tick();
    };
    document.addEventListener('visibilitychange', onVisibility);
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [pollOnce]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await pollOnce();
    } finally {
      setRefreshing(false);
    }
  }, [pollOnce]);

  const status = deriveClientStatus(snapshot, receivedAt, clock, attempted);
  const value = useMemo<TransitContextValue>(
    () => ({
      network,
      snapshot,
      status,
      vehicles: visibleVehicles(snapshot, status),
      snapshotReceivedAt: receivedAt,
      refreshing,
      refresh,
    }),
    [network, snapshot, status, receivedAt, refreshing, refresh]
  );

  return <TransitContext.Provider value={value}>{children}</TransitContext.Provider>;
}

export function useTransit(): TransitContextValue {
  const value = useContext(TransitContext);
  if (!value) throw new Error('useTransit must be used inside <TransitProvider>');
  return value;
}
```

- [ ] **Step 6: Mount the provider in `RouterApp.tsx`**

Add the import:

```tsx
import { TransitProvider } from './context/TransitProvider';
```

Wrap the router contents:

```tsx
export function RouterApp() {
  return (
    <BrowserRouter>
      <TransitProvider>
        <div className="h-full flex flex-col min-h-0">
        <Routes>
          {/* ...all existing <Route> elements, unchanged... */}
        </Routes>
        </div>
      </TransitProvider>
    </BrowserRouter>
  );
}
```

Keep every existing `<Route>` exactly as it is; only add the `<TransitProvider>` wrapper.

- [ ] **Step 7: Verify polling in the browser**

Start `npm run server` and `npm run dev` in the background, then open `http://localhost:3000` in the Browser pane. Check `read_network_requests` with `urlPattern: "/api/live"`.

Expected:
- One `/api/live/network` request.
- `/api/live/snapshot` requests about every 6 s, all returning 200.
- In the console: `document.hidden` is false.
- The UI is unchanged (nothing consumes the context yet).

- [ ] **Step 8: Run the tests and typecheck, then commit**

Run: `npm test && npm run typecheck`
Expected: tests pass; baseline errors only.

```bash
git add utils/livePolling.ts context/TransitProvider.tsx RouterApp.tsx tests/utils/livePolling.test.ts
git commit -m "$(printf 'Add TransitProvider that polls live snapshots\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')"
```

### Task 10: Live buses in the list, detail sheet and map

**Files:**
- Create: `utils/vehicleDisplay.ts`, `utils/liveVehicleAnimation.ts`, `utils/liveStatus.ts`, `components/LiveStatusBanner.tsx`
- Modify: `App.tsx`, `components/BusList.tsx`, `components/BusDetailSheet.tsx`, `components/ClosestStopCard.tsx`, `components/MapView.tsx`, `components/MapboxMap.tsx`
- Test: `tests/utils/vehicleDisplay.test.ts`, `tests/utils/liveVehicleAnimation.test.ts`, `tests/utils/liveStatus.test.ts`

**Interfaces:**
- Consumes: `useTransit`, `getActivePattern`, `getPattern`, `formatEta`, `ROUTE_COLORS`, `createRouteInterpolator`, and `RouteInterpolator` (from `utils/routeInterpolation.ts`: `{ totalLengthMeters, pointAt(d) → LngLat, bearingAt(d) → number }`).
- Produces:
  - `getLoadInfo(v: { load, capacity }) → { percent: number, riders: number | null, capacity: number | null } | null`
  - `BusPosition` (`{ id, routeId, lon, lat, bearing, stale }`)
  - `extrapolateVehicle(v, interp | null, elapsedSec, maxSec?) → BusPosition`
  - `easeToward(prev, target, dtSec, easeSec?) → BusPosition`
  - `MAX_EXTRAPOLATE_SEC = 6`, `EASE_SEC = 1`
  - `getLiveStatusMessage(status, now?) → { text, tone: 'info' | 'warning' } | null`
  - `<LiveStatusBanner status className? />`
  - `MapboxMap` props gain `vehiclesReceivedAt`, `routeLines: Record<RouteId, LngLat[]>`, `patternLines: Record<number, LngLat[]>` and `statusNote: string | null`. `vehicles` and `onSelectBus` switch to `LiveVehicle`.
- Stays as-is until Task 11: map stop circles still come from `data/p2pStops.ts`, and the closest stop and stop pop-up still use `STOPS`. ETAs at those old stop ids fall back to the timetable until then.

- [ ] **Step 1: Write the failing tests**

`tests/utils/vehicleDisplay.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getLoadInfo } from '../../utils/vehicleDisplay';

describe('getLoadInfo', () => {
  it('computes percent and riders from load and capacity', () => {
    expect(getLoadInfo({ load: 0.375, capacity: 48 })).toEqual({ percent: 38, riders: 18, capacity: 48 });
  });
  it('returns percent only when capacity is unknown', () => {
    expect(getLoadInfo({ load: 0.5, capacity: null })).toEqual({ percent: 50, riders: null, capacity: null });
  });
  it('returns null when load is unknown', () => {
    expect(getLoadInfo({ load: null, capacity: 48 })).toBeNull();
  });
});
```

`tests/utils/liveVehicleAnimation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRouteInterpolator } from '../../utils/routeInterpolation';
import { easeToward, extrapolateVehicle } from '../../utils/liveVehicleAnimation';
import { makeVehicle } from '../fixtures/transit';

const interp = createRouteInterpolator([[-79.05, 35.9], [-79.04, 35.9]])!;

describe('extrapolateVehicle', () => {
  it('moves the bus along its pattern at its reported speed', () => {
    const pos = extrapolateVehicle(makeVehicle({ distAlong: 0, speedMps: 10 }), interp, 3);
    expect(pos.lon).toBeCloseTo(interp.pointAt(30)[0], 9);
    expect(pos.lat).toBeCloseTo(interp.pointAt(30)[1], 9);
    expect(pos.bearing).toBeCloseTo(interp.bearingAt(30), 6);
  });

  it('caps extrapolation at maxSec', () => {
    const pos = extrapolateVehicle(makeVehicle({ distAlong: 0, speedMps: 10 }), interp, 60, 6);
    expect(pos.lon).toBeCloseTo(interp.pointAt(60)[0], 9);
  });

  it('treats a missing speed as stopped', () => {
    const pos = extrapolateVehicle(makeVehicle({ distAlong: 100, speedMps: null }), interp, 5);
    expect(pos.lon).toBeCloseTo(interp.pointAt(100)[0], 9);
  });

  it('uses the raw reported position for stale vehicles or without a pattern line', () => {
    const v = makeVehicle({ lat: 35.95, lon: -79.01, heading: 45 });
    expect(extrapolateVehicle({ ...v, stale: true }, interp, 3)).toMatchObject({ lat: 35.95, lon: -79.01, bearing: 45, stale: true });
    expect(extrapolateVehicle(v, null, 3)).toMatchObject({ lat: 35.95, lon: -79.01, bearing: 45 });
    expect(extrapolateVehicle({ ...v, distAlong: null }, interp, 3)).toMatchObject({ lat: 35.95, lon: -79.01 });
  });
});

describe('easeToward', () => {
  const prev = { id: 'v1', routeId: 'P2P_EXPRESS' as const, lon: 0, lat: 0, bearing: 0, stale: false };
  const target = { ...prev, lon: 10, lat: 20, bearing: 90 };

  it('covers the fraction dt / easeSec of the gap', () => {
    expect(easeToward(prev, target, 0.5, 1)).toMatchObject({ lon: 5, lat: 10, bearing: 90 });
  });
  it('snaps to the target once dt >= easeSec', () => {
    expect(easeToward(prev, target, 2, 1)).toMatchObject({ lon: 10, lat: 20 });
  });
});
```

`tests/utils/liveStatus.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getLiveStatusMessage } from '../../utils/liveStatus';

describe('getLiveStatusMessage', () => {
  it('shows nothing while live or loading', () => {
    expect(getLiveStatusMessage('live')).toBeNull();
    expect(getLiveStatusMessage('loading')).toBeNull();
  });
  it('warns when data is delayed or unavailable', () => {
    expect(getLiveStatusMessage('degraded')).toMatchObject({ tone: 'warning', text: expect.stringContaining('delayed') });
    expect(getLiveStatusMessage('unavailable')).toMatchObject({ tone: 'warning', text: expect.stringContaining('scheduled times') });
  });
  it('explains no service outside service hours', () => {
    expect(getLiveStatusMessage('no-service', new Date(2026, 8, 14, 12, 0))?.text).toBe('No buses running — service starts 7:00 PM.');
  });
  it('explains missing buses during service hours', () => {
    expect(getLiveStatusMessage('no-service', new Date(2026, 8, 14, 21, 0))?.text).toContain('No buses are reporting');
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm test -- tests/utils/vehicleDisplay.test.ts tests/utils/liveVehicleAnimation.test.ts tests/utils/liveStatus.test.ts`
Expected: FAIL, because the modules cannot be found.

- [ ] **Step 3: Create `utils/vehicleDisplay.ts`**

```ts
import type { LiveVehicle } from '../types';

export interface LoadInfo {
  percent: number;
  riders: number | null;
  capacity: number | null;
}

export function getLoadInfo(v: Pick<LiveVehicle, 'load' | 'capacity'>): LoadInfo | null {
  if (v.load == null) return null;
  return {
    percent: Math.round(v.load * 100),
    riders: v.capacity != null ? Math.round(v.load * v.capacity) : null,
    capacity: v.capacity,
  };
}
```

- [ ] **Step 4: Create `utils/liveVehicleAnimation.ts`**

```ts
/**
 * Map bus motion between live snapshots: move each bus along its pattern at its reported speed
 * for at most one poll interval, and ease the drawn position into each new report.
 */

import type { LiveVehicle, RouteId } from '../types';
import type { RouteInterpolator } from './routeInterpolation';

export const MAX_EXTRAPOLATE_SEC = 6;
export const EASE_SEC = 1;

export interface BusPosition {
  id: string;
  routeId: RouteId;
  lon: number;
  lat: number;
  bearing: number;
  stale: boolean;
}

export function extrapolateVehicle(
  v: LiveVehicle,
  interp: RouteInterpolator | null,
  elapsedSec: number,
  maxSec: number = MAX_EXTRAPOLATE_SEC
): BusPosition {
  const base = { id: v.id, routeId: v.routeId, stale: v.stale };
  if (!interp || v.stale || v.distAlong == null) {
    return { ...base, lon: v.lon, lat: v.lat, bearing: v.heading };
  }
  const t = Math.min(Math.max(elapsedSec, 0), maxSec);
  const d = v.distAlong + Math.max(v.speedMps ?? 0, 0) * t;
  const [lon, lat] = interp.pointAt(d);
  return { ...base, lon, lat, bearing: interp.bearingAt(d) };
}

export function easeToward(prev: BusPosition, target: BusPosition, dtSec: number, easeSec: number = EASE_SEC): BusPosition {
  const alpha = easeSec <= 0 ? 1 : Math.min(1, Math.max(0, dtSec / easeSec));
  return {
    ...target,
    lon: prev.lon + (target.lon - prev.lon) * alpha,
    lat: prev.lat + (target.lat - prev.lat) * alpha,
  };
}
```

- [ ] **Step 5: Create `utils/liveStatus.ts`**

```ts
import type { ClientLiveStatus } from '../types';
import { ROUTE_IDS } from '../data/routes';
import { getServiceResumeLabel, isRouteOperatingNow } from './serviceSchedule';

export interface LiveStatusMessage {
  text: string;
  tone: 'info' | 'warning';
}

export function getLiveStatusMessage(status: ClientLiveStatus, now: Date = new Date()): LiveStatusMessage | null {
  switch (status) {
    case 'live':
    case 'loading':
      return null;
    case 'degraded':
      return { text: 'Live data delayed — bus positions may be a little behind.', tone: 'warning' };
    case 'unavailable':
      return { text: 'Live data unavailable — showing scheduled times.', tone: 'warning' };
    case 'no-service':
      return ROUTE_IDS.some((routeId) => isRouteOperatingNow(routeId, now))
        ? { text: 'No buses are reporting right now — showing scheduled times.', tone: 'info' }
        : { text: `No buses running — service starts ${getServiceResumeLabel()}.`, tone: 'info' };
    default:
      return null;
  }
}
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `npm test -- tests/utils/vehicleDisplay.test.ts tests/utils/liveVehicleAnimation.test.ts tests/utils/liveStatus.test.ts`
Expected: 13 passed.

- [ ] **Step 7: Create `components/LiveStatusBanner.tsx`**

```tsx
import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import type { ClientLiveStatus } from '../types';
import { getLiveStatusMessage } from '../utils/liveStatus';

interface LiveStatusBannerProps {
  status: ClientLiveStatus;
  className?: string;
}

export function LiveStatusBanner({ status, className = '' }: LiveStatusBannerProps) {
  const message = getLiveStatusMessage(status);
  if (!message) return null;
  const warning = message.tone === 'warning';
  return (
    <div className={className}>
      <div
        role="status"
        className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
          warning ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-gray-200 bg-white text-gray-700'
        }`}
      >
        {warning ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> : <Info size={16} className="mt-0.5 shrink-0" />}
        <span>{message.text}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Replace `components/BusList.tsx`**

```tsx
import React from 'react';
import type { LiveVehicle, Stop } from '../types';
import { Bus, ChevronRight } from 'lucide-react';
import { formatEta } from '../utils/format';

interface BusListProps {
  vehicles: LiveVehicle[];
  stops: Stop[];
  onSelectBus: (bus: LiveVehicle) => void;
}

export const BusList: React.FC<BusListProps> = ({ vehicles, stops, onSelectBus }) => {
  const getStopName = (id: string) => stops.find((s) => s.id === id)?.name || 'Unknown Stop';

  return (
    <div className="px-4 pb-24 pt-2">
      <div className="space-y-3">
        {vehicles.length === 0 && (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-sm text-gray-500">
            No buses currently running
          </div>
        )}
        {vehicles.map((bus) => (
          <button
            key={bus.id}
            onClick={() => onSelectBus(bus)}
            className={`w-full bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between gap-2 active:scale-[0.98] transition-transform text-left min-w-0 ${
              bus.stale ? 'opacity-60' : ''
            }`}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div
                className={`p-3 rounded-full shrink-0 ${
                  bus.routeId === 'P2P_EXPRESS' ? 'bg-p2p-blue/10 text-p2p-blue' : 'bg-p2p-red/10 text-p2p-red'
                }`}
              >
                <Bus size={24} />
              </div>
              <div className="min-w-0 overflow-hidden">
                <div className="font-bold text-gray-900 truncate">
                  {bus.routeName} <span className="font-normal text-gray-400">· {bus.name}</span>
                </div>
                <div className="text-sm text-gray-500 mt-0.5 leading-snug overflow-hidden line-clamp-2">
                  {bus.stale
                    ? 'Location not updating'
                    : bus.nextStopId
                      ? `Next: ${getStopName(bus.nextStopId)}`
                      : 'Next stop unknown'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 min-w-[64px]">
              <div className="text-right whitespace-nowrap">
                <div className="font-bold text-gray-900">{formatEta(bus.nextStopEtaSec)}</div>
                <div className="text-xs text-gray-400">Arrival</div>
              </div>
              <ChevronRight size={20} className="text-gray-300 shrink-0" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
```

- [ ] **Step 9: Replace `components/BusDetailSheet.tsx`**

`vehicle` is now required, and App only renders the sheet when a bus is selected. This also fixes hooks being called after the old `if (!vehicle) return null`.

```tsx
import React, { useEffect, useMemo } from 'react';
import type { Coordinate, LiveVehicle, Stop } from '../types';
import { X, Navigation } from 'lucide-react';
import { getDistanceMeters, getWalkTimeMinutes } from '../utils/geo';
import { formatEta } from '../utils/format';
import { getLoadInfo } from '../utils/vehicleDisplay';
import { getPattern } from '../utils/transitSelectors';
import { useTransit } from '../context/TransitProvider';

function getFullnessMeta(percent: number): { label: string; textClass: string; barClass: string } {
  if (percent <= 30) return { label: 'Low', textClass: 'text-emerald-600', barClass: 'bg-emerald-500' };
  if (percent <= 70) return { label: 'Moderate', textClass: 'text-yellow-600', barClass: 'bg-yellow-400' };
  if (percent <= 90) return { label: 'High', textClass: 'text-orange-600', barClass: 'bg-orange-500' };
  return { label: 'Near Capacity', textClass: 'text-red-600', barClass: 'bg-red-500' };
}

interface BusDetailSheetProps {
  vehicle: LiveVehicle;
  stops: Stop[];
  userLocation: Coordinate;
  onClose: () => void;
}

export const BusDetailSheet: React.FC<BusDetailSheetProps> = ({ vehicle, stops, userLocation, onClose }) => {
  const { network } = useTransit();
  const stopsById = useMemo(() => new Map(stops.map((s) => [s.id, s])), [stops]);
  const orderedStopIds = useMemo(
    () => getPattern(network, vehicle.patternId)?.stops.map((s) => s.stopId) ?? [],
    [network, vehicle.patternId]
  );

  const nextStop = vehicle.nextStopId ? stopsById.get(vehicle.nextStopId) ?? null : null;
  const walkToNextStop = useMemo(
    () => (nextStop ? getWalkTimeMinutes(getDistanceMeters(userLocation, nextStop)) : null),
    [nextStop, userLocation]
  );

  const loadInfo = getLoadInfo(vehicle);
  const fullnessMeta = loadInfo ? getFullnessMeta(loadInfo.percent) : null;

  const upcoming = useMemo(() => {
    const nameOf = (id: string) => stopsById.get(id)?.name ?? 'Unknown stop';
    return vehicle.upcomingStops.map((stop, idx) => {
      let previousStopId: string | null = null;
      if (idx > 0) {
        previousStopId = vehicle.upcomingStops[idx - 1].stopId;
      } else {
        const i = orderedStopIds.indexOf(stop.stopId);
        if (i !== -1 && orderedStopIds.length > 1) {
          previousStopId = orderedStopIds[(i - 1 + orderedStopIds.length) % orderedStopIds.length];
        }
      }
      const minutesFromPrevious =
        idx > 0 ? Math.max(1, Math.round((stop.etaSec - vehicle.upcomingStops[idx - 1].etaSec) / 60)) : null;
      return {
        ...stop,
        name: nameOf(stop.stopId),
        previousStopName: previousStopId ? nameOf(previousStopId) : null,
        minutesFromPrevious,
      };
    });
  }, [vehicle.upcomingStops, orderedStopIds, stopsById]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center sm:justify-center pointer-events-none">
      <div
        className="absolute inset-0 bg-black/40 pointer-events-auto backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl shadow-2xl z-50 pointer-events-auto max-h-[85vh] flex flex-col animate-slide-up sm:m-4"
        style={{ minHeight: 0 }}
      >
        <div className="shrink-0">
          <div className="w-full flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
          </div>
          <div className="p-5 pb-0 flex justify-between items-start">
            <div>
              <span
                className={`inline-block px-2 py-0.5 rounded text-xs font-bold mb-2 text-white ${
                  vehicle.routeId === 'P2P_EXPRESS' ? 'bg-p2p-blue' : 'bg-p2p-red'
                }`}
              >
                {vehicle.routeName.toUpperCase()}
              </span>
              <h2 className="text-2xl font-bold text-gray-900">{vehicle.routeName}</h2>
              <p className="text-gray-500 text-sm">{vehicle.name}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
              aria-label="Close"
            >
              <X size={20} className="text-gray-600" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 pt-4" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-2 h-2 rounded-full ${vehicle.stale ? 'bg-gray-400' : 'bg-green-500 animate-pulse'}`} />
              <span className="text-sm font-semibold text-gray-700">
                {vehicle.stale ? (
                  'Location not updating'
                ) : nextStop ? (
                  <>
                    En route to <span className="text-gray-900">{nextStop.name}</span>
                  </>
                ) : (
                  'Next stop unknown'
                )}
              </span>
            </div>

            <div className="flex justify-between items-center pl-5 mb-3">
              <div>
                <div className="text-3xl font-bold text-gray-900">{formatEta(vehicle.nextStopEtaSec)}</div>
                <div className="text-xs text-gray-400">Estimated Arrival</div>
              </div>
              {walkToNextStop !== null && (
                <div className="text-right">
                  <div className="flex items-center justify-end text-p2p-blue gap-1">
                    <Navigation size={14} />
                    <span className="font-bold">{walkToNextStop} min</span>
                  </div>
                  <div className="text-xs text-gray-400">Walk to stop</div>
                </div>
              )}
            </div>

            {loadInfo && fullnessMeta && (
              <div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>Fullness</span>
                  <span className={`font-semibold ${fullnessMeta.textClass}`}>
                    {loadInfo.riders != null && loadInfo.capacity != null
                      ? `${loadInfo.riders} / ${loadInfo.capacity} riders`
                      : `${loadInfo.percent}%`}{' '}
                    ({fullnessMeta.label})
                  </span>
                </div>
                <div className="h-2 bg-white rounded-full overflow-hidden border border-gray-200/70">
                  <div
                    className={`h-full rounded-full ${fullnessMeta.barClass}`}
                    style={{ width: `${Math.min(100, loadInfo.percent)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Upcoming Stops</h3>
            {upcoming.length === 0 ? (
              <p className="text-sm text-gray-500">No upcoming stop predictions for this bus.</p>
            ) : (
              <div className="relative pl-2 space-y-6 before:content-[''] before:absolute before:left-[19px] before:top-2 before:bottom-4 before:w-0.5 before:bg-gray-200">
                {upcoming.map((stop, idx) => (
                  <div key={`${stop.stopId}-${idx}`} className="relative flex items-center justify-between pl-8 group">
                    <div
                      className={`absolute left-3 w-4 h-4 rounded-full border-2 border-white shadow-sm z-10 ${
                        idx === 0 ? 'bg-p2p-blue' : 'bg-gray-300'
                      }`}
                    />
                    <div className="min-w-0 flex-1 pr-2">
                      <span className={`block text-sm font-medium truncate ${idx === 0 ? 'text-gray-900' : 'text-gray-600'}`}>
                        {stop.name}
                      </span>
                      {stop.previousStopName && (
                        <span className="block text-xs text-gray-400 truncate">
                          {stop.minutesFromPrevious == null
                            ? `Previous stop: ${stop.previousStopName}`
                            : `${stop.minutesFromPrevious} min after ${stop.previousStopName}`}
                        </span>
                      )}
                    </div>
                    <span className={`text-sm font-bold whitespace-nowrap ${idx === 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                      {formatEta(stop.etaSec)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 10: Update `components/ClosestStopCard.tsx` for `LiveVehicle`**

Replace the imports:

```tsx
import React, { useMemo } from 'react';
import { Stop, Vehicle, Coordinate } from '../types';
```

with:

```tsx
import React, { useMemo } from 'react';
import type { Stop, LiveVehicle, Coordinate } from '../types';
import { formatEta } from '../utils/format';
```

Change `vehicles: Vehicle[];` to `vehicles: LiveVehicle[];`.

Replace the `bestBus` memo body:

```tsx
  const bestBus = useMemo(() => {
    let bestVehicle: LiveVehicle | null = null;
    let minEta = Infinity;

    vehicles.forEach((v) => {
      const upcoming = v.upcomingStops.find((s) => s.stopId === stop.id);
      if (upcoming && upcoming.etaSec < minEta) {
        minEta = upcoming.etaSec;
        bestVehicle = v;
      }
    });

    return { vehicle: bestVehicle as LiveVehicle | null, eta: minEta };
  }, [stop, vehicles]);
```

Replace `<span className="font-bold text-lg">{bestBus.eta} min</span>` with:

```tsx
              <span className="font-bold text-lg">{formatEta(bestBus.eta)}</span>
```

- [ ] **Step 11: Update `components/MapboxMap.tsx`**

Make these replacements in order.

(a) Replace the header comment and imports (from the first line through `import { API } from '../utils/api';`) with:

```tsx
/**
 * Mapbox GL JS map (student map view).
 * Single init on mount; updates via source.setData. No globe mode.
 * Route lines come from the active GMV patterns. Buses are live GMV vehicles, moved along their
 * pattern between snapshots and eased into each new report.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import type { Map as MapboxMapType, GeoJSONSource } from 'mapbox-gl';
import type { Stop, LiveVehicle, Coordinate, Journey, RouteId } from '../types';
import { P2P_EXPRESS_STOPS, BAITY_HILL_STOPS } from '../data/p2pStops';
import { createRouteInterpolator, type LngLat, type RouteInterpolator } from '../utils/routeInterpolation';
import {
  easeToward,
  extrapolateVehicle,
  EASE_SEC,
  MAX_EXTRAPOLATE_SEC,
  type BusPosition,
} from '../utils/liveVehicleAnimation';
import { ROUTE_COLORS } from '../data/routes';
import { Navigation, Box, ExternalLink } from 'lucide-react';
```

(b) Replace:

```tsx
const ROUTE_COLORS = { P2P_EXPRESS: '#418FC5', BAITY_HILL: '#C33934' } as const;
const BUS_SPEED_MPS = 6;
const TICK_MS = 300;
```

with:

```tsx
const TICK_MS = 300;
```

(c) Replace the whole `busesToGeoJSON` function with:

```tsx
/** GeoJSON for buses (points with busId, routeId, bearing for symbol rotation, stale for fading). */
function busesToGeoJSON(busPositions: BusPosition[]): GeoJSONFC {
  return {
    type: 'FeatureCollection',
    features: busPositions.map((b) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [b.lon, b.lat] },
      properties: { busId: b.id, routeId: b.routeId, bearing: b.bearing, stale: b.stale },
    })),
  };
}
```

(d) In `MapboxMapProps`, replace `vehicles: Vehicle[];` with:

```tsx
  vehicles: LiveVehicle[];
  /** Client time (ms) when `vehicles` arrived; buses are extrapolated from here. */
  vehiclesReceivedAt: number | null;
  /** Active pattern line per route (drawn). */
  routeLines: Record<RouteId, LngLat[]>;
  /** Every known pattern's line, keyed by pattern id (used to move buses). */
  patternLines: Record<number, LngLat[]>;
  /** Short live-data status shown in the route card (null when live). */
  statusNote?: string | null;
```

Then replace `onSelectBus: (bus: Vehicle) => void;` with `onSelectBus: (bus: LiveVehicle) => void;`.

(e) In the component's destructured props, after `vehicles,` add:

```tsx
  vehiclesReceivedAt,
  routeLines,
  patternLines,
  statusNote = null,
```

(f) Replace the ref block from `const routeGeomsRef = useRef<` through `const lastTickRef = useRef<number>(0);` with:

```tsx
  const vehiclesRef = useRef<LiveVehicle[]>(vehicles);
  const receivedAtRef = useRef<number | null>(vehiclesReceivedAt);
  const patternInterpRef = useRef<Map<number, RouteInterpolator>>(new Map());
  const displayedBusesRef = useRef<Map<string, BusPosition>>(new Map());
  vehiclesRef.current = vehicles;
  receivedAtRef.current = vehiclesReceivedAt;
```

Keep `const enabledBusRoutesRef = useRef({ showExpress: true, showBaity: true });`.

(g) Inside `applyBusLayerFilter`, replace:

```tsx
        if (showExpress) enabledRouteIds.push('p2p-express');
        if (showBaity) enabledRouteIds.push('baity-hill');
```

with:

```tsx
        if (showExpress) enabledRouteIds.push('P2P_EXPRESS');
        if (showBaity) enabledRouteIds.push('BAITY_HILL');
```

(h) In `addBusesSymbolLayer`, replace:

```tsx
            'icon-image': ['match', ['get', 'routeId'], 'p2p-express', 'bus-express', 'bus-baity'],
```

with:

```tsx
            'icon-image': ['match', ['get', 'routeId'], 'P2P_EXPRESS', 'bus-express', 'bus-baity'],
```

and replace that layer's `paint: {},` (the one right after `'icon-ignore-placement': true,` and `},`) with:

```tsx
          paint: { 'icon-opacity': ['case', ['get', 'stale'], 0.45, 1] },
```

(i) In the circle fallback layer, replace:

```tsx
                'circle-color': ['case', ['==', ['get', 'routeId'], 'p2p-express'], BUS_ICON_EXPRESS_COLOR, BUS_ICON_BAITY_COLOR],
```

with:

```tsx
                'circle-color': ['case', ['==', ['get', 'routeId'], 'P2P_EXPRESS'], BUS_ICON_EXPRESS_COLOR, BUS_ICON_BAITY_COLOR],
                'circle-opacity': ['case', ['get', 'stale'], 0.45, 1],
```

(j) Replace the whole route-fetch effect (from the comment `// Fetch route polylines from server proxy (cached); store geometry for bus interpolation` through its closing `}, [mapReady]);`) **and** the whole bus-animation effect (from `// Bus animation: snap to route, advance distMeters each tick, update buses source` through its closing `}, [mapReady, vehicles]);`) with:

```tsx
  // Route lines: the active GMV pattern per route.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const expressCoords = routeLines.P2P_EXPRESS;
    const baityCoords = routeLines.BAITY_HILL;
    const expressSrc = map.getSource(P2P_EXPRESS_LINE_SOURCE) as GeoJSONSource | undefined;
    const baitySrc = map.getSource(BAITY_HILL_LINE_SOURCE) as GeoJSONSource | undefined;

    if (expressSrc) {
      expressSrc.setData(
        expressCoords.length > 1
          ? {
              type: 'FeatureCollection',
              features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: expressCoords }, properties: {} }],
            }
          : emptyLineGeoJSON()
      );
    }
    if (baitySrc) {
      if (baityCoords.length > 1) {
        const { baseFeatures, overlapFeatures } = splitBaityByOverlap(baityCoords, expressCoords, OVERLAP_TOLERANCE_METERS);
        baitySrc.setData({ type: 'FeatureCollection', features: [...baseFeatures, ...overlapFeatures] });
      } else {
        baitySrc.setData(emptyLineGeoJSON());
      }
    }
  }, [mapReady, routeLines]);

  // Interpolators for every pattern, so each bus moves along the pattern it reports.
  useEffect(() => {
    const next = new Map<number, RouteInterpolator>();
    for (const [id, coords] of Object.entries(patternLines)) {
      const interp = createRouteInterpolator(coords);
      if (interp) next.set(Number(id), interp);
    }
    patternInterpRef.current = next;
  }, [patternLines]);

  // Live buses: extrapolate along the reported pattern since the snapshot arrived, easing into each new report.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    let lastTick = performance.now();
    const id = setInterval(() => {
      const nowPerf = performance.now();
      const dtSec = (nowPerf - lastTick) / 1000;
      lastTick = nowPerf;
      const receivedAt = receivedAtRef.current;
      const elapsedSec = receivedAt != null ? (Date.now() - receivedAt) / 1000 : 0;
      const previous = displayedBusesRef.current;
      const next = new Map<string, BusPosition>();
      for (const v of vehiclesRef.current) {
        const interp = v.patternId != null ? patternInterpRef.current.get(v.patternId) ?? null : null;
        const target = extrapolateVehicle(v, interp, elapsedSec, MAX_EXTRAPOLATE_SEC);
        const prev = previous.get(v.id);
        next.set(v.id, prev ? easeToward(prev, target, dtSec, EASE_SEC) : target);
      }
      displayedBusesRef.current = next;
      const src = map.getSource(BUSES_SOURCE) as GeoJSONSource | undefined;
      if (src) src.setData(busesToGeoJSON([...next.values()]));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [mapReady]);
```

(k) In the route-visibility effect near the end, replace:

```tsx
    if (showExpress) enabledRouteIds.push('p2p-express');
    if (showBaity) enabledRouteIds.push('baity-hill');
```

with:

```tsx
    if (showExpress) enabledRouteIds.push('P2P_EXPRESS');
    if (showBaity) enabledRouteIds.push('BAITY_HILL');
```

(l) In the JSX route card, directly after the closing `</label>` of the Baity Hill checkbox (just before the card's closing `</div>`), add:

```tsx
            {statusNote && <p className="w-full text-xs font-medium text-amber-700">{statusNote}</p>}
```

- [ ] **Step 12: Update `components/MapView.tsx`**

Replace the imports:

```tsx
import React, { useState } from 'react';
import { MapboxMap } from './MapboxMap';
import { StopPopup } from './StopPopup';
import { Stop, Vehicle, Coordinate, Journey } from '../types';
```

with:

```tsx
import React, { useMemo, useState } from 'react';
import { MapboxMap } from './MapboxMap';
import { StopPopup } from './StopPopup';
import type { Stop, LiveVehicle, Coordinate, Journey, RouteId } from '../types';
import type { LngLat } from '../utils/routeInterpolation';
import { useTransit } from '../context/TransitProvider';
import { getActivePattern } from '../utils/transitSelectors';
import { getLiveStatusMessage } from '../utils/liveStatus';
```

In `MapViewProps`, change `vehicles: Vehicle[];` to `vehicles: LiveVehicle[];` and `onSelectBus: (bus: Vehicle) => void;` to `onSelectBus: (bus: LiveVehicle) => void;`.

After `const [enable3D, setEnable3D] = useState(false);`, add:

```tsx
  const { network, snapshot, status, snapshotReceivedAt } = useTransit();
  const expressPattern = getActivePattern(network, snapshot, 'P2P_EXPRESS');
  const baityPattern = getActivePattern(network, snapshot, 'BAITY_HILL');
  const routeLines = useMemo<Record<RouteId, LngLat[]>>(
    () => ({
      P2P_EXPRESS: expressPattern?.geometry.coordinates ?? [],
      BAITY_HILL: baityPattern?.geometry.coordinates ?? [],
    }),
    [expressPattern, baityPattern]
  );
  const patternLines = useMemo<Record<number, LngLat[]>>(() => {
    const out: Record<number, LngLat[]> = {};
    network?.routes.forEach((r) => r.patterns.forEach((p) => { out[p.id] = p.geometry.coordinates; }));
    return out;
  }, [network]);
  const statusNote = getLiveStatusMessage(status)?.text ?? null;
```

In the `<MapboxMap` element, after `vehicles={vehicles}`, add:

```tsx
        vehiclesReceivedAt={snapshotReceivedAt}
        routeLines={routeLines}
        patternLines={patternLines}
        statusNote={statusNote}
```

- [ ] **Step 13: Update `App.tsx`**

(a) Replace:

```tsx
import { ViewState, Vehicle, Stop, Coordinate, Journey } from './types';
import { STOPS, VEHICLES } from './data/mockTransit';
```

with:

```tsx
import { ViewState, Stop, Coordinate, Journey } from './types';
import { STOPS } from './data/mockTransit';
```

(b) Replace `import { isRouteOperatingNow } from './utils/serviceSchedule';` with:

```tsx
import { useTransit } from './context/TransitProvider';
import { LiveStatusBanner } from './components/LiveStatusBanner';
```

(c) Replace `const [selectedBus, setSelectedBus] = useState<Vehicle | null>(null);` with:

```tsx
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
```

(d) Replace:

```tsx
  const [vehicles, setVehicles] = useState<Vehicle[]>(VEHICLES);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [clockTickMs, setClockTickMs] = useState(() => Date.now());
```

with:

```tsx
  const { network, vehicles, status: liveStatus, refresh, refreshing, snapshotReceivedAt } = useTransit();
  const selectedBus = useMemo(() => vehicles.find((v) => v.id === selectedBusId) ?? null, [vehicles, selectedBusId]);
  const networkStops = useMemo(() => network?.stops ?? [], [network]);
```

(e) Delete the 60-second clock effect:

```tsx
  useEffect(() => {
    const timer = window.setInterval(() => setClockTickMs(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
```

(f) Delete the `activeVehicles` memo, and the whole `handleRefreshEtas` callback (from `const handleRefreshEtas = useCallback(async () => {` through its closing `}, []);`).

(g) Replace every remaining `activeVehicles` with `vehicles` (in the `ClosestStopCard`, `BusList` and `MapView` props).

(h) In the list view, make `<LiveStatusBanner status={liveStatus} className="px-4 pt-4" />` the first child of the scrolling list `<div>`, before `{closestStop && (`.

(i) In the Active Buses header, replace:

```tsx
                {lastUpdated != null && (
                  <span className="text-xs text-gray-400">
                    Updated {lastUpdated > Date.now() - 60000 ? 'just now' : new Date(lastUpdated).toLocaleTimeString()}
                  </span>
                )}
```

with:

```tsx
                {snapshotReceivedAt != null && (
                  <span className="text-xs text-gray-400">
                    Updated {snapshotReceivedAt > Date.now() - 60000 ? 'just now' : new Date(snapshotReceivedAt).toLocaleTimeString()}
                  </span>
                )}
```

and in the Refresh button replace `onClick={handleRefreshEtas}` with `onClick={() => { void refresh(); }}`, `disabled={refreshLoading}` with `disabled={refreshing}`, and `refreshLoading ? 'animate-spin' : ''` with `refreshing ? 'animate-spin' : ''`.

(j) Change the `BusList` props to `stops={networkStops}` and `onSelectBus={(bus) => setSelectedBusId(bus.id)}`.

(k) In `MapView`'s `onSelectBus`, replace `setSelectedBus(bus);` with `setSelectedBusId(bus.id);`.

(l) Replace the shared `<BusDetailSheet ... />` element with:

```tsx
      {selectedBus && (
        <BusDetailSheet
          vehicle={selectedBus}
          stops={networkStops}
          userLocation={userLocation}
          onClose={() => setSelectedBusId(null)}
        />
      )}
```

- [ ] **Step 14: Type-check and test**

Run: `npm run typecheck`
Expected: baseline errors only. If `Vehicle` is reported unused anywhere, remove only that import.

Run: `npm test`
Expected: all pass.

- [ ] **Step 15: Verify in the browser**

With `npm run server` and `npm run dev` running, open `http://localhost:3000`.

- **Outside service hours:**
  - The list shows "No buses running — service starts 7:00 PM." and "No buses currently running".
  - The map draws both route lines (official GMV shapes) and the route card shows the same note.
  - No console errors.
- **During service hours** (or re-check later in Task 19):
  - Bus cards show real next stops and ETAs.
  - Tapping one opens the sheet with fullness and upcoming stops.
  - Buses move smoothly on the map, and Refresh triggers an immediate `/api/live/snapshot` request.

Take a screenshot of the list and map views.

- [ ] **Step 16: Commit**

```bash
git add utils/vehicleDisplay.ts utils/liveVehicleAnimation.ts utils/liveStatus.ts components/LiveStatusBanner.tsx components/BusList.tsx components/BusDetailSheet.tsx components/ClosestStopCard.tsx components/MapView.tsx components/MapboxMap.tsx App.tsx tests/utils/vehicleDisplay.test.ts tests/utils/liveVehicleAnimation.test.ts tests/utils/liveStatus.test.ts
git commit -m "$(printf 'Show live GMV buses in the list, detail sheet and map\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')"
```

### Task 11: Network stops and route lines for the rider app (IDs level)

**Files:**
- Create: `utils/tripPlanning.ts`
- Modify: `App.tsx`, `components/MapView.tsx`, `components/MapboxMap.tsx`, `components/StopPopup.tsx`, `components/ClosestStopCard.tsx`, `components/PlanTripView.tsx`, `utils/multimodalRouting.ts` (full rewrite)
- Test: `tests/utils/tripPlanning.test.ts`

**Interfaces:**
- Consumes: `getActiveStops`, `getRouteStops`, `getRoutesServingStop`, `getActivePattern`, `activePatternKey`, `ROUTE_IDS`, `ROUTE_NAMES`, `ROUTE_COLORS`, `sliceRouteByDistance`.
- Produces:
  - `rideDistanceMeters(boardDist, alightDist, lengthMeters) → number` (wraps around the loop).
  - `fallbackRideSec(distanceMeters, intermediateStops) → number` (6 m/s plus 20 s per intermediate stop, rounded up).
  - `BUS_SPEED_MPS = 6`, `DWELL_SEC_PER_STOP = 20`.
  - `computeMultimodalRoute({ origin, destination, network, snapshot }) → Promise<Journey>`. Bus segments now carry canonical `routeId`s and GMV stop ids.
  - `MapboxMap` gains a `routeStops: Record<RouteId, Stop[]>` prop.
- After this task no rider-side file imports `data/p2pStops.ts`, `data/routeConfig.ts` or `STOPS`. Wait times in Plan Trip and stop ETAs are still timetable-based; they become live in Tasks 13 and 15.

- [ ] **Step 1: Write the failing test `tests/utils/tripPlanning.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { fallbackRideSec, rideDistanceMeters } from '../../utils/tripPlanning';

describe('rideDistanceMeters', () => {
  it('measures forward along the pattern', () => {
    expect(rideDistanceMeters(900, 2000, 3000)).toBe(1100);
  });
  it('wraps past the end of a loop', () => {
    expect(rideDistanceMeters(2000, 900, 3000)).toBe(1900);
  });
});

describe('fallbackRideSec', () => {
  it('uses 6 m/s plus 20 s per intermediate stop, rounded up', () => {
    expect(fallbackRideSec(600, 2)).toBe(140);
    expect(fallbackRideSec(601, 0)).toBe(101);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- tests/utils/tripPlanning.test.ts`
Expected: FAIL, because the module cannot be found.

- [ ] **Step 3: Create `utils/tripPlanning.ts`**

```ts
/**
 * Bus-leg math for Plan Trip.
 */

export const BUS_SPEED_MPS = 6;
export const DWELL_SEC_PER_STOP = 20;

/** Meters from the board stop to the alight stop along a loop pattern, wrapping past the end. */
export function rideDistanceMeters(boardDist: number, alightDist: number, lengthMeters: number): number {
  const d = alightDist - boardDist;
  return d > 0 ? d : d + lengthMeters;
}

/** Estimated ride time when no live prediction covers both stops. */
export function fallbackRideSec(distanceMeters: number, intermediateStops: number): number {
  return Math.ceil(distanceMeters / BUS_SPEED_MPS + Math.max(0, intermediateStops) * DWELL_SEC_PER_STOP);
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test -- tests/utils/tripPlanning.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Rewrite `utils/multimodalRouting.ts`**

Replace the whole file with:

```ts
/**
 * Multimodal routing: Walk → Bus → Walk using Mapbox walking directions and GMV pattern geometry.
 * Compares walk-only vs bus-assisted and returns the best journey with geometries and steps.
 */

import type {
  Coordinate,
  Destination,
  Journey,
  JourneySegment,
  LineStringGeometry,
  LiveSnapshot,
  RoutePattern,
  Stop,
  TransitNetwork,
  WalkingStep,
} from '../types';
import { findKNearestStops } from './geo';
import { sliceRouteByDistance } from './routeInterpolation';
import { getUpcomingRouteArrivals, isRouteOperatingNow } from './serviceSchedule';
import { ROUTE_IDS, ROUTE_NAMES } from '../data/routes';
import { getActivePattern } from './transitSelectors';
import { fallbackRideSec, rideDistanceMeters } from './tripPlanning';

const BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_OPS_API_URL) || '';
const K_NEAREST = 6;
const MAX_WALK_METERS = 1200;
const MAX_WALK_DURATION_SEC = 15 * 60;
const WALK_ONLY_MARGIN_SEC = 90;

export interface WalkDirectionsResult {
  durationSec: number;
  distanceMeters: number;
  geometry: { type: string; coordinates: [number, number][] };
  steps: { instruction: string; distanceMeters: number; durationSec: number }[];
}

export async function getWalkDirections(from: Coordinate, to: Coordinate): Promise<WalkDirectionsResult | null> {
  const fromStr = `${from.lon},${from.lat}`;
  const toStr = `${to.lon},${to.lat}`;
  try {
    const res = await fetch(`${BASE}/api/mapbox/directions/walk?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.geometry || !data.geometry.coordinates) return null;
    return {
      durationSec: data.durationSec ?? 0,
      distanceMeters: data.distanceMeters ?? 0,
      geometry: data.geometry,
      steps: Array.isArray(data.steps) ? data.steps : [],
    };
  } catch {
    return null;
  }
}

/** A stop on a pattern, in pattern order (first occurrence only). */
interface PatternStopRef {
  stop: Stop;
  distAlong: number;
  index: number;
}

function patternStopRefs(pattern: RoutePattern, stopsById: Map<string, Stop>): PatternStopRef[] {
  const seen = new Set<string>();
  const refs: PatternStopRef[] = [];
  for (const ps of pattern.stops) {
    const stop = stopsById.get(ps.stopId);
    if (!stop || seen.has(ps.stopId)) continue;
    seen.add(ps.stopId);
    refs.push({ stop, distAlong: ps.distAlong, index: refs.length });
  }
  return refs;
}

/** Ordered stops from board index to alight index (forward, with wrap). */
function orderedStopsBetween(stops: PatternStopRef[], boardIndex: number, alightIndex: number): PatternStopRef[] {
  const n = stops.length;
  if (n === 0) return [];
  if (boardIndex === alightIndex) return [stops[boardIndex]];
  const out: PatternStopRef[] = [];
  let i = boardIndex;
  while (true) {
    out.push(stops[i]);
    if (i === alightIndex) break;
    i = (i + 1) % n;
    if (out.length > n) break;
  }
  return out;
}

function walkSegment(
  fromName: string,
  toName: string,
  fromCoords: Coordinate,
  toCoords: Coordinate,
  walk: WalkDirectionsResult
): JourneySegment {
  return {
    type: 'walk',
    fromName,
    toName,
    fromCoords,
    toCoords,
    distanceMeters: walk.distanceMeters,
    durationMin: Math.ceil(walk.durationSec / 60),
    instruction: `Walk to ${toName}`,
    geometry: walk.geometry as LineStringGeometry,
    steps: walk.steps as WalkingStep[],
  };
}

interface StopCandidate {
  ref: PatternStopRef;
  walk: WalkDirectionsResult;
}

export interface MultimodalInput {
  origin: Coordinate;
  destination: Destination;
  network: TransitNetwork | null;
  snapshot: LiveSnapshot | null;
}

export async function computeMultimodalRoute(input: MultimodalInput): Promise<Journey> {
  const { origin, destination, network, snapshot } = input;
  const destCoord: Coordinate = { lat: destination.lat, lon: destination.lon };
  const now = new Date();

  const walkOnly = await getWalkDirections(origin, destCoord);
  const walkOnlyDurationSec = walkOnly ? walkOnly.durationSec : Infinity;

  let bestTotalSec = walkOnlyDurationSec;
  let bestSegments: JourneySegment[] =
    walkOnly && walkOnly.geometry ? [walkSegment('Current Location', destination.name, origin, destCoord, walkOnly)] : [];

  const stopsById = new Map((network?.stops ?? []).map((s) => [s.id, s]));

  for (const routeId of ROUTE_IDS) {
    if (!isRouteOperatingNow(routeId, now)) continue;
    const pattern = getActivePattern(network, snapshot, routeId);
    if (!pattern || pattern.geometry.coordinates.length < 2) continue;
    const refs = patternStopRefs(pattern, stopsById);
    if (refs.length < 2) continue;
    const refByStopId = new Map(refs.map((r) => [r.stop.id, r]));
    const routeStops = refs.map((r) => r.stop);
    const routeName = ROUTE_NAMES[routeId];
    const waitSec = (getUpcomingRouteArrivals(routeId, now, 1)[0] ?? 0) * 60;

    const boardCandidates: StopCandidate[] = [];
    for (const { stop, distanceMeters } of findKNearestStops(origin, routeStops, K_NEAREST)) {
      if (distanceMeters > MAX_WALK_METERS) continue;
      const walk = await getWalkDirections(origin, { lat: stop.lat, lon: stop.lon });
      if (!walk || walk.durationSec > MAX_WALK_DURATION_SEC) continue;
      boardCandidates.push({ ref: refByStopId.get(stop.id)!, walk });
    }

    const alightCandidates: StopCandidate[] = [];
    for (const { stop, distanceMeters } of findKNearestStops(destCoord, routeStops, K_NEAREST)) {
      if (distanceMeters > MAX_WALK_METERS) continue;
      const walk = await getWalkDirections({ lat: stop.lat, lon: stop.lon }, destCoord);
      if (!walk || walk.durationSec > MAX_WALK_DURATION_SEC) continue;
      alightCandidates.push({ ref: refByStopId.get(stop.id)!, walk });
    }

    for (const board of boardCandidates) {
      for (const alight of alightCandidates) {
        if (board.ref.stop.id === alight.ref.stop.id) continue;
        const forwardStops = orderedStopsBetween(refs, board.ref.index, alight.ref.index);
        const distance = rideDistanceMeters(board.ref.distAlong, alight.ref.distAlong, pattern.lengthMeters);
        const busDurationSec = fallbackRideSec(distance, forwardStops.length - 2);
        const totalSec = board.walk.durationSec + waitSec + busDurationSec + alight.walk.durationSec;
        if (totalSec >= bestTotalSec) continue;

        const busGeometry = sliceRouteByDistance(pattern.geometry.coordinates, board.ref.distAlong, alight.ref.distAlong);
        if (busGeometry.length < 2) continue;

        const boardCoords: Coordinate = { lat: board.ref.stop.lat, lon: board.ref.stop.lon };
        const alightCoords: Coordinate = { lat: alight.ref.stop.lat, lon: alight.ref.stop.lon };
        bestTotalSec = totalSec;
        bestSegments = [
          walkSegment('Current Location', board.ref.stop.name, origin, boardCoords, board.walk),
          {
            type: 'bus',
            fromName: board.ref.stop.name,
            toName: alight.ref.stop.name,
            fromCoords: boardCoords,
            toCoords: alightCoords,
            distanceMeters: 0,
            durationMin: Math.ceil(busDurationSec / 60),
            instruction: `Ride ${routeName}`,
            routeId,
            routeName,
            stopsCount: forwardStops.length,
            waitTimeMin: Math.ceil(waitSec / 60),
            busSegmentGeometry: { type: 'LineString', coordinates: busGeometry },
            busOrderedStopIds: forwardStops.map((s) => s.stop.id),
          },
          walkSegment(alight.ref.stop.name, destination.name, alightCoords, destCoord, alight.walk),
        ];
      }
    }
  }

  if (walkOnly && walkOnly.geometry && walkOnlyDurationSec <= bestTotalSec + WALK_ONLY_MARGIN_SEC) {
    bestTotalSec = walkOnlyDurationSec;
    bestSegments = [walkSegment('Current Location', destination.name, origin, destCoord, walkOnly)];
  }

  const totalDurationMin = Math.ceil(bestTotalSec / 60);
  const arrivalTime = new Date(now.getTime() + bestTotalSec * 1000);

  return {
    id: `journey-${Date.now()}`,
    destination,
    totalDurationMin,
    segments: bestSegments,
    startTime: now,
    arrivalTime,
  };
}
```

- [ ] **Step 6: Update `components/PlanTripView.tsx`**

(a) Replace `import { ROUTE_CONFIGS } from '../data/routeConfig';` with:

```tsx
import { ROUTE_IDS } from '../data/routes';
import { useTransit } from '../context/TransitProvider';
```

(b) Replace:

```tsx
  const anyRouteInService = ROUTE_CONFIGS.some((route) => isRouteOperatingNow(route.routeId));

  const stopNameById = useMemo(() => {
    const m = new Map<string, string>();
    ROUTE_CONFIGS.forEach((r) => r.stops.forEach((s) => m.set(s.id, s.name)));
    return m;
  }, []);
```

with:

```tsx
  const anyRouteInService = ROUTE_IDS.some((routeId) => isRouteOperatingNow(routeId));

  const { network, snapshot } = useTransit();
  // Latest transit data for routing without re-creating every handler on each poll.
  const transitRef = useRef({ network, snapshot });
  transitRef.current = { network, snapshot };
  const planRoute = useCallback(
    (input: { origin: Coordinate; destination: Destination }) =>
      computeMultimodalRoute({ ...input, ...transitRef.current }),
    []
  );

  const stopNameById = useMemo(
    () => new Map((network?.stops ?? []).map((s) => [s.id, s.name] as const)),
    [network]
  );
```

(c) Replace each of the four existing `await computeMultimodalRoute(` calls with `await planRoute(`. The arguments stay the same. Confirm with `grep -n "computeMultimodalRoute" components/PlanTripView.tsx`, which should show only the import and the `planRoute` definition.

- [ ] **Step 7: Update `components/StopPopup.tsx`**

(a) Replace `import React, { useEffect, useState, useCallback } from 'react';` with `import React, { useEffect, useMemo, useState, useCallback } from 'react';`.

(b) Replace `import { getRoutesServedForStop } from '../data/p2pStops';` with:

```tsx
import { useTransit } from '../context/TransitProvider';
import { activePatternKey, getRoutesServingStop } from '../utils/transitSelectors';
import { ROUTE_NAMES } from '../data/routes';
```

(c) Replace `const routesServed = getRoutesServedForStop(stop);` with the version below. Memoizing it also stops the arrivals effect re-running on every render.

```tsx
  const { network, snapshot } = useTransit();
  const patternKey = activePatternKey(snapshot);
  const routesServed = useMemo(
    () => getRoutesServingStop(network, snapshot, stop.id).map((routeId) => ROUTE_NAMES[routeId]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [network, patternKey, stop.id]
  );
```

- [ ] **Step 8: Update `components/ClosestStopCard.tsx`**

(a) Replace `import { ROUTE_CONFIGS } from '../data/routeConfig';` with:

```tsx
import { ROUTE_COLORS, ROUTE_NAMES } from '../data/routes';
import { useTransit } from '../context/TransitProvider';
import { activePatternKey, getRoutesServingStop } from '../utils/transitSelectors';
```

(b) Replace the whole `mockArrivals` memo with:

```tsx
  const { network, snapshot } = useTransit();
  const patternKey = activePatternKey(snapshot);
  const mockArrivals = useMemo(
    () =>
      getRoutesServingStop(network, snapshot, stop.id)
        .filter((routeId) => isRouteOperatingNow(routeId))
        .flatMap((routeId) =>
          getUpcomingRouteArrivals(routeId, new Date(), 2).map((minutes) => ({
            routeName: ROUTE_NAMES[routeId],
            minutes,
            color: ROUTE_COLORS[routeId],
          }))
        )
        .sort((a, b) => a.minutes - b.minutes)
        .slice(0, 3),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [network, patternKey, stop.id]
  );
```

- [ ] **Step 9: Draw network stops in `components/MapboxMap.tsx`**

(a) Delete `import { P2P_EXPRESS_STOPS, BAITY_HILL_STOPS } from '../data/p2pStops';`.

(b) In `MapboxMapProps`, after `patternLines: Record<number, LngLat[]>;`, add:

```tsx
  /** Ordered stops of each route's active pattern (drawn as circles). */
  routeStops: Record<RouteId, Stop[]>;
```

and add `routeStops,` to the destructured props after `patternLines,`.

(c) Replace:

```tsx
    if (expressStops) expressStops.setData(routeStopsToGeoJSON(P2P_EXPRESS_STOPS, selectedStopId));
    if (baityStops) baityStops.setData(routeStopsToGeoJSON(BAITY_HILL_STOPS, selectedStopId));
```

with:

```tsx
    if (expressStops) expressStops.setData(routeStopsToGeoJSON(routeStops.P2P_EXPRESS, selectedStopId));
    if (baityStops) baityStops.setData(routeStopsToGeoJSON(routeStops.BAITY_HILL, selectedStopId));
```

and change that effect's dependency array from `[mapReady, selectedStopId, userLocation, activeJourney]` to `[mapReady, selectedStopId, userLocation, activeJourney, routeStops]`.

- [ ] **Step 10: Pass route stops from `components/MapView.tsx`**

Change the selector import to `import { getActivePattern, getRouteStops } from '../utils/transitSelectors';` and change the type import to include `Stop` (it already does). After the `routeLines` memo, add:

```tsx
  const routeStops = useMemo<Record<RouteId, Stop[]>>(
    () => ({
      P2P_EXPRESS: getRouteStops(network, snapshot, 'P2P_EXPRESS'),
      BAITY_HILL: getRouteStops(network, snapshot, 'BAITY_HILL'),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [network, expressPattern, baityPattern]
  );
```

and pass `routeStops={routeStops}` to `<MapboxMap`.

- [ ] **Step 11: Use active network stops in `App.tsx`**

(a) Delete `import { STOPS } from './data/mockTransit';` and add:

```tsx
import { activePatternKey, getActiveStops } from './utils/transitSelectors';
```

(b) Change the `useTransit()` destructure to also take `snapshot`:

```tsx
  const { network, snapshot, vehicles, status: liveStatus, refresh, refreshing, snapshotReceivedAt } = useTransit();
```

and after the `networkStops` memo add:

```tsx
  const patternKey = activePatternKey(snapshot);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const activeStops = useMemo(() => getActiveStops(network, snapshot), [network, patternKey]);
```

(c) Replace `const closestStop = useMemo(() => findNearestStop(userLocation, STOPS), [userLocation]);` with:

```tsx
  const closestStop = useMemo(() => findNearestStop(userLocation, activeStops), [userLocation, activeStops]);
```

(d) In `<MapView`, replace `stops={STOPS}` with `stops={activeStops}`.

- [ ] **Step 12: Check that no rider code uses the old data**

Run:

```bash
grep -rn -e "p2pStops" -e "routeConfig" -e "mockTransit'" App.tsx components/*.tsx utils/*.ts
```

Expected: only `components/PlanTripView.tsx` importing `MOCK_DESTINATIONS` from `../data/mockTransit`, and `components/BusDetailSheet.tsx` should not appear.

- [ ] **Step 13: Type-check, test and verify in the browser**

Run: `npm run typecheck && npm test`
Expected: baseline errors only; all tests pass.

In the browser:
- Map stop circles sit on the GMV route lines.
- Tapping a stop shows its friendly name (e.g. "Hinton James/Horton (Horton Residence Hall)") and "P2P Express • Baity Hill" where both serve it.
- The list view's Closest Stop shows a GMV stop.
- Plan Trip to "Davis Library" returns a journey (walk-only outside service hours). During service it includes a bus leg with intermediate stop names.

- [ ] **Step 14: Commit**

```bash
git add utils/tripPlanning.ts utils/multimodalRouting.ts components/PlanTripView.tsx components/StopPopup.tsx components/ClosestStopCard.tsx components/MapboxMap.tsx components/MapView.tsx App.tsx tests/utils/tripPlanning.test.ts
git commit -m "$(printf 'Use GMV stops and patterns for the rider map, stops and Plan Trip\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')"
```

### Task 12: Move ops pages to live data and delete the mock transit data

**Files:**
- Modify: `components/ops/ManageDrivers.tsx`, `storage/opsAssignments.ts`, `components/ops/DriverLocationMap.tsx`, `pages/ops/OpsManagerPage.tsx`, `pages/ops/OpsAdminPage.tsx`, `utils/adminMetrics.ts`, `data/mockTransit.ts`, `types.ts`
- Delete: `data/p2pStops.ts`, `data/routeConfig.ts`, `utils/journey.ts`

**Interfaces:**
- Consumes: `useTransit`, `getActivePattern`, `ROUTE_IDS`, `ROUTE_NAMES`, `ROUTE_COLORS`, `routeIdFromName`.
- Produces:
  - `computeAdminMetrics({ stops, vehicles: LiveVehicle[], complaints? })`, same result shape as before. It is fully reworked in Task 17.
  - `types.ts` no longer exports `Route`, `UpcomingStop` or `Vehicle`.
  - `data/mockTransit.ts` exports only `MOCK_DESTINATIONS`.

- [ ] **Step 1: Route names in `components/ops/ManageDrivers.tsx`**

Replace `import { ROUTE_CONFIGS } from '../../data/routeConfig';` with `import { ROUTE_IDS, ROUTE_NAMES } from '../../data/routes';`, and replace:

```tsx
  const routeOptions = useMemo(() => ROUTE_CONFIGS.map((route) => route.routeName), []);
```

with:

```tsx
  const routeOptions = useMemo(() => ROUTE_IDS.map((id) => ROUTE_NAMES[id]), []);
```

- [ ] **Step 2: Route names in `storage/opsAssignments.ts`**

Replace `import { ROUTE_CONFIGS } from '../data/routeConfig';` with `import { ROUTE_NAMES } from '../data/routes';`, and replace:

```ts
  routeName: ROUTE_CONFIGS[0]?.routeName ?? 'P2P Express',
```

with:

```ts
  routeName: ROUTE_NAMES.P2P_EXPRESS,
```

- [ ] **Step 3: Official route line in `components/ops/DriverLocationMap.tsx`**

(a) Replace `import { ROUTE_CONFIGS } from '../../data/routeConfig';` with:

```tsx
import { useTransit } from '../../context/TransitProvider';
import { getActivePattern } from '../../utils/transitSelectors';
import { ROUTE_COLORS, routeIdFromName } from '../../data/routes';
```

(b) Replace:

```tsx
  const matchedRoute = routeName
    ? ROUTE_CONFIGS.find((route) => route.routeName.toLowerCase() === routeName.toLowerCase())
    : null;
  const routeCoords = matchedRoute?.stops
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((stop) => stop.coord) ?? [];
```

with:

```tsx
  const { network, snapshot } = useTransit();
  const routeId = routeName ? routeIdFromName(routeName) : null;
  const routeColor = routeId ? ROUTE_COLORS[routeId] : undefined;
  const routeCoords: [number, number][] = routeId
    ? getActivePattern(network, snapshot, routeId)?.geometry.coordinates ?? []
    : [];
```

(c) Replace every `matchedRoute?.routeColor` in the file with `routeColor` (the paint color and the effect dependency array). Check with `grep -n "matchedRoute" components/ops/DriverLocationMap.tsx`, which should print nothing.

(d) Replace `const routeLineCoords = [...routeCoords, routeCoords[0]];` with `const routeLineCoords = routeCoords;`. The GMV pattern already closes its own loop.

- [ ] **Step 4: Live vehicle list in `pages/ops/OpsManagerPage.tsx`**

Replace `import { VEHICLES } from '../../data/mockTransit';` with `import { useTransit } from '../../context/TransitProvider';`. Add `const { vehicles } = useTransit();` as the first line inside `export function OpsManagerPage() {`. Then replace:

```tsx
                      {VEHICLES.slice(0, 4).map((v) => (
                        <li key={v.id}>{v.id} · {v.routeName}</li>
                      ))}
```

with:

```tsx
                      {vehicles.length === 0 ? (
                        <li className="text-gray-400">No buses reporting</li>
                      ) : (
                        vehicles.map((v) => <li key={v.id}>{v.name} · {v.routeName}</li>)
                      )}
```

- [ ] **Step 5: Live inputs in `pages/ops/OpsAdminPage.tsx`**

(a) Replace:

```tsx
import { STOPS } from '../../data/p2pStops';
import { VEHICLES } from '../../data/mockTransit';
```

with:

```tsx
import { useTransit } from '../../context/TransitProvider';
```

(b) Add `const { network, vehicles } = useTransit();` as the first line inside `export function OpsAdminPage() {`.

(c) Replace the metrics effect with the version below. It runs once the network has loaded; StrictMode's double run is handled by `cancelled`.

```tsx
  useEffect(() => {
    if (!network) return;
    let cancelled = false;
    (async () => {
      setMetricsLoading(metrics == null);
      try {
        const next = await computeAdminMetrics({
          stops: network.stops,
          vehicles,
          complaints: MOCK_COMPLAINTS,
        });
        if (cancelled) return;
        setMetrics(next);
        setCachedAdminMetrics(next);
      } finally {
        if (!cancelled) setMetricsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network]);
```

- [ ] **Step 6: `LiveVehicle` in `utils/adminMetrics.ts`**

(a) Replace `import type { Coordinate, Stop, Vehicle } from '../types';` with `import type { Coordinate, LiveVehicle, Stop } from '../types';`.

(b) Delete the `toRouteIdFromVehicleRouteId` and `mockFullnessPercent` functions.

(c) In `computeAdminMetrics`'s input type, change `vehicles: Vehicle[];` to `vehicles: LiveVehicle[];`.

(d) Replace the vehicle loop:

```ts
  vehicles.forEach((v) => {
    const rid = toRouteIdFromVehicleRouteId(v.routeId);
    if (!rid) return;
    activeBusCounts[rid] += 1;
    fullnessBuckets[rid].push(mockFullnessPercent(v));
  });
```

with:

```ts
  vehicles.forEach((v) => {
    activeBusCounts[v.routeId] += 1;
    if (v.load != null) fullnessBuckets[v.routeId].push(Math.round(v.load * 100));
  });
```

- [ ] **Step 7: Delete the old transit data**

```bash
git rm data/p2pStops.ts data/routeConfig.ts utils/journey.ts
```

Replace `data/mockTransit.ts` with:

```ts
import { Destination } from '../types';

export const MOCK_DESTINATIONS: Destination[] = [
  { id: 'davis', name: 'Davis Library', lat: 35.9088, lon: -79.0470, address: '208 Raleigh St' },
  { id: 'union', name: 'Student Union', lat: 35.9105, lon: -79.0478, address: '209 South Rd' },
  { id: 'lenoir', name: 'Lenoir Dining Hall', lat: 35.9118, lon: -79.0482, address: '100 Manning Dr' },
  { id: 'rams', name: 'Rams Head Rec Center', lat: 35.9032, lon: -79.0440, address: '340 Ridge Rd' },
  { id: 'dean', name: 'Dean Smith Center', lat: 35.8999, lon: -79.0438, address: '300 Skipper Bowles Dr' },
  { id: 'kenan', name: 'Kenan Stadium', lat: 35.9069, lon: -79.0479, address: '104 Stadium Dr' },
  { id: 'target', name: 'Target Franklin St', lat: 35.9132, lon: -79.0558, address: '143 W Franklin St' },
  { id: 'hospital', name: 'UNC Hospitals', lat: 35.9025, lon: -79.0500, address: '101 Manning Dr' },
  { id: 'store', name: 'Student Stores', lat: 35.9100, lon: -79.0465, address: '207 South Rd' },
  { id: 'granville', name: 'Granville Towers', lat: 35.9135, lon: -79.0590, address: '125 W Franklin St' },
];
```

In `types.ts`, delete the `Route`, `UpcomingStop` and `Vehicle` interfaces.

- [ ] **Step 8: Check for leftovers**

```bash
grep -rn -e "p2pStops" -e "routeConfig" -e "ROUTE_CONFIGS" -e "VEHICLES" -e "mockFullness" -e "'p2p-express'" -e "'baity-hill'" -e "\bVehicle\b" --include='*.ts' --include='*.tsx' . | grep -v node_modules
```

Expected: only `components/mapboxBuses3DLayer.ts` (unused, out of scope) and `utils/serviceSchedule.ts` (it deliberately still accepts the legacy spellings).

- [ ] **Step 9: Type-check, test and build**

Run: `npm run typecheck && npm test && npm run build`
Expected: baseline errors only; all tests pass; Vite build succeeds.

- [ ] **Step 10: Verify the ops pages**

Log in at `/ops/login` with a manager account from `ops/auth.ts`, then:
- `/ops/manager`: the Live Fleet card lists live buses, or "No buses reporting".
- `/ops/admin` (as admin): loads without console errors.
- `/ops/driver`: the map draws the GMV route line for the assigned route.

- [ ] **Step 11: Commit**

```bash
git add -A components/ops/ManageDrivers.tsx storage/opsAssignments.ts components/ops/DriverLocationMap.tsx pages/ops/OpsManagerPage.tsx pages/ops/OpsAdminPage.tsx utils/adminMetrics.ts data/mockTransit.ts types.ts
git commit -m "$(printf 'Move ops pages to live transit data and delete mock stops/vehicles\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')"
```

## Phase 3 — Stop ETAs and service messages

### Task 13: Live stop arrivals (closest-stop card and stop pop-up)

**Files:**
- Create: `utils/arrivals.ts`, `components/ArrivalSourceTag.tsx`
- Modify: `context/TransitProvider.tsx`, `components/ClosestStopCard.tsx` (full rewrite), `components/StopPopup.tsx`, `App.tsx`
- Test: `tests/utils/arrivals.test.ts`

**Interfaces:**
- Consumes: `getRoutesServingStop`, `ROUTE_NAMES`, `ROUTE_COLORS`, `getUpcomingRouteArrivals`, `isRouteOperatingNow`, `formatEta`.
- Produces:
  - `getStopArrivals({ stopId, snapshot, status, network, now?, limit? }) → StopArrival[]`. If the status is `live`/`degraded` and the stop has live arrivals, those are returned (a GMV `scheduled` entry gets `source: 'scheduled'`). Otherwise it returns timetable arrivals for the routes that serve the stop and are operating now.
  - `useStopArrivals(stopId: string | null, limit = 5) → StopArrival[]` (exported from `context/TransitProvider.tsx`).
  - `<ArrivalSourceTag source />`.
  - `ClosestStopCard` props become `{ stop, userLocation }` (the `vehicles` prop is removed).

- [ ] **Step 1: Write the failing test `tests/utils/arrivals.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { getStopArrivals } from '../../utils/arrivals';
import { makeNetwork, makeSnapshot } from '../fixtures/transit';

const network = makeNetwork();
const NINE_PM_MONDAY = new Date(2026, 8, 14, 21, 0);
const NOON = new Date(2026, 8, 14, 12, 0);

describe('getStopArrivals', () => {
  it('returns live arrivals with route names', () => {
    const out = getStopArrivals({ stopId: 'b', snapshot: makeSnapshot(), status: 'live', network, now: NINE_PM_MONDAY });
    expect(out).toEqual([{ routeId: 'P2P_EXPRESS', routeName: 'P2P Express', etaSec: 90, source: 'live', vehicleId: 'v1' }]);
  });

  it('labels GMV schedule predictions as scheduled', () => {
    const snapshot = makeSnapshot({
      arrivalsByStop: { b: [{ routeId: 'P2P_EXPRESS', vehicleId: null, etaSec: 600, scheduled: true }] },
    });
    const out = getStopArrivals({ stopId: 'b', snapshot, status: 'live', network, now: NINE_PM_MONDAY });
    expect(out[0]).toMatchObject({ source: 'scheduled', vehicleId: null, etaSec: 600 });
  });

  it('falls back to the timetable when the stop has no live arrivals', () => {
    const out = getStopArrivals({ stopId: 'e', snapshot: makeSnapshot(), status: 'live', network, now: NINE_PM_MONDAY });
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((a) => a.routeId === 'BAITY_HILL' && a.source === 'scheduled' && a.etaSec % 60 === 0)).toBe(true);
  });

  it('ignores live data when the client status is unavailable', () => {
    const out = getStopArrivals({ stopId: 'b', snapshot: makeSnapshot(), status: 'unavailable', network, now: NINE_PM_MONDAY });
    expect(out.every((a) => a.source === 'scheduled' && a.routeId === 'P2P_EXPRESS')).toBe(true);
  });

  it('returns nothing outside service hours without live data', () => {
    expect(getStopArrivals({ stopId: 'b', snapshot: null, status: 'no-service', network, now: NOON })).toEqual([]);
  });

  it('respects the limit', () => {
    const out = getStopArrivals({ stopId: 'e', snapshot: null, status: 'unavailable', network, now: NINE_PM_MONDAY, limit: 2 });
    expect(out).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- tests/utils/arrivals.test.ts`
Expected: FAIL, because the module cannot be found.

- [ ] **Step 3: Create `utils/arrivals.ts`**

```ts
/**
 * Arrivals for a stop: live GMV predictions when available, otherwise the timetable.
 * Single source for the closest-stop card, stop pop-up and Plan Trip.
 */

import type { ClientLiveStatus, LiveSnapshot, StopArrival, TransitNetwork } from '../types';
import { ROUTE_NAMES } from '../data/routes';
import { getRoutesServingStop } from './transitSelectors';
import { getUpcomingRouteArrivals, isRouteOperatingNow } from './serviceSchedule';

export interface StopArrivalsInput {
  stopId: string;
  snapshot: LiveSnapshot | null;
  status: ClientLiveStatus;
  network: TransitNetwork | null;
  now?: Date;
  limit?: number;
}

export function getStopArrivals({
  stopId,
  snapshot,
  status,
  network,
  now = new Date(),
  limit = 5,
}: StopArrivalsInput): StopArrival[] {
  const liveUsable = status === 'live' || status === 'degraded';
  const live = liveUsable && snapshot ? snapshot.arrivalsByStop[stopId] ?? [] : [];
  if (live.length > 0) {
    return live.slice(0, limit).map((a) => ({
      routeId: a.routeId,
      routeName: ROUTE_NAMES[a.routeId],
      etaSec: a.etaSec,
      source: a.scheduled ? 'scheduled' : 'live',
      vehicleId: a.vehicleId,
    }));
  }

  return getRoutesServingStop(network, snapshot, stopId)
    .filter((routeId) => isRouteOperatingNow(routeId, now))
    .flatMap((routeId) =>
      getUpcomingRouteArrivals(routeId, now, 3).map(
        (minutes): StopArrival => ({
          routeId,
          routeName: ROUTE_NAMES[routeId],
          etaSec: minutes * 60,
          source: 'scheduled',
          vehicleId: null,
        })
      )
    )
    .sort((a, b) => a.etaSec - b.etaSec)
    .slice(0, limit);
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test -- tests/utils/arrivals.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Add `useStopArrivals` to `context/TransitProvider.tsx`**

Change the type import to include `StopArrival`, and add the arrivals import:

```tsx
import type { ClientLiveStatus, LiveSnapshot, LiveVehicle, StopArrival, TransitNetwork } from '../types';
import { getStopArrivals } from '../utils/arrivals';
```

Append at the end of the file:

```tsx
export function useStopArrivals(stopId: string | null, limit = 5): StopArrival[] {
  const { network, snapshot, status } = useTransit();
  return useMemo(
    () => (stopId ? getStopArrivals({ stopId, snapshot, status, network, now: new Date(), limit }) : []),
    [stopId, snapshot, status, network, limit]
  );
}
```

- [ ] **Step 6: Create `components/ArrivalSourceTag.tsx`**

```tsx
import React from 'react';

export function ArrivalSourceTag({ source }: { source: 'live' | 'scheduled' }) {
  if (source === 'live') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
        Live
      </span>
    );
  }
  return <span className="text-xs text-gray-500">Scheduled</span>;
}
```

- [ ] **Step 7: Replace `components/ClosestStopCard.tsx`**

```tsx
import React, { useMemo } from 'react';
import type { Stop, Coordinate } from '../types';
import { getDistanceMeters, getWalkTimeMinutes } from '../utils/geo';
import { Navigation } from 'lucide-react';
import { getServiceResumeLabel } from '../utils/serviceSchedule';
import { ROUTE_COLORS } from '../data/routes';
import { formatEta } from '../utils/format';
import { useStopArrivals } from '../context/TransitProvider';
import { ArrivalSourceTag } from './ArrivalSourceTag';

interface ClosestStopCardProps {
  stop: Stop;
  userLocation: Coordinate;
}

export const ClosestStopCard: React.FC<ClosestStopCardProps> = ({ stop, userLocation }) => {
  const walkTime = useMemo(() => getWalkTimeMinutes(getDistanceMeters(userLocation, stop)), [userLocation, stop]);
  const arrivals = useStopArrivals(stop.id, 3);

  return (
    <div className="mt-3 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">Closest Stop</h2>
          <h3 className="text-lg font-bold text-gray-900 leading-tight">{stop.name}</h3>
        </div>
        <div className="flex items-center text-p2p-blue bg-p2p-light-blue/20 px-2 py-1 rounded-lg">
          <Navigation size={14} className="mr-1" />
          <span className="text-sm font-bold">{walkTime} min walk</span>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-3">
        {arrivals.length > 0 ? (
          <div className="space-y-2">
            {arrivals.map((arr, idx) => (
              <div key={`${arr.routeId}-${arr.vehicleId ?? 'sched'}-${idx}`} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold text-white"
                    style={{ backgroundColor: ROUTE_COLORS[arr.routeId] }}
                  >
                    {arr.routeName}
                  </span>
                  <ArrivalSourceTag source={arr.source} />
                </div>
                <span className="text-sm font-bold text-gray-900">
                  {arr.etaSec < 60 ? 'Arriving now' : `Arriving in ${formatEta(arr.etaSec)}`}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-sm text-gray-500 italic">Service resumes at {getServiceResumeLabel()}</span>
        )}
      </div>
    </div>
  );
};
```

In `App.tsx`, remove the `vehicles={vehicles}` prop from `<ClosestStopCard`.

- [ ] **Step 8: Update `components/StopPopup.tsx`**

(a) Imports:
- Change `import type { Stop, Coordinate, Journey } from '../types';` to `import type { Stop, Coordinate, Journey, LineStringGeometry } from '../types';`.
- Delete `import { getUpcomingRouteArrivals, isRouteOperatingNow } from '../utils/serviceSchedule';`.
- Change `import { useTransit } from '../context/TransitProvider';` to `import { useStopArrivals, useTransit } from '../context/TransitProvider';`.
- Add:

```tsx
import { formatEta } from '../utils/format';
import { ArrivalSourceTag } from './ArrivalSourceTag';
```

(b) Delete the `ArrivalItem` interface. Run `grep -rn "ArrivalItem" --include='*.tsx' --include='*.ts' . | grep -v node_modules` and confirm nothing else uses it.

(c) Delete these three state lines:

```tsx
  const [arrivals, setArrivals] = useState<ArrivalItem[] | null>(null);
  const [arrivalsLoading, setArrivalsLoading] = useState(true);
  const [arrivalsError, setArrivalsError] = useState(false);
```

Also delete the whole effect that starts with `setArrivalsLoading(true);` and ends with `}, [routesServed]);`. After the `routesServed` memo, add:

```tsx
  const arrivals = useStopArrivals(stop.id, 5);
```

(d) In the journey object inside `handleWalkToThisStop`, change `geometry: result.geometry,` to `geometry: result.geometry as LineStringGeometry,`. This fixes the baseline type error.

(e) Replace the arrivals conditional (from `{arrivalsLoading ? (` through the closing `)}` just before `</section>`) with:

```tsx
          {arrivals.length > 0 ? (
            <ul className="space-y-1">
              {arrivals.map((a, i) => (
                <li
                  key={`${a.routeId}-${a.vehicleId ?? 'sched'}-${i}`}
                  className="text-sm text-gray-700 flex justify-between items-center gap-2"
                >
                  <span className="flex items-center gap-2">
                    {a.routeName}
                    <ArrivalSourceTag source={a.source} />
                  </span>
                  <span className="font-semibold">{formatEta(a.etaSec)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No buses currently running</p>
          )}
```

- [ ] **Step 9: Type-check, test and verify**

Run: `npm run typecheck && npm test`
Expected: the `StopPopup.tsx` baseline error is gone, leaving only the other baseline errors; all tests pass.

In the browser:
- Outside service hours: the closest-stop card says "Service resumes at 7:00 PM" and the stop pop-up says "No buses currently running".
- During service: rows show a green **Live** tag with minute counts that change as snapshots arrive.

- [ ] **Step 10: Commit**

```bash
git add utils/arrivals.ts components/ArrivalSourceTag.tsx context/TransitProvider.tsx components/ClosestStopCard.tsx components/StopPopup.tsx App.tsx tests/utils/arrivals.test.ts
git commit -m "$(printf 'Show live stop arrivals with Live/Scheduled labels\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')"
```

### Task 14: Service messages

**Files:**
- Create: `utils/serviceMessages.ts`, `components/ServiceMessageBanner.tsx`
- Modify: `App.tsx`, `components/StopPopup.tsx`
- Test: `tests/utils/serviceMessages.test.ts`

**Interfaces:**
- Consumes: `snapshot.messages` (`ServiceMessage[]`) from `useTransit`.
- Produces:
  - `getBannerMessages(messages, dismissedIds: ReadonlySet<string>) → ServiceMessage[]`: global or route messages that haven't been dismissed.
  - `getStopMessages(messages, stopId) → ServiceMessage[]`.
  - `<ServiceMessageBanner />`, which remembers dismissals in sessionStorage under the key `p2p-dismissed-service-messages`.

- [ ] **Step 1: Write the failing test `tests/utils/serviceMessages.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import type { ServiceMessage } from '../../types';
import { getBannerMessages, getStopMessages } from '../../utils/serviceMessages';

const msg = (o: Partial<ServiceMessage>): ServiceMessage => ({
  id: '1', title: 't', body: '', global: false, routeIds: [], stopIds: [], startsAt: null, endsAt: null, ...o,
});

const globalMsg = msg({ id: 'g', global: true });
const routeMsg = msg({ id: 'r', routeIds: ['P2P_EXPRESS'] });
const stopMsg = msg({ id: 's', stopIds: ['10044065'] });

describe('getBannerMessages', () => {
  it('returns global and route messages, not stop-only ones', () => {
    expect(getBannerMessages([globalMsg, routeMsg, stopMsg], new Set()).map((m) => m.id)).toEqual(['g', 'r']);
  });
  it('hides dismissed messages', () => {
    expect(getBannerMessages([globalMsg, routeMsg], new Set(['g'])).map((m) => m.id)).toEqual(['r']);
  });
});

describe('getStopMessages', () => {
  it('returns messages assigned to the stop', () => {
    expect(getStopMessages([globalMsg, routeMsg, stopMsg], '10044065').map((m) => m.id)).toEqual(['s']);
    expect(getStopMessages([stopMsg], 'other')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- tests/utils/serviceMessages.test.ts`
Expected: FAIL, because the module cannot be found.

- [ ] **Step 3: Create `utils/serviceMessages.ts`**

```ts
import type { ServiceMessage } from '../types';

/** System-wide and route messages for the rider banner, minus ones the rider dismissed. */
export function getBannerMessages(messages: ServiceMessage[], dismissedIds: ReadonlySet<string>): ServiceMessage[] {
  return messages.filter((m) => (m.global || m.routeIds.length > 0) && !dismissedIds.has(m.id));
}

/** Messages assigned to a specific stop (shown in its pop-up). */
export function getStopMessages(messages: ServiceMessage[], stopId: string): ServiceMessage[] {
  return messages.filter((m) => m.stopIds.includes(stopId));
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test -- tests/utils/serviceMessages.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Create `components/ServiceMessageBanner.tsx`**

```tsx
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useTransit } from '../context/TransitProvider';
import { getBannerMessages } from '../utils/serviceMessages';
import { ROUTE_NAMES } from '../data/routes';

const DISMISSED_KEY = 'p2p-dismissed-service-messages';

function readDismissed(): Set<string> {
  try {
    const raw = window.sessionStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function ServiceMessageBanner() {
  const { snapshot } = useTransit();
  const [dismissed, setDismissed] = useState<Set<string>>(() => readDismissed());
  const messages = getBannerMessages(snapshot?.messages ?? [], dismissed);
  if (messages.length === 0) return null;

  const dismiss = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    try {
      window.sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
    } catch {
      // ignore storage errors
    }
  };

  return (
    <>
      {messages.map((m) => (
        <div
          key={m.id}
          role="status"
          className="pointer-events-auto w-full max-w-md rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 shadow-sm relative"
        >
          <button
            type="button"
            onClick={() => dismiss(m.id)}
            className="absolute right-2 top-2 inline-flex items-center justify-center rounded-full p-1.5 text-sky-700 hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
            aria-label="Dismiss service message"
          >
            <X size={14} />
          </button>
          <p className="text-sm font-semibold text-sky-900 pr-6">{m.title}</p>
          {m.body && <p className="text-xs text-sky-800/90 mt-1 pr-6">{m.body}</p>}
          {m.routeIds.length > 0 && (
            <p className="text-[11px] font-medium text-sky-700 mt-1">{m.routeIds.map((r) => ROUTE_NAMES[r]).join(' • ')}</p>
          )}
        </div>
      ))}
    </>
  );
}
```

- [ ] **Step 6: Mount the banner in `App.tsx`**

Add `import { ServiceMessageBanner } from './components/ServiceMessageBanner';`.

Replace:

```tsx
        {outsideAreaMiles != null && outsideAreaMiles > SERVICE_RADIUS_MILES && !warningDismissed && (
          <div className="pointer-events-none absolute inset-x-0 top-2 z-30 flex justify-center px-4">
            <div className="pointer-events-auto w-full max-w-md rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm relative">
```

with:

```tsx
        <div className="pointer-events-none absolute inset-x-0 top-2 z-30 flex flex-col items-center gap-2 px-4">
          <ServiceMessageBanner />
          {outsideAreaMiles != null && outsideAreaMiles > SERVICE_RADIUS_MILES && !warningDismissed && (
            <div className="pointer-events-auto w-full max-w-md rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm relative">
```

and replace the end of that block:

```tsx
                Center Map on UNC
              </button>
            </div>
          </div>
        )}
```

with:

```tsx
                Center Map on UNC
              </button>
            </div>
          )}
        </div>
```

- [ ] **Step 7: Show stop messages in `components/StopPopup.tsx`**

Add `import { getStopMessages } from '../utils/serviceMessages';`. After `const arrivals = useStopArrivals(stop.id, 5);`, add:

```tsx
  const stopMessages = getStopMessages(snapshot?.messages ?? [], stop.id);
```

Directly before `<section className="mt-4" aria-labelledby="arrivals-heading">`, add:

```tsx
        {stopMessages.length > 0 && (
          <section className="mt-3 space-y-2" aria-label="Service alerts">
            {stopMessages.map((m) => (
              <div key={m.id} className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
                <p className="text-sm font-semibold text-sky-900">{m.title}</p>
                {m.body && <p className="text-xs text-sky-800/90 mt-0.5">{m.body}</p>}
              </div>
            ))}
          </section>
        )}
```

- [ ] **Step 8: Verify with a synthetic message**

GMV currently returns no messages, so check the UI by temporarily overriding the response in the browser console:

```js
const orig = window.fetch;
window.fetch = async (u, i) => {
  const r = await orig(u, i);
  if (!String(u).includes('/api/live/snapshot')) return r;
  const d = await r.json();
  d.messages = [{ id: 'demo', title: 'Granville closed', body: 'Buses detour via Pittsboro St.', global: false, routeIds: ['P2P_EXPRESS'], stopIds: ['10044065'], startsAt: null, endsAt: null }];
  return new Response(JSON.stringify(d), { headers: { 'Content-Type': 'application/json' } });
};
```

Expected:
- Within 6 s a blue banner "Granville closed" appears over the list and map. Dismissing it hides it until the session ends.
- On the map, the Ehringhaus stop pop-up shows the alert.

Reload the page to remove the override.

- [ ] **Step 9: Type-check, test and commit**

Run: `npm run typecheck && npm test`
Expected: baseline errors only (minus StopPopup); all tests pass.

```bash
git add utils/serviceMessages.ts components/ServiceMessageBanner.tsx App.tsx components/StopPopup.tsx tests/utils/serviceMessages.test.ts
git commit -m "$(printf 'Show GMV service messages in a banner and stop pop-ups\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')"
```

## Phase 4 — Plan Trip

### Task 15: Live wait and ride times in Plan Trip

**Files:**
- Modify: `utils/tripPlanning.ts`, `utils/multimodalRouting.ts`, `types.ts`, `components/PlanTripView.tsx`
- Test: `tests/utils/tripPlanning.test.ts` (extend)

**Interfaces:**
- Consumes: `LiveVehicle.upcomingStops`, `snapshot.arrivalsByStop`, `getUpcomingRouteArrivals`.
- Produces:
  - `estimateBusLeg({ vehicles, routeId, boardStopId, alightStopId, walkToBoardSec, scheduledArrivalsSec, fallbackRideSec }) → { waitSec, rideSec, source: 'live' | 'scheduled', vehicleId: string | null } | null`
  - `JourneySegment.waitSource?: 'live' | 'scheduled'`
- **Semantics:** `waitTimeMin` now means minutes waiting *at the stop after walking there*. `PlanTripView` already computes `nextBusAt = now + walk + wait`, so it stays correct.

- [ ] **Step 1: Add failing tests to `tests/utils/tripPlanning.test.ts`**

Change the import line to:

```ts
import { estimateBusLeg, fallbackRideSec, rideDistanceMeters } from '../../utils/tripPlanning';
import { makeVehicle } from '../fixtures/transit';
```

Append:

```ts
describe('estimateBusLeg', () => {
  const base = {
    routeId: 'P2P_EXPRESS' as const,
    boardStopId: 'b',
    alightStopId: 'c',
    walkToBoardSec: 60,
    scheduledArrivalsSec: [] as number[],
    fallbackRideSec: 500,
  };
  const v1 = makeVehicle({ id: 'v1', upcomingStops: [{ stopId: 'b', etaSec: 90 }, { stopId: 'c', etaSec: 300 }] });
  const v2 = makeVehicle({ id: 'v2', upcomingStops: [{ stopId: 'b', etaSec: 400 }, { stopId: 'c', etaSec: 700 }] });

  it('picks the earliest live bus the rider can reach, with ride time from its predictions', () => {
    expect(estimateBusLeg({ ...base, vehicles: [v2, v1] })).toEqual({ waitSec: 30, rideSec: 210, source: 'live', vehicleId: 'v1' });
  });

  it('skips a bus that arrives before the rider can reach the stop', () => {
    expect(estimateBusLeg({ ...base, walkToBoardSec: 120, vehicles: [v1, v2] })).toEqual({ waitSec: 280, rideSec: 300, source: 'live', vehicleId: 'v2' });
  });

  it('uses the fallback ride time when the alight stop is not predicted', () => {
    const v = makeVehicle({ upcomingStops: [{ stopId: 'b', etaSec: 90 }] });
    expect(estimateBusLeg({ ...base, vehicles: [v] })).toMatchObject({ rideSec: 500, source: 'live' });
  });

  it('ignores stale buses and other routes, then falls back to the first reachable scheduled arrival', () => {
    const stale = { ...v1, stale: true };
    const baity = { ...v1, id: 'v3', routeId: 'BAITY_HILL' as const };
    expect(estimateBusLeg({ ...base, vehicles: [stale, baity], scheduledArrivalsSec: [30, 600] })).toEqual({
      waitSec: 540, rideSec: 500, source: 'scheduled', vehicleId: null,
    });
  });

  it('returns null when no bus fits', () => {
    expect(estimateBusLeg({ ...base, vehicles: [] })).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- tests/utils/tripPlanning.test.ts`
Expected: FAIL, because `estimateBusLeg` is not exported.

- [ ] **Step 3: Add `estimateBusLeg` to `utils/tripPlanning.ts`**

Add at the top: `import type { LiveVehicle, RouteId } from '../types';`. Append:

```ts
export interface BusLegEstimate {
  /** Seconds waiting at the board stop after walking there. */
  waitSec: number;
  rideSec: number;
  source: 'live' | 'scheduled';
  vehicleId: string | null;
}

export interface BusLegInput {
  vehicles: LiveVehicle[];
  routeId: RouteId;
  boardStopId: string;
  alightStopId: string;
  /** Seconds until the rider reaches the board stop. */
  walkToBoardSec: number;
  /** Non-live arrivals at the board stop (seconds from now), used when no live bus fits. */
  scheduledArrivalsSec: number[];
  fallbackRideSec: number;
}

/** Earliest live bus the rider can catch (ride time from its own predictions), else the next scheduled arrival. */
export function estimateBusLeg(input: BusLegInput): BusLegEstimate | null {
  const { vehicles, routeId, boardStopId, alightStopId, walkToBoardSec, scheduledArrivalsSec } = input;
  let best: BusLegEstimate | null = null;
  let bestBoardEta = Infinity;

  for (const v of vehicles) {
    if (v.routeId !== routeId || v.stale) continue;
    const board = v.upcomingStops.find((s) => s.stopId === boardStopId && s.etaSec >= walkToBoardSec);
    if (!board) continue;
    const alight = v.upcomingStops.find((s) => s.stopId === alightStopId && s.etaSec > board.etaSec);
    if (board.etaSec < bestBoardEta || (board.etaSec === bestBoardEta && alight)) {
      bestBoardEta = board.etaSec;
      best = {
        waitSec: board.etaSec - walkToBoardSec,
        rideSec: alight ? alight.etaSec - board.etaSec : input.fallbackRideSec,
        source: 'live',
        vehicleId: v.id,
      };
    }
  }
  if (best) return best;

  const next = [...scheduledArrivalsSec].sort((a, b) => a - b).find((s) => s >= walkToBoardSec);
  if (next == null) return null;
  return { waitSec: next - walkToBoardSec, rideSec: input.fallbackRideSec, source: 'scheduled', vehicleId: null };
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test -- tests/utils/tripPlanning.test.ts`
Expected: 8 passed.

- [ ] **Step 5: Add `waitSource` to `JourneySegment` in `types.ts`**

After `waitTimeMin?: number;`, add:

```ts
  /** Whether waitTimeMin comes from a live prediction or the timetable. */
  waitSource?: 'live' | 'scheduled';
```

- [ ] **Step 6: Use `estimateBusLeg` in `utils/multimodalRouting.ts`**

(a) Change `import { fallbackRideSec, rideDistanceMeters } from './tripPlanning';` to:

```ts
import { estimateBusLeg, fallbackRideSec, rideDistanceMeters } from './tripPlanning';
```

(b) After `const stopsById = new Map((network?.stops ?? []).map((s) => [s.id, s]));`, add:

```ts
  const liveUsable = snapshot != null && (snapshot.status === 'live' || snapshot.status === 'degraded');
  const liveVehicles = liveUsable ? snapshot.vehicles : [];
```

(c) Replace `if (!isRouteOperatingNow(routeId, now)) continue;` with:

```ts
    const hasLiveBuses = liveVehicles.some((v) => v.routeId === routeId);
    if (!hasLiveBuses && !isRouteOperatingNow(routeId, now)) continue;
```

(d) Replace `const waitSec = (getUpcomingRouteArrivals(routeId, now, 1)[0] ?? 0) * 60;` with:

```ts
    const timetableSec = getUpcomingRouteArrivals(routeId, now, 6).map((minutes) => minutes * 60);
    /** Non-vehicle arrivals at a stop: GMV schedule predictions when live, else the timetable. */
    const scheduledAtStop = (stopId: string): number[] => {
      const live = liveUsable
        ? (snapshot?.arrivalsByStop[stopId] ?? []).filter((a) => a.routeId === routeId).map((a) => a.etaSec)
        : [];
      return live.length > 0 ? live : timetableSec;
    };
```

(e) Replace:

```ts
        const busDurationSec = fallbackRideSec(distance, forwardStops.length - 2);
        const totalSec = board.walk.durationSec + waitSec + busDurationSec + alight.walk.durationSec;
        if (totalSec >= bestTotalSec) continue;
```

with:

```ts
        const leg = estimateBusLeg({
          vehicles: liveVehicles,
          routeId,
          boardStopId: board.ref.stop.id,
          alightStopId: alight.ref.stop.id,
          walkToBoardSec: board.walk.durationSec,
          scheduledArrivalsSec: scheduledAtStop(board.ref.stop.id),
          fallbackRideSec: fallbackRideSec(distance, forwardStops.length - 2),
        });
        if (!leg) continue;
        const busDurationSec = leg.rideSec;
        const totalSec = board.walk.durationSec + leg.waitSec + busDurationSec + alight.walk.durationSec;
        if (totalSec >= bestTotalSec) continue;
```

(f) In the bus segment object, replace `waitTimeMin: Math.ceil(waitSec / 60),` with:

```ts
            waitTimeMin: Math.ceil(leg.waitSec / 60),
            waitSource: leg.source,
```

- [ ] **Step 7: Label the timing widget in `components/PlanTripView.tsx`**

Replace:

```tsx
                <div className="text-[9px] md:text-[10px] font-semibold uppercase tracking-wide text-amber-700 mb-1">
                  Timing
                </div>
```

with:

```tsx
                <div className="text-[9px] md:text-[10px] font-semibold uppercase tracking-wide text-amber-700 mb-1">
                  Timing{busSeg?.waitSource ? ` · ${busSeg.waitSource === 'live' ? 'Live' : 'Scheduled'}` : ''}
                </div>
```

- [ ] **Step 8: Type-check, test and verify**

Run: `npm run typecheck && npm test`
Expected: baseline errors only; all tests pass.

In the browser:
- During service: plan a trip from Horton Residence Hall to Planetarium. The result shows "Via P2P Express", the Timing widget reads "Timing · Live", and "Leave at" moves as snapshots update when you re-plan.
- Outside service: walk-only, or "This route is not currently operating".

- [ ] **Step 9: Commit**

```bash
git add utils/tripPlanning.ts utils/multimodalRouting.ts types.ts components/PlanTripView.tsx tests/utils/tripPlanning.test.ts
git commit -m "$(printf 'Use live predictions for Plan Trip wait and ride times\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')"
```

## Phase 5 — Ops dashboards and cleanup

### Task 16: Live fleet on the manager dashboard

**Files:**
- Create: `utils/fleet.ts`
- Modify: `pages/ops/OpsManagerPage.tsx`, `data/mockOps.ts`
- Test: `tests/utils/fleet.test.ts`

**Interfaces:**
- Consumes: `projectPointToRoute`, `haversineMeters`, `getPattern`, `getLoadInfo`, and `FleetStatusRow` (from `data/mockOps.ts`: `{ busId, busLabel, routeName, runLabel, capacityCurrent, capacityMax, isOffRoute, lastUpdated }`).
- Produces:
  - `OFF_ROUTE_METERS = 60`
  - `distanceFromLineMeters(line, point) → number`
  - `isOffRoute(vehicle, network, thresholdMeters?) → boolean`
  - `buildFleetRows(vehicles, network) → FleetStatusRow[]`
  - `medianHeadwayMin(snapshot, routeId) → number | null`: the median gap between consecutive live vehicles' arrivals at each stop, in minutes. Used again in Task 17.

- [ ] **Step 1: Write the failing test `tests/utils/fleet.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { buildFleetRows, distanceFromLineMeters, isOffRoute, medianHeadwayMin } from '../../utils/fleet';
import { LINE, makeNetwork, makeSnapshot, makeVehicle } from '../fixtures/transit';

const network = makeNetwork();

describe('distanceFromLineMeters', () => {
  it('measures the perpendicular distance to the nearest segment', () => {
    expect(distanceFromLineMeters(LINE, [-79.045, 35.901])).toBeCloseTo(111.2, 0);
  });
});

describe('isOffRoute', () => {
  it('is false on the pattern line and true far from it', () => {
    expect(isOffRoute(makeVehicle({ lat: 35.9, lon: -79.045 }), network)).toBe(false);
    expect(isOffRoute(makeVehicle({ lat: 35.95, lon: -79.045 }), network)).toBe(true);
  });
  it('is false when stale or the pattern is unknown', () => {
    expect(isOffRoute(makeVehicle({ lat: 35.95, lon: -79.045, stale: true }), network)).toBe(false);
    expect(isOffRoute(makeVehicle({ lat: 35.95, lon: -79.045, patternId: 404 }), network)).toBe(false);
  });
});

describe('buildFleetRows', () => {
  it('maps live vehicles to fleet rows', () => {
    const [row] = buildFleetRows([makeVehicle({ lat: 35.9, lon: -79.045 })], network);
    expect(row).toEqual({
      busId: 'v1', busLabel: 'Bus 1', routeName: 'P2P Express', runLabel: 'P2P Express',
      capacityCurrent: 20, capacityMax: 40, isOffRoute: false, lastUpdated: '2026-09-14T23:00:00.000Z',
    });
  });
});

describe('medianHeadwayMin', () => {
  it('takes the median gap between consecutive live vehicles at each stop', () => {
    const snapshot = makeSnapshot({
      arrivalsByStop: {
        b: [
          { routeId: 'P2P_EXPRESS', vehicleId: 'v1', etaSec: 90, scheduled: false },
          { routeId: 'P2P_EXPRESS', vehicleId: 'v2', etaSec: 690, scheduled: false },
          { routeId: 'P2P_EXPRESS', vehicleId: null, etaSec: 700, scheduled: true },
        ],
        c: [
          { routeId: 'P2P_EXPRESS', vehicleId: 'v1', etaSec: 300, scheduled: false },
          { routeId: 'P2P_EXPRESS', vehicleId: 'v2', etaSec: 1500, scheduled: false },
          { routeId: 'BAITY_HILL', vehicleId: 'v9', etaSec: 310, scheduled: false },
        ],
      },
    });
    expect(medianHeadwayMin(snapshot, 'P2P_EXPRESS')).toBe(15);
  });
  it('returns null with fewer than two vehicles', () => {
    expect(medianHeadwayMin(makeSnapshot(), 'P2P_EXPRESS')).toBeNull();
    expect(medianHeadwayMin(null, 'P2P_EXPRESS')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- tests/utils/fleet.test.ts`
Expected: FAIL, because the module cannot be found.

- [ ] **Step 3: Create `utils/fleet.ts`**

```ts
/**
 * Fleet views for ops: rows for the Fleet tab, off-route detection, live headways.
 */

import type { LiveSnapshot, LiveVehicle, RouteId, TransitNetwork } from '../types';
import type { FleetStatusRow } from '../data/mockOps';
import { haversineMeters, projectPointToRoute, type LngLat } from './routeInterpolation';
import { getPattern } from './transitSelectors';
import { getLoadInfo } from './vehicleDisplay';

export const OFF_ROUTE_METERS = 60;

export function distanceFromLineMeters(line: LngLat[], point: LngLat): number {
  if (line.length < 2) return Infinity;
  const { nearestPoint } = projectPointToRoute(line, point);
  return haversineMeters(point, nearestPoint);
}

/** A bus is off route when it is more than `thresholdMeters` from its own pattern line. */
export function isOffRoute(
  vehicle: LiveVehicle,
  network: TransitNetwork | null,
  thresholdMeters: number = OFF_ROUTE_METERS
): boolean {
  if (vehicle.stale) return false;
  const pattern = getPattern(network, vehicle.patternId);
  if (!pattern) return false;
  return distanceFromLineMeters(pattern.geometry.coordinates, [vehicle.lon, vehicle.lat]) > thresholdMeters;
}

export function buildFleetRows(vehicles: LiveVehicle[], network: TransitNetwork | null): FleetStatusRow[] {
  return vehicles.map((v) => {
    const load = getLoadInfo(v);
    return {
      busId: v.id,
      busLabel: v.name,
      routeName: v.routeName,
      runLabel: getPattern(network, v.patternId)?.name ?? '—',
      capacityCurrent: load?.riders ?? 0,
      capacityMax: v.capacity ?? 0,
      isOffRoute: isOffRoute(v, network),
      lastUpdated: v.lastUpdated ?? '',
    };
  });
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Median gap (minutes) between consecutive live buses arriving at the same stop. */
export function medianHeadwayMin(snapshot: LiveSnapshot | null, routeId: RouteId): number | null {
  if (!snapshot) return null;
  const gaps: number[] = [];
  for (const arrivals of Object.values(snapshot.arrivalsByStop)) {
    const firstEtaByVehicle = new Map<string, number>();
    for (const a of arrivals) {
      if (a.routeId !== routeId || a.scheduled || !a.vehicleId) continue;
      const prev = firstEtaByVehicle.get(a.vehicleId);
      if (prev == null || a.etaSec < prev) firstEtaByVehicle.set(a.vehicleId, a.etaSec);
    }
    const etas = [...firstEtaByVehicle.values()].sort((x, y) => x - y);
    for (let i = 1; i < etas.length; i++) gaps.push(etas[i] - etas[i - 1]);
  }
  const m = median(gaps);
  return m == null ? null : m / 60;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test -- tests/utils/fleet.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Live fleet on `pages/ops/OpsManagerPage.tsx`**

(a) In the `../../data/mockOps` import list, delete `MOCK_FLEET_SUMMARY,`, `MOCK_ACTIVE_ROUTES,`, `MOCK_FLEET_STATUS_ROWS,`, `MOCK_STAT_ACTIVE_BUSES,` and `MOCK_STAT_OFF_ROUTE_BUSES,`. Add:

```tsx
import { buildFleetRows } from '../../utils/fleet';
import { ROUTE_IDS, ROUTE_NAMES } from '../../data/routes';
```

(b) Replace `const { vehicles } = useTransit();` with:

```tsx
  const { network, vehicles, status: liveStatus, snapshotReceivedAt } = useTransit();
  const fleetRows = useMemo(() => buildFleetRows(vehicles, network), [vehicles, network]);
  const offRouteCount = fleetRows.filter((r) => r.isOffRoute).length;
  const trackingStale = liveStatus === 'degraded' || liveStatus === 'unavailable';
```

(c) Replace `value={MOCK_STAT_ACTIVE_BUSES}` with `value={vehicles.length}`, and `value={MOCK_STAT_OFF_ROUTE_BUSES}` with `value={offRouteCount}`.

(d) Replace:

```tsx
                    <p className="text-2xl font-bold text-gray-900">{MOCK_FLEET_SUMMARY.activeBuses} active buses</p>
                    <p className="text-sm text-gray-500">Last update: {new Date(MOCK_FLEET_SUMMARY.lastUpdateAt).toLocaleTimeString()}</p>
                    {MOCK_FLEET_SUMMARY.trackingStale && <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-800">Tracking stale</span>}
```

with:

```tsx
                    <p className="text-2xl font-bold text-gray-900">{vehicles.length} active buses</p>
                    <p className="text-sm text-gray-500">
                      Last update: {snapshotReceivedAt != null ? new Date(snapshotReceivedAt).toLocaleTimeString() : '—'}
                    </p>
                    {trackingStale && <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-800">Tracking stale</span>}
```

(e) Replace the Active Routes grid body:

```tsx
                    {MOCK_ACTIVE_ROUTES.map((r) => (
                      <div key={r.id} className="p-4 rounded-xl border border-gray-100 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-gray-900">{r.name}</p>
                          <p className="text-sm text-gray-500">{r.activeBuses} buses · {r.nextArrivalSummary}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-800">{r.status}</span>
                      </div>
                    ))}
```

with:

```tsx
                    {ROUTE_IDS.map((routeId) => {
                      const count = vehicles.filter((v) => v.routeId === routeId).length;
                      return (
                        <div key={routeId} className="p-4 rounded-xl border border-gray-100 flex items-center justify-between">
                          <div>
                            <p className="font-bold text-gray-900">{ROUTE_NAMES[routeId]}</p>
                            <p className="text-sm text-gray-500">{count} {count === 1 ? 'bus' : 'buses'} reporting</p>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              count > 0 ? 'bg-emerald-500/20 text-emerald-800' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {count > 0 ? 'running' : 'no service'}
                          </span>
                        </div>
                      );
                    })}
```

(f) In the Fleet tab, replace:

```tsx
                      {MOCK_FLEET_STATUS_ROWS.map((row) => (
                        <tr key={row.busId} className="border-b border-gray-50">
                          <td className="py-3 px-4 font-medium text-gray-900">{row.busLabel}</td>
                          <td className="py-3 px-4 text-gray-600">{row.routeName} · {row.runLabel}</td>
                          <td className="py-3 px-4 w-40"><CapacityBar current={row.capacityCurrent} max={row.capacityMax} /></td>
```

with:

```tsx
                      {fleetRows.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-6 px-4 text-center text-gray-500">No buses reporting right now</td>
                        </tr>
                      )}
                      {fleetRows.map((row) => (
                        <tr key={row.busId} className="border-b border-gray-50">
                          <td className="py-3 px-4 font-medium text-gray-900">{row.busLabel}</td>
                          <td className="py-3 px-4 text-gray-600">{row.routeName} · {row.runLabel}</td>
                          <td className="py-3 px-4 w-40">
                            {row.capacityMax > 0 ? <CapacityBar current={row.capacityCurrent} max={row.capacityMax} /> : <span className="text-gray-400">—</span>}
                          </td>
```

and replace the footnote text `Bars show capacity; &apos;Off route&apos; indicates special runs (e.g. basketball, football).` with `Capacity comes from live passenger counts. &apos;Off route&apos; means the bus is more than 60 m from its route line.`

- [ ] **Step 6: Remove the unused mock exports from `data/mockOps.ts`**

Run `grep -rn -e MOCK_FLEET_SUMMARY -e MOCK_ACTIVE_ROUTES -e MOCK_STAT_ACTIVE_BUSES -e MOCK_STAT_OFF_ROUTE_BUSES --include='*.ts' --include='*.tsx' . | grep -v node_modules`. Expected: only their definitions in `data/mockOps.ts`.

Delete those four exports. Keep `MOCK_FLEET_STATUS_ROWS`, which driver assignments still use for bus ids.

- [ ] **Step 7: Type-check, test and verify**

Run: `npm run typecheck && npm test`
Expected: baseline errors only; all tests pass.

On `/ops/manager`:
- Outside service: stat cards show 0 active and 0 off-route, both routes read "no service", and the Fleet tab says "No buses reporting right now".
- During service: rows show real bus names, variant names and capacity bars.

- [ ] **Step 8: Commit**

```bash
git add utils/fleet.ts pages/ops/OpsManagerPage.tsx data/mockOps.ts tests/utils/fleet.test.ts
git commit -m "$(printf 'Show the live fleet on the manager dashboard\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')"
```

### Task 17: Live admin metrics

**Files:**
- Modify: `utils/adminMetrics.ts` (full rewrite), `pages/ops/OpsAdminPage.tsx`
- Test: `tests/utils/adminMetrics.test.ts`

**Interfaces:**
- Consumes: `getActivePattern`, `getActiveStops`, `fallbackRideSec`, `medianHeadwayMin`, `getLoadInfo`.
- Produces:
  - `computeAdminMetrics({ network, snapshot, vehicles, complaints? }) → Promise<AdminMetrics>`
  - `buildRouteMetrics(routeId, network, snapshot, vehicles, issues: { gps, freeze }) → AdminMetrics['routes'][RouteId]`
  - `getCachedAdminMetrics()`, `setCachedAdminMetrics()` (cache key `p2p-admin-metrics-v2`)
  - `AdminMetrics.system` becomes `{ apiLatencyAvgMs, apiLatencyP95Ms, liveApiLatencyAvgMs, liveApiLatencyP95Ms }`.

- [ ] **Step 1: Write the failing test `tests/utils/adminMetrics.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { buildRouteMetrics } from '../../utils/adminMetrics';
import { makeNetwork, makeSnapshot, makeVehicle } from '../fixtures/transit';

describe('buildRouteMetrics', () => {
  const network = makeNetwork();
  const vehicles = [makeVehicle({ id: 'v1', load: 0.5 }), makeVehicle({ id: 'v2', load: 0.25 })];
  const snapshot = makeSnapshot({
    vehicles,
    arrivalsByStop: {
      b: [
        { routeId: 'P2P_EXPRESS', vehicleId: 'v1', etaSec: 60, scheduled: false },
        { routeId: 'P2P_EXPRESS', vehicleId: 'v2', etaSec: 660, scheduled: false },
      ],
    },
  });

  it('derives route length, loop estimate, buses, fullness and headway from live data', () => {
    const m = buildRouteMetrics('P2P_EXPRESS', network, snapshot, vehicles, { gps: 1, freeze: 0 });
    expect(m.distanceMeters).toBe(3000);
    expect(m.durationSec).toBe(560); // 3000 m / 6 m/s + 3 stops × 20 s
    expect(m.activeBuses).toBe(2);
    expect(m.averageFullnessPercent).toBe(38); // (50 + 25) / 2 rounded
    expect(m.headwayMin).toBe(10);
    expect(m.averageWaitMin).toBe(5);
    expect(m.gpsDropoutsToday).toBe(1);
  });

  it('reports nulls for a route with no buses', () => {
    const m = buildRouteMetrics('BAITY_HILL', network, snapshot, vehicles, { gps: 0, freeze: 0 });
    expect(m).toMatchObject({ activeBuses: 0, averageFullnessPercent: null, headwayMin: null, averageWaitMin: null });
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- tests/utils/adminMetrics.test.ts`
Expected: FAIL, because `buildRouteMetrics` is not exported.

- [ ] **Step 3: Rewrite `utils/adminMetrics.ts`**

```ts
import type { Coordinate, LiveSnapshot, LiveVehicle, RouteId, Stop, TransitNetwork } from '../types';
import { getDistanceMeters } from './geo';
import { getActivePattern, getActiveStops } from './transitSelectors';
import { fallbackRideSec } from './tripPlanning';
import { medianHeadwayMin } from './fleet';
import { getLoadInfo } from './vehicleDisplay';

const CAMPUS_BBOX = { west: -79.08, south: 35.89, east: -79.03, north: 35.93 };
const CACHE_KEY = 'p2p-admin-metrics-v2';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours (under the 24 h GMV storage limit)

export interface RouteMetrics {
  distanceMeters: number | null;
  durationSec: number | null;
  loopDurationMin: number | null;
  efficiencyScore: number | null; // 0–100, 100 = optimal
  activeBuses: number;
  headwayMin: number | null;
  averageWaitMin: number | null; // half headway
  averageFullnessPercent: number | null;
  etaAccuracyPercent: number | null;
  gpsDropoutsToday: number | null;
  trackerFreezesToday: number | null;
}

export interface AdminMetrics {
  generatedAt: number;
  system: {
    apiLatencyAvgMs: number | null;
    apiLatencyP95Ms: number | null;
    liveApiLatencyAvgMs: number | null;
    liveApiLatencyP95Ms: number | null;
  };
  routes: Record<RouteId, RouteMetrics>;
  optimization: {
    averageWalkTimeMin: number | null;
    averageWaitTimeMin: number | null;
    mostCongestedStopName: string | null;
    mostUnderutilizedStopName: string | null;
  };
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[idx];
}

async function timeFetch(url: string, init?: RequestInit, samples = 3): Promise<{ avg: number | null; p95: number | null }> {
  const times: number[] = [];
  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    const res = await fetch(url, init);
    try {
      await res.text();
    } catch {
      /* ignore */
    }
    const end = performance.now();
    if (res.ok) times.push(end - start);
  }
  const avg = times.length ? times.reduce((s, v) => s + v, 0) / times.length : null;
  const p95 = percentile(times, 0.95);
  return { avg: avg != null ? Math.round(avg) : null, p95: p95 != null ? Math.round(p95) : null };
}

async function fetchWalkDurationSec(from: Coordinate, to: Coordinate): Promise<number | null> {
  const fromStr = `${from.lon},${from.lat}`;
  const toStr = `${to.lon},${to.lat}`;
  const res = await fetch(`/api/mapbox/directions/walk?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return typeof data?.durationSec === 'number' ? data.durationSec : null;
}

function randomCampusPoints(count: number, seed: number): Coordinate[] {
  const rand = mulberry32(seed);
  const pts: Coordinate[] = [];
  for (let i = 0; i < count; i++) {
    const lon = CAMPUS_BBOX.west + rand() * (CAMPUS_BBOX.east - CAMPUS_BBOX.west);
    const lat = CAMPUS_BBOX.south + rand() * (CAMPUS_BBOX.north - CAMPUS_BBOX.south);
    pts.push({ lat, lon });
  }
  return pts;
}

export function getCachedAdminMetrics(): AdminMetrics | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminMetrics;
    if (!parsed?.generatedAt) return null;
    if (Date.now() - parsed.generatedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setCachedAdminMetrics(metrics: AdminMetrics) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(metrics));
  } catch {
    /* ignore */
  }
}

export function buildRouteMetrics(
  routeId: RouteId,
  network: TransitNetwork,
  snapshot: LiveSnapshot | null,
  vehicles: LiveVehicle[],
  issues: { gps: number; freeze: number }
): RouteMetrics {
  const pattern = getActivePattern(network, snapshot, routeId);
  const distanceMeters = pattern ? pattern.lengthMeters : null;
  // Estimated loop time: length at the average bus speed plus dwell at every stop.
  const durationSec = pattern ? fallbackRideSec(pattern.lengthMeters, pattern.stops.length) : null;
  const routeVehicles = vehicles.filter((v) => v.routeId === routeId);
  const loads = routeVehicles
    .map((v) => getLoadInfo(v)?.percent)
    .filter((p): p is number => typeof p === 'number');
  const headwayMin = medianHeadwayMin(snapshot, routeId);

  return {
    distanceMeters,
    durationSec,
    loopDurationMin: durationSec != null ? durationSec / 60 : null,
    efficiencyScore:
      distanceMeters != null && durationSec
        ? Math.min(100, Math.round(((distanceMeters / 8.9408) / durationSec) * 100))
        : null,
    activeBuses: routeVehicles.length,
    headwayMin,
    averageWaitMin: headwayMin != null ? headwayMin / 2 : null,
    averageFullnessPercent: loads.length ? Math.round(loads.reduce((s, v) => s + v, 0) / loads.length) : null,
    etaAccuracyPercent: null,
    gpsDropoutsToday: issues.gps,
    trackerFreezesToday: issues.freeze,
  };
}

export async function computeAdminMetrics(input: {
  network: TransitNetwork;
  snapshot: LiveSnapshot | null;
  vehicles: LiveVehicle[];
  complaints?: Array<{ route?: string; category?: string; notes?: string }>;
}): Promise<AdminMetrics> {
  const { network, snapshot, vehicles, complaints = [] } = input;
  const stops: Stop[] = getActiveStops(network, snapshot);

  const [apiLatency, liveLatency] = await Promise.all([
    timeFetch('/healthz', undefined, 3),
    timeFetch('/api/live/snapshot', undefined, 2),
  ]);

  const countIssues = (routeLabel: string) => {
    const subset = complaints.filter((c) => (c.route || '').toLowerCase().includes(routeLabel.toLowerCase()));
    const gps = subset.filter((c) => `${c.category ?? ''} ${c.notes ?? ''}`.toLowerCase().includes('gps')).length;
    const freeze = subset.filter((c) => `${c.category ?? ''} ${c.notes ?? ''}`.toLowerCase().includes('freeze')).length;
    return { gps, freeze };
  };

  // Walk-time sampling: random campus points → nearest stop → Mapbox walking.
  const samplePoints = randomCampusPoints(8, 1337);
  const nearestCounts: Record<string, number> = {};
  const walkDurationsMin: number[] = [];

  for (const p of samplePoints) {
    let nearest: Stop | null = null;
    let best = Infinity;
    for (const s of stops) {
      const d = getDistanceMeters(p, s);
      if (d < best) {
        best = d;
        nearest = s;
      }
    }
    if (!nearest) continue;
    nearestCounts[nearest.id] = (nearestCounts[nearest.id] || 0) + 1;
    const durSec = await fetchWalkDurationSec(p, { lat: nearest.lat, lon: nearest.lon });
    walkDurationsMin.push(durSec != null && durSec > 0 ? durSec / 60 : best / 1.4 / 60);
  }

  let mostCongestedStopName: string | null = null;
  let mostUnderutilizedStopName: string | null = null;
  const nearestEntries = Object.entries(nearestCounts);
  if (nearestEntries.length) {
    nearestEntries.sort((a, b) => b[1] - a[1]);
    mostCongestedStopName = stops.find((s) => s.id === nearestEntries[0][0])?.name ?? null;
    mostUnderutilizedStopName = stops.find((s) => s.id === nearestEntries[nearestEntries.length - 1][0])?.name ?? null;
  }

  const avgWalk = walkDurationsMin.length ? walkDurationsMin.reduce((s, v) => s + v, 0) / walkDurationsMin.length : null;

  const routes: Record<RouteId, RouteMetrics> = {
    P2P_EXPRESS: buildRouteMetrics('P2P_EXPRESS', network, snapshot, vehicles, countIssues('P2P Express')),
    BAITY_HILL: buildRouteMetrics('BAITY_HILL', network, snapshot, vehicles, countIssues('Baity Hill')),
  };

  const waitVals = [routes.P2P_EXPRESS.averageWaitMin, routes.BAITY_HILL.averageWaitMin].filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v)
  );
  const avgWait = waitVals.length ? waitVals.reduce((s, v) => s + v, 0) / waitVals.length : null;

  return {
    generatedAt: Date.now(),
    system: {
      apiLatencyAvgMs: apiLatency.avg,
      apiLatencyP95Ms: apiLatency.p95,
      liveApiLatencyAvgMs: liveLatency.avg,
      liveApiLatencyP95Ms: liveLatency.p95,
    },
    routes,
    optimization: {
      averageWalkTimeMin: avgWalk != null ? Math.round(avgWalk * 10) / 10 : null,
      averageWaitTimeMin: avgWait != null ? Math.round(avgWait * 10) / 10 : null,
      mostCongestedStopName,
      mostUnderutilizedStopName,
    },
  };
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test -- tests/utils/adminMetrics.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Update `pages/ops/OpsAdminPage.tsx`**

(a) Replace `const { network, vehicles } = useTransit();` with:

```tsx
  const { network, snapshot, vehicles } = useTransit();
  const hasSnapshot = snapshot != null;
```

(b) In the metrics effect:
- Change the guard to `if (!network || !hasSnapshot) return;`.
- Change the `computeAdminMetrics` call to `computeAdminMetrics({ network, snapshot, vehicles, complaints: MOCK_COMPLAINTS })`.
- Change the dependency array to `[network, hasSnapshot]`.

(c) Remove the hard-coded fallback numbers in the Bus System Analytics cards. Each `rid === 'P2P_EXPRESS' ? '<value>' : '<value>'` fallback becomes `'—'`, six places in total (efficiency, loop duration, route length, headway, avg wait, fullness). For example:

```tsx
{headway != null ? `${headway.toFixed(1)} min` : '—'}
```

Confirm with `grep -n "rid === 'P2P_EXPRESS' ?" pages/ops/OpsAdminPage.tsx`, which should print nothing.

(d) In `DiagnosticsResponse`, after the `process` field, add:

```tsx
  gmv?: { configured: boolean; callCount: number; lastSuccessAt: number | null; lastError: string | null; cacheHits: number };
```

and after the `Route cache entries` list item add:

```tsx
                <li><span className="text-gray-500">GMV API:</span> <span className="font-mono">{diag?.gmv ? (diag.gmv.configured ? `${diag.gmv.callCount} calls · ${diag.gmv.cacheHits} cache hits` : 'key not set') : '—'}</span></li>
                <li><span className="text-gray-500">GMV last success:</span> <span className="font-mono">{diag?.gmv?.lastSuccessAt ? new Date(diag.gmv.lastSuccessAt).toLocaleTimeString() : '—'}</span></li>
                {diag?.gmv?.lastError && (
                  <li><span className="text-gray-500">GMV last error:</span> <span className="font-mono">{diag.gmv.lastError}</span></li>
                )}
```

- [ ] **Step 6: Type-check, test and verify**

Run: `npm run typecheck && npm test`
Expected: baseline errors only; all tests pass.

On `/ops/admin`:
- The route cards show route lengths from GMV patterns.
- Headway and fullness show "—" outside service hours.
- The diagnostics list shows "GMV API: N calls · M cache hits".
- The AI optimization card still loads, falling back if Gemini isn't configured.

- [ ] **Step 7: Commit**

```bash
git add utils/adminMetrics.ts pages/ops/OpsAdminPage.tsx tests/utils/adminMetrics.test.ts
git commit -m "$(printf 'Compute admin metrics from live GMV data\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')"
```

### Task 18: Remove the Mapbox route proxy and mock arrivals

**Files:**
- Modify: `server/index.cjs`, `pages/ops/OpsAdminPage.tsx`
- Delete: `server/routeWaypoints.json`

**Interfaces:**
- Removes: `GET /api/mapbox/route`, `GET /api/arrivals`, and the diagnostics fields `cache.routeCacheEntries` and `errors.routeDirectionsFailures`.

- [ ] **Step 1: Confirm nothing calls the removed endpoints**

```bash
grep -rn -e "mapbox/route" -e "/api/arrivals" --include='*.ts' --include='*.tsx' --include='*.cjs' . | grep -v node_modules
```

Expected: matches only in `server/index.cjs`.

- [ ] **Step 2: Clean up `server/index.cjs`**

- Change the header comment's first line to: `Small API server: live transit (GMV), Mapbox geocoding/walking, Gemini summaries.`
- Delete:
  - `const path = require('path');` and `const fs = require('fs');`
  - `const ROUTE_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours`
  - `let routeCache = Object.create(null);`
  - `let routeDirectionsFailures = 0;`
  - the functions `loadRouteWaypoints`, `hashCoords`, `fetchMapboxRoute`, `handleMapboxRoute` and `getMockArrivals`
- In diagnostics, delete the `routeCacheEntries: ...` line and the `routeDirectionsFailures,` line.
- Delete the `const routeMatch = ...` handler block (through its `return;` and closing `}`) and the `const arrivalsMatch = ...` handler block.
- In the `MAPBOX_TOKEN` startup warning, change `/api/mapbox/route will return 500.` to `geocoding and walking directions will return 500.`

Then delete the waypoints file:

```bash
git rm server/routeWaypoints.json
```

Start `npm run server` in the background, then run:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "localhost:3001/api/mapbox/route?routeId=P2P_EXPRESS"
curl -s localhost:3001/healthz
```

Expected: `404`, then `{"ok":true}`. Stop the server.

- [ ] **Step 3: Clean up `pages/ops/OpsAdminPage.tsx`**

- In `DiagnosticsResponse`, change `cache: { routeCacheEntries: number; walkCacheEntries: number };` to `cache: { walkCacheEntries: number };`.
- Change `errors: { failedLlmCalls: number; directionsFailures: number; routeDirectionsFailures: number };` to `errors: { failedLlmCalls: number; directionsFailures: number };`.
- Delete the `<li>` that renders "Route cache entries".

- [ ] **Step 4: Full verification**

```bash
npm test
npm run typecheck
npm run build
grep -rn -e "p2pStops" -e "routeConfig" -e "mockFullness" -e "getMockArrivals" -e "routeWaypoints" -e "VEHICLES" --include='*.ts' --include='*.tsx' --include='*.cjs' . | grep -v node_modules
```

Expected:
- All tests pass.
- Only the baseline type errors in `mapboxBuses3DLayer.ts`, `ops/ErrorBoundary.tsx` and `OpsManagerPage.tsx`.
- The build succeeds.
- The grep prints nothing.

Then run the app (server and dev) and click through `/`: the list, map, a stop pop-up, Plan Trip, `/ops/manager` and `/ops/admin`. There should be no console errors and no failed `/api` requests.

- [ ] **Step 5: Commit**

```bash
git add -A server/index.cjs pages/ops/OpsAdminPage.tsx
git commit -m "$(printf 'Remove Mapbox route proxy and mock arrivals endpoint\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')"
```

### Task 19: Live verification during service hours (7 PM–3 AM)

**Files:**
- Modify (only if a check fails): `server/gmv/config.cjs`

This task must run while P2P buses are operating.

- [ ] **Step 1: Confirm the `speed` unit**

With `.env` loaded (`set -a; source .env; set +a`), sample one Express vehicle twice, 30 s apart, without writing anything to disk:

```bash
for i in 1 2; do curl -s -H "Api-Key: $GMV_RTPI_API_KEY" -H "Accept: application/json" https://api.syncromatics.com/portal/routes/6566/vehicles | python3 -c "import json,sys,time; v=json.load(sys.stdin); print(time.time(), [(x['id'], x.get('speed'), x.get('shapeDistanceTraveled'), x.get('lastUpdated'), x.get('pattern_id')) for x in v])"; [ $i = 1 ] && sleep 30; done
```

For a bus that moved without wrapping around the loop, compute `ratio = (Δ shapeDistanceTraveled / Δ lastUpdated seconds) / average(speed)`:
- ratio ≈ 0.447 → mph (keep `SPEED_TO_MPS = 0.44704`)
- ratio ≈ 0.278 → km/h (set `0.27778`)
- ratio ≈ 1 → m/s (set `1`)

Also confirm that `pattern_id` is present. If it isn't, the snapshot falls back to the default pattern; note that in the commit message. Update the comment on `SPEED_TO_MPS` to say which unit was confirmed and on what date.

- [ ] **Step 2: Check the snapshot**

```bash
curl -s localhost:3001/api/live/snapshot | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['status'], d['activePatternIds']); [print(v['name'], v['routeId'], v['nextStopId'], v['nextStopEtaSec'], v['stale'], v['load'], v['capacity']) for v in d['vehicles']]; print({k: [(a['etaSec'], a['scheduled']) for a in v[:3]] for k, v in list(d['arrivalsByStop'].items())[:3]})"
```

Expected:
- `live` with vehicles whose `nextStopId` is set.
- A mix of `scheduled` values is fine.
- `activePatternIds` matches a real variant (e.g. 31799).

If the variant isn't the default (Granville Closed), update `DEFAULT_PATTERN` in `server/gmv/config.cjs`.

- [ ] **Step 3: Compare with the official tracker**

For three stops (Student Union, Horton Residence Hall, Granville Towers), compare the app's stop pop-up ETAs with P2P's official Syncromatics tracker. They should agree within about 1 minute.

On the map, watch buses for 60 s: they should move smoothly along the lines, with no backwards jumps larger than about half a block each 6 s.

- [ ] **Step 4: Check the call budget**

Note `callCount` from `/api/admin/diagnostics`, keep three app tabs open and visible for 60 s, then read it again. Expected: the delta is at most about 45 (per 6 s: 2 vehicle calls plus 1–2 arrivals calls, plus 1 messages call per minute), regardless of how many tabs are open.

- [ ] **Step 5: Commit any config corrections**

```bash
git add server/gmv/config.cjs
git commit -m "$(printf 'Confirm GMV speed unit and default patterns from live data\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')"
```

If nothing changed, skip the commit and record the results in the PR description.

---

## Rollout (after the branch is merged)

1. In the Render dashboard, set `GMV_RTPI_API_KEY` on the backend service (you do this; the key never goes in git).
2. Deploy the backend. The new endpoints are additions, so the current frontend is unaffected.
3. Deploy the frontend to Netlify. The existing `/api/*` redirect reaches Render.
4. Smoke test production: `https://p2pnow.netlify.app` should show the status banner or live buses, and `/api/live/network` through Netlify should return both routes.
