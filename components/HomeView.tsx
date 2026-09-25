import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowUpRight, Bus, ChevronRight, Clock, LocateOff, Radio, RefreshCw } from 'lucide-react';
import type { Coordinate, LiveVehicle, Stop } from '../types';
import { useTransit } from '../context/TransitProvider';
import { getActiveStops, getStopById } from '../utils/transitSelectors';
import { getStopArrivals } from '../utils/arrivals';
import { eligibleCampusLocation } from '../utils/mapPresentation';
import { getDistanceMeters, getWalkTimeSeconds } from '../utils/geo';
import { homeDeparture, homeEta, homeServiceSummary, nearestHomeStop } from '../utils/homePresentation';
import './home.css';

interface HomeViewProps {
  location: Coordinate;
  locationResolved: boolean;
  loadingLocation: boolean;
  onSelectBus: (bus: LiveVehicle) => void;
  onSelectStop: (stop: Stop) => void;
  onBrowseMap: () => void;
}

function Eta({ seconds, stale = false }: { seconds: number | null; stale?: boolean }) {
  const eta = homeEta(seconds, stale);
  return <span className="home-eta"><span>{eta.value}</span>{eta.unit && <small>{eta.unit}</small>}</span>;
}

function EmptyCard({ icon: Icon, title, tone = '', action, children }: { icon: React.ElementType; title: string; tone?: string; action?: { label: string; onClick: () => void; disabled?: boolean }; children: React.ReactNode }) {
  return <section className={`home-empty-card ${tone}`} aria-label={title}>
    <Icon className="home-state-icon" aria-hidden="true" />
    <h2>{title}</h2>
    {children}
    {action && <button className="home-secondary-action" onClick={action.onClick} disabled={action.disabled}>{action.label}<ChevronRight size={20} aria-hidden="true" /></button>}
  </section>;
}

