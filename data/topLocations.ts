export type TopLocationCategory =
  | 'food'
  | 'dorm'
  | 'library'
  | 'gym'
  | 'stadium'
  | 'housing'
  | 'academic'
  | 'museum'
  | 'retail'
  | 'health'
  | 'other';

export interface TopLocation {
  id: string;
  name: string;
  aliases: string[];
  address: string;
  /** Stored as [lng, lat] for Mapbox usage. */
  coordinates: [number, number];
  category: TopLocationCategory;
}

/** Curated UNC student top locations for Plan Trip search and map navigation. */
export const TOP_LOCATIONS: TopLocation[] = [
  {
    id: 'target-franklin',
    name: 'Target on Franklin',
    aliases: ['target', 'target franklin', 'franklin target', 'tarjay', 'e franklin', 'franklin st'],
    address: '136 E Franklin St, Chapel Hill, NC',
    coordinates: [-79.05824180898817, 35.912074341960405],
    category: 'retail',
  },
  {
    id: 'raising-canes',
    name: "Raising Cane's",
    aliases: ['canes', 'raising canes', 'chicken fingers', "cane's", 'e franklin', 'franklin st'],
    address: '101 E Franklin St, Chapel Hill, NC',
    coordinates: [-79.05567319909228, 35.91334191107102],
    category: 'food',
  },
  {
    id: 'hinton-james',
    name: 'Hinton James Residence Hall',
    aliases: ['hinton james', 'hojo', 'hinton', 'james dorm'],
    address: '211 Hinton James Rd, Chapel Hill, NC',
    coordinates: [-79.04331466882603, 35.902514150863674],
    category: 'dorm',
  },
  {
    id: 'davis-library',
    name: 'Davis Library',
    aliases: ['davis', 'davis lib', 'library', 'raleigh st'],
    address: '208 Raleigh St, Chapel Hill, NC',
    coordinates: [-79.048137677022, 35.91071663606584],
    category: 'library',
  },
  {
    id: 'dean-smith-center',
    name: 'Dean E. Smith Center',
    aliases: ['dean dome', 'smith center', 'dean smith', 'basketball arena', 'skipper bowles'],
    address: '300 Skipper Bowles Dr, Chapel Hill, NC',
    coordinates: [-79.0437796853531, 35.89983001347148],
    category: 'stadium',
  },
  {
    id: 'lark-apartments',
    name: 'Lark Apartments',
    aliases: ['lark', 'lark apartments', 'mlk', 'martin luther king'],
    address: '602 Martin Luther King Jr Blvd, Chapel Hill, NC',
    coordinates: [-79.05341392886925, 35.9187844545912],
    category: 'housing',
  },
  {
    id: 'union-apartments',
    name: 'Union Apartments',
    aliases: ['union apartments', 'union chapel hill', 'hillsborough'],
    address: '425 Hillsborough St, Chapel Hill, NC',
    coordinates: [-79.05436638235562, 35.91991451781258],
    category: 'housing',
  },
  {
    id: 'horton',
    name: 'Horton',
    aliases: ['horton', 'horton hall', 'horton residence', 'manning dr'],
    address: '101 Manning Dr, Chapel Hill, NC',
    coordinates: [-79.04383928406942, 35.90323194912688],
    category: 'dorm',
  },
  {
    id: 'student-union',
    name: 'Student Union',
    aliases: ['student union', 'fpg student union', 'union building', 'south rd', 'fpg'],
    address: '209 South Rd, Chapel Hill, NC',
    coordinates: [-79.04796204224962, 35.91016362680265],
    category: 'academic',
  },
  {
    id: 'lenoir-dining',
    name: 'Lenoir Dining Hall',
    aliases: ['lenoir', 'lenoir dining', 'north campus dining', 'south rd'],
    address: '101 South Rd, Chapel Hill, NC',
    coordinates: [-79.04869804087589, 35.91042030693407],
    category: 'food',
  },
  {
    id: 'chase-dining',
    name: 'Chase Dining Hall',
    aliases: ['chase', 'chase dining', 'south campus dining', 'ridge rd', 'manning dr'],
    address: 'Ridge Rd & Manning Dr, Chapel Hill, NC',
    coordinates: [-79.04575617007293, 35.90609888694108],
    category: 'food',
  },
  {
    id: 'granville',
    name: 'Granville',
    aliases: ['granville', 'granville towers', 'granville dorms', 'w franklin', 'franklin st'],
    address: '125 W Franklin St, Chapel Hill, NC',
    coordinates: [-79.05654680124175, 35.91120038872988],
    category: 'housing',
  },
  {
    id: 'fraternity-court',
    name: 'Fraternity Court',
    aliases: ['frat court', 'fraternity court'],
    address: 'Fraternity Ct, Chapel Hill, NC',
    coordinates: [-79.05517963476693, 35.911407434386106],
    category: 'housing',
  },
  {
    id: 'student-rec-center',
    name: 'Student Recreational Center',
    aliases: ['src', 'student rec center', 'student recreation center', 'fetzer', 'fetzer gym'],
    address: '101 Fetzer Gym Dr, Chapel Hill, NC',
    coordinates: [-79.04762171744795, 35.90928364968048],
    category: 'gym',
  },
  {
    id: 'rams-head-gym',
    name: 'Rams Head Gym',
    aliases: ['rams', 'rams head', 'rams rec', 'rams gym', 'ridge rd'],
    address: '330 Ridge Rd, Chapel Hill, NC',
    coordinates: [-79.04625423455954, 35.90589127706861],
    category: 'gym',
  },
  {
    id: 'kenan-stadium',
    name: 'Kenan Stadium',
    aliases: ['kenan', 'kenan stadium', 'football stadium', 'stadium dr'],
    address: '104 Stadium Dr, Chapel Hill, NC',
    coordinates: [-79.04731882042569, 35.90793353619244],
    category: 'stadium',
  },
  {
    id: 'unc-medical-center',
    name: 'UNC Medical Center',
    aliases: ['unc medical center', 'unc hospital', 'unc hospitals', 'hospital', 'manning dr'],
    address: '101 Manning Dr, Chapel Hill, NC',
    coordinates: [-79.05014507123745, 35.90449135406702],
    category: 'health',
  },
  {
    id: 'ackland-art-museum',
    name: 'Ackland Art Museum',
    aliases: ['ackland', 'ackland museum', 'art museum', 's columbia', 'columbia st'],
    address: '101 S Columbia St, Chapel Hill, NC',
    coordinates: [-79.05505258531518, 35.91251956165537],
    category: 'museum',
  },
  {
    id: 'chipotle-franklin',
    name: 'Chipotle',
    aliases: ['chipotle', 'chipotle franklin', 'burrito', 'w franklin', 'franklin st'],
    address: '301 W Franklin St, Chapel Hill, NC',
    coordinates: [-79.05959410779747, 35.911475049586734],
    category: 'food',
  },
  {
    id: 'might-as-well',
    name: 'Might As Well',
    aliases: ['might as well', 'maw', 'franklin bar', 'e franklin', 'franklin st'],
    address: '303 E Franklin St, Chapel Hill, NC',
    coordinates: [-79.05871501810346, 35.912126482092056],
    category: 'other',
  },
];

export function topLocationToDestination(loc: TopLocation): { id: string; name: string; lat: number; lon: number; address: string } {
  return {
    id: loc.id,
    name: loc.name,
    lat: loc.coordinates[1],
    lon: loc.coordinates[0],
    address: loc.address,
  };
}

