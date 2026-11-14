import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { fetchHistory } from "./api";
import type { HistoryRecord, HistoryResult } from "./api";
import { AlertIcon, ThermometerIcon } from "../../components/icons";
import type { Trip } from "../trips/api";
import { ReverseGeocode, ReverseGeocodePlace } from "../fleet/location";
import { truckDisplayNameForId, type UserTruck } from "../fleet/trucksApi";

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

function formatTemperature(
  record: HistoryRecord,
  bounds?: [number, number]
): { text: string; outOfRange: boolean } {
  const value = record.temperature;
  if (value === null || value === undefined || value === "") {
    return { text: "—", outOfRange: false };
  }
  const temperature = Number(value);
  if (!Number.isFinite(temperature)) {
    return { text: value, outOfRange: false };
  }
  const outOfRange =
    bounds !== undefined &&
    (temperature < bounds[0] || temperature > bounds[1]);
  return { text: `${temperature.toFixed(1)} °C`, outOfRange };
}

function tripTemperatureBounds(trip?: Trip): [number, number] | undefined {
  if (!trip) return undefined;
  const minimum = Number(
    trip.minTemperature ??
      trip.minTemp ??
      trip.min_temperature ??
      trip.min_temp ??
      trip.minimumTemperature ??
      trip.minimum_temperature
  );
  const maximum = Number(
    trip.maxTemperature ??
      trip.maxTemp ??
      trip.max_temperature ??
      trip.max_temp ??
      trip.maximumTemperature ??
      trip.maximum_temperature
  );
  return Number.isFinite(minimum) && Number.isFinite(maximum)
    ? [minimum, maximum]
    : undefined;
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

function tripAddressKey(tripId: string, kind: "source" | "destination"): string {
  return `${tripId}-${kind}`;
}

function tripPlaceNameForHistory(
  trip: Trip,
  kind: "source" | "destination"
): string | undefined {
  const names =
    kind === "source"
      ? ["sourceName", "source_name", "originName", "origin_name"]
      : ["destinationName", "destination_name"];
  for (const name of names) {
    const value = trip[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function tripTemperatureRange(trip: Trip): string | undefined {
  const min = trip.minTemp ?? trip.min_temp ?? trip.minTemperature ??
    trip.min_temperature ?? trip.minimumTemperature ?? trip.minimum_temperature;
  const max = trip.maxTemp ?? trip.max_temp ?? trip.maxTemperature ??
    trip.max_temperature ?? trip.maximumTemperature ?? trip.maximum_temperature;
  const minimum = Number(min);
  const maximum = Number(max);
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) return undefined;
  return `${minimum}°C to ${maximum}°C`;
}

function completedTime(trip: Trip): number {
  const candidates = [
    trip.completedAt,
    trip.completed_at,
    trip.completedTime,
    trip.completed_time,
    trip.endedAt,
    trip.ended_at,
    trip.endTime,
    trip.end_time,
    trip.updatedAt,
    trip.updated_at,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string" && typeof candidate !== "number") continue;
    const timestamp = new Date(candidate).getTime();
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return 0;
}

function tripTime(trip: Trip, kind: "start" | "end"): number {
  const candidates = [
    ...(kind === "start"
      ? [
          trip.startedAt,
          trip.started_at,
          trip.startTime,
          trip.start_time,
          trip.createdAt,
          trip.created_at,
        ]
      : [
          trip.completedAt,
          trip.completed_at,
          trip.completedTime,
          trip.completed_time,
          trip.endedAt,
          trip.ended_at,
          trip.endTime,
          trip.end_time,
          trip.updatedAt,
          trip.updated_at,
        ]),
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string" && typeof candidate !== "number") continue;
    const timestamp = new Date(candidate).getTime();
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return 0;
}

type QueryHistoryProps = {
  trucks: UserTruck[];
  onResult?: (result: HistoryResult | null) => void;
  completedTrips?: Trip[];
  completedTripsLoading?: boolean;
  completedTripsError?: string;
  onLocationSelect?: (record: HistoryRecord) => void;
};

export default function QueryHistory({
  trucks,
  onResult,
  completedTrips = [],
  completedTripsLoading = false,
  completedTripsError = "",
  onLocationSelect,
}: QueryHistoryProps) {
  const [result, setResult] = useState<HistoryResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState("");
  const [panelTab, setPanelTab] = useState<"trips" | "points">("trips");
  const [recordAddresses, setRecordAddresses] = useState<Record<number, string>>({});
  const [tripPlaceNames, setTripPlaceNames] = useState<Record<string, string>>({});
  const [truckSearch, setTruckSearch] = useState("");
  const [tripSearch, setTripSearch] = useState("");
  const [startTimeFilter, setStartTimeFilter] = useState("");
  const [endTimeFilter, setEndTimeFilter] = useState("");

  async function loadHistory(id: string) {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();
    if (!idToken) {
      throw new Error("No Cognito ID token found. Please sign in again.");
    }

    const data = await fetchHistory({ tripId: id, idToken });
    setResult(data);
    onResult?.(data);
  }

  async function handleCompletedTrip(trip: Trip) {
    setSelectedTripId(trip.tripId);
    setPanelTab("points");
    setError("");
    setLoading(true);
    try {
      await loadHistory(trip.tripId);
    } catch (queryError) {
      setError(queryError instanceof Error ? queryError.message : "Query failed.");
      setResult(null);
      onResult?.(null);
    } finally {
      setLoading(false);
    }
  }

  const shownRecords = result?.records ?? [];
  const selectedTrip = completedTrips.find((trip) => trip.tripId === selectedTripId);
  const sortedCompletedTrips = completedTrips
    .map((trip, index) => ({ trip, index }))
    .sort((first, second) => {
      const timeDifference = completedTime(second.trip) - completedTime(first.trip);
      return timeDifference || first.index - second.index;
    })
    .map(({ trip }) => trip);
  const normalizedTruckSearch = truckSearch.trim().toLocaleLowerCase();
  const normalizedTripSearch = tripSearch.trim().toLocaleLowerCase();
  const startTime = startTimeFilter ? new Date(startTimeFilter).getTime() : 0;
  const endTime = endTimeFilter ? new Date(endTimeFilter).getTime() : 0;
  const filteredCompletedTrips = sortedCompletedTrips.filter((trip) => {
    const truckLabel = truckDisplayNameForId(trucks, trip.truckId).toLocaleLowerCase();
    if (
      normalizedTruckSearch &&
      !truckLabel.includes(normalizedTruckSearch) &&
      !trip.truckId.toLocaleLowerCase().includes(normalizedTruckSearch)
    ) {
      return false;
    }
    if (
      normalizedTripSearch &&
      !(trip.tripName || trip.tripId).toLocaleLowerCase().includes(normalizedTripSearch)
    ) {
      return false;
    }

    const tripStartTime = tripTime(trip, "start");
    const tripEndTime = tripTime(trip, "end");
    if (startTime && (!tripStartTime || tripStartTime < startTime)) return false;
    if (endTime && (!tripEndTime || tripEndTime > endTime)) return false;
    return true;
  });

  useEffect(() => {
    let cancelled = false;
    setTripPlaceNames({});
    void Promise.all(
      completedTrips.flatMap((trip) =>
        (["source", "destination"] as const).map(async (kind) => {
          const point = trip[kind];
          if (!point) return null;
          try {
            const place = await ReverseGeocodePlace([point.longitude, point.latitude]);
            return { key: tripAddressKey(trip.tripId, kind), ...place };
          } catch (error) {
            console.error("Could not resolve completed trip address:", error);
            return null;
          }
        })
      )
    ).then((places) => {
      if (!cancelled) {
        setTripPlaceNames(
          Object.fromEntries(
            places
              .filter((place): place is { key: string; name: string } =>
                Boolean(place?.key && place.name)
              )
              .map((place): [string, string] => [place.key, place.name])
          )
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [completedTrips]);

  useEffect(() => {
    let cancelled = false;
    setRecordAddresses({});
    void Promise.all(
      shownRecords.map(async (record, index) => {
        const latitude = Number(record.latitude);
        const longitude = Number(record.longitude);
        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          Math.abs(latitude) > 90 ||
          Math.abs(longitude) > 180
        ) {
          return null;
        }
        try {
          const address = await ReverseGeocode([longitude, latitude]);
          return address ? ([index, address] as const) : null;
        } catch (error) {
          console.error("Could not resolve route point address:", error);
          return null;
        }
      })
    ).then((addresses) => {
      if (!cancelled) {
        setRecordAddresses(
          Object.fromEntries(addresses.filter((entry): entry is readonly [number, string] => entry !== null))
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [result]);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-white text-left">
      <div className="flex items-start justify-between gap-3 border-b border-motive-line px-4 py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-motive-ink">Route history</h2>
          <p className="text-xs text-motive-muted">Athena data lake · newest first</p>
        </div>

        {result ? (
          <span className="shrink-0 rounded-md bg-motive-surface px-2 py-1 text-[11px] text-motive-muted">
            <span className="block font-medium text-motive-ink">
              Trip: {selectedTrip?.tripName || result.tripId}
            </span>
            {selectedTrip?.tripName && (
              <span className="block">Truck: {truckDisplayNameForId(trucks, selectedTrip.truckId)}</span>
            )}
          </span>
        ) : (
          <span className="shrink-0 text-[11px] text-motive-muted">Select a trip</span>
        )}
      </div>

      <div className="grid grid-cols-2 border-b border-motive-line bg-white p-1">
        <button
          type="button"
          onClick={() => setPanelTab("trips")}
          className={`rounded px-3 py-2 text-xs font-medium transition-colors ${
            panelTab === "trips"
              ? "bg-motive-surface text-motive-ink"
              : "text-motive-muted hover:text-motive-ink"
          }`}
        >
          Trips
        </button>
        <button
          type="button"
          onClick={() => setPanelTab("points")}
          className={`rounded px-3 py-2 text-xs font-medium transition-colors ${
            panelTab === "points"
              ? "bg-motive-surface text-motive-ink"
              : "text-motive-muted hover:text-motive-ink"
          }`}
        >
          Route points
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {panelTab === "trips" ? (
          <div className="mb-4">
            <h3 className="mb-3 text-xs font-semibold text-motive-muted">
              Recently completed
            </h3>
            <div className="mb-3 grid gap-2">
              <label className="text-[11px] font-medium text-motive-muted">
                Trip name
                <input
                  type="search"
                  value={tripSearch}
                  onChange={(event) => setTripSearch(event.target.value)}
                  placeholder="Name or trip ID"
                  className="mt-1 h-9 w-full rounded-md border border-motive-line px-3 text-xs text-motive-ink outline-none focus:border-motive-blue focus:ring-2 focus:ring-motive-blue/15"
                />
              </label>
              <label className="text-[11px] font-medium text-motive-muted">
                Truck name
                <input
                  type="search"
                  value={truckSearch}
                  onChange={(event) => setTruckSearch(event.target.value)}
                  placeholder="Name or truck ID"
                  className="mt-1 h-9 w-full rounded-md border border-motive-line px-3 text-xs text-motive-ink outline-none focus:border-motive-blue focus:ring-2 focus:ring-motive-blue/15"
                />
              </label>
              <label className="text-[11px] font-medium text-motive-muted">
                Start time
                <input
                  type="datetime-local"
                  value={startTimeFilter}
                  onChange={(event) => setStartTimeFilter(event.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-motive-line px-3 text-xs text-motive-ink outline-none focus:border-motive-blue focus:ring-2 focus:ring-motive-blue/15"
                />
              </label>
              <label className="text-[11px] font-medium text-motive-muted">
                End time
                <input
                  type="datetime-local"
                  value={endTimeFilter}
                  onChange={(event) => setEndTimeFilter(event.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-motive-line px-3 text-xs text-motive-ink outline-none focus:border-motive-blue focus:ring-2 focus:ring-motive-blue/15"
                />
              </label>
            </div>
            {completedTripsLoading ? (
              <p className="text-sm text-motive-muted">Loading completed trips…</p>
            ) : completedTripsError ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {completedTripsError}
              </p>
            ) : completedTrips.length === 0 ? (
              <p className="rounded-md border border-dashed border-motive-line bg-motive-surface px-3 py-5 text-center text-sm text-motive-muted">
                No completed trips found.
              </p>
            ) : filteredCompletedTrips.length === 0 ? (
              <p className="rounded-md border border-dashed border-motive-line bg-motive-surface px-3 py-5 text-center text-sm text-motive-muted">
                No trips match your search.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-motive-line overflow-y-auto rounded-md border border-motive-line">
                {filteredCompletedTrips.map((trip) => (
                  <button
                    key={trip.tripId}
                    type="button"
                    onClick={() => void handleCompletedTrip(trip)}
                    className={`flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-motive-surface ${
                      selectedTripId === trip.tripId ? "bg-blue-50" : "bg-white"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block min-w-0">
                        <span className="block truncate text-xs font-semibold text-motive-ink">
                        Trip: {trip.tripName || trip.tripId}
                        </span>
                      <span className="block truncate text-[11px] text-motive-muted">
                        Truck: {truckDisplayNameForId(trucks, trip.truckId)}
                      </span>
                      {tripTemperatureRange(trip) && (
                        <span className="block truncate text-[11px] text-motive-muted">
                          Temperature: {tripTemperatureRange(trip)}
                        </span>
                      )}
                      </span>
                      <span className="mt-0.5 block break-words text-[11px] text-motive-muted">
                        {tripPlaceNames[tripAddressKey(trip.tripId, "source")] ||
                          tripPlaceNameForHistory(trip, "source") ||
                          "Source"}
                      </span>
                      <span className="block break-words text-[11px] text-motive-muted">
                        →{" "}
                        {tripPlaceNames[tripAddressKey(trip.tripId, "destination")] ||
                          tripPlaceNameForHistory(trip, "destination") ||
                          "Destination"}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      COMPLETED
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
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
              const temperature = formatTemperature(
                record,
                tripTemperatureBounds(selectedTrip)
              );
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => onLocationSelect?.(record)}
                  className="flex items-start justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-motive-surface"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium tabular-nums text-motive-ink">
                      {formatTimestamp(record)}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] tabular-nums text-motive-muted">
                      {recordAddresses[index] || formatCoords(record)}
                    </p>
                  </div>
                  <span
                    className={
                      temperature.outOfRange
                        ? "inline-flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-red-600"
                        : "inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-emerald-700"
                    }
                  >
                    {temperature.outOfRange ? (
                      <AlertIcon className="h-3 w-3" />
                    ) : (
                      <ThermometerIcon className="h-3 w-3" />
                    )}
                    {temperature.text}
                  </span>
                </button>
              );
            })}
          </div>
            ) : (
          <p className="flex min-h-[160px] items-center justify-center rounded-md border border-dashed border-motive-line bg-motive-surface px-3 py-6 text-center text-sm text-motive-muted">
            {result
              ? `No locations found for trip ${result.tripId}.`
              : "Select a completed trip to view its locations."}
          </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
