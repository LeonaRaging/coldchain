import { useState } from "react";
import {
  createTrip,
  displayStatus,
  readStoredTrips,
  setStoredTripStatus,
  setTripStatus,
  type Trip,
} from "./api";
import PlaceAutocomplete from "./PlaceAutocomplete";
import type { PlaceResult } from "../fleet/location";
import { PlusIcon, RouteIcon } from "../../components/icons";

type TripsPanelProps = {
  onShowTrip: (trip: Trip) => void;
};

type CreateState = {
  truckId: string;
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

export default function TripsPanel({ onShowTrip }: TripsPanelProps) {
  const [trips, setTrips] = useState<Trip[]>(() => readStoredTrips().filter(
    (trip) => displayStatus(trip.status) !== "COMPLETED"
  ));
  const [formOpen, setFormOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [form, setForm] = useState<CreateState>({
    truckId: "DEMO-001",
    source: "",
    destination: "",
  });

  function refresh() {
    setTrips(
      readStoredTrips().filter((trip) => displayStatus(trip.status) !== "COMPLETED")
    );
  }

  function advanceTrip(trip: Trip, next: "ONGOING" | "COMPLETED") {
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
    void setTripStatus(trip.tripId, next).catch(() => {
      console.warn(`Status change for ${trip.tripId} could not be sent to the API`);
    });
  }

  async function handleCreate() {    setCreateError("");

    if (!form.sourcePlace || !form.destinationPlace) {
      setCreateError("Select both a source and a destination from the suggestions.");
      return;
    }

    setCreating(true);
    try {
      await createTrip({
        truckId: form.truckId.trim(),
        source: {
          latitude: form.sourcePlace.Position[1],
          longitude: form.sourcePlace.Position[0],
        },
        destination: {
          latitude: form.destinationPlace.Position[1],
          longitude: form.destinationPlace.Position[0],
        },
      });
      setForm({ truckId: form.truckId, source: "", destination: "" });
      setFormOpen(false);
      refresh();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to create trip");
    } finally {
      setCreating(false);
    }
  }

  const canCreate =
    form.truckId.trim().length > 0 && !!form.sourcePlace && !!form.destinationPlace && !creating;

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
              <label className={labelClass} htmlFor="trip-truck">
                Truck ID
              </label>
              <input
                id="trip-truck"
                value={form.truckId}
                onChange={(e) => setForm((c) => ({ ...c, truckId: e.target.value }))}
                className={inputClass}
              />
            </div>
            <PlaceAutocomplete
              id="trip-source"
              label="Source"
              value={form.source}
              onTextChange={(value) => setForm((c) => ({ ...c, source: value, sourcePlace: undefined }))}
              onPick={(place) => setForm((c) => ({ ...c, source: place.Title, sourcePlace: place }))}
            />
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
            {trips.length === 0 && (
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
                      <span className="truncate text-sm font-medium text-motive-ink">
                        {trip.truckId}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          STATUS_STYLES[status] || "bg-gray-100 text-motive-muted"
                        }`}
                      >
                        {status}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-motive-muted">
                      <RouteIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {trip.source.latitude.toFixed(3)}, {trip.source.longitude.toFixed(3)} →{" "}
                        {trip.destination.latitude.toFixed(3)}, {trip.destination.longitude.toFixed(3)}
                      </span>
                    </span>
                  </button>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {nextAction && (
                      <button
                        type="button"
                        onClick={() => advanceTrip(trip, nextAction)}
                        className="w-full cursor-pointer rounded-md border border-motive-line bg-white px-2.5 py-1.5 text-xs font-medium text-motive-blue transition-colors hover:bg-motive-blue/5"
                      >
                        {nextAction === "ONGOING" ? "Start trip" : "Complete"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onShowTrip(trip)}
                      className="cursor-pointer text-xs font-medium text-motive-blue underline-offset-2 transition-colors hover:underline"
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
