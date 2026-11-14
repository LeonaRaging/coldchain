import { useEffect, useState } from "react";
import {
  createTrip,
  fetchTrips,
  setTripStatus,
  type Trip,
} from "./api";
import { displayStatus, hasTripName, mergeTrips } from "./model";
import { readStoredTrips, setStoredTripStatus } from "./storage";
import PlaceAutocomplete from "./PlaceAutocomplete";
import type { PlaceResult } from "../fleet/location";
import { PlusIcon, RouteIcon } from "../../components/icons";
import { ReverseGeocodePlace } from "../fleet/location";
import type { UserTruck } from "../fleet/trucksApi";
import { truckDisplayName, truckDisplayNameForId } from "../fleet/trucksApi";

type TripsPanelProps = {
  onShowTrip: (trip: Trip) => void;
  mapPickTarget: "source" | "destination" | null;
  onStartMapPick: (target: "source" | "destination") => void;
  onRegisterMapPickHandler: (
    handler: ((target: "source" | "destination", place: PlaceResult) => void) | null
  ) => void;
  trucks: UserTruck[];
  onTripStatusChanged: (trip: Trip, status: "ONGOING" | "COMPLETED") => void;
};

type CreateState = {
  tripName: string;
  truckId: string;
  minTemp: string;
  maxTemp: string;
  source: string;
  destination: string;
  sourcePlace?: PlaceResult;
  destinationPlace?: PlaceResult;
};

const inputClass =
  "h-10 w-full rounded-md border border-motive-line bg-white px-3 text-sm text-motive-ink outline-none transition-shadow placeholder:text-gray-400 focus:border-motive-blue focus:ring-2 focus:ring-motive-blue/15";
const labelClass = "mb-1.5 block text-xs font-medium text-motive-muted";

const STATUS_STYLES: Record<string, string> = {
  PLANNED: "bg-amber-50 text-amber-700",
  ONGOING: "bg-blue-50 text-motive-blue",
  COMPLETED: "bg-emerald-50 text-emerald-700",
};

function activeTrips(items: Trip[]): Trip[] {
  return items.filter(
    (trip) => hasTripName(trip) && displayStatus(trip.status) !== "COMPLETED"
  );
}