export function HomeView(props: HomeViewProps) {
  const { network, networkStatus, snapshot, vehicles, status, refresh, refreshing } = useTransit();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(timer); }, []);
  const summary = homeServiceSummary(status, now);
  const StatusIcon = summary.tone === 'warning' ? AlertCircle : summary.tone === 'inactive' ? Clock : Radio;
  const stops = useMemo(() => getActiveStops(network, snapshot), [network, snapshot]);
  const nearest = useMemo(() => nearestHomeStop(props.location, props.locationResolved, stops), [props.location, props.locationResolved, stops]);
  const walkSec = nearest ? getWalkTimeSeconds(getDistanceMeters(props.location, nearest)) : 0;
  const departure = nearest && status !== 'loading' ? homeDeparture(getStopArrivals({ stopId: nearest.id, network, snapshot, status, now, limit: Infinity }), walkSec) : null;
  const trackingFailed = status === 'unavailable';
  const refreshAction = { label: refreshing ? 'Refreshing…' : 'Try again', onClick: () => void refresh(), disabled: refreshing };
  const listMessage = status === 'loading' ? 'Loading buses…'
    : trackingFailed ? 'Live bus information is unavailable. Try refreshing.'
    : summary.tone === 'inactive' ? `Service begins at ${summary.value}.`
    : 'No buses are reporting right now.';

  let nearby: React.ReactNode;
  if (!network && networkStatus === 'unavailable') {
    nearby = <EmptyCard icon={AlertCircle} title="Route information unavailable" tone="warning" action={{ ...refreshAction, label: refreshing ? 'Refreshing…' : 'Retry' }}><p>Routes and stops could not be loaded. We’ll retry automatically.</p></EmptyCard>;
  } else if (props.loadingLocation || (!network && networkStatus === 'loading') || (nearest && status === 'loading')) {
    nearby = <div className="home-empty-card loading" role="status"><p>{props.loadingLocation ? 'Finding your nearest stop…' : nearest ? 'Loading arrivals…' : 'Loading campus stops…'}</p></div>;
  } else if (!nearest) {
    nearby = !props.locationResolved
      ? <EmptyCard icon={LocateOff} title="Find your boarding stop" action={{ label: 'Browse stops', onClick: props.onBrowseMap }}><p>Your location is unavailable. Browse campus stops to choose where to board.</p></EmptyCard>
      : eligibleCampusLocation(props.location, props.locationResolved)
        ? <EmptyCard icon={AlertCircle} title="Stops unavailable" tone="warning" action={refreshAction}><p>Stop information is unavailable right now.</p></EmptyCard>
        : <EmptyCard icon={LocateOff} title="Find your boarding stop" action={{ label: 'Browse stops', onClick: props.onBrowseMap }}><p>You’re outside the campus service area. Browse campus stops to choose where to board.</p></EmptyCard>;
  } else if (departure) {
    const { arrival, busInMin, walkMin, leaveInMin } = departure;
    const source = arrival.source === 'scheduled' ? 'Scheduled' : status === 'degraded' ? 'Delayed' : null;
    nearby = <>
      <h2 className="home-title" id="home-next-title">Your next ride.</h2>
      <section className="home-catch" data-route={arrival.routeId} aria-labelledby="home-next-title">
        <div className="home-catch-route"><span className="home-route-pill">{arrival.routeName}</span></div>
        <div className="home-catch-time">
          {leaveInMin > 0
            ? <p className="home-go"><span className="home-go-label">Go in</span><strong>{leaveInMin}</strong><span className="home-go-unit">min</span></p>
            : <p className="home-go now"><strong>Go now</strong></p>}
          {source && <span className="home-source">{arrival.source === 'scheduled' ? <Clock aria-hidden="true" /> : <AlertCircle aria-hidden="true" />}{source}</span>}
        </div>
        <div className="home-boarding"><span>Board at</span><h3>{nearest.name}</h3></div>
        <p className="home-bus-line"><Bus aria-hidden="true" /><span className="home-bus-text"><span><span>{busInMin < 1 ? 'Bus arriving now' : `Bus arrives in ${busInMin} min`}</span> <small>{walkMin} min walk</small></span></span></p>
        <button className="home-primary" onClick={() => props.onSelectStop(nearest)}>View stop <ArrowUpRight size={20} aria-hidden="true" /></button>
      </section>
    </>;
  } else if (summary.tone === 'inactive') {
    const [time, meridiem] = (summary.value ?? '').split(' ');
    nearby = <EmptyCard icon={Clock} title="Your evening ride" action={{ label: 'View nearest stop', onClick: () => props.onSelectStop(nearest) }}>
      <div className="home-service-time">{time} <span>{meridiem}</span></div>
      <p>Buses begin service at {summary.value}.</p>
      <p className="home-source">Scheduled start · No live arrivals yet</p>
    </EmptyCard>;
  } else if (trackingFailed) {
    nearby = <EmptyCard icon={AlertCircle} title="Arrival times unavailable" tone="warning" action={refreshAction}>
      <p>Buses may still be running. Live tracking is not updating.</p>
      <p className="home-source">Check again before heading to your stop.</p>
    </EmptyCard>;
  } else {
    nearby = <EmptyCard icon={Clock} title="No upcoming arrivals" action={{ label: 'View stop', onClick: () => props.onSelectStop(nearest) }}>
      <p>No buses are predicted at {nearest.name} right now.</p>
    </EmptyCard>;
  }

  return <div className="home-content">
    <p className={`home-status-line ${summary.tone}`} role="status"><StatusIcon aria-hidden="true" /><span>{summary.label}</span>{status === 'live' && <span className="home-live-dot" aria-hidden="true" />}</p>
    {nearby}

    <section className="home-campus" aria-labelledby="home-campus-title">
      <div className="home-list-heading"><h2 id="home-campus-title">Buses on campus</h2><button className="home-refresh" onClick={() => void refresh()} disabled={refreshing} aria-label="Refresh bus times"><RefreshCw size={20} className={refreshing ? 'home-spinning' : ''} aria-hidden="true" /></button></div>
      <p className="home-list-explainer">Times below are to each bus’s next stop.</p>
      <div className="home-bus-rows">
        {(!vehicles.length || status === 'loading' || trackingFailed) ? <p className="home-list-empty" role="status">{listMessage}</p> : vehicles.map(bus => {
          const stop = bus.nextStopId ? getStopById(network, bus.nextStopId) : null;
          const duplicates = vehicles.filter(v => v.routeId === bus.routeId).length > 1;
          const detail = [duplicates && bus.name, bus.stale ? 'Location not updating' : homeEta(bus.nextStopEtaSec).value === '—' ? 'Arrival time unavailable' : status === 'degraded' && 'Delayed'].filter(Boolean).join(' · ');
          return <button key={bus.id} className="home-bus-row" data-route={bus.routeId} onClick={() => props.onSelectBus(bus)}>
            <span className="home-bus-copy"><strong>{bus.routeName}</strong>
              <span>{stop ? `Next: ${stop.name}` : 'Next stop unknown'}</span>
              {detail && <span className="home-source">{detail}</span>}
            </span>
            <Eta seconds={bus.nextStopEtaSec} stale={bus.stale} />
            <ChevronRight className="home-chevron" size={16} aria-hidden="true" />
          </button>;
        })}
      </div>
    </section>
  </div>;
}
