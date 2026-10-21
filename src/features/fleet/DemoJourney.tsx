import type { PlaceResult } from "./location";
import { useState } from "react";

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
};

const labelClass = "mb-2 block text-xs text-gray-400";
const inputClass =
  "box-border w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-gray-100 outline-none";

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
}: DemoJourneyProps) {
  const [sourceOpen, setSourceOpen] = useState(false);
  const [destinationOpen, setDestinationOpen] = useState(false);

  return (
    <section className="border-t border-gray-700 bg-gray-900 px-7 pb-7 pt-6 text-gray-100">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-xl text-cyan-400">🚚</span>
          <span className="text-lg font-semibold">Demo journey</span>
        </div>

        <span className="text-sm text-gray-400">
          Simulated GPS · straight-line journey · 60 seconds
        </span>
      </div>

      {/* Form */}
      <div className="flex items-end gap-4">
        {/* Source */}
        <div className="relative min-w-0 flex-1">
          <label className={labelClass}>Source</label>
          <input
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
            autoComplete="off"
            className={inputClass}
          />
          {sourceOpen && sourceResults.length > 0 && (
            <PlaceDropdown
              places={sourceResults}
              onSelect={(place) => {
                onSourceSelect(place);
                setSourceOpen(false);
              }}
            />
          )}
        </div>

        {/* Destination */}
        <div className="relative min-w-0 flex-1">
          <label className={labelClass}>Destination</label>
          <input
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
            autoComplete="off"
            className={inputClass}
          />
          {destinationOpen && destinationResults.length > 0 && (
            <PlaceDropdown
              places={destinationResults}
              onSelect={(place) => {
                onDestinationSelect(place);
                setDestinationOpen(false);
              }}
            />
          )}
        </div>

        {/* Truck ID */}
        <div className="min-w-0 flex-1">
          <label className={labelClass}>Truck ID</label>
          <input
            value={truckId}
            onChange={(e) => onTruckIdChange(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Button */}
        <button
          type="button"
          onClick={onStart}
          disabled={!selectedSource || !selectedDestination}
          className="h-10 whitespace-nowrap rounded-md border-none bg-cyan-500 px-5 text-sm font-bold text-cyan-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ▶ Start demo
        </button>
      </div>
    </section>
  );
}

function PlaceDropdown({
  places,
  onSelect,
}: {
  places: PlaceResult[];
  onSelect: (place: PlaceResult) => void;
}) {
  return (
    <div
      role="listbox"
      className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-gray-600 bg-gray-800 p-1 shadow-xl"
    >
      {places.map((place) => (
        <button
          key={`${place.Title}-${place.Position.join(",")}`}
          type="button"
          role="option"
          onClick={() => onSelect(place)}
          className="block w-full rounded px-2 py-2 text-left text-sm text-gray-100 hover:bg-gray-700"
        >
          {place.Title}
        </button>
      ))}
    </div>
  );
}