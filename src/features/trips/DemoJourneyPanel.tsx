import { useEffect, useState } from "react";
import { subscribeDemoStatus } from "../fleet/TruckDemo";
import type { Trip } from "./model";
import type { UserTruck } from "../fleet/trucksApi";
import { truckDisplayName, truckDisplayNameForId } from "../fleet/trucksApi";
import { oneTripPerTruck } from "./model";

export type DemoTruck = {
  truckId: string;
  longitude: number;
  latitude: number;
  sampleTime: string;
  temperature?: number | string;
};

type DemoJourneyPanelProps = {
  trucks: DemoTruck[];
  ownedTrucks: UserTruck[];
  trips: Trip[];
  onDemoTrip: (
    currentLocation: [number, number],
    source: [number, number],
    destination: [number, number],
    truckId: string,
    simulateTemperatureExcursion: boolean,
    minimumTemperature: number,
    maximumTemperature: number
  ) => Promise<void>;
  onStopDemo: (truckId?: string) => void;
};

type DemoForm = {
  truckId: string;
  simulateTemperatureExcursion: boolean;
};

const inputClass =
  "h-10 w-full rounded-md border border-motive-line bg-white px-3 text-sm text-motive-ink outline-none transition-shadow placeholder:text-gray-400 focus:border-motive-blue focus:ring-2 focus:ring-motive-blue/15";
const labelClass = "mb-1.5 block text-xs font-medium text-motive-muted";

export default function DemoJourneyPanel({
  trucks,
  ownedTrucks,
  trips,
  onDemoTrip,
  onStopDemo,
}: DemoJourneyPanelProps) {
  const [demoError, setDemoError] = useState("");
  const [demoTruckIds, setDemoTruckIds] = useState<Set<string>>(new Set());
  const [demoForm, setDemoForm] = useState<DemoForm>({
    truckId: ownedTrucks[0]?.truckId ?? "",
    simulateTemperatureExcursion: false,
  });
  const effectiveTruckId = ownedTrucks.some((truck) => truck.truckId === demoForm.truckId)
    ? demoForm.truckId
    : ownedTrucks[0]?.truckId ?? "";
  const selectedTruck = trucks.find((truck) => truck.truckId === effectiveTruckId);
  const truckTrips = oneTripPerTruck(
    trips.filter((trip) => trip.truckId === effectiveTruckId)
  );
  const selectedTrip = truckTrips[0];
  const minimumTemperature = Number(
    selectedTrip?.minTemperature ??
      selectedTrip?.minTemp ??
      selectedTrip?.min_temperature ??
      selectedTrip?.min_temp
  );
  const maximumTemperature = Number(
    selectedTrip?.maxTemperature ??
      selectedTrip?.maxTemp ??
      selectedTrip?.max_temperature ??
      selectedTrip?.max_temp
  );
  const demoStartLocation = selectedTruck
    ? ([selectedTruck.longitude, selectedTruck.latitude] as [number, number])
    : selectedTrip
      ? ([selectedTrip.source.longitude, selectedTrip.source.latitude] as [number, number])
      : undefined;

  useEffect(
    () =>
      subscribeDemoStatus((running, truckId) => {
        setDemoTruckIds((current) => {
          const next = new Set(current);
          if (running) next.add(truckId);
          else next.delete(truckId);
          return next;
        });
      }),
    []
  );

  async function handleDemo() {
    setDemoError("");
    if (!demoStartLocation || !selectedTrip) {
      setDemoError("Select a truck and trip.");
      return;
    }
    if (!Number.isFinite(minimumTemperature) || !Number.isFinite(maximumTemperature)) {
      setDemoError("The selected trip does not have a valid temperature range.");
      return;
    }
    try {
      await onDemoTrip(
        demoStartLocation,
        [selectedTrip.source.longitude, selectedTrip.source.latitude],
        [selectedTrip.destination.longitude, selectedTrip.destination.latitude],
        effectiveTruckId,
        demoForm.simulateTemperatureExcursion,
        minimumTemperature,
        maximumTemperature
      );
    } catch (error) {
      setDemoError(error instanceof Error ? error.message : "Could not start demo journey");
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="text-xs text-motive-muted">
        Choose a current truck and trip. The truck will travel to the trip start,
        then continue to its destination.
      </p>
      <label className="flex items-start gap-2 text-xs text-motive-muted">
        <input
          type="checkbox"
          checked={demoForm.simulateTemperatureExcursion}
          onChange={(event) =>
            setDemoForm((current) => ({
              ...current,
              simulateTemperatureExcursion: event.target.checked,
            }))
          }
          className="mt-0.5 h-4 w-4 accent-motive-blue"
        />
        <span>
          Randomly simulate an out-of-range temperature interval
        </span>
      </label>
      <div>
        <label className={labelClass} htmlFor="demo-truck-id">Truck</label>
        <select
          id="demo-truck-id"
          value={effectiveTruckId}
          onChange={(event) =>
            setDemoForm((current) => ({
              ...current,
              truckId: event.target.value,
            }))
          }
          className={inputClass}
        >
          <option value="">Select your truck</option>
          {ownedTrucks.map((truck) => (
            <option key={truck.truckId} value={truck.truckId}>
              {truckDisplayName(truck)}{!trucks.some((item) => item.truckId === truck.truckId) ? " (starts at source)" : ""}
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs text-motive-muted">
        Source:{" "}
        {selectedTruck
          ? `${selectedTruck.latitude.toFixed(5)}, ${selectedTruck.longitude.toFixed(5)}`
          : selectedTrip
            ? "Trip source (no live position)"
            : "Select a truck"}
      </p>
      {selectedTrip ? (
        <div className="text-xs text-motive-muted">
          <p className="text-sm font-medium text-motive-ink">
            Trip: {selectedTrip.tripName || selectedTrip.tripId}
          </p>
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-motive-line bg-motive-surface px-3 py-2.5 text-xs text-motive-muted">
          No currently ongoing trip for this truck.
        </p>
      )}
      <button
        type="button"
        onClick={() => void handleDemo()}
        disabled={
          !effectiveTruckId ||
          !selectedTrip ||
          !effectiveTruckId.trim()
        }
        className="h-10 rounded-md bg-motive-blue px-4 text-sm font-semibold text-white disabled:opacity-50"
      >
        Start demo
      </button>
      {demoError && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {demoError}
        </p>
      )}
      {demoTruckIds.size > 0 && (
        <div className="border-t border-motive-line pt-3">
          <p className="mb-2 text-xs font-semibold text-motive-muted">Running demos</p>
          {[...demoTruckIds].map((truckId) => (
            <button
              key={truckId}
              type="button"
              onClick={() => onStopDemo(truckId)}
              className="mr-2 mb-2 rounded-md border border-red-200 px-2.5 py-1.5 text-xs text-red-700"
            >
              Stop {truckDisplayNameForId(ownedTrucks, truckId)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
