import { useState } from "react";
import type { FormEvent } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { fetchHistory } from "./api";
import type { HistoryRecord, HistoryResult } from "./api";

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

export default function QueryHistory() {
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
    } catch (queryError) {
      setError(queryError instanceof Error ? queryError.message : "Query failed.");
      setResult(null);
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
    <section className="rounded-lg border border-[#374151] bg-[#111827] px-7 pb-7 pt-6 text-left text-[#f3f4f6]">
      <div className="mb-[22px] grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
        <div className="col-start-1 row-start-1 flex items-center gap-2.5">
          <span className="text-xl text-[#22d3ee]">🕒</span>
          <span className="truncate text-[17px] font-semibold">Query history</span>
        </div>

        <div className="col-start-2 row-start-1 whitespace-nowrap text-right">
          {result ? (
            <div className="font-mono text-xs text-[#6b7280]">Truck {result.truckId}</div>
          ) : (
            <div className="text-[13px] text-[#9ca3af]">No query yet</div>
          )}
        </div>

        <div className="col-span-2 row-start-2 text-xs text-[#9ca3af]">From the data lake · newest first</div>
      </div>

      <form className="grid grid-cols-[minmax(0,1fr)_84px_auto] items-end gap-2.5" onSubmit={handleSubmit}>
        <div>
          <label className="mb-[7px] block text-xs text-[#9ca3af]" htmlFor="history-truck">
            Truck ID
          </label>
          <input
            id="history-truck"
            className="box-border w-full rounded-md border border-[#374151] bg-[#1f2937] px-3 py-2.5 text-sm text-[#f3f4f6] outline-none [color-scheme:dark]"
            value={truckId}
            onChange={(event) => setTruckId(event.target.value)}
            placeholder="e.g. DEMO-001"
          />
        </div>

        <div>
          <label className="mb-[7px] block text-xs text-[#9ca3af]" htmlFor="history-limit">
            Limit
          </label>
          <input
            id="history-limit"
            className="box-border w-full rounded-md border border-[#374151] bg-[#1f2937] px-3 py-2.5 text-sm text-[#f3f4f6] outline-none [color-scheme:dark]"
            type="number"
            min={1}
            step={1}
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
            placeholder="20"
          />
        </div>

        <button
          type="submit"
          className="h-[39px] cursor-pointer whitespace-nowrap rounded-md border-none bg-[#06b6d4] px-5 text-sm font-bold text-[#082f49] disabled:cursor-default disabled:opacity-70"
          disabled={loading}
        >
          {loading ? "Querying..." : "Query"}
        </button>
      </form>

      {error && <div className="mt-4 rounded-md border border-[rgba(239,68,68,0.4)] bg-[rgba(239,68,68,0.12)] px-3 py-2.5 text-[13px] text-[#f87171]">{error}</div>}

      <div className="mb-3 mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="font-bold">Route points</div>
        {result && (
          <div className="text-[13px] text-[#9ca3af]">
            {shownRecords.length} of {result.count}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-[13px] text-[#9ca3af]">Running Athena query…</p>
      ) : result && result.records.length > 0 ? (
        <div className="flex flex-col gap-2">
          {shownRecords.map((record, index) => {
            const temperature = formatTemperature(record);
            return (
              <div key={index} className="rounded-md border border-[#1f2937] bg-[#0f172a] px-3 py-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-mono text-xs text-[#d1d5db]">{formatTimestamp(record)}</span>
                  <span
                    className={
                      temperature.hot
                        ? "text-[13px] font-bold text-[#f87171]"
                        : "text-[13px] font-bold text-[#22d3ee]"
                    }
                  >
                    {temperature.text}
                  </span>
                </div>
                <div className="mt-1 break-words font-mono text-xs text-[#9ca3af]">{formatCoords(record)}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[13px] text-[#9ca3af]">
          {result
            ? `No events found for truck ${result.truckId}.`
            : "Enter a truck ID, then run a query."}
        </p>
      )}
    </section>
  );
}
