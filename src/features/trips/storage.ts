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

export function setStoredTripStatus(tripId: string, status: TripStatus): void {
  writeStoredTrips(
    readStoredTrips().map((trip) =>
      trip.tripId === tripId ? { ...trip, status } : trip
    )
  );
}
