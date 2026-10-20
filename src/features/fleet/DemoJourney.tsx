type DemoJourneyProps = {
  source: string;
  destination: string;
  truckId: string;
  onSourceChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
  onTruckIdChange: (value: string) => void;
  onStart: () => void;
};

const labelClass = "mb-[7px] block text-xs text-[#9ca3af]";
const inputClass =
  "box-border w-full rounded-md border border-[#374151] bg-[#1f2937] px-3 py-2.5 text-sm text-[#f3f4f6] outline-none";

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
    <section className="border-t border-[#374151] bg-[#111827] px-7 pb-7 pt-6 text-[#f3f4f6]">
      {/* Header */}
      <div className="mb-[22px] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-xl text-[#22d3ee]">🚚</span>
          <span className="text-[17px] font-semibold">Demo journey</span>
        </div>

        <span className="text-[13px] text-[#9ca3af]">
          Simulated GPS · straight-line journey · 60 seconds
        </span>
      </div>

      {/* Form */}
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-4">
        {/* Source */}
        <div>
          <label className={labelClass}>Source</label>
          <input
            value={source}
            onChange={(e) => onSourceChange(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Destination */}
        <div>
          <label className={labelClass}>Destination</label>
          <input
            value={destination}
            onChange={(e) => onDestinationChange(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Truck ID */}
        <div>
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
          className="h-[39px] cursor-pointer whitespace-nowrap rounded-md border-none bg-[#06b6d4] px-5 text-sm font-bold text-[#082f49]"
        >
          ▶ Start demo
        </button>
      </div>
    </section>
  );
}
