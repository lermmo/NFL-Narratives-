import cityData from "@/data/cities.json";

const CITIES = cityData as unknown as Record<string, [number, number]>;

// Must stay identical to norm() in scripts/build-data.mjs
export function norm(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\bst\.?\s/g, "saint ")
    .replace(/\bmt\.?\s/g, "mount ")
    .replace(/[^a-z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type LatLon = [number, number];

export function lookupCity(city?: string, state?: string): LatLon | null {
  if (!city || !state) return null;
  return CITIES[`${norm(city)}|${state.toUpperCase()}`] ?? null;
}

export function miles(a: LatLon, b: LatLon): number {
  const R = 3958.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Home stadium coordinates by ESPN team abbreviation.
export const STADIUMS: Record<string, LatLon> = {
  ARI: [33.5276, -112.2626], ATL: [33.7554, -84.4009], BAL: [39.278, -76.6227], BUF: [42.7738, -78.787],
  CAR: [35.2258, -80.8528], CHI: [41.8623, -87.6167], CIN: [39.0955, -84.5161], CLE: [41.5061, -81.6995],
  DAL: [32.7473, -97.0945], DEN: [39.7439, -105.0201], DET: [42.34, -83.0456], GB: [44.5013, -88.0622],
  HOU: [29.6847, -95.4107], IND: [39.7601, -86.1639], JAX: [30.3239, -81.6373], KC: [39.0489, -94.4839],
  LV: [36.0909, -115.1833], LAC: [33.9535, -118.3392], LAR: [33.9535, -118.3392], MIA: [25.958, -80.2389],
  MIN: [44.9737, -93.2577], NE: [42.0909, -71.2643], NO: [29.9511, -90.0812], NYG: [40.8135, -74.0745],
  NYJ: [40.8135, -74.0745], PHI: [39.9008, -75.1675], PIT: [40.4468, -80.0158], SF: [37.403, -121.97],
  SEA: [47.5952, -122.3316], TB: [27.9759, -82.5033], TEN: [36.1665, -86.7713], WSH: [38.9076, -76.8645],
};

// Neutral-site (international) venues by city name.
export const INTL_VENUES: Record<string, LatLon> = {
  madrid: [40.4531, -3.6883],
  london: [51.5560, -0.2796],
  munich: [48.2188, 11.6247],
  frankfurt: [50.0686, 8.6455],
  berlin: [52.5147, 13.2395],
  paris: [48.9245, 2.3601],
  dublin: [53.3607, -6.2505],
  "mexico city": [19.3029, -99.1505],
  "sao paulo": [-23.5453, -46.4742],
  "rio de janeiro": [-22.9121, -43.2302],
  melbourne: [-37.82, 144.9834],
  sydney: [-33.8473, 151.0636],
  toronto: [43.6414, -79.3894],
  tokyo: [35.7056, 139.7519],
};

const UK = new Set(["england", "uk", "united kingdom", "great britain", "scotland", "wales"]);
const USA = new Set(["usa", "us", "united states", "united states of america"]);

export function sameCountry(a?: string, b?: string): boolean {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (UK.has(x) && UK.has(y)) return true;
  if (USA.has(x) && USA.has(y)) return true;
  return false;
}

export const isUSA = (c?: string) => !c || USA.has(norm(c));
