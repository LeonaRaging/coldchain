type DemoJourneyProps = {
  source: string;
  destination: string;
  truckId: string;
  onSourceChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
  onTruckIdChange: (value: string) => void;
  onStart: () => void;
};

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
    <section
      style={{
        background: "#111827",
        color: "#f3f4f6",
        padding: "24px 28px 28px",
        borderTop: "1px solid #374151",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "22px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span
            style={{
              color: "#22d3ee",
              fontSize: "20px",
            }}
          >
            🚚
          </span>

          <span
            style={{
              fontSize: "17px",
              fontWeight: 600,
            }}
          >
            Demo journey
          </span>
        </div>

        <span
          style={{
            color: "#9ca3af",
            fontSize: "13px",
          }}
        >
          Simulated GPS · straight-line journey · 60 seconds
        </span>
      </div>

      {/* Form */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr auto",
          gap: "16px",
          alignItems: "end",
        }}
      >
        {/* Source */}
        <div>
          <label
            style={{
              display: "block",
              color: "#9ca3af",
              fontSize: "12px",
              marginBottom: "7px",
            }}
          >
            Source
          </label>

          <input
            value={source}
            onChange={(e) => onSourceChange(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 12px",
              background: "#1f2937",
              border: "1px solid #374151",
              borderRadius: "6px",
              color: "#f3f4f6",
              fontSize: "14px",
              outline: "none",
            }}
          />
        </div>

        {/* Destination */}
        <div>
          <label
            style={{
              display: "block",
              color: "#9ca3af",
              fontSize: "12px",
              marginBottom: "7px",
            }}
          >
            Destination
          </label>

          <input
            value={destination}
            onChange={(e) => onDestinationChange(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 12px",
              background: "#1f2937",
              border: "1px solid #374151",
              borderRadius: "6px",
              color: "#f3f4f6",
              fontSize: "14px",
              outline: "none",
            }}
          />
        </div>

        {/* Truck ID */}
        <div>
          <label
            style={{
              display: "block",
              color: "#9ca3af",
              fontSize: "12px",
              marginBottom: "7px",
            }}
          >
            Truck ID
          </label>

          <input
            value={truckId}
            onChange={(e) => onTruckIdChange(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 12px",
              background: "#1f2937",
              border: "1px solid #374151",
              borderRadius: "6px",
              color: "#f3f4f6",
              fontSize: "14px",
              outline: "none",
            }}
          />
        </div>

        {/* Button */}
        <button
          onClick={onStart}
          style={{
            height: "39px",
            padding: "0 20px",
            background: "#06b6d4",
            color: "#082f49",
            border: "none",
            borderRadius: "6px",
            fontSize: "14px",
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          ▶ Start demo
        </button>
      </div>
    </section>
  );
}