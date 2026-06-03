// ---------------------------------------------------------------------------
// Static reference data — not available in openfootball JSON
// ---------------------------------------------------------------------------

export const CONFEDERATIONS = [
  { code: 'UEFA', name: 'Union of European Football Associations' },
  { code: 'CONMEBOL', name: 'South American Football Confederation' },
  { code: 'CONCACAF', name: 'Confederation of North, Central America and Caribbean Association Football' },
  { code: 'CAF', name: 'Confederation of African Football' },
  { code: 'AFC', name: 'Asian Football Confederation' },
  { code: 'OFC', name: 'Oceania Football Confederation' },
] as const;

/** openfootball team name → { fifa_code, iso2, confederation } */
export const TEAM_META: Record<string, { fifaCode: string; iso2: string; confederation: string }> = {
  'Algeria':               { fifaCode: 'ALG', iso2: 'dz', confederation: 'CAF' },
  'Argentina':             { fifaCode: 'ARG', iso2: 'ar', confederation: 'CONMEBOL' },
  'Australia':             { fifaCode: 'AUS', iso2: 'au', confederation: 'AFC' },
  'Austria':               { fifaCode: 'AUT', iso2: 'at', confederation: 'UEFA' },
  'Belgium':               { fifaCode: 'BEL', iso2: 'be', confederation: 'UEFA' },
  'Bosnia & Herzegovina':  { fifaCode: 'BIH', iso2: 'ba', confederation: 'UEFA' },
  'Brazil':                { fifaCode: 'BRA', iso2: 'br', confederation: 'CONMEBOL' },
  'Canada':                { fifaCode: 'CAN', iso2: 'ca', confederation: 'CONCACAF' },
  'Cape Verde':            { fifaCode: 'CPV', iso2: 'cv', confederation: 'CAF' },
  'Colombia':              { fifaCode: 'COL', iso2: 'co', confederation: 'CONMEBOL' },
  'Croatia':               { fifaCode: 'CRO', iso2: 'hr', confederation: 'UEFA' },
  'Curaçao':               { fifaCode: 'CUW', iso2: 'cw', confederation: 'CONCACAF' },
  'Czech Republic':        { fifaCode: 'CZE', iso2: 'cz', confederation: 'UEFA' },
  'DR Congo':              { fifaCode: 'COD', iso2: 'cd', confederation: 'CAF' },
  'Ecuador':               { fifaCode: 'ECU', iso2: 'ec', confederation: 'CONMEBOL' },
  'Egypt':                 { fifaCode: 'EGY', iso2: 'eg', confederation: 'CAF' },
  'England':               { fifaCode: 'ENG', iso2: 'gb-eng', confederation: 'UEFA' },
  'France':                { fifaCode: 'FRA', iso2: 'fr', confederation: 'UEFA' },
  'Germany':               { fifaCode: 'GER', iso2: 'de', confederation: 'UEFA' },
  'Ghana':                 { fifaCode: 'GHA', iso2: 'gh', confederation: 'CAF' },
  'Haiti':                 { fifaCode: 'HAI', iso2: 'ht', confederation: 'CONCACAF' },
  'Iran':                  { fifaCode: 'IRN', iso2: 'ir', confederation: 'AFC' },
  'Iraq':                  { fifaCode: 'IRQ', iso2: 'iq', confederation: 'AFC' },
  'Ivory Coast':           { fifaCode: 'CIV', iso2: 'ci', confederation: 'CAF' },
  'Japan':                 { fifaCode: 'JPN', iso2: 'jp', confederation: 'AFC' },
  'Jordan':                { fifaCode: 'JOR', iso2: 'jo', confederation: 'AFC' },
  'Mexico':                { fifaCode: 'MEX', iso2: 'mx', confederation: 'CONCACAF' },
  'Morocco':               { fifaCode: 'MAR', iso2: 'ma', confederation: 'CAF' },
  'Netherlands':           { fifaCode: 'NED', iso2: 'nl', confederation: 'UEFA' },
  'New Zealand':           { fifaCode: 'NZL', iso2: 'nz', confederation: 'OFC' },
  'Norway':                { fifaCode: 'NOR', iso2: 'no', confederation: 'UEFA' },
  'Panama':                { fifaCode: 'PAN', iso2: 'pa', confederation: 'CONCACAF' },
  'Paraguay':              { fifaCode: 'PAR', iso2: 'py', confederation: 'CONMEBOL' },
  'Portugal':              { fifaCode: 'POR', iso2: 'pt', confederation: 'UEFA' },
  'Qatar':                 { fifaCode: 'QAT', iso2: 'qa', confederation: 'AFC' },
  'Saudi Arabia':          { fifaCode: 'KSA', iso2: 'sa', confederation: 'AFC' },
  'Scotland':              { fifaCode: 'SCO', iso2: 'gb-sct', confederation: 'UEFA' },
  'Senegal':               { fifaCode: 'SEN', iso2: 'sn', confederation: 'CAF' },
  'South Africa':          { fifaCode: 'RSA', iso2: 'za', confederation: 'CAF' },
  'South Korea':           { fifaCode: 'KOR', iso2: 'kr', confederation: 'AFC' },
  'Spain':                 { fifaCode: 'ESP', iso2: 'es', confederation: 'UEFA' },
  'Sweden':                { fifaCode: 'SWE', iso2: 'se', confederation: 'UEFA' },
  'Switzerland':           { fifaCode: 'SUI', iso2: 'ch', confederation: 'UEFA' },
  'Tunisia':               { fifaCode: 'TUN', iso2: 'tn', confederation: 'CAF' },
  'Turkey':                { fifaCode: 'TUR', iso2: 'tr', confederation: 'UEFA' },
  'USA':                   { fifaCode: 'USA', iso2: 'us', confederation: 'CONCACAF' },
  'Uruguay':               { fifaCode: 'URU', iso2: 'uy', confederation: 'CONMEBOL' },
  'Uzbekistan':            { fifaCode: 'UZB', iso2: 'uz', confederation: 'AFC' },
};

