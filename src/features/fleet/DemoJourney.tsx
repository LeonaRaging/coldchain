import { PlayIcon } from "../../components/icons";

type DemoJourneyProps = {
  source: string;
  destination: string;
  truckId: string;
  onSourceChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
  onTruckIdChange: (value: string) => void;
  onStart: () => void;
};

const labelClass = "mb-1.5 block text-xs font-medium text-motive-muted";
const inputClass =
  "h-10 w-full rounded-md border border-motive-line bg-white px-3 text-sm text-motive-ink outline-none transition-shadow placeholder:text-gray-400 focus:border-motive-blue focus:ring-2 focus:ring-motive-blue/15";

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
        <div className="min-w-0">
          <label className={labelClass} htmlFor="demo-source">
            Source
          </label>
          <input
            id="demo-source"
            value={source}
            onChange={(e) => onSourceChange(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="min-w-0">
          <label className={labelClass} htmlFor="demo-destination">
            Destination
          </label>
          <input
            id="demo-destination"
            value={destination}
            onChange={(e) => onDestinationChange(e.target.value)}
            className={inputClass}
          />
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
          className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border-none bg-motive-blue px-5 text-sm font-semibold text-white transition-colors hover:bg-motive-blue-dark sm:col-span-2 xl:col-span-1"
        >
          <PlayIcon className="h-4 w-4" />
          Start demo
        </button>
      </div>
    </section>
  );
}
