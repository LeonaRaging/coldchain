type DemoJourneyProps = {
  source: string;
  destination: string;
  truckId: string;
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
  onSourceChange,
  onDestinationChange,
  onTruckIdChange,
  onStart,
}: DemoJourneyProps) {
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
        <div className="min-w-0 flex-1">
          <label className={labelClass}>Source</label>
          <input
            value={source}
            onChange={(e) => onSourceChange(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Destination */}
        <div className="min-w-0 flex-1">
          <label className={labelClass}>Destination</label>
          <input
            value={destination}
            onChange={(e) => onDestinationChange(e.target.value)}
            className={inputClass}
          />
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
          onClick={onStart}
          className="h-10 cursor-pointer whitespace-nowrap rounded-md border-none bg-cyan-500 px-5 text-sm font-bold text-cyan-950"
        >
          ▶ Start demo
        </button>
      </div>
    </section>
  );
}
