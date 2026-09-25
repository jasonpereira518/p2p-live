/** Non-modal stop sheet, shared by nearby-stop and explicit selection. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Footprints, MapPin, X } from 'lucide-react';
import type { Coordinate, Journey, Stop } from '../types';
import { useStopArrivals, useTransit } from '../context/TransitProvider';
import { ROUTE_COLORS, ROUTE_NAMES } from '../data/routes';
import { getRoutesServingStop } from '../utils/transitSelectors';
import { getWalkDirections } from '../utils/multimodalRouting';
import { getStopMessages } from '../utils/serviceMessages';
import { getDistanceMeters, getWalkTimeMinutes } from '../utils/geo';
import { getLiveStatusMessage } from '../utils/liveStatus';
import { formatEta } from '../utils/format';

interface StopPopupProps {
  stop: Stop;
  userLocation: Coordinate | null;
  nearby?: boolean;
  onClose: () => void;
  onWalkToStop: (journey: Journey) => void;
}
export function StopPopup({ stop, userLocation, nearby = false, onClose, onWalkToStop }: StopPopupProps) {
  const { network, snapshot, status } = useTransit();
  const arrivals = useStopArrivals(stop.id, 12);
  const routes = getRoutesServingStop(network, snapshot, stop.id);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    setExpanded(false); setError(null); setLoading(false);
    if (!nearby) heading.current?.focus({ preventScroll: true });
    return () => { request.current++; };
  }, [stop.id, nearby]);
  const visible = useMemo(() => expanded ? arrivals : arrivals.filter((a, i) => arrivals.findIndex(b => b.routeId === a.routeId) === i), [arrivals, expanded]);
  const messages = getStopMessages(snapshot?.messages ?? [], stop.id);
  const walkMin = userLocation ? getWalkTimeMinutes(getDistanceMeters(userLocation, stop)) : null;
  const walk = async () => {
    if (!userLocation || loading) return;
    const version = ++request.current;
    setLoading(true); setError(null);
    try {
      const result = await getWalkDirections(userLocation, stop);
      if (version !== request.current) return;
      if (!result?.geometry?.coordinates?.length) { setError('Walking directions could not load. Please try again.'); return; }
      const startTime = new Date(), durationMin = Math.ceil(result.durationSec / 60);
      onWalkToStop({
        id: `walk-to-${stop.id}-${Date.now()}`, destination: { ...stop }, startTime,
        arrivalTime: new Date(startTime.getTime() + result.durationSec * 1000), totalDurationMin: durationMin,
        segments: [{ type: 'walk', fromName: 'Your location', toName: stop.name, fromCoords: userLocation, toCoords: stop,
          durationMin, distanceMeters: result.distanceMeters, instruction: `Walk to ${stop.name}`, geometry: { type: 'LineString', coordinates: result.geometry.coordinates }, steps: result.steps }],
      });
    } catch { if (version === request.current) setError('Walking directions could not load. Please try again.'); }
    finally { if (version === request.current) setLoading(false); }
  };
  const emptyMessage = status === 'loading' ? 'Loading arrivals…' : status === 'unavailable' ? 'Live tracking is unavailable. No scheduled arrivals are available for this stop.' : getLiveStatusMessage(status)?.text ?? 'No arrival predictions for this stop right now.';
  return <section className="campus-sheet" aria-label={`${nearby ? 'Nearby' : 'Selected'} stop: ${stop.name}`} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}>
    <div className="campus-sheet-heading">
      <div className="min-w-0"><div className="campus-eyebrow"><MapPin size={13} aria-hidden="true" />{nearby ? 'Nearby stop' : 'Selected stop'}{walkMin != null && ` · ~${walkMin} min walk`}</div>
        <h2 ref={heading} tabIndex={-1}>{stop.name}</h2>
      </div>
      <button type="button" className="campus-close" onClick={onClose} aria-label="Close stop details"><X size={17} /></button>
    </div>
    <div aria-live="polite">
      {visible.map((a, i) => <div className="campus-arrival" key={`${a.routeId}-${a.vehicleId}-${i}`}>
        <span className="campus-route-tag" style={{ background: ROUTE_COLORS[a.routeId] }}>{a.routeId === 'P2P_EXPRESS' ? 'EX' : 'BH'}</span>
        <span>{a.routeName}{(a.source === 'scheduled' || status === 'degraded') && <span className="block text-[10px] text-slate-500">{a.source === 'scheduled' ? 'Scheduled' : 'Delayed'}</span>}</span>
        <span className="campus-arrival-time">{formatEta(a.etaSec)}</span>
      </div>)}
      {arrivals.length === 0 && <><p className="campus-hint">{emptyMessage}</p><p className="campus-hint">{routes.map(id => ROUTE_NAMES[id]).join(' · ')}</p></>}
    </div>
    {arrivals.length > new Set(arrivals.map(a => a.routeId)).size && <button type="button" className="campus-text-button inline-flex items-center gap-1" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>{expanded ? 'Fewer arrivals' : 'All arrivals'}{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>}
    {messages.map(m => <div className="campus-alert" key={m.id}><strong>{m.title}</strong>{m.body && <p>{m.body}</p>}</div>)}
    <button type="button" className="campus-primary" disabled={!userLocation || loading} onClick={walk}><Footprints size={16} aria-hidden="true" />{loading ? 'Finding walking route…' : 'Walk here'}</button>
    {!userLocation && <p className="campus-hint">Allow location access while on campus to get walking directions.</p>}
    {error && <p role="alert" className="text-red-700 text-xs mt-2">{error}</p>}
  </section>;
}
