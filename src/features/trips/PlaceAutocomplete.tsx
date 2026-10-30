import { useEffect, useState } from "react";
import { SearchPlace, type PlaceResult } from "../fleet/location";

const defaultCenter: [number, number] = [105.8342, 21.0278];

type PlaceAutocompleteProps = {
  id: string;
  label: string;
  value: string;
  onPick: (place: PlaceResult) => void;
  onTextChange: (value: string) => void;
};

export default function PlaceAutocomplete({
  id,
  label,
  value,
  onPick,
  onTextChange,
}: PlaceAutocompleteProps) {
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<PlaceResult>();
  const [biasPosition, setBiasPosition] = useState<[number, number]>(defaultCenter);

  const dropdownId = `${id}-listbox`;

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setBiasPosition([position.coords.longitude, position.coords.latitude]);
      },
      () => {},
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 5000 }
    );
  }, []);

  useEffect(() => {
    if (picked && picked.Title === value) return;
    const query = value.trim();
    if (query.length < 2) {
      const clearTimer = window.setTimeout(() => setResults([]), 0);
      return () => window.clearTimeout(clearTimer);
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      SearchPlace(query, biasPosition)
        .then((places) => {
          if (!cancelled) setResults(places);
        })
        .catch((error) =>
          console.error(`Could not load ${label.toLowerCase()} places:`, error)
        );
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, picked, label, biasPosition]);

  return (
    <div className="relative min-w-0">
      <label className="mb-1.5 block text-xs font-medium text-motive-muted" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => {
          onTextChange(event.target.value);
          setPicked(undefined);
          setOpen(true);
        }}
        placeholder="Search a place"
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
        }}
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={dropdownId}
        autoComplete="off"
        className="h-10 w-full rounded-md border border-motive-line bg-white px-3 text-sm text-motive-ink outline-none transition-shadow placeholder:text-gray-400 focus:border-motive-blue focus:ring-2 focus:ring-motive-blue/15"
      />
      {open && results.length > 0 && (
        <PlaceDropdown
          id={dropdownId}
          places={results}
          onSelect={(place) => {
            onPick(place);
            setPicked(place);
            setResults([]);
            setOpen(false);
          }}
        />
      )}
    </div>
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
          <span className="block truncate">{place.Title}</span>
          {place.Subtitle && place.Subtitle !== place.Title && (
            <span className="mt-0.5 block truncate text-xs text-motive-muted">
              {place.Subtitle}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
