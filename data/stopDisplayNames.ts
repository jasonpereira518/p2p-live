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
