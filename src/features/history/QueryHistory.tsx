import { useState } from "react";
import type { FormEvent } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { fetchHistory } from "./api";
import type { HistoryRecord, HistoryResult } from "./api";
import { AlertIcon, ThermometerIcon } from "../../components/icons";

function formatTimestamp(record: HistoryRecord): string {
  const value = record.timestamp ?? record.event_time;
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatTemperature(record: HistoryRecord): { text: string; hot: boolean } {
  const value = record.temperature;
  if (value === null || value === undefined || value === "") {
    return { text: "—", hot: false };
  }
  const temperature = Number(value);
  if (!Number.isFinite(temperature)) {
    return { text: value, hot: false };
  }
  return { text: `${temperature.toFixed(1)} °C`, hot: temperature > 8 };
}

function formatCoords(record: HistoryRecord): string {
  const latitude = record.latitude;
  const longitude = record.longitude;
  if (!latitude || !longitude) {
    return "No location";
  }
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return `${latitude}, ${longitude}`;
  }
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

type QueryHistoryProps = {
  onResult?: (result: HistoryResult | null) => void;
};

export default function QueryHistory({ onResult }: QueryHistoryProps) {
  const [truckId, setTruckId] = useState("");
  const [limit, setLimit] = useState("20");
  const [result, setResult] = useState<HistoryResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const id = truckId.trim();
      if (!id) {
        throw new Error("Enter a truck ID to query.");
      }

      if (limit.trim() !== "") {
        const parsedLimit = Number(limit);
        if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
          throw new Error("Limit must be a positive whole number.");
        }
      }

      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      if (!idToken) {
        throw new Error("No Cognito ID token found. Please sign in again.");
      }

      const data = await fetchHistory({ truckId: id, idToken });
      setResult(data);
      onResult?.(data);
    } catch (queryError) {
      setError(queryError instanceof Error ? queryError.message : "Query failed.");
      setResult(null);
      onResult?.(null);
    } finally {
      setLoading(false);
    }
  }

  const parsedLimit = Number(limit);
  const activeLimit =
    limit.trim() !== "" && Number.isInteger(parsedLimit) && parsedLimit > 0
      ? parsedLimit
      : null;
  const shownRecords = result
    ? activeLimit
      ? result.records.slice(0, activeLimit)
      : result.records
    : [];

  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-motive-line bg-white text-left shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-motive-line px-4 py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-motive-ink">Route history</h2>
          <p className="text-xs text-motive-muted">Athena data lake · newest first</p>
        </div>

        {result ? (
          <span className="shrink-0 rounded-full bg-motive-surface px-2 py-0.5 text-[11px] font-medium text-motive-muted">
            {result.truckId}
          </span>
        ) : (
          <span className="shrink-0 text-[11px] text-motive-muted">No query yet</span>
        )}
      </div>

      <form className="flex flex-col gap-3 border-b border-motive-line p-4" onSubmit={handleSubmit}>
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <label
              className="mb-1.5 block text-xs font-medium text-motive-muted"
              htmlFor="history-truck"
            >
              Truck ID
            </label>
            <input
              id="history-truck"
              className="h-10 w-full rounded-md border border-motive-line bg-white px-3 text-sm text-motive-ink outline-none transition-shadow placeholder:text-gray-400 focus:border-motive-blue focus:ring-2 focus:ring-motive-blue/15"
              value={truckId}
              onChange={(event) => setTruckId(event.target.value)}
              placeholder="e.g. DEMO-001"
            />
          </div>

          <div className="w-20">
            <label
              className="mb-1.5 block text-xs font-medium text-motive-muted"
              htmlFor="history-limit"
            >
              Limit
            </label>
            <input
              id="history-limit"
              className="h-10 w-full rounded-md border border-motive-line bg-white px-3 text-sm tabular-nums text-motive-ink outline-none transition-shadow focus:border-motive-blue focus:ring-2 focus:ring-motive-blue/15"
              type="number"
              min={1}
              step={1}
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
              placeholder="20"
            />
          </div>
        </div>

        <button
          type="submit"
          className="h-10 w-full cursor-pointer whitespace-nowrap rounded-md border-none bg-motive-blue text-sm font-semibold text-white transition-colors hover:bg-motive-blue-dark disabled:cursor-not-allowed disabled:opacity-70"
          disabled={loading}
        >
          {loading ? "Querying..." : "Query history"}
        </button>
      </form>

      <div className="flex flex-col p-4">
        {error && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-motive-muted">Route points</h3>
          {result && (
            <span className="text-[11px] tabular-nums text-motive-muted">
              {shownRecords.length} of {result.count}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-motive-muted">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-motive-blue/25 border-t-motive-blue" />
            Running Athena query…
          </div>
        ) : result && result.records.length > 0 ? (
          <div className="flex max-h-[420px] flex-col divide-y divide-motive-line overflow-y-auto rounded-md border border-motive-line xl:max-h-[560px]">
            {shownRecords.map((record, index) => {
              const temperature = formatTemperature(record);
              return (
                <div key={index} className="flex items-start justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-medium tabular-nums text-motive-ink">
                      {formatTimestamp(record)}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] tabular-nums text-motive-muted">
                      {formatCoords(record)}
                    </p>
                  </div>
                  <span
                    className={
                      temperature.hot
                        ? "inline-flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-red-600"
                        : "inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-emerald-700"
                    }
                  >
                    {temperature.hot ? (
                      <AlertIcon className="h-3 w-3" />
                    ) : (
                      <ThermometerIcon className="h-3 w-3" />
                    )}
                    {temperature.text}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="flex min-h-[160px] items-center justify-center rounded-md border border-dashed border-motive-line bg-motive-surface px-3 py-6 text-center text-sm text-motive-muted">
            {result
              ? `No events found for truck ${result.truckId}.`
              : "Enter a truck ID, then run a query."}
          </p>
        )}
      </div>
    </section>
  );
}
