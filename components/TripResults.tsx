/** Plan Trip results: walk vs bus side by side, with the chosen option's logistics. */
import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowUpRight, Bus, Clock, Footprints, RefreshCw } from 'lucide-react';
import type { Journey, JourneySegment } from '../types';
import type { PlannedTrip } from './PlanTripView';
import { busTripTimes, journeySec, tripComparison, walkingMeters, type TripMode } from '../utils/tripPlanning';
import { formatDistanceImperial } from '../utils/format';
import './trip.css';

interface TripResultsProps {
  trip: PlannedTrip;
  stopNameById: Map<string, string>;
  refreshing: boolean;
  onModeChange: (mode: TripMode) => void;
  onStart: () => void;
  onNewSearch: () => void;
  onRefresh: () => void;
}

const clock = (date: Date) => date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
/** Walks and rides round up: better early than late. */
const mins = (sec: number) => Math.max(1, Math.ceil(sec / 60));
const busLeg = (journey: Journey) => journey.segments.find(s => s.type === 'bus') ?? null;
const walkLegs = (journey: Journey) => journey.segments.filter(s => s.type === 'walk');
const stopsWord = (n: number) => `${n} stop${n === 1 ? '' : 's'}`;
/** Mapbox adds tiny "Continue" steps of a few feet; they are noise in a list. */
const usefulSteps = (segment?: JourneySegment) => (segment?.steps ?? []).filter(step => step.distanceMeters >= 8);

function Directions({ segment }: { segment?: JourneySegment }) {
  const steps = usefulSteps(segment);
  if (!steps.length) return null;
  return <details className="trip-more"><summary>Walking directions</summary>
    <ol>{steps.map((step, i) => <li key={i}>{step.instruction} <span>{formatDistanceImperial(step.distanceMeters)}</span></li>)}</ol>
  </details>;
}