/** openfootball ground name → city / venue detail */
export const GROUND_META: Record<string, {
  venueName: string;
  cityName: string;
  country: string;
  timezone: string;
  lat: string;
  lng: string;
}> = {
  'Atlanta': {
    venueName: 'Mercedes-Benz Stadium',
    cityName: 'Atlanta', country: 'USA', timezone: 'America/New_York',
    lat: '33.7554', lng: '-84.4009',
  },
  'Boston (Foxborough)': {
    venueName: 'Gillette Stadium',
    cityName: 'Boston', country: 'USA', timezone: 'America/New_York',
    lat: '42.0909', lng: '-71.2643',
  },
  'Dallas (Arlington)': {
    venueName: 'AT&T Stadium',
    cityName: 'Dallas', country: 'USA', timezone: 'America/Chicago',
    lat: '32.7473', lng: '-97.0945',
  },
  'Guadalajara (Zapopan)': {
    venueName: 'Estadio Akron',
    cityName: 'Guadalajara', country: 'Mexico', timezone: 'America/Monterrey',
    lat: '20.6821', lng: '-103.4636',
  },
  'Houston': {
    venueName: 'NRG Stadium',
    cityName: 'Houston', country: 'USA', timezone: 'America/Chicago',
    lat: '29.6848', lng: '-95.4103',
  },
  'Kansas City': {
    venueName: 'Arrowhead Stadium',
    cityName: 'Kansas City', country: 'USA', timezone: 'America/Chicago',
    lat: '39.0489', lng: '-94.4839',
  },
  'Los Angeles (Inglewood)': {
    venueName: 'SoFi Stadium',
    cityName: 'Los Angeles', country: 'USA', timezone: 'America/Los_Angeles',
    lat: '33.9535', lng: '-118.3392',
  },
  'Mexico City': {
    venueName: 'Estadio Azteca',
    cityName: 'Mexico City', country: 'Mexico', timezone: 'America/Mexico_City',
    lat: '19.3029', lng: '-99.1505',
  },
  'Miami (Miami Gardens)': {
    venueName: 'Hard Rock Stadium',
    cityName: 'Miami', country: 'USA', timezone: 'America/New_York',
    lat: '25.9580', lng: '-80.2389',
  },
  'Monterrey (Guadalupe)': {
    venueName: 'Estadio BBVA',
    cityName: 'Monterrey', country: 'Mexico', timezone: 'America/Monterrey',
    lat: '25.6694', lng: '-100.2432',
  },
  'New York/New Jersey (East Rutherford)': {
    venueName: 'MetLife Stadium',
    cityName: 'New York/New Jersey', country: 'USA', timezone: 'America/New_York',
    lat: '40.8135', lng: '-74.0745',
  },
  'Philadelphia': {
    venueName: 'Lincoln Financial Field',
    cityName: 'Philadelphia', country: 'USA', timezone: 'America/New_York',
    lat: '39.9008', lng: '-75.1675',
  },
  'San Francisco Bay Area (Santa Clara)': {
    venueName: "Levi's Stadium",
    cityName: 'San Francisco Bay Area', country: 'USA', timezone: 'America/Los_Angeles',
    lat: '37.4033', lng: '-121.9694',
  },
  'Seattle': {
    venueName: 'Lumen Field',
    cityName: 'Seattle', country: 'USA', timezone: 'America/Los_Angeles',
    lat: '47.5952', lng: '-122.3316',
  },
  'Toronto': {
    venueName: 'BMO Field',
    cityName: 'Toronto', country: 'Canada', timezone: 'America/Toronto',
    lat: '43.6330', lng: '-79.4188',
  },
  'Vancouver': {
    venueName: 'BC Place',
    cityName: 'Vancouver', country: 'Canada', timezone: 'America/Vancouver',
    lat: '49.2768', lng: '-123.1118',
  },
};

/**
 * Venue name → seating capacity (WC 2026 nominal, public figures).
 * Curated static — robust + reproducible (no network). Used to enrich
 * venues.capacity (FIFA's API returns null for these).
 */
export const VENUE_CAPACITY: Record<string, number> = {
  'Mercedes-Benz Stadium': 71000,
  'Gillette Stadium': 65878,
  'AT&T Stadium': 80000,
  'Estadio Akron': 48071,
  'NRG Stadium': 72220,
  'Arrowhead Stadium': 76416,
  'SoFi Stadium': 70240,
  'Estadio Azteca': 87523,
  'Hard Rock Stadium': 65326,
  'Estadio BBVA': 53500,
  'MetLife Stadium': 82500,
  'Lincoln Financial Field': 69176,
  "Levi's Stadium": 68500,
  'Lumen Field': 68740,
  'BMO Field': 45000,
  'BC Place': 54500,
};
