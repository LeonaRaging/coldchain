const tripsApiBase = import.meta.env.VITE_TRIPS_API_URL || "/stage1/trips";

export type HistoryRecord = Record<string, string | null>;

export type HistoryResult = {
  tripId: string;
  truckId: string;
  count: number;
  records: HistoryRecord[];
};

export type HistoryParams = {
  tripId: string;
  limit?: number;
  idToken: string;
};

type HistoryApiResponse = Partial<HistoryResult> & {
  locations?: HistoryRecord[];
  points?: HistoryRecord[];
  trips?: unknown[];
};

export async function fetchHistory({
  tripId,
  limit,
  idToken,
}: HistoryParams): Promise<HistoryResult> {
  const url = `${tripsApiBase}/${encodeURIComponent(tripId)}/locations`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
    };
    throw new Error(
      detail.message ?? detail.error ?? `History API returned ${response.status}`,
    );
  }

  const data = (await response.json()) as HistoryApiResponse | HistoryRecord[];
  const payload: HistoryApiResponse = Array.isArray(data) ? {} : data;
  const records = Array.isArray(data)
    ? data
    : payload.records ??
      payload.locations ??
      payload.points ??
      (payload.trips ?? []).flatMap((trip: unknown) => {
        if (!trip || typeof trip !== "object") return [];
        const value = trip as { locations?: unknown; points?: unknown };
        const locations = value.locations ?? value.points;
        return Array.isArray(locations) ? locations : [];
      });
  const shownRecords =
    limit === undefined ? records : records.slice(0, Math.max(0, limit));

  return {
    tripId,
    truckId:
      typeof payload.truckId === "string"
        ? payload.truckId
        : "",
    count:
      typeof payload.count === "number" ? payload.count
        : records.length,
    records: shownRecords,
  };
}
