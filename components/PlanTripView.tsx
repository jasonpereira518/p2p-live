import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Search, MapPin, ArrowRight, Navigation, History, X, Pencil, ArrowUpDown, Heart } from 'lucide-react';
import { Destination, Coordinate } from '../types';
import { MOCK_DESTINATIONS } from '../data/mockTransit';
import { POPULAR_LOCATIONS } from '../data/popularLocations';
import { TOP_LOCATIONS, topLocationToDestination } from '../data/topLocations';
import { getRecentSearches, addRecentSearch, clearRecentSearches, type RecentSearchItem } from '../storage/recentSearches';
import { getSavedRoutes, recordRouteUsage, toggleSavedRouteFavorite, type SavedRouteItem } from '../storage/savedRoutes';
import { computeTripOptions } from '../utils/multimodalRouting';
import type { TripMode, TripOptions } from '../utils/tripPlanning';
import { useTransit } from '../context/TransitProvider';
import { API } from '../utils/api';
import { TripResults } from './TripResults';
import './motion.css';
import './trip.css';

const TOP_DESTINATIONS: Destination[] = TOP_LOCATIONS.map(topLocationToDestination);

const ALL_DESTINATIONS = (() => {
  const byId = new Map<string, Destination>();
  [...TOP_DESTINATIONS, ...POPULAR_LOCATIONS, ...MOCK_DESTINATIONS].forEach((d) => byId.set(d.id, d));
  return Array.from(byId.values());
})();

/** Start or end of a trip: current location or a chosen place. */
export type TripEnd = 'current' | Destination;

/** A planned trip: both options, the one the rider picked, and what was asked (for refresh). */
export interface PlannedTrip {
  options: TripOptions;
  mode: TripMode;
  request: { start: TripEnd; destination: Destination };
}

function tripEndToDestination(tripEnd: TripEnd, userLocation: Coordinate): Destination {
  if (tripEnd === 'current') {
    return { id: 'current', name: 'Current Location', lat: userLocation.lat, lon: userLocation.lon };
  }
  return tripEnd;
}

function recentToDestination(item: RecentSearchItem): Destination {
  return item.lat != null && item.lon != null
    ? { id: `recent-${item.label}`, name: item.label, lat: item.lat, lon: item.lon }
    : ALL_DESTINATIONS.find((d) => d.name.toLowerCase() === item.label.toLowerCase()) ?? {
        id: `recent-${item.label}`,
        name: item.label,
        lat: 35.91,
        lon: -79.05,
      };
}

interface GeocodeResult {
  id: string;
  place_name: string;
  coordinates: [number, number];
  type: string;
}

interface PlanTripViewProps {
  userLocation: Coordinate;
  plannedTrip: PlannedTrip | null;
  onPlannedTripChange: (trip: PlannedTrip | null) => void;
  onViewOnMap: () => void;
}

