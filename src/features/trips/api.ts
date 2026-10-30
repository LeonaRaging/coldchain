import { fetchAuthSession } from "aws-amplify/auth";
import {
  normalizeTrip,
  normalizeTripList,
  hasTripName,
  type Trip,
  type TripStatus,
} from "./model";
import { readStoredTrips, writeStoredTrips } from "./storage";

const tripsApiUrl = import.meta.env.VITE_TRIPS_API_URL || "/stage1/trips";
const trucksApiUrl = import.meta.env.VITE_TRUCKS_API_URL || "/stage1/trucks/positions";
const trucksBase = trucksApiUrl.replace(/\/positions\/?$/, "");

export type { Trip, TripStatus } from "./model";
export type { TripGeoPoint } from "./model";
export { displayStatus } from "./model";
export { hasTripName } from "./model";
export { oneTripPerTruck } from "./model";
export { readStoredTrips, writeStoredTrips } from "./storage";

export type CreateTripParams = {
  tripName: string;
  truckId: string;
  minTemp: number;
  maxTemp: number;
  sourceName?: string;
  destinationName?: string;
  source: import("./model").TripGeoPoint;
  destination: import("./model").TripGeoPoint;
};

async function bearerToken(): Promise<string> {
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken?.toString();
  if (!idToken) throw new Error("No Cognito ID token found");
  return idToken;
}


export async function createTrip({
  tripName,
  truckId,
  minTemp,
  maxTemp,
  sourceName,
  destinationName,
  source,
  destination,
}: CreateTripParams): Promise<Trip> {
  const token = await bearerToken();
  const response = await fetch(tripsApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      tripName,
      truckId,
      minTemperature: minTemp,
      maxTemperature: maxTemp,
      ...(sourceName ? { sourceName } : {}),
      ...(destinationName ? { destinationName } : {}),
      source,
      destination,
    }),
  });

  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(detail.message || `Failed to create trip (${response.status})`);
  }

  const raw = (await response.json()) as unknown;
  const trip =
    normalizeTrip(raw) ||
    (raw &&
    typeof raw === "object" &&
    !Array.isArray(raw)
      ? normalizeTrip(
          (raw as Record<string, unknown>).trip ??
            (raw as Record<string, unknown>).data ??
            (raw as Record<string, unknown>).item
        )
      : null);
  if (!trip) throw new Error("Trip API returned an unexpected response");
  const namedTrip: Trip = {
    ...trip,
    ...(sourceName ? { sourceName } : {}),
    ...(destinationName ? { destinationName } : {}),
  };

  const stored = readStoredTrips().filter(
    (existing) => existing.tripId !== namedTrip.tripId
  );
  stored.push(namedTrip);
  writeStoredTrips(stored);

  return namedTrip;
}

export function mergeTripStatuses(updates: Map<string, Trip>): void {
  const stored = readStoredTrips();
  const merged = stored.map(
    (trip) => updates.get(trip.tripId) ?? trip
  );
  writeStoredTrips(merged);
}

export async function fetchTrips(signal?: AbortSignal): Promise<Trip[]> {
  const token = await bearerToken();
  const response = await fetch(trucksApiUrl, {
    signal,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Truck positions API returned ${response.status}`);
  }

  const raw = (await response.json()) as unknown;
  const trucks: unknown[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { trucks?: unknown[] }).trucks)
      ? (raw as { trucks: unknown[] }).trucks
      : [];
  const truckIds = trucks
    .map((truck) => {
      if (!truck || typeof truck !== "object") return "";
      const value = truck as Record<string, unknown>;
      return String(value.truckId ?? value.truck_id ?? "");
    })
    .filter((truckId) => truckId.length > 0);

  const tripsByTruck = await Promise.all(
    truckIds.map((truckId) => fetchTruckTrips(truckId, undefined, signal))
  );
  return tripsByTruck.flat().filter(hasTripName);
}

export async function fetchCompletedTrips(signal?: AbortSignal): Promise<Trip[]> {
  const token = await bearerToken();
  const response = await fetch(trucksApiUrl, {
    signal,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Truck positions API returned ${response.status}`);
  }

  const raw = (await response.json()) as unknown;
  const trucks: unknown[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { trucks?: unknown[] }).trucks)
      ? (raw as { trucks: unknown[] }).trucks
      : [];
  const truckIds = trucks
    .map((truck) => {
      if (!truck || typeof truck !== "object") return "";
      const value = truck as Record<string, unknown>;
      return String(value.truckId ?? value.truck_id ?? "");
    })
    .filter((truckId) => truckId.length > 0);

  const tripsByTruck = await Promise.all(
    truckIds.map((truckId) => fetchTruckTrips(truckId, "COMPLETED", signal))
  );
  return tripsByTruck.flat().filter(hasTripName);
}

export async function fetchTrip(tripId: string): Promise<Trip> {
  const token = await bearerToken();
  const response = await fetch(`${tripsApiUrl}/${encodeURIComponent(tripId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(detail.message || `Failed to load trip ${tripId} (${response.status})`);
  }

  const raw = (await response.json()) as Record<string, unknown>;
  const trip = normalizeTrip(raw);
  if (!trip) throw new Error("Trip API returned an unexpected response");
  return trip;
}

export async function setTripStatus(
  tripId: string,
  status: TripStatus
): Promise<void> {
  const token = await bearerToken();
  const response = await fetch(
    `${tripsApiUrl}/${encodeURIComponent(tripId)}/status`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    let message = "";
    try {
      const detail = JSON.parse(body) as {
        message?: string;
        error?: string;
      };
      message = detail.message || detail.error || "";
    } catch {
      message = body.trim();
    }
    throw new Error(message || `Failed to update trip ${tripId} (${response.status})`);
  }
}

export async function fetchTruckTrips(
  truckId: string,
  status?: "ONGOING" | "COMPLETED",
  signal?: AbortSignal
): Promise<Trip[]> {
  if (signal?.aborted) {
    throw new DOMException("The request was aborted", "AbortError");
  }
  const token = await bearerToken();
  const statusQuery = status ? `?status=${status}` : "";
  const response = await fetch(
    `${trucksBase}/${encodeURIComponent(truckId)}/trips${statusQuery}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) {
    throw new Error(`Truck-trips API returned ${response.status}`);
  }

  if (signal?.aborted) {
    throw new DOMException("The request was aborted", "AbortError");
  }

  return normalizeTripList(await response.json());
}