function tripPlaceName(trip: Trip, names: string[]): string | undefined {
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

export default function TripsPanel({
  onShowTrip,
  mapPickTarget,
  onStartMapPick,
  onRegisterMapPickHandler,
  trucks,
  onTripStatusChanged,
}: TripsPanelProps) {
  const [trips, setTrips] = useState<Trip[]>(() => activeTrips(readStoredTrips()));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [statusError, setStatusError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [tripPlaceNames, setTripPlaceNames] = useState<Record<string, string>>({});
  const [form, setForm] = useState<CreateState>({
    tripName: "",
    truckId: "",
    minTemp: "",
    maxTemp: "",
    source: "",
    destination: "",
  });

  useEffect(() => {
    const controller = new AbortController();

    fetchTrips(controller.signal)
      .then((remoteTrips) => setTrips(mergeTrips(readStoredTrips(), remoteTrips)))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Could not load trips:", error);
        setTrips(activeTrips(readStoredTrips()));
        setLoadError(error instanceof Error ? error.message : "Could not load trips");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    onRegisterMapPickHandler((target, place) => {
      const update = (current: CreateState) =>
        target === "source"
          ? { ...current, source: place.Title, sourcePlace: place }
          : { ...current, destination: place.Title, destinationPlace: place };
      setForm(update);
    });
    return () => onRegisterMapPickHandler(null);
  }, [onRegisterMapPickHandler]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      trips.flatMap((trip) =>
        [
          ["source", trip.source],
          ["destination", trip.destination],
        ] as const
      ).map(async ([kind, point], index) => {
        try {
          const place = await ReverseGeocodePlace([point.longitude, point.latitude]);
          const key = `${trips[Math.floor(index / 2)]?.tripId}-${kind}`;
          return { key, ...place };
        } catch (error) {
          console.error("Could not resolve trip address:", error);
          return null;
        }
      })
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
  }, [trips]);

  function refresh() {
    setLoading(true);
    setLoadError("");
    setReloadKey((key) => key + 1);
  }

  function advanceTrip(trip: Trip, next: "ONGOING" | "COMPLETED") {
    if (
      next === "COMPLETED" &&
      !window.confirm(`Complete the trip for ${truckDisplayNameForId(trucks, trip.truckId)}?`)
    ) {
      return;
    }

    setStatusError("");
    const previousStatus = displayStatus(trip.status);
    setStoredTripStatus(trip.tripId, next);
    if (next === "COMPLETED") {
      setTrips((current) => current.filter((item) => item.tripId !== trip.tripId));
    } else {
      setTrips((current) =>
        current.map((item) =>
          item.tripId === trip.tripId ? { ...item, status: next } : item
        )
      );
    }
    void setTripStatus(trip.tripId, next)
      .then(() => onTripStatusChanged({ ...trip, status: next }, next))
      .catch((error: unknown) => {
        const message =
          error instanceof Error
            ? error.message
            : `Status change for ${trip.tripId} could not be sent to the API`;
        setStatusError(message);
        setStoredTripStatus(trip.tripId, previousStatus);
        setTrips((current) => {
          if (previousStatus === "COMPLETED") {
            return current;
          }
          const existing = current.find((item) => item.tripId === trip.tripId);
          if (existing) {
            return current.map((item) =>
              item.tripId === trip.tripId
                ? { ...item, status: previousStatus }
                : item
            );
          }
          return [...current, { ...trip, status: previousStatus }];
        });
      });
  }

  async function handleCreate() {    setCreateError("");

    const minTemp = Number(form.minTemp);
    const maxTemp = Number(form.maxTemp);
    if (
      !form.tripName.trim() ||
      !form.truckId ||
      !form.minTemp.trim() ||
      !form.maxTemp.trim() ||
      !Number.isFinite(minTemp) ||
      !Number.isFinite(maxTemp) ||
      !form.sourcePlace ||
      !form.destinationPlace
    ) {
      setCreateError(
        "Enter a trip name, temperature range, truck, source, and destination."
      );
      return;
    }
    if (minTemp > maxTemp) {
      setCreateError("Minimum temperature cannot be greater than maximum temperature.");
      return;
    }

    setCreating(true);
    try {
      await createTrip({
        tripName: form.tripName.trim(),
        truckId: form.truckId.trim(),
        minTemp,
        maxTemp,
        source: {
          latitude: form.sourcePlace.Position[1],
          longitude: form.sourcePlace.Position[0],
        },
        destination: {
          latitude: form.destinationPlace.Position[1],
          longitude: form.destinationPlace.Position[0],
        },
        sourceName: form.sourcePlace.Title,
        destinationName: form.destinationPlace.Title,
      });
      setForm({
        tripName: "",
        truckId: form.truckId,
        minTemp: "",
        maxTemp: "",
        source: "",
        destination: "",
      });
      setFormOpen(false);
      void refresh();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to create trip");
    } finally {
      setCreating(false);
    }
  }

  const canCreate =
    form.tripName.trim().length > 0 &&
    form.truckId.length > 0 &&
    form.minTemp.trim().length > 0 &&
    form.maxTemp.trim().length > 0 &&
    Number.isFinite(Number(form.minTemp)) &&
    Number.isFinite(Number(form.maxTemp)) &&
    Number(form.minTemp) <= Number(form.maxTemp) &&
    !!form.sourcePlace &&
    !!form.destinationPlace &&
    !creating;

  return (
    <div className="flex h-full min-w-0 flex-col bg-white">
      <div className="flex shrink-0 items-center justify-between border-b border-motive-line px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-motive-ink">
          <RouteIcon className="h-4 w-4 text-motive-muted" />
          Trips
        </h2>
        <button
          type="button"
          onClick={() => {
            setCreateError("");
            setFormOpen(true);
          }}
          title="New trip"
          disabled={creating}
          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-motive-line bg-white text-motive-blue transition-colors hover:bg-motive-surface disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {formOpen ? (
          <div className="flex flex-col gap-3 p-4">
            <p className="text-xs font-medium text-motive-muted">New trip</p>
            <div className="min-w-0">
              <label className={labelClass} htmlFor="trip-name">Trip name</label>
              <input
                id="trip-name"
                value={form.tripName}
                onChange={(event) => setForm((current) => ({ ...current, tripName: event.target.value }))}
                className={inputClass}
                placeholder="e.g. Morning delivery"
                autoFocus
              />
            </div>
            <div className="min-w-0">
              <label className={labelClass} htmlFor="trip-truck">
                Truck
              </label>
              <select
                id="trip-truck"
                value={form.truckId}
                onChange={(e) => setForm((c) => ({ ...c, truckId: e.target.value }))}
                className={inputClass}
              >
                <option value="">Select a truck</option>
                {trucks.map((truck) => (
                  <option key={truck.truckId} value={truck.truckId}>
                    {truckDisplayName(truck)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0">
                <label className={labelClass} htmlFor="trip-min-temp">
                  Minimum temperature
                </label>
                <input
                  id="trip-min-temp"
                  type="number"
                  value={form.minTemp}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, minTemp: event.target.value }))
                  }
                  className={inputClass}
                  placeholder="e.g. 2"
                  step="any"
                />
              </div>
              <div className="min-w-0">
                <label className={labelClass} htmlFor="trip-max-temp">
                  Maximum temperature
                </label>
                <input
                  id="trip-max-temp"
                  type="number"
                  value={form.maxTemp}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, maxTemp: event.target.value }))
                  }
                  className={inputClass}
                  placeholder="e.g. 8"
                  step="any"
                />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <PlaceAutocomplete
                  id="trip-source"
                  label="Source"
                  value={form.source}
                  onTextChange={(value) => setForm((c) => ({ ...c, source: value, sourcePlace: undefined }))}
                  onPick={(place) => setForm((c) => ({ ...c, source: place.Title, sourcePlace: place }))}
                />
              </div>
              <button
                type="button"
                onClick={() => onStartMapPick("source")}
                className={`h-10 shrink-0 rounded-md border px-2.5 text-xs font-medium ${
                  mapPickTarget === "source"
                    ? "border-motive-blue bg-motive-blue text-white"
                    : "border-motive-line bg-white text-motive-blue hover:bg-motive-surface"
                }`}
              >
                {mapPickTarget === "source" ? "Click map" : "Pick on map"}
              </button>
            </div>
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <PlaceAutocomplete
                  id="trip-destination"
                  label="Destination"
                  value={form.destination}
                  onTextChange={(value) =>
                    setForm((c) => ({ ...c, destination: value, destinationPlace: undefined }))
                  }
                  onPick={(place) =>
                    setForm((c) => ({ ...c, destination: place.Title, destinationPlace: place }))
                  }
                />
              </div>
              <button
                type="button"
                onClick={() => onStartMapPick("destination")}
                className={`h-10 shrink-0 rounded-md border px-2.5 text-xs font-medium ${
                  mapPickTarget === "destination"
                    ? "border-motive-blue bg-motive-blue text-white"
                    : "border-motive-line bg-white text-motive-blue hover:bg-motive-surface"
                }`}
              >
                {mapPickTarget === "destination" ? "Click map" : "Pick on map"}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={!canCreate}
                title={
                  canCreate
                    ? undefined
                    : "Pick a source and a destination from the search suggestions first"
                }
                className="h-10 cursor-pointer rounded-md border-none bg-motive-blue px-4 text-sm font-semibold text-white transition-colors hover:bg-motive-blue-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating ? "Creating…" : "Create trip"}
              </button>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="h-10 cursor-pointer rounded-md border border-motive-line bg-white px-4 text-sm font-medium text-motive-ink transition-colors hover:bg-motive-surface"
              >
                Cancel
              </button>
            </div>
            {createError ? (
              <p className="text-xs font-medium text-red-600">{createError}</p>
            ) : (
              !canCreate && (
                <p className="text-xs text-motive-muted">
                  Source and destination must be selected from the suggestions before creating.
                </p>
              )
            )}
          </div>
        ) : (
          <div className="flex flex-col">
            {loadError && (
              <div className="m-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <p>{loadError}</p>
                <button
                  type="button"
                  onClick={refresh}
                  className="mt-2 font-semibold underline underline-offset-2"
                >
                  Retry
                </button>
              </div>
            )}
            {statusError && (
              <div className="m-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {statusError}
              </div>
            )}
            {loading && trips.length === 0 && (
              <p className="px-4 py-6 text-center text-xs text-motive-muted">
                Loading trips…
              </p>
            )}
            {!loading && !loadError && trips.length === 0 && (
              <p className="px-4 py-6 text-center text-xs text-motive-muted">
                No trips yet — use the + button to plan one.
              </p>
            )}
            {trips.map((trip) => {
              const status = displayStatus(trip.status);
              const nextAction =
                status === "PLANNED"
                  ? "ONGOING"
                  : status === "ONGOING"
                    ? "COMPLETED"
                    : null;

              return (
                <div
                  key={trip.tripId}
                  className="flex items-center gap-3 border-b border-motive-line px-4 py-3 last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => onShowTrip(trip)}
                    className="min-w-0 flex-1 cursor-pointer text-left"
                  >
                    <span className="flex items-center gap-2">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-motive-ink">
                          {trip.tripName || trip.tripId}
                        </span>
                        {trip.tripName && (
                          <span className="block truncate text-[11px] text-motive-muted">
                            Truck: {truckDisplayNameForId(trucks, trip.truckId)}
                          </span>
                        )}
                        {tripTemperatureRange(trip) && (
                          <span className="block truncate text-[11px] text-motive-muted">
                            Temperature: {tripTemperatureRange(trip)}
                          </span>
                        )}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          STATUS_STYLES[status] || "bg-gray-100 text-motive-muted"
                        }`}
                      >
                        {status}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-start gap-1.5 text-xs text-motive-muted">
                      <RouteIcon className="h-3.5 w-3.5 shrink-0" />
                        <span className="flex min-w-0 flex-1 items-start gap-1">
                          <span className="min-w-0 flex-1">
                            <span className="block break-words">
                              {tripPlaceName(trip, [
                                "sourceName",
                                "source_name",
                                "originName",
                                "origin_name",
                              ]) ||
                                tripPlaceNames[`${trip.tripId}-source`] ||
                                "Source"}
                            </span>
                          </span>
                        <span aria-hidden="true">→</span>
                          <span className="min-w-0 flex-1">
                            <span className="block break-words">
                              {tripPlaceName(trip, ["destinationName", "destination_name"]) ||
                                tripPlaceNames[`${trip.tripId}-destination`] ||
                                "Destination"}
                            </span>
                          </span>
                      </span>
                    </span>
                  </button>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {nextAction && (
                      <button
                        type="button"
                        onClick={() => advanceTrip(trip, nextAction)}
                        className={`w-full cursor-pointer rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                          nextAction === "COMPLETED"
                            ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                            : "border-motive-blue bg-motive-blue text-white hover:bg-motive-blue-dark"
                        }`}
                      >
                        {nextAction === "ONGOING" ? "Start trip" : "Complete"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onShowTrip(trip)}
                      className="w-full cursor-pointer rounded-md bg-motive-blue px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-motive-blue-dark"
                    >
                      View path
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
