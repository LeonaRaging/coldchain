import { fetchAuthSession } from "aws-amplify/auth";

const createTrucksApiUrl = import.meta.env.VITE_CREATE_TRUCKS_API_URL;
const getUserTrucksApiUrl = import.meta.env.VITE_GET_USER_TRUCKS_API_URL;

export type UserTruck = {
  truckId: string;
  truckName?: string;
  temperature?: number | string;
  [key: string]: unknown;
};

async function bearerToken(): Promise<string> {
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken?.toString();
  if (!idToken) throw new Error("No Cognito ID token found");
  return idToken;
}

function normalizeTruck(raw: unknown): UserTruck | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const truckId = String(
    value.truckId ?? value.truck_id ?? value.truckID ?? value.id ?? ""
  ).trim();
  const truckName = String(value.truckName ?? value.truck_name ?? value.name ?? "").trim();
  return truckId ? { ...value, truckId, ...(truckName ? { truckName } : {}) } : null;
}

export function truckDisplayName(truck: UserTruck): string {
  return truck.truckName?.trim() || truck.truckId;
}

export function truckDisplayLabel(truck: UserTruck): string {
  return truck.truckName?.trim()
    ? `${truck.truckName.trim()} (${truck.truckId})`
    : truck.truckId;
}

export function truckDisplayNameForId(
  trucks: UserTruck[],
  truckId: string
): string {
  const truck = trucks.find((item) => item.truckId === truckId);
  return truck ? truckDisplayName(truck) : truckId;
}

export function truckDisplayLabelForId(
  trucks: UserTruck[],
  truckId: string
): string {
  const truck = trucks.find((item) => item.truckId === truckId);
  return truck ? truckDisplayLabel(truck) : truckId;
}

function normalizeTruckList(raw: unknown): UserTruck[] {
  const value = raw && typeof raw === "object"
    ? (raw as Record<string, unknown>)
    : undefined;
  const list =
    Array.isArray(raw)
      ? raw
      : Array.isArray(value?.trucks)
        ? value.trucks
        : Array.isArray(value?.userTrucks)
          ? value.userTrucks
          : Array.isArray(value?.user_trucks)
            ? value.user_trucks
            : Array.isArray(value?.data)
              ? value.data
        : [];
  return list
    .map(normalizeTruck)
    .filter((truck): truck is UserTruck => truck !== null);
}

export async function fetchUserTrucks(signal?: AbortSignal): Promise<UserTruck[]> {
  const token = await bearerToken();
  const response = await fetch(getUserTrucksApiUrl, {
    signal,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`Could not load your trucks (${response.status})`);
  }
  return normalizeTruckList(await response.json());
}

export async function createTruck(truckName: string, truckId: string): Promise<UserTruck> {
  const normalizedName = truckName.trim();
  const normalizedId = truckId.trim();
  if (!normalizedName) throw new Error("Truck name is required");
  if (!normalizedId) throw new Error("Truck ID is required");

  const token = await bearerToken();
  const response = await fetch(createTrucksApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ truck_name: normalizedName, truck_id: normalizedId }),
  });

  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(detail.message || `Could not create truck (${response.status})`);
  }

  if (response.status === 204) return { truckId: normalizedId };
  const truck = normalizeTruck(await response.json());
  if (!truck) return { truckId: normalizedId };
  return truck;
}

export async function deleteTruck(truckId: string): Promise<void> {
  const normalizedId = truckId.trim();
  if (!normalizedId) throw new Error("Truck ID is required");

  const token = await bearerToken();
  const response = await fetch(
    `${getUserTrucksApiUrl.replace(/\/$/, "")}/${encodeURIComponent(normalizedId)}`,
    {
    method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    const body = await response.text();
    let message = "";
    try {
      const detail = JSON.parse(body) as { message?: string; error?: string };
      message = detail.message || detail.error || "";
    } catch {
      message = body.trim();
    }
    throw new Error(message || `Could not delete truck (${response.status})`);
  }
}
