export type TripGeoPoint = {
  latitude: number;
  longitude: number;
};

export type Trip = {
  tripId: string;
  tripName?: string;
  truckId: string;
  source: TripGeoPoint;
  destination: TripGeoPoint;
  status?: string;
  [key: string]: unknown;
};

export type TripStatus = "PLANNED" | "ONGOING" | "COMPLETED";

function toPoint(point: unknown): TripGeoPoint | null {
  if (!point || typeof point !== "object") return null;
  const { latitude, longitude } = point as Record<string, unknown>;
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { latitude: lat, longitude: lng };
}

export function normalizeTrip(raw: unknown): Trip | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const tripId = String(value.tripId ?? value.trip_id ?? value.id ?? "");
  const tripName = String(value.tripName ?? value.trip_name ?? value.name ?? "").trim();
  const truckId = String(value.truckId ?? value.truck_id ?? "");
  const source = toPoint(value.source ?? value.origin);
  const destination = toPoint(value.destination);
  if (!tripId || !truckId || !source || !destination) return null;
  return {
    ...value,
    tripId,
    ...(tripName ? { tripName } : {}),
    truckId,
    source,
    destination,
    status: typeof value.status === "string" ? value.status : undefined,
  };
}

export function normalizeTripList(raw: unknown): Trip[] {
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { trips?: unknown[] }).trips)
      ? (raw as { trips: unknown[] }).trips
      : [];

  return list
    .map(normalizeTrip)
    .filter((trip): trip is Trip => trip !== null);
}

export function displayStatus(raw: string | undefined): TripStatus {
  const value = (raw ?? "").toUpperCase();
  if (value === "ONGOING" || value === "IN_PROGRESS" || value === "STARTED") {
    return "ONGOING";
  }
  if (value === "COMPLETED" || value === "DONE" || value === "FINISHED") {
    return "COMPLETED";
  }
  return "PLANNED";
}

export function hasTripName(trip: Trip): boolean {
  return Boolean(trip.tripName?.trim());
}

export function oneTripPerTruck(trips: Trip[]): Trip[] {
  const byTruck = new Map<string, Trip>();
  for (const trip of trips) {
    const current = byTruck.get(trip.truckId);
    if (
      !current ||
      (displayStatus(trip.status) === "ONGOING" &&
        displayStatus(current.status) !== "ONGOING")
    ) {
      byTruck.set(trip.truckId, trip);
    }
  }
  return [...byTruck.values()];
}

export function mergeTrips(localTrips: Trip[], remoteTrips: Trip[]): Trip[] {
  const byId = new Map(localTrips.filter(hasTripName).map((trip) => [trip.tripId, trip]));
  for (const trip of remoteTrips.filter(hasTripName)) {
    const local = byId.get(trip.tripId);
    byId.set(
      trip.tripId,
      local
        ? {
            ...local,
            ...trip,
            ...(local.sourceName && !trip.sourceName
              ? { sourceName: local.sourceName }
              : {}),
            ...(local.destinationName && !trip.destinationName
              ? { destinationName: local.destinationName }
              : {}),
          }
        : trip
    );
  }
  return [...byId.values()].filter(
    (trip) => hasTripName(trip) && displayStatus(trip.status) !== "COMPLETED"
  );
}