export function TripResults({ trip, stopNameById, refreshing, onModeChange, onStart, onNewSearch, onRefresh }: TripResultsProps) {
  const { options, mode, request } = trip;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(timer); }, []);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);

  const { walk, bus } = options;
  const times = bus ? busTripTimes(bus, now) : null;
  const ride = bus ? busLeg(bus) : null;
  // Walking can start any time; the bus trip is pinned to the bus it was planned around.
  const walkArrive = walk ? new Date(now.getTime() + journeySec(walk) * 1000) : null;
  const fastest: TripMode | null = walk && bus && Math.abs(journeySec(walk) - journeySec(bus)) >= 60
    ? (journeySec(walk) < journeySec(bus) ? 'walk' : 'bus') : null;
  const selected = mode === 'bus' ? bus : walk;
  const destination = request.destination;

  const optionCard = (m: TripMode, journey: Journey | null) => {
    const Icon = m === 'bus' ? Bus : Footprints;
    return <button type="button" className="trip-option" data-mode={m} data-route={m === 'bus' ? ride?.routeId : undefined}
      aria-pressed={mode === m} disabled={!journey} onClick={() => onModeChange(m)}>
      <span className="trip-option-label"><Icon aria-hidden="true" />{m === 'bus' ? 'Bus' : 'Walk'}{fastest === m && <span className="trip-badge">Fastest</span>}</span>
      {journey ? <>
        <span className="trip-option-time"><strong>{Math.ceil(journeySec(journey) / 60)}</strong> min</span>
        <span className="trip-option-note">Arrive {clock(m === 'bus' ? times!.arriveAt : walkArrive!)}</span>
        {m === 'bus' && ride && <span className="trip-option-route">{ride.routeName}</span>}
      </> : <span className="trip-option-note">Unavailable</span>}
    </button>;
  };

  return <div className="trip-view trip-results">
    <button type="button" className="trip-back" onClick={onNewSearch}><ArrowLeft aria-hidden="true" />New search</button>
    <h2 ref={heading} tabIndex={-1} className="trip-dest">{destination.name}</h2>
    {destination.address && destination.address !== destination.name && <p className="trip-sub">{destination.address}</p>}
    <p className="trip-sub">From {request.start === 'current' ? 'your location' : request.start.name}</p>

    <div className="trip-options" role="group" aria-label="Ways to get there">{optionCard('walk', walk)}{optionCard('bus', bus)}</div>
    <p className="trip-compare">{tripComparison(options)}</p>

    {mode === 'bus' && bus && ride && times ? <>
      <section className="trip-hero" data-route={ride.routeId} aria-label={`Bus trip on ${ride.routeName}`}>
        <span className="trip-route-pill">{ride.routeName}</span>
        {times.missed
          ? <p className="trip-missed"><AlertCircle aria-hidden="true" />This bus may have already left. Refresh times for the next one.</p>
          : <div className="trip-go">
              {times.leaveInMin > 0 ? <p><span>Go in</span><strong>{times.leaveInMin}</strong><span>min</span></p> : <p><strong>Go now</strong></p>}
              {ride.waitSource === 'scheduled' && <span className="trip-tag"><Clock aria-hidden="true" />Scheduled</span>}
            </div>}
        <span className="trip-label">Board at</span>
        <h3>{ride.fromName}</h3>
        <p className="trip-hero-note">Bus arrives {clock(times.boardAt)} · {mins(times.walkToStopSec)} min walk to stop</p>
      </section>
      <ol className="trip-steps">
        <li><time>{clock(times.leaveAt)}</time><div><strong>Leave</strong>
          <span>Walk {mins(times.walkToStopSec)} min ({formatDistanceImperial(walkLegs(bus)[0]?.distanceMeters ?? 0)}) to {ride.fromName}</span>
          <Directions segment={walkLegs(bus)[0]} /></div></li>
        <li><time>{clock(times.boardAt)}</time><div><strong>Board {ride.routeName}</strong>
          <span>{times.waitAtStopSec >= 30 ? `Wait about ${mins(times.waitAtStopSec)} min at the stop` : 'The bus arrives as you do'}</span></div></li>
        <li><time>{clock(times.alightAt)}</time><div><strong>Get off at {ride.toName}</strong>
          <span>{stopsWord(Math.max(1, (ride.stopsCount ?? 2) - 1))} · {mins(times.rideSec)} min ride</span>
          {(ride.busOrderedStopIds?.length ?? 0) > 2 && <details className="trip-more"><summary>Stops on the way</summary>
            <ol>{ride.busOrderedStopIds!.slice(1, -1).map(id => <li key={id}>{stopNameById.get(id) ?? id}</li>)}</ol></details>}</div></li>
        <li><time>{clock(times.arriveAt)}</time><div><strong>Arrive at {destination.name}</strong>
          <span>Walk {mins(times.finalWalkSec)} min ({formatDistanceImperial(walkLegs(bus)[1]?.distanceMeters ?? 0)})</span>
          <Directions segment={walkLegs(bus)[1]} /></div></li>
      </ol>
    </> : walk && walkArrive ? <>
      <section className="trip-hero" data-mode="walk" aria-label="Walking trip">
        <div className="trip-go"><p><strong>{mins(journeySec(walk))}</strong><span>min walk</span></p></div>
        <p className="trip-hero-note">{formatDistanceImperial(walkingMeters(walk))} · Arrive {clock(walkArrive)}</p>
      </section>
      <ol className="trip-steps">
        {usefulSteps(walk.segments[0]).map((step, i) =>
          <li key={i}><time>{formatDistanceImperial(step.distanceMeters)}</time><div><strong>{step.instruction}</strong></div></li>)}
        <li><time>{clock(walkArrive)}</time><div><strong>Arrive at {destination.name}</strong></div></li>
      </ol>
    </> : null}

    {selected && <button type="button" className="trip-start" data-route={mode === 'bus' ? ride?.routeId : undefined} onClick={onStart}>
      {mode === 'bus' ? 'Start trip on map' : 'Start walking on map'}<ArrowUpRight size={20} aria-hidden="true" />
    </button>}
    <button type="button" className="trip-refresh" onClick={onRefresh} disabled={refreshing}>
      <RefreshCw size={16} className={refreshing ? 'trip-spinning' : ''} aria-hidden="true" />{refreshing ? 'Refreshing…' : 'Refresh times'}
    </button>
  </div>;
}
