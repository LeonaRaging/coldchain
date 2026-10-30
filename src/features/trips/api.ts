import { fetchAuthSession } from "aws-amplify/auth";

const tripsApiUrl = import.meta.env.VITE_TRIPS_API_URL || "/stage1/trips";
const trucksApiUrl = import.meta.env.VITE_TRUCKS_API_URL || "/stage1/trucks/positions";
const trucksBase = trucksApiUrl.replace(/\/positions\/?$/, "");

export type TripGeoPoint = {
  latitude: number;
  longitude: number;
};

export type Trip = {
  tripId: string;
  truckId: string;
  source: TripGeoPoint;
  destination: TripGeoPoint;
  status?: string;
  [key: string]: unknown;
};

export type CreateTripParams = {
  truckId: string;
  source: TripGeoPoint;
  destination: TripGeoPoint;
};

const TRIPS_STORAGE_KEY = "coldchain.trips";

async function bearerToken(): Promise<string> {
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken?.toString();
  if (!idToken) throw new Error("No Cognito ID token found");
  return idToken;
}

function toPoint(point: unknown): TripGeoPoint | null {
  if (!point || typeof point !== "object") return null;
  const { latitude, longitude } = point as Record<string, unknown>;
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { latitude: lat, longitude: lng };
}

function normalizeTrip(raw: Record<string, unknown>): Trip | null {
  if (!raw || typeof raw !== "object") return null;
  const tripId = String(raw.tripId ?? raw.trip_id ?? raw.id ?? "");
  const truckId = String(raw.truckId ?? raw.truck_id ?? "");
  const source = toPoint(raw.source ?? raw.origin);
  const destination = toPoint(raw.destination);
  if (!tripId || !truckId || !source || !destination) return null;
  return {
    ...(raw as unknown as Trip),
    tripId,
    truckId,
    source,
    destination,
    status: (raw.status as string) || undefined,
  };
}

export async function createTrip({
  truckId,
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
    body: JSON.stringify({ truckId, source, destination }),
  });

  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(detail.message || `Failed to create trip (${response.status})`);
  }

  const raw = (await response.json()) as Record<string, unknown>;
  const trip = normalizeTrip(raw);
  if (!trip) throw new Error("Trip API returned an unexpected response");

  const stored = readStoredTrips().filter(
    (existing) => existing.tripId !== trip.tripId
  );
  stored.push(trip);
  writeStoredTrips(stored);

  return trip;
}

export function readStoredTrips(): Trip[] {
  try {
    const raw = window.localStorage.getItem(TRIPS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeTrip(item as Record<string, unknown>))
      .filter((trip): trip is Trip => trip !== null);
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

export function mergeTripStatuses(updates: Map<string, Trip>): void {
  const stored = readStoredTrips();
  const merged = stored.map(
    (trip) => updates.get(trip.tripId) ?? trip
  );
  writeStoredTrips(merged);
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

export type TripStatus = "PLANNED" | "ONGOING" | "COMPLETED";

export function displayStatus(raw: string | undefined): Exclude<TripStatus, never> {
  const value = (raw ?? "").toUpperCase();
  if (value === "ONGOING" || value === "IN_PROGRESS" || value === "STARTED") {
    return "ONGOING";
  }
  if (value === "COMPLETED" || value === "DONE" || value === "FINISHED") {
    return "COMPLETED";
  }
  return "PLANNED";
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
    const detail = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(detail.message || `Failed to update trip ${tripId} (${response.status})`);
  }
}

export function setStoredTripStatus(tripId: string, status: TripStatus): void {
  writeStoredTrips(
    readStoredTrips().map((trip) =>
      trip.tripId === tripId ? { ...trip, status } : trip
    )
  );
}

export async function fetchTruckTrips(
  truckId: string,
  status: "ONGOING" | "COMPLETED"
): Promise<Trip[]> {
  const token = await bearerToken();
  const response = await fetch(
    `${trucksBase}/${encodeURIComponent(truckId)}/trips?status=${status}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) {
    throw new Error(`Truck-trips API returned ${response.status}`);
  }

  const raw = (await response.json()) as unknown;
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { trips?: unknown[] }).trips)
      ? (raw as { trips: unknown[] }).trips
      : [];
  return list
    .map((item) => normalizeTrip(item as Record<string, unknown>))
    .filter((trip): trip is Trip => trip !== null);
}
