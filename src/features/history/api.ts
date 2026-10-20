const historyApiUrl = import.meta.env.VITE_HISTORY_API_URL;

export type HistoryRecord = Record<string, string | null>;

export type HistoryResult = {
  truckId: string;
  count: number;
  records: HistoryRecord[];
};

export type HistoryParams = {
  truckId: string;
  limit?: number;
  idToken: string;
};

export async function fetchHistory({
  truckId,
  limit,
  idToken,
}: HistoryParams): Promise<HistoryResult> {
  if (!historyApiUrl) {
    throw new Error("VITE_HISTORY_API_URL is not configured");
  }

  const url = new URL(historyApiUrl, window.location.origin);
  url.searchParams.set("truckId", truckId);
  if (limit !== undefined) {
    url.searchParams.set("limit", String(limit));
  }

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

  const data = (await response.json()) as Partial<HistoryResult>;
  const records = data.records ?? [];

  return {
    truckId: data.truckId ?? truckId,
    count: data.count ?? records.length,
    records,
  };
}
