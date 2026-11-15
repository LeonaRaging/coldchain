export type LngLat = [number, number];

export type RouteProjection = {
  /** Index of the route segment (route[segment] -> route[segment + 1]) the point snaps to. */
  segment: number;
  /** The snapped point on the route. */
  point: LngLat;
  /** Distance from the original position to the snapped point, in meters. */
  distanceMeters: number;
  /** Distance along the route from its start to the snapped point, in meters. */
  alongMeters: number;
};

const METERS_PER_DEGREE_LAT = 110_540;
const METERS_PER_DEGREE_LNG_AT_EQUATOR = 111_320;

/**
 * When searching forward from a previous segment, an earlier candidate within this
 * many meters of the best forward match wins. This keeps routes that pass the same
 * place twice from jumping ahead to the later pass.
 */
const EARLIER_PASS_TOLERANCE_METERS = 20;

/**
 * When the best forward match is this much worse than the best match anywhere on the
 * route, the forward hint is treated as stale (e.g. the truck was reset) and ignored.
 */
const STALE_HINT_METERS = 100;

function toLocalMeters([lng, lat]: LngLat, cosLat: number): [number, number] {
  return [lng * METERS_PER_DEGREE_LNG_AT_EQUATOR * cosLat, lat * METERS_PER_DEGREE_LAT];
}

export function distanceMeters(a: LngLat, b: LngLat): number {
  const cosLat = Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
  const [ax, ay] = toLocalMeters(a, cosLat);
  const [bx, by] = toLocalMeters(b, cosLat);
  return Math.hypot(ax - bx, ay - by);
}

type Candidate = { segment: number; t: number; distance: number };

/**
 * Snaps `position` onto the nearest point of `route` (a polyline), searching forward
 * from `fromSegment` so progress along the route stays monotonic.
 */
export function projectOntoRoute(
  route: LngLat[],
  position: LngLat,
  fromSegment = 0
): RouteProjection | null {
  if (route.length === 0) return null;
  if (route.length === 1) {
    return {
      segment: 0,
      point: route[0],
      distanceMeters: distanceMeters(route[0], position),
      alongMeters: 0,
    };
  }

  const cosLat = Math.cos((position[1] * Math.PI) / 180);
  const [px, py] = toLocalMeters(position, cosLat);
  const points = route.map((point) => toLocalMeters(point, cosLat));
  const segmentCount = points.length - 1;
  const start = Math.min(Math.max(0, Math.floor(fromSegment)), segmentCount - 1);

  const candidates: Candidate[] = [];
  for (let segment = 0; segment < segmentCount; segment += 1) {
    const [ax, ay] = points[segment];
    const [bx, by] = points[segment + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const t =
      lengthSquared === 0
        ? 0
        : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
    candidates.push({
      segment,
      t,
      distance: Math.hypot(px - (ax + dx * t), py - (ay + dy * t)),
    });
  }

  let globalBest = candidates[0];
  for (const candidate of candidates) {
    if (candidate.distance < globalBest.distance) globalBest = candidate;
  }

  const forward = candidates.slice(start);
  let forwardBest = forward[0];
  for (const candidate of forward) {
    if (candidate.distance < forwardBest.distance) forwardBest = candidate;
  }

  let chosen: Candidate;
  if (forwardBest.distance - globalBest.distance > STALE_HINT_METERS) {
    chosen = globalBest;
  } else {
    chosen =
      forward.find(
        (candidate) =>
          candidate.distance <= forwardBest.distance + EARLIER_PASS_TOLERANCE_METERS
      ) ?? forwardBest;
  }

  let alongMeters = 0;
  for (let segment = 0; segment < chosen.segment; segment += 1) {
    const [ax, ay] = points[segment];
    const [bx, by] = points[segment + 1];
    alongMeters += Math.hypot(bx - ax, by - ay);
  }
  const [ax, ay] = points[chosen.segment];
  const [bx, by] = points[chosen.segment + 1];
  alongMeters += Math.hypot(bx - ax, by - ay) * chosen.t;

  const [aLng, aLat] = route[chosen.segment];
  const [bLng, bLat] = route[chosen.segment + 1];
  return {
    segment: chosen.segment,
    point: [aLng + (bLng - aLng) * chosen.t, aLat + (bLat - aLat) * chosen.t],
    distanceMeters: chosen.distance,
    alongMeters,
  };
}

/** Splits a route at a projected point into the part already driven and the part left. */
export function splitRoute(
  route: LngLat[],
  projection: RouteProjection
): { traveled: LngLat[]; remaining: LngLat[] } {
  return {
    traveled: [...route.slice(0, projection.segment + 1), projection.point],
    remaining: [projection.point, ...route.slice(projection.segment + 1)],
  };
}
