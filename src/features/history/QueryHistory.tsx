import { useState } from "react";
import type { FormEvent } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { fetchHistory } from "./api";
import type { HistoryRecord, HistoryResult } from "./api";
import "./QueryHistory.css";

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
    <section className="history-panel">
      <div className="history-header">
        <div className="history-title-row">
          <span className="history-title-icon">🕒</span>
          <span className="history-title">Query history</span>
        </div>

        <div className="history-truck">
          {result ? (
            <div className="history-mono">Truck {result.truckId}</div>
          ) : (
            <div className="history-muted">No query yet</div>
          )}
        </div>

        <div className="history-subtitle">From the data lake · newest first</div>
      </div>

      <form className="history-form" onSubmit={handleSubmit}>
        <div>
          <label className="history-label" htmlFor="history-truck">
            Truck ID
          </label>
          <input
            id="history-truck"
            className="history-input"
            value={truckId}
            onChange={(event) => setTruckId(event.target.value)}
            placeholder="e.g. DEMO-001"
          />
        </div>

        <div>
          <label className="history-label" htmlFor="history-limit">
            Limit
          </label>
          <input
            id="history-limit"
            className="history-input"
            type="number"
            min={1}
            step={1}
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
            placeholder="20"
          />
        </div>

        <button type="submit" className="history-submit" disabled={loading}>
          {loading ? "Querying..." : "Query"}
        </button>
      </form>

      {error && <div className="history-error">{error}</div>}

      <div className="history-results-head">
        <div className="history-results-title">Route points</div>
        {result && (
          <div className="history-muted">
            {shownRecords.length} of {result.count}
          </div>
        )}
      </div>

      {loading ? (
        <p className="history-muted">Running Athena query…</p>
      ) : result && result.records.length > 0 ? (
        <div className="history-list">
          {shownRecords.map((record, index) => {
            const temperature = formatTemperature(record);
            return (
              <div key={index} className="history-point">
                <div className="history-point-top">
                  <span className="history-point-time">{formatTimestamp(record)}</span>
                  <span
                    className={
                      temperature.hot
                        ? "history-point-temp history-point-temp--hot"
                        : "history-point-temp"
                    }
                  >
                    {temperature.text}
                  </span>
                </div>
                <div className="history-point-coords">{formatCoords(record)}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="history-muted">
          {result
            ? `No events found for truck ${result.truckId}.`
            : "Enter a truck ID, then run a query."}
        </p>
      )}
    </section>
  );
}
