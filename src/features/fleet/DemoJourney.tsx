import { useState } from "react";
import type { PlaceResult } from "./location";
import { PlayIcon } from "../../components/icons";

type DemoJourneyProps = {
  source: string;
  destination: string;
  truckId: string;
  sourceResults: PlaceResult[];
  destinationResults: PlaceResult[];
  selectedSource: PlaceResult | undefined;
  selectedDestination: PlaceResult | undefined;
  onSourceSelect: (place: PlaceResult) => void;
  onDestinationSelect: (place: PlaceResult) => void;
  onSourceChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
  onTruckIdChange: (value: string) => void;
  onStart: () => void;
  error?: string;
};

const labelClass = "mb-1.5 block text-xs font-medium text-motive-muted";
const inputClass =
  "h-10 w-full rounded-md border border-motive-line bg-white px-3 text-sm text-motive-ink outline-none transition-shadow placeholder:text-gray-400 focus:border-motive-blue focus:ring-2 focus:ring-motive-blue/15";

export default function DemoJourney({
  source,
  destination,
  truckId,
  sourceResults,
  destinationResults,
  selectedSource,
  selectedDestination,
  onSourceChange,
  onDestinationChange,
  onSourceSelect,
  onDestinationSelect,
  onTruckIdChange,
  onStart,
  error,
}: DemoJourneyProps) {
  const [sourceOpen, setSourceOpen] = useState(false);
  const [destinationOpen, setDestinationOpen] = useState(false);

  return (
    <section className="rounded-xl border border-motive-line bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-motive-ink">Demo journey</h2>
          <p className="text-xs text-motive-muted">
            Simulated GPS · straight-line journey · 60 seconds
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto] xl:items-end">
        <div className="relative min-w-0">
          <label className={labelClass} htmlFor="demo-source">
            Source
          </label>
          <input
            id="demo-source"
            value={source}
            onChange={(event) => {
              onSourceChange(event.target.value);
              setSourceOpen(true);
            }}
            onFocus={() => {
              if (sourceResults.length > 0) {
                setSourceOpen(true);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setSourceOpen(false);
              }
            }}
            onBlur={() => {
              window.setTimeout(() => setSourceOpen(false), 120);
            }}
            role="combobox"
            aria-expanded={sourceOpen && sourceResults.length > 0}
            aria-controls="demo-source-listbox"
            autoComplete="off"
            className={inputClass}
          />
          {sourceOpen && sourceResults.length > 0 && (
            <PlaceDropdown
              id="demo-source-listbox"
              places={sourceResults}
              onSelect={(place) => {
                onSourceSelect(place);
                setSourceOpen(false);
              }}
            />
          )}
        </div>

        <div className="relative min-w-0">
          <label className={labelClass} htmlFor="demo-destination">
            Destination
          </label>
          <input
            id="demo-destination"
            value={destination}
            onChange={(event) => {
              onDestinationChange(event.target.value);
              setDestinationOpen(true);
            }}
            onFocus={() => {
              if (destinationResults.length > 0) {
                setDestinationOpen(true);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setDestinationOpen(false);
              }
            }}
            onBlur={() => {
              window.setTimeout(() => setDestinationOpen(false), 120);
            }}
            role="combobox"
            aria-expanded={destinationOpen && destinationResults.length > 0}
            aria-controls="demo-destination-listbox"
            autoComplete="off"
            className={inputClass}
          />
          {destinationOpen && destinationResults.length > 0 && (
            <PlaceDropdown
              id="demo-destination-listbox"
              places={destinationResults}
              onSelect={(place) => {
                onDestinationSelect(place);
                setDestinationOpen(false);
              }}
            />
          )}
        </div>

        <div className="min-w-0">
          <label className={labelClass} htmlFor="demo-truck">
            Truck ID
          </label>
          <input
            id="demo-truck"
            value={truckId}
            onChange={(e) => onTruckIdChange(e.target.value)}
            className={inputClass}
          />
        </div>

        <button
          type="button"
          onClick={onStart}
          disabled={!selectedSource || !selectedDestination}
          className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border-none bg-motive-blue px-5 text-sm font-semibold text-white transition-colors hover:bg-motive-blue-dark disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2 xl:col-span-1"
        >
          <PlayIcon className="h-4 w-4" />
          Start demo
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}

function PlaceDropdown({
  id,
  places,
  onSelect,
}: {
  id: string;
  places: PlaceResult[];
  onSelect: (place: PlaceResult) => void;
}) {
  const labeled = places.filter((place) => place.Title.trim().length > 0);

  return (
    <div
      id={id}
      role="listbox"
      className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-motive-line bg-white p-1 shadow-lg"
    >
      {labeled.map((place) => (
        <button
          key={`${place.Title}-${place.Position.join(",")}`}
          type="button"
          role="option"
          onMouseDown={(event) => {
            event.preventDefault();
            onSelect(place);
          }}
          className="block w-full rounded px-2 py-2 text-left text-sm text-motive-ink hover:bg-motive-surface"
        >
          {place.Title}
        </button>
      ))}
    </div>
  );
}