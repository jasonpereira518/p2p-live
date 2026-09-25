import { describe, expect, it } from 'vitest';
import { homeDeparture, homeEta, homeServiceSummary, nearestHomeStop } from '../../utils/homePresentation';
import type { Stop, StopArrival } from '../../types';

const afternoon = new Date(2026, 8, 20, 14);
const evening = new Date(2026, 8, 20, 20);
describe('Home service summary', () => {
  it('distinguishes tracking failure from inactive service even outside scheduled hours', () => {
    expect(homeServiceSummary('unavailable', afternoon)).toMatchObject({ label: 'Live tracking unavailable', tone: 'warning' });
    expect(homeServiceSummary('degraded', afternoon)).toMatchObject({ label: 'Live tracking delayed', tone: 'warning' });
    expect(homeServiceSummary('loading', afternoon).tone).toBe('neutral');
    expect(homeServiceSummary('live', afternoon)).toMatchObject({ label: 'Service running', tone: 'active' });
  });
  it('only shows the service start for no-service outside scheduled hours', () => {
    expect(homeServiceSummary('no-service', afternoon)).toMatchObject({label:'Service starts at 7:00 PM',tone:'inactive',value:'7:00 PM'});
    expect(homeServiceSummary('no-service', evening).label).toBe('No buses reporting');
    expect(homeServiceSummary('no-service', new Date(2026,8,21,1)).label).toBe('No buses reporting');
  });
});
describe('Home departures', () => {
  const make = (etaSec:number, routeId:StopArrival['routeId']='P2P_EXPRESS'):StopArrival => ({etaSec,routeId,routeName:'P2P Express',source:'live',vehicleId:null});
  it('says when to leave: bus ETA minus the walk', () => {
    expect(homeDeparture([make(480)], 180)).toMatchObject({busInMin:8,walkMin:3,leaveInMin:5});
    // The walk rounds up, so the shown numbers always add up.
    expect(homeDeparture([make(530)], 130)).toMatchObject({busInMin:8,walkMin:3,leaveInMin:5});
  });
  it('skips a bus that arrives before the rider can walk there', () => {
    const arrivals=[make(420,'BAITY_HILL'),make(90),make(900)];
    expect(homeDeparture(arrivals, 150)?.arrival).toBe(arrivals[0]);
    expect(homeDeparture(arrivals, 60)?.arrival).toBe(arrivals[1]);
    expect(arrivals[0].etaSec).toBe(420);
  });
  it('says go now when the bus is due, including for a rider already at the stop', () => {
    expect(homeDeparture([make(30)], 10)).toMatchObject({busInMin:0,walkMin:1,leaveInMin:0});
    expect(homeDeparture([make(200)], 170)).toMatchObject({busInMin:3,walkMin:3,leaveInMin:0});
  });
  it('falls back to the earliest arrival when none is reachable', () => {
    const arrivals=[make(240),make(120)];
    expect(homeDeparture(arrivals, 600)).toMatchObject({arrival:arrivals[1],leaveInMin:0});
  });
  it('ignores missing or negative ETAs', () => {
    expect(homeDeparture([make(NaN),make(-2)], 60)).toBeNull();
    expect(homeDeparture([], 60)).toBeNull();
  });
  it('does not turn missing or stale ETAs into imminent arrivals', () => {
    expect(homeEta(null).value).toBe('—');
    expect(homeEta(0,true).value).toBe('—');
    expect(homeEta(-1).value).toBe('—');
    expect(homeEta(59)).toEqual({value:'Now',unit:''});
    expect(homeEta(120)).toEqual({value:'2',unit:'min'});
  });
});
describe('Home location eligibility', () => {
  const location={lat:35.9105,lon:-79.0478};
  const stops=[{...location,id:'near',name:'Near'}, {lat:35.915,lon:-79.05,id:'far',name:'Far'}] as Stop[];
  it('finds the closest stop only after successful in-area geolocation', () => {
    expect(nearestHomeStop(location,true,stops)?.id).toBe('near');
    expect(nearestHomeStop(location,false,stops)).toBeNull();
    expect(nearestHomeStop({lat:40.7,lon:-74},true,stops)).toBeNull();
    expect(nearestHomeStop(null,true,stops)).toBeNull();
    expect(nearestHomeStop(location,true,[])).toBeNull();
  });
});