export const PlanTripView: React.FC<PlanTripViewProps> = ({
  userLocation,
  plannedTrip,
  onPlannedTripChange,
  onViewOnMap,
}) => {
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [fromLocation, setFromLocation] = useState<TripEnd>('current');
  const [toDestination, setToDestination] = useState<Destination | null>(null);
  const [expandedSearch, setExpandedSearch] = useState(false);
  const [fromQuery, setFromQuery] = useState('');
  const [fromSearchFocused, setFromSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>(() => getRecentSearches());
  const [savedRoutes, setSavedRoutes] = useState<SavedRouteItem[]>(() => getSavedRoutes());
  const [routingLoading, setRoutingLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [addressResults, setAddressResults] = useState<GeocodeResult[]>([]);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownScrollRef = useRef<HTMLDivElement>(null);

  const activeQuery = expandedSearch && fromSearchFocused ? fromQuery : query;

  const { network, snapshot } = useTransit();
  // Latest transit data for routing without re-creating every handler on each poll.
  const transitRef = useRef({ network, snapshot });
  transitRef.current = { network, snapshot };

  const stopNameById = useMemo(
    () => new Map((network?.stops ?? []).map((s) => [s.id, s.name] as const)),
    [network]
  );

  useEffect(() => () => { if (blurTimerRef.current) clearTimeout(blurTimerRef.current); }, []);

  const topLocationSuggestions = useMemo(() => {
    const q = activeQuery.trim().toLowerCase();
    if (!q) return TOP_DESTINATIONS;
    return TOP_LOCATIONS.filter((loc) => {
      const fields = [loc.name, loc.address, ...loc.aliases];
      return fields.some((f) => f.toLowerCase().includes(q));
    }).map(topLocationToDestination);
  }, [activeQuery]);

  useEffect(() => {
    const q = activeQuery.trim();
    if (q.length < 3) {
      setAddressResults([]);
      setGeocodeLoading(false);
      return;
    }
    const controller = new AbortController();
    setGeocodeLoading(true);
    const t = setTimeout(() => {
      fetch(
        `${API}/api/mapbox/geocode?q=${encodeURIComponent(q)}&proximity=${userLocation.lon},${userLocation.lat}`,
        { signal: controller.signal }
      )
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
        .then((data: { results?: GeocodeResult[] }) => {
          setAddressResults(Array.isArray(data.results) ? data.results : []);
        })
        .catch((err) => {
          if ((err as Error).name === 'AbortError') return;
          setAddressResults([]);
        })
        .finally(() => setGeocodeLoading(false));
    }, 280);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [activeQuery, userLocation.lon, userLocation.lat]);

  const isFromActive = expandedSearch && fromSearchFocused;
  const showDropdownUnfocused = !expandedSearch ? !searchFocused : false;
  const showDropdownFocusedEmpty =
    (expandedSearch && fromSearchFocused && fromQuery.trim().length === 0) ||
    (expandedSearch && searchFocused && query.trim().length === 0) ||
    (!expandedSearch && searchFocused && query.trim().length === 0);
  const showDropdownFocusedQuery =
    (expandedSearch && fromSearchFocused && fromQuery.trim().length > 0) ||
    (expandedSearch && searchFocused && query.trim().length > 0) ||
    (!expandedSearch && searchFocused && query.trim().length > 0);

  const refreshRecent = useCallback(() => {
    setRecentSearches(getRecentSearches());
  }, []);
  const refreshSavedRoutes = useCallback(() => {
    setSavedRoutes(getSavedRoutes());
  }, []);

  /** Plan walk and bus options from `start` to `dest`. A refresh keeps the rider's choice when it still exists. */
  const planTrip = useCallback(
    async (start: TripEnd, dest: Destination, refresh?: { mode: TripMode }) => {
      const routeOrigin: Coordinate = start === 'current' ? userLocation : { lat: start.lat, lon: start.lon };
      const originName = start === 'current' ? 'Current Location' : start.name;
      setPlanError(null);
      if (refresh) setRefreshing(true); else setRoutingLoading(true);
      try {
        const options = await computeTripOptions({ origin: routeOrigin, originName, destination: dest, ...transitRef.current });
        if (!options.walk && !options.bus) throw new Error('No walking or bus route');
        const mode = refresh && options[refresh.mode] ? refresh.mode : options.recommended;
        onPlannedTripChange({ options, mode, request: { start, destination: dest } });
        if (refresh) return;
        recordRouteUsage({
          fromName: originName,
          fromLat: routeOrigin.lat,
          fromLon: routeOrigin.lon,
          fromIsCurrent: start === 'current',
          toName: dest.name,
          toAddress: dest.address,
          toLat: dest.lat,
          toLon: dest.lon,
          routeLabel: options.bus?.segments.find((s) => s.type === 'bus')?.routeName,
        });
        refreshSavedRoutes();
      } catch (e) {
        console.error(e);
        setPlanError('We couldn’t plan this trip. Check your connection and try again.');
      } finally {
        setRoutingLoading(false);
        setRefreshing(false);
      }
    },
    [userLocation, onPlannedTripChange, refreshSavedRoutes]
  );

  const chooseDestination = useCallback(
    (dest: Destination, address = dest.address) => {
      setQuery(dest.name);
      setToDestination(dest);
      setSearchFocused(false);
      addRecentSearch({ label: dest.name, address, lat: dest.lat, lon: dest.lon });
      refreshRecent();
      void planTrip(fromLocation, dest);
    },
    [fromLocation, planTrip, refreshRecent]
  );

  const handleSelectDestination = useCallback((dest: Destination) => chooseDestination(dest), [chooseDestination]);

  const handleSelectAddressResult = useCallback(
    (item: GeocodeResult) => {
      const [lon, lat] = item.coordinates;
      handleSelectDestination({ id: `addr-${item.id}`, name: item.place_name, lat, lon, address: item.place_name });
    },
    [handleSelectDestination]
  );

  const handleSelectRecent = useCallback(
    (item: RecentSearchItem) => chooseDestination(recentToDestination(item), item.address),
    [chooseDestination]
  );

  const handleClearRecent = useCallback(() => {
    clearRecentSearches();
    setRecentSearches([]);
  }, []);

  const handleSelectFrom = useCallback((dest: Destination) => {
    setFromLocation(dest);
    setFromQuery(dest.name);
    setFromSearchFocused(false);
    addRecentSearch({ label: dest.name, address: dest.address, lat: dest.lat, lon: dest.lon });
    refreshRecent();
  }, [refreshRecent]);

  const handleSelectFromRecent = useCallback((item: RecentSearchItem) => {
    const dest = recentToDestination(item);
    setFromLocation(dest);
    setFromQuery(dest.name);
    setFromSearchFocused(false);
    addRecentSearch({ label: dest.name, address: item.address ?? dest.address, lat: dest.lat, lon: dest.lon });
    refreshRecent();
  }, [refreshRecent]);

  const handleSelectFromAddressResult = useCallback(
    (item: GeocodeResult) => {
      const [lon, lat] = item.coordinates;
      handleSelectFrom({ id: `addr-${item.id}`, name: item.place_name, lat, lon, address: item.place_name });
    },
    [handleSelectFrom]
  );

  const handleUseCurrentLocation = useCallback(() => {
    setFromLocation('current');
    setFromQuery('');
    setFromSearchFocused(false);
  }, []);

  const handleSwapFromTo = useCallback(() => {
    if (toDestination == null) return;
    setFromLocation(toDestination);
    setToDestination(fromLocation === 'current' ? null : fromLocation);
    setQuery(fromLocation === 'current' ? '' : fromLocation.name);
    setFromQuery(toDestination.name);
    setSearchFocused(false);
    setFromSearchFocused(false);
  }, [fromLocation, toDestination]);

  const handleClearFrom = useCallback(() => {
    setFromLocation('current');
    setFromQuery('');
  }, []);

  const handleClearTo = useCallback(() => {
    setToDestination(null);
    setQuery('');
  }, []);

  const handlePlanTripFromExpanded = useCallback(() => {
    if (toDestination != null) void planTrip(fromLocation, toDestination);
  }, [fromLocation, toDestination, planTrip]);

  const handleRunSavedRoute = useCallback(
    (item: SavedRouteItem) => {
      const destination: Destination = {
        id: `saved-route-dest-${item.id}`,
        name: item.toName,
        address: item.toAddress,
        lat: item.toLat,
        lon: item.toLon,
      };
      const start: TripEnd = item.fromIsCurrent
        ? 'current'
        : { id: `saved-route-from-${item.id}`, name: item.fromName, lat: item.fromLat, lon: item.fromLon };
      setFromLocation(start);
      setFromQuery(item.fromIsCurrent ? '' : item.fromName);
      setToDestination(destination);
      setQuery(destination.name);
      setSearchFocused(false);
      setFromSearchFocused(false);
      addRecentSearch({ label: destination.name, address: destination.address, lat: destination.lat, lon: destination.lon });
      refreshRecent();
      void planTrip(start, destination);
    },
    [planTrip, refreshRecent]
  );

  const handleToggleFavoriteRoute = useCallback(
    (routeId: string) => {
      toggleSavedRouteFavorite(routeId);
      refreshSavedRoutes();
    },
    [refreshSavedRoutes]
  );

  type SelectableEntry =
    | { type: 'top'; dest: Destination }
    | { type: 'recent'; item: RecentSearchItem }
    | { type: 'address'; item: GeocodeResult };
  const selectableItems = useMemo((): SelectableEntry[] => {
    if (showDropdownUnfocused) return TOP_DESTINATIONS.map((dest) => ({ type: 'top', dest }));
    if (showDropdownFocusedEmpty)
      return [
        ...recentSearches.map((item) => ({ type: 'recent' as const, item })),
        ...TOP_DESTINATIONS.map((dest) => ({ type: 'top' as const, dest })),
      ];
    if (showDropdownFocusedQuery)
      return [
        ...topLocationSuggestions.map((dest) => ({ type: 'top' as const, dest })),
        ...addressResults.map((item) => ({ type: 'address' as const, item })),
      ];
    return [];
  }, [
    showDropdownUnfocused,
    showDropdownFocusedEmpty,
    showDropdownFocusedQuery,
    recentSearches,
    topLocationSuggestions,
    addressResults,
  ]);

  useEffect(() => {
    setHighlightedIndex((prev) => (prev >= selectableItems.length ? 0 : Math.min(prev, selectableItems.length - 1)));
  }, [selectableItems.length]);

  useEffect(() => {
    if (selectableItems.length === 0) return;
    const el = dropdownScrollRef.current?.querySelector(`[data-dropdown-index="${highlightedIndex}"]`);
    (el as HTMLElement)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [highlightedIndex, selectableItems.length]);

  const runSelection = useCallback(
    (entry: SelectableEntry) => {
      if (entry.type === 'top') {
        if (isFromActive) handleSelectFrom(entry.dest);
        else handleSelectDestination(entry.dest);
      } else if (entry.type === 'recent') {
        if (isFromActive) handleSelectFromRecent(entry.item);
        else handleSelectRecent(entry.item);
      } else if (entry.type === 'address') {
        if (isFromActive) handleSelectFromAddressResult(entry.item);
        else handleSelectAddressResult(entry.item);
      }
    },
    [
      isFromActive,
      handleSelectFrom,
      handleSelectDestination,
      handleSelectFromRecent,
      handleSelectRecent,
      handleSelectFromAddressResult,
      handleSelectAddressResult,
    ]
  );

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        (e.target as HTMLInputElement).blur();
        setSearchFocused(false);
        if (expandedSearch) setFromSearchFocused(false);
        return;
      }
      if (selectableItems.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % selectableItems.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + selectableItems.length) % selectableItems.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const entry = selectableItems[highlightedIndex];
        if (!entry) return;
        runSelection(entry);
      }
    },
    [selectableItems, highlightedIndex, expandedSearch, runSelection]
  );

  const handleFromSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        (e.target as HTMLInputElement).blur();
        setFromSearchFocused(false);
        return;
      }
      if (selectableItems.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % selectableItems.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + selectableItems.length) % selectableItems.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const entry = selectableItems[highlightedIndex];
        if (!entry) return;
        runSelection(entry);
      }
    },
    [selectableItems, highlightedIndex, runSelection]
  );

  const handleNewSearch = () => {
    setQuery('');
    setToDestination(null);
    onPlannedTripChange(null);
  };

  if (routingLoading) {
    return (
      <div className="trip-view trip-loading" role="status">
        <p className="trip-loading-title">Finding walk and bus options…</p>
        <div aria-hidden="true" className="skel" style={{ width: '60%', height: 30 }} />
        <div aria-hidden="true" className="trip-skel-options"><div className="skel" style={{ height: 96, borderRadius: 14 }} /><div className="skel" style={{ height: 96, borderRadius: 14 }} /></div>
        <div aria-hidden="true" className="skel" style={{ height: 44, borderRadius: 12 }} />
        <div aria-hidden="true" className="skel" style={{ height: 190, borderRadius: 18 }} />
        <div aria-hidden="true" className="skel" style={{ width: '75%', height: 18 }} />
        <div aria-hidden="true" className="skel" style={{ width: '55%', height: 18 }} />
      </div>
    );
  }

  if (plannedTrip) {
    return (
      <TripResults
        trip={plannedTrip}
        stopNameById={stopNameById}
        refreshing={refreshing}
        onModeChange={(mode) => onPlannedTripChange({ ...plannedTrip, mode })}
        onStart={onViewOnMap}
        onNewSearch={handleNewSearch}
        onRefresh={() => void planTrip(plannedTrip.request.start, plannedTrip.request.destination, { mode: plannedTrip.mode })}
      />
    );
  }

  // Render Search View
  const dropdownContent = (
    <div ref={dropdownScrollRef} className="max-h-[60vh] overflow-y-auto pt-4 pb-2 px-2" style={{ WebkitOverflowScrolling: 'touch' }}>
      {showDropdownUnfocused && (
        <>
          <h3 className="trip-section-label px-2">Top destinations</h3>
          <ul className="space-y-1" role="listbox" aria-label="Top destinations" aria-activedescendant={selectableItems.length ? `dropdown-option-${highlightedIndex}` : undefined}>
            {TOP_DESTINATIONS.map((dest, i) => (
              <li key={dest.id} role="option" aria-selected={highlightedIndex === i}>
                <button
                  type="button"
                  id={`dropdown-option-${i}`}
                  data-dropdown-index={i}
                  onClick={() => runSelection({ type: 'top', dest })}
                  onMouseEnter={() => setHighlightedIndex(i)}
                  className={`w-full px-4 py-3 text-left flex items-center gap-2 ${highlightedIndex === i ? 'bg-black/[0.06]' : ''}`}
                >
                  <MapPin size={18} className="text-gray-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate">{dest.name}</div>
                    {dest.address && <div className="text-xs text-gray-500 truncate">{dest.address}</div>}
                  </div>
                  <ArrowRight size={16} className="text-gray-300 shrink-0 ml-auto" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {showDropdownFocusedEmpty && (
        <div className="space-y-4">
          <section aria-labelledby="recent-heading">
            <div className="flex items-center justify-between mb-1 px-2">
              <h3 id="recent-heading" className="trip-section-label">Recent searches</h3>
              {recentSearches.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearRecent}
                  className="text-[15px] font-normal text-[#007aff] flex items-center gap-1"
                >
                  <X size={14} /> Clear
                </button>
              )}
            </div>
            {recentSearches.length > 0 ? (
              <ul className="space-y-1" role="listbox" aria-label="Recent searches" aria-activedescendant={selectableItems.length ? `dropdown-option-${highlightedIndex}` : undefined}>
                {recentSearches.map((item, i) => (
                  <li key={`${item.label}-${item.timestamp}`} role="option" aria-selected={highlightedIndex === i}>
                    <button
                      type="button"
                      id={`dropdown-option-${i}`}
                      data-dropdown-index={i}
                      onClick={() => runSelection({ type: 'recent', item })}
                      onMouseEnter={() => setHighlightedIndex(i)}
                      className={`w-full px-4 py-3 flex items-center gap-3 text-left ${highlightedIndex === i ? 'bg-black/[0.06]' : ''}`}
                    >
                      <History size={18} className="text-gray-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">{item.label}</div>
                        {item.address && <div className="text-xs text-gray-500 truncate">{item.address}</div>}
                      </div>
                      <ArrowRight size={16} className="text-gray-300 shrink-0 ml-auto" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400 px-2 py-1">No recent searches</p>
            )}
          </section>
          <section aria-labelledby="top-locations-heading">
            <h3 id="top-locations-heading" className="trip-section-label px-2">Top locations</h3>
            <ul className="space-y-1" role="listbox" aria-label="Top locations" aria-activedescendant={selectableItems.length ? `dropdown-option-${highlightedIndex}` : undefined}>
              {TOP_DESTINATIONS.map((dest, i) => {
                const idx = recentSearches.length + i;
                return (
                  <li key={dest.id} role="option" aria-selected={highlightedIndex === idx}>
                    <button
                      type="button"
                      id={`dropdown-option-${idx}`}
                      data-dropdown-index={idx}
                      onClick={() => runSelection({ type: 'top', dest })}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`w-full px-4 py-3 text-left flex items-center gap-2 ${highlightedIndex === idx ? 'bg-black/[0.06]' : ''}`}
                    >
                      <MapPin size={18} className="text-gray-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">{dest.name}</div>
                        {dest.address && <div className="text-xs text-gray-500 truncate">{dest.address}</div>}
                      </div>
                      <ArrowRight size={16} className="text-gray-300 shrink-0 ml-auto" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}
      {showDropdownFocusedQuery && (
        <div className="space-y-4">
          <div>
            <h3 id="top-locations-heading" className="trip-section-label px-2">Top locations</h3>
            {topLocationSuggestions.length > 0 ? (
              <ul className="space-y-1" role="listbox" aria-label="Top locations" aria-activedescendant={selectableItems.length ? `dropdown-option-${highlightedIndex}` : undefined}>
                {topLocationSuggestions.map((dest, i) => (
                  <li key={dest.id} role="option" aria-selected={highlightedIndex === i}>
                    <button
                      type="button"
                      id={`dropdown-option-${i}`}
                      data-dropdown-index={i}
                      onClick={() => runSelection({ type: 'top', dest })}
                      onMouseEnter={() => setHighlightedIndex(i)}
                      className={`w-full px-4 py-3 text-left flex items-center gap-2 ${highlightedIndex === i ? 'bg-black/[0.06]' : ''}`}
                    >
                      <MapPin size={18} className="text-gray-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">{dest.name}</div>
                        {dest.address && <div className="text-xs text-gray-500 truncate">{dest.address}</div>}
                      </div>
                      <ArrowRight size={16} className="text-gray-300 shrink-0 ml-auto" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 px-2">No top locations match.</p>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between mb-1 px-2">
              <h3 className="trip-section-label">Address results</h3>
              {geocodeLoading && <span className="text-[11px] text-gray-400">Searching…</span>}
            </div>
            {addressResults.length > 0 ? (
              <ul className="space-y-1" role="listbox" aria-label="Address results" aria-activedescendant={selectableItems.length ? `dropdown-option-${highlightedIndex}` : undefined}>
                {addressResults.map((item, i) => {
                  const idx = topLocationSuggestions.length + i;
                  return (
                  <li key={item.id} role="option" aria-selected={highlightedIndex === idx}>
                    <button
                      type="button"
                      id={`dropdown-option-${idx}`}
                      data-dropdown-index={idx}
                      onClick={() => runSelection({ type: 'address', item })}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`w-full px-4 py-3 text-left flex items-center gap-2 ${highlightedIndex === idx ? 'bg-black/[0.06]' : ''}`}
                    >
                      <MapPin size={18} className="text-gray-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">{item.place_name.split(',')[0]}</div>
                        <div className="text-xs text-gray-500 truncate">{item.place_name}</div>
                      </div>
                      <ArrowRight size={16} className="text-gray-300 shrink-0 ml-auto" />
                    </button>
                  </li>
                  );
                })}
              </ul>
            ) : !geocodeLoading && activeQuery.trim().length >= 3 && (
              <p className="text-sm text-gray-500 px-2">No address results.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="trip-view trip-search flex flex-col h-full">
      <div>
        <h2 className="trip-title">Where to?</h2>

        {/* Search widget — compact (single To) or expanded (From + To) */}
        {!expandedSearch ? (<>
          <div className={`trip-card overflow-visible ${showDropdownUnfocused ? 'rounded-2xl' : 'rounded-t-2xl'}`}>
            <div className="relative">
              <div className="trip-search-field">
                <Search size={18} aria-hidden />
                <input
                  id="plan-trip-destination"
                  type="text"
                  autoComplete="off"
                  placeholder="Search a place or address"
                  aria-label="Destination search"
                  aria-expanded={searchFocused || showDropdownUnfocused}
                  aria-haspopup="listbox"
                  className="focus:outline-none placeholder-black/25"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => { if (blurTimerRef.current) clearTimeout(blurTimerRef.current); blurTimerRef.current = null; setSearchFocused(true); }}
                  onBlur={() => { blurTimerRef.current = setTimeout(() => setSearchFocused(false), 200); }}
                  onKeyDown={handleSearchKeyDown}
                />
              </div>
              {!showDropdownUnfocused && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white rounded-2xl shadow-lg overflow-hidden">
                  {dropdownContent}
                </div>
              )}
            </div>
          </div>
          <p className="trip-from">
            From: {fromLocation === 'current' ? 'Current location' : fromLocation.name}
            <button type="button" onClick={() => setExpandedSearch(true)} aria-label="Change start location"><Pencil size={13} aria-hidden="true" />Change</button>
          </p>
        </>) : (
          <div className={`trip-card overflow-visible ${(fromSearchFocused || searchFocused) ? 'rounded-t-2xl' : 'rounded-2xl'}`}>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Edit start & destination</span>
                <button
                  type="button"
                  onClick={() => setExpandedSearch(false)}
                  className="text-[17px] font-normal text-[#007aff]"
                >
                  Done
                </button>
              </div>
              {/* From */}
              <div className="relative">
                <label className="trip-section-label">From</label>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10 mt-1" size={18} aria-hidden />
                <input
                  id="plan-trip-from"
                  type="text"
                  autoComplete="off"
                  placeholder="Current Location"
                  aria-label="Start location"
                  aria-expanded={fromSearchFocused}
                  aria-haspopup="listbox"
                  className="w-full bg-black/[0.04] border-0 pl-10 pr-10 py-3 text-[17px] font-normal focus:outline-none focus:ring-2 focus:ring-[#007aff] focus:ring-inset rounded-xl placeholder-black/25"
                  value={fromSearchFocused ? fromQuery : (fromLocation === 'current' ? '' : fromLocation.name)}
                  onChange={(e) => setFromQuery(e.target.value)}
                  onFocus={() => { if (blurTimerRef.current) clearTimeout(blurTimerRef.current); blurTimerRef.current = null; setFromSearchFocused(true); setSearchFocused(false); setHighlightedIndex(0); }}
                  onBlur={() => { blurTimerRef.current = setTimeout(() => setFromSearchFocused(false), 200); }}
                  onKeyDown={handleFromSearchKeyDown}
                />
                {fromLocation !== 'current' && (
                  <button
                    type="button"
                    onClick={handleClearFrom}
                    className="absolute right-3 top-1/2 -translate-y-1/2 mt-0.5 text-gray-400 hover:text-gray-600 p-1 rounded"
                    aria-label="Clear start location"
                  >
                    <X size={18} />
                  </button>
                )}
                {fromSearchFocused && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white rounded-b-xl shadow-lg border border-t-0 border-gray-200 overflow-hidden">
                    {dropdownContent}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {fromLocation !== 'current' && (
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[15px] font-medium text-[#007aff] bg-black/[0.06]"
                  >
                    <Navigation size={14} />
                    Use Current Location
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSwapFromTo}
                  disabled={toDestination == null}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[15px] font-medium text-black/60 bg-black/[0.06] disabled:opacity-40 disabled:pointer-events-none"
                  aria-label="Swap From and To"
                >
                  <ArrowUpDown size={14} />
                  Swap
                </button>
              </div>

              {/* To */}
              <div className="relative">
                <label className="trip-section-label">To</label>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10 mt-1" size={18} aria-hidden />
                <input
                  id="plan-trip-to"
                  type="text"
                  autoComplete="off"
                  placeholder="Where do you want to go?"
                  aria-label="Destination"
                  aria-expanded={searchFocused}
                  aria-haspopup="listbox"
                  className="w-full bg-black/[0.04] border-0 pl-10 pr-10 py-3 text-[17px] font-normal focus:outline-none focus:ring-2 focus:ring-[#007aff] focus:ring-inset rounded-xl placeholder-black/25"
                  value={searchFocused ? query : (toDestination?.name ?? '')}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => { if (blurTimerRef.current) clearTimeout(blurTimerRef.current); blurTimerRef.current = null; setSearchFocused(true); setFromSearchFocused(false); setHighlightedIndex(0); }}
                  onBlur={() => { blurTimerRef.current = setTimeout(() => setSearchFocused(false), 200); }}
                  onKeyDown={handleSearchKeyDown}
                />
                {toDestination != null && (
                  <button
                    type="button"
                    onClick={handleClearTo}
                    className="absolute right-3 top-1/2 -translate-y-1/2 mt-0.5 text-gray-400 hover:text-gray-600 p-1 rounded"
                    aria-label="Clear destination"
                  >
                    <X size={18} />
                  </button>
                )}
                {searchFocused && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white rounded-b-xl shadow-lg border border-t-0 border-gray-200 overflow-hidden">
                    {dropdownContent}
                  </div>
                )}
              </div>

              {toDestination != null && (
                <button
                  type="button"
                  onClick={handlePlanTripFromExpanded}
                  className="trip-primary w-full py-3.5 px-4 bg-[#007aff] text-white font-semibold text-[17px] rounded-xl"
                >
                  Plan trip
                </button>
              )}
            </div>
          </div>
        )}

        {/* Top Destinations widget — separate card when dropdown is closed */}
        {planError && <p className="trip-error" role="alert">{planError}</p>}
        {showDropdownUnfocused && (
          <section className="trip-section" aria-labelledby="trip-top-title">
            <div>
              <h3 id="trip-top-title" className="trip-section-title">Top destinations</h3>
              <ul className="trip-rows" role="listbox" aria-label="Top destinations" aria-activedescendant={selectableItems.length ? `dropdown-option-${highlightedIndex}` : undefined}>
                {TOP_DESTINATIONS.map((dest, i) => (
                  <li key={dest.id} role="option" aria-selected={highlightedIndex === i}>
                    <button
                      type="button"
                      id={`dropdown-option-${i}`}
                      data-dropdown-index={i}
                      onClick={() => runSelection({ type: 'top', dest })}
                      onMouseEnter={() => setHighlightedIndex(i)}
                      className={`trip-row ${highlightedIndex === i ? 'is-active' : ''}`}
                    >
                      <MapPin size={18} className="text-black/25 shrink-0" />
                      <div className="min-w-0 overflow-hidden">
                        <div className="font-medium text-black truncate">{dest.name}</div>
                        {dest.address && <div className="text-[13px] text-black/40 truncate">{dest.address}</div>}
                      </div>
                      <ArrowRight size={16} className="text-black/20 shrink-0 ml-auto" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
        {showDropdownUnfocused && (
          <section className="trip-section" aria-labelledby="trip-routes-title">
            <div>
              <h3 id="trip-routes-title" className="trip-section-title">Recent and favorite routes</h3>
              {savedRoutes.length > 0 ? (
                <ul className="trip-rows">
                  {savedRoutes.slice(0, 6).map((item) => (
                    <li key={item.id}>
                      <div className="trip-row">
                        <button
                          type="button"
                          onClick={() => handleRunSavedRoute(item)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <div className="font-medium text-black truncate">
                            {item.fromName} <ArrowRight size={14} className="inline mx-1 text-black/25" /> {item.toName}
                          </div>
                          <div className="text-[13px] text-black/40 truncate">
                            {item.lastRouteLabel ? `Via ${item.lastRouteLabel}` : 'Walk + transit options'} · Used {item.useCount}x
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleFavoriteRoute(item.id)}
                          className={`p-2 rounded-full ${
                            item.favorite ? 'text-p2p-red bg-p2p-light-red/30' : 'text-black/25'
                          }`}
                          aria-label={item.favorite ? 'Remove from favorite routes' : 'Add to favorite routes'}
                        >
                          <Heart size={16} fill={item.favorite ? 'currentColor' : 'none'} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="trip-empty">Plan a trip to start building your recent and favorite routes.</p>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
