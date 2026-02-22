import { Destination } from '../types';

export type PopularCategory = 'campus' | 'transit' | 'housing' | 'retail' | 'other';

export interface PopularLocation extends Destination {
  category?: PopularCategory;
}

/** Curated UNC / Chapel Hill locations for Plan Trip suggestions and typeahead. */
export const POPULAR_LOCATIONS: PopularLocation[] = [
  { id: 'student-stores', name: 'Student Stores (Campus Store)', lat: 35.9100, lon: -79.0465, address: '207 South Rd', category: 'retail' },
  { id: 'rams-head-plaza', name: 'Rams Head Plaza', lat: 35.9035, lon: -79.0442, address: 'Ridge Rd', category: 'campus' },
  { id: 'davis-library', name: 'Davis Library', lat: 35.9088, lon: -79.0470, address: '208 Raleigh St', category: 'campus' },
  { id: 'undergrad-library', name: 'Undergraduate Library', lat: 35.9092, lon: -79.0468, address: '212 Raleigh St', category: 'campus' },
  { id: 'kenan-stadium', name: 'Kenan Memorial Stadium', lat: 35.9069, lon: -79.0479, address: '104 Stadium Dr', category: 'campus' },
  { id: 'dean-smith-center', name: 'Dean Smith Center', lat: 35.8999, lon: -79.0438, address: '300 Skipper Bowles Dr', category: 'campus' },
  { id: 'student-union', name: 'Student Union', lat: 35.9105, lon: -79.0478, address: '209 South Rd', category: 'campus' },
  { id: 'polley-center', name: 'Polley Center', lat: 35.9050, lon: -79.0455, address: 'Campus', category: 'campus' },
  { id: 'genome-sciences', name: 'Genome Sciences Building', lat: 35.9075, lon: -79.0480, address: '250 Bell Tower Dr', category: 'campus' },
  { id: 'unc-hospitals', name: 'UNC Hospitals', lat: 35.9025, lon: -79.0500, address: '101 Manning Dr', category: 'campus' },
  { id: 'friday-center', name: 'Friday Center', lat: 35.9180, lon: -79.0380, address: '100 Friday Center Dr', category: 'campus' },
  { id: 'franklin-street', name: 'Franklin Street', lat: 35.9132, lon: -79.0558, address: 'Franklin St', category: 'retail' },
  { id: 'ackland', name: 'Ackland Art Museum', lat: 35.9120, lon: -79.0510, address: '101 S Columbia St', category: 'campus' },
  { id: 'southpoint', name: 'Southpoint', lat: 35.9130, lon: -79.0200, address: '6910 Fayetteville Rd', category: 'retail' },
  { id: 'carrboro', name: 'Carrboro', lat: 35.9100, lon: -79.0720, address: 'Carrboro', category: 'retail' },
  { id: 'baity-hill', name: 'Baity Hill', lat: 35.8970, lon: -79.0400, address: 'Baity Hill', category: 'housing' },
  { id: 'rams-village', name: 'Rams Village', lat: 35.9020, lon: -79.0435, address: 'Rams Village', category: 'housing' },
  { id: 'craige-deck', name: 'Craige Deck', lat: 35.9040, lon: -79.0460, address: 'Craige Deck', category: 'transit' },
  { id: 'cobb-deck', name: 'Cobb Deck', lat: 35.9080, lon: -79.0490, address: 'Cobb Deck', category: 'transit' },
  { id: 'chapel-hill-transit', name: 'Chapel Hill Transit Center', lat: 35.9135, lon: -79.0560, address: 'E Franklin St', category: 'transit' },
];
