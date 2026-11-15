import { hasTripName, normalizeTrip, type Trip, type TripStatus } from "./model";

const TRIPS_STORAGE_KEY = "coldchain.trips";

export function readStoredTrips(): Trip[] {
  try {
    const raw = window.localStorage.getItem(TRIPS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const trips = parsed
      .map(normalizeTrip)
      .filter((trip): trip is Trip => trip !== null && hasTripName(trip));
    if (trips.length !== parsed.length) {
      writeStoredTrips(trips);
    }
    return trips;
  } catch {
    return [];
  }
}

export function writeStoredTrips(trips: Trip[]): void {
  try {
    window.localStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify(trips));
  } catch {
    console.error("Could not persist trips locally");
  }
}

const STARTED_TRIPS_STORAGE_KEY = "coldchain.startedTrips";

/** Trip IDs whose truck has reached the pickup point and is driving to the destination. */
export function readStartedTripIds(): string[] {
  try {
    const raw = window.localStorage.getItem(STARTED_TRIPS_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

export function writeStartedTripIds(tripIds: Iterable<string>): void {
  try {
    window.localStorage.setItem(STARTED_TRIPS_STORAGE_KEY, JSON.stringify([...tripIds]));
  } catch {
    console.error("Could not persist started trips locally");
  }
}

export function setStoredTripStatus(tripId: string, status: TripStatus): void {
  writeStoredTrips(
    readStoredTrips().map((trip) =>
      trip.tripId === tripId ? { ...trip, status } : trip
    )
  );
}
