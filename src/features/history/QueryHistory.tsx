import { useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { fetchHistory } from "./api";
import type { HistoryRecord, HistoryResult } from "./api";

const SECTION: CSSProperties = {
  background: "#111827",
  color: "#f3f4f6",
  padding: "24px 28px 28px",
  border: "1px solid #374151",
  borderRadius: "8px",
  textAlign: "left",
};

const TITLE_ROW: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

const TITLE_ICON: CSSProperties = {
  color: "#22d3ee",
  fontSize: "20px",
};

const HEADER: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  marginBottom: "22px",
  flexWrap: "wrap",
};

const HEADING: CSSProperties = {
  fontSize: "17px",
  fontWeight: 600,
};

const SUBTITLE: CSSProperties = {
  color: "#9ca3af",
  fontSize: "12px",
};

const FORM_GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 84px auto",
  gap: "10px",
  alignItems: "end",
};

const LABEL: CSSProperties = {
  display: "block",
  color: "#9ca3af",
  fontSize: "12px",
  marginBottom: "7px",
};

const INPUT: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  background: "#1f2937",
  border: "1px solid #374151",
  borderRadius: "6px",
  color: "#f3f4f6",
  fontSize: "14px",
  outline: "none",
  colorScheme: "dark",
};

const PRIMARY: CSSProperties = {
  height: "39px",
  padding: "0 20px",
  background: "#06b6d4",
  color: "#082f49",
  border: "none",
  borderRadius: "6px",
  fontSize: "14px",
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const ERROR_BOX: CSSProperties = {
  marginTop: "16px",
  padding: "10px 12px",
  borderRadius: "6px",
  background: "rgba(239, 68, 68, 0.12)",
  border: "1px solid rgba(239, 68, 68, 0.4)",
  color: "#f87171",
  fontSize: "13px",
};

const RESULTS_HEAD: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  margin: "24px 0 12px",
  flexWrap: "wrap",
};

const MUTED: CSSProperties = {
  color: "#9ca3af",
  fontSize: "13px",
};

const MONO: CSSProperties = {
  fontFamily: "ui-monospace, Consolas, monospace",
  fontSize: "12px",
  color: "#6b7280",
};

const LIST: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const POINT: CSSProperties = {
  background: "#0f172a",
  border: "1px solid #1f2937",
  borderRadius: "6px",
  padding: "10px 12px",
};

const POINT_TOP: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: "8px",
  flexWrap: "wrap",
};

const POINT_TIME: CSSProperties = {
  fontFamily: "ui-monospace, Consolas, monospace",
  fontSize: "12px",
  color: "#d1d5db",
};

const POINT_TEMP: CSSProperties = {
  fontSize: "13px",
  fontWeight: 700,
  color: "#22d3ee",
};

const POINT_TEMP_HOT: CSSProperties = {
  ...POINT_TEMP,
  color: "#f87171",
};

const POINT_COORDS: CSSProperties = {
  marginTop: "4px",
  fontFamily: "ui-monospace, Consolas, monospace",
  fontSize: "12px",
  color: "#9ca3af",
  wordBreak: "break-word",
};

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
    <section style={SECTION}>
      <div style={HEADER}>
        <div>
          <div style={TITLE_ROW}>
            <span style={TITLE_ICON}>🕒</span>
            <span style={HEADING}>Query history</span>
          </div>
          <div style={SUBTITLE}>From the data lake · newest first</div>
        </div>

        <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
          {result ? (
            <div style={MONO}>Truck {result.truckId}</div>
          ) : (
            <div style={MUTED}>No query yet</div>
          )}
        </div>
      </div>

      <form style={FORM_GRID} onSubmit={handleSubmit}>
        <div>
          <label style={LABEL} htmlFor="history-truck">
            Truck ID
          </label>
          <input
            id="history-truck"
            style={INPUT}
            value={truckId}
            onChange={(event) => setTruckId(event.target.value)}
            placeholder="e.g. DEMO-001"
          />
        </div>

        <div>
          <label style={LABEL} htmlFor="history-limit">
            Limit
          </label>
          <input
            id="history-limit"
            style={INPUT}
            type="number"
            min={1}
            step={1}
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
            placeholder="20"
          />
        </div>

        <button type="submit" style={PRIMARY} disabled={loading}>
          {loading ? "Querying..." : "Query"}
        </button>
      </form>

      {error && <div style={ERROR_BOX}>{error}</div>}

      <div style={RESULTS_HEAD}>
        <div style={{ fontWeight: 700 }}>Route points</div>
        {result && (
          <div style={MUTED}>
            {shownRecords.length} of {result.count}
          </div>
        )}
      </div>

      {loading ? (
        <p style={MUTED}>Running Athena query…</p>
      ) : result && result.records.length > 0 ? (
        <div style={LIST}>
          {shownRecords.map((record, index) => {
            const temperature = formatTemperature(record);
            return (
              <div key={index} style={POINT}>
                <div style={POINT_TOP}>
                  <span style={POINT_TIME}>{formatTimestamp(record)}</span>
                  <span style={temperature.hot ? POINT_TEMP_HOT : POINT_TEMP}>
                    {temperature.text}
                  </span>
                </div>
                <div style={POINT_COORDS}>{formatCoords(record)}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <p style={MUTED}>
          {result
            ? `No events found for truck ${result.truckId}.`
            : "Enter a truck ID, then run a query."}
        </p>
      )}
    </section>
  );
}
