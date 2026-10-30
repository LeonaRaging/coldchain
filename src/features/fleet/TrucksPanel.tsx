import { useState } from "react";
import { truckDisplayLabel, type UserTruck } from "./trucksApi";

type TrucksPanelProps = {
  trucks: UserTruck[];
  onCreateTruck: (truckName: string, truckId: string) => Promise<void>;
  onDeleteTruck: (truckId: string) => Promise<void>;
};

const inputClass =
  "h-10 w-full rounded-md border border-motive-line bg-white px-3 text-sm text-motive-ink outline-none transition-shadow placeholder:text-gray-400 focus:border-motive-blue focus:ring-2 focus:ring-motive-blue/15";
const labelClass = "mb-1.5 block text-xs font-medium text-motive-muted";

function latestTemperature(truck: UserTruck): string {
  const temperature = truck.temperature;
  const value = Number(temperature);
  return Number.isFinite(value) ? `${value}°C` : "Unavailable";
}

export default function TrucksPanel({
  trucks,
  onCreateTruck,
  onDeleteTruck,
}: TrucksPanelProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [truckName, setTruckName] = useState("");
  const [truckId, setTruckId] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingTruckId, setDeletingTruckId] = useState("");

  async function handleCreate() {
    setError("");
    setCreating(true);
    try {
      await onCreateTruck(truckName, truckId);
      setTruckName("");
      setTruckId("");
      setModalOpen(false);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Failed to create truck");
    } finally {
      setCreating(false);
    }

  }

  async function handleDelete(truck: UserTruck) {
    if (!window.confirm(`Delete ${truckDisplayLabel(truck)}?`)) return;
    setError("");
    setDeletingTruckId(truck.truckId);
    try {
      await onDeleteTruck(truck.truckId);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Failed to delete truck");
    } finally {
      setDeletingTruckId("");
    }
  }

  return (
    <div className="flex h-full min-w-0 flex-col bg-white">
      <div className="flex shrink-0 items-center justify-between border-b border-motive-line px-4 py-3">
        <h2 className="text-sm font-semibold text-motive-ink">My trucks</h2>
        <button
          type="button"
          onClick={() => {
            setError("");
            setModalOpen(true);
          }}
          className="h-8 rounded-md bg-motive-blue px-3 text-xs font-semibold text-white hover:bg-motive-blue-dark"
        >
          Create truck
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {trucks.length === 0 ? (
          <p className="text-xs text-motive-muted">You have no trucks yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {trucks.map((truck) => (
              <div
                key={truck.truckId}
                className="flex items-center justify-between gap-3 rounded-md border border-motive-line px-3 py-2 text-sm text-motive-ink"
              >
                <div className="min-w-0 flex-1">
                  <p className="break-words font-medium">{truckDisplayLabel(truck)}</p>
                  <p className="mt-0.5 text-xs text-motive-muted">
                    Temperature: {latestTemperature(truck)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(truck)}
                  disabled={Boolean(deletingTruckId) || creating}
                  className="shrink-0 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  {deletingTruckId === truck.truckId ? "Deleting…" : "Delete"}
                </button>
              </div>
            ))}
          </div>
        )}
        {error && !modalOpen && (
          <p className="mt-3 text-xs font-medium text-red-600">{error}</p>
        )}
      </div>
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !creating) setModalOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-truck-title"
            className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
          >
            <h3 id="create-truck-title" className="text-sm font-semibold text-motive-ink">
              Create truck
            </h3>
            <p className="mt-1 text-xs text-motive-muted">
              Add a truck by entering its name and ID.
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <div>
                <label className={labelClass} htmlFor="truck-name">Truck name</label>
                <input
                  id="truck-name"
                  value={truckName}
                  onChange={(event) => setTruckName(event.target.value)}
                  className={inputClass}
                  autoFocus
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="truck-id">Truck ID</label>
                <input
                  id="truck-id"
                  value={truckId}
                  onChange={(event) => setTruckId(event.target.value)}
                  className={inputClass}
                />
              </div>
              {error && <p className="text-xs font-medium text-red-600">{error}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={creating}
                  className="h-10 rounded-md border border-motive-line bg-white px-4 text-sm font-medium text-motive-ink disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleCreate()}
                  disabled={!truckName.trim() || !truckId.trim() || creating}
                  className="h-10 rounded-md bg-motive-blue px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {creating ? "Creating…" : "Create truck"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
