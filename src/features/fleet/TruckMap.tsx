import { useEffect, useRef, useState } from "react";
import { LngLatBounds, Map, Marker, NavigationControl, Popup, setWorkerUrl } from "maplibre-gl";
import { fetchAuthSession, getCurrentUser, signOut } from "aws-amplify/auth";
import "maplibre-gl/dist/maplibre-gl.css";
import { startDemo, stopDemo } from "./TruckDemo";
import DemoJourney from "./DemoJourney";
import QueryHistory from "../history/QueryHistory";
import type { HistoryResult } from "../history/api";
import {
  ClockIcon,
  LogOutIcon,
  MapIcon,
  SnowflakeIcon,
} from "../../components/icons";
import { SearchPlace, type PlaceResult } from "./location";

const apiKey = import.meta.env.VITE_LOCATION_API_KEY;
const region = import.meta.env.VITE_AWS_REGION;
const mapName = import.meta.env.VITE_LOCATION_MAP_NAME;
const truckApiUrl = import.meta.env.VITE_TRUCKS_API_URL;

setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());

type Truck = {
  truckId: string;
  longitude: number;
  latitude: number;
  sampleTime: string;
};

type TruckMapProps = {
  onSignedOut: () => void;
};

type DashboardTab = "map" | "history";

const tabItemClass = (active: boolean) =>
  `-mb-px cursor-pointer border-b-2 pb-3.5 pt-3.5 text-sm font-medium transition-colors ${
    active
      ? "border-motive-blue text-motive-blue"
      : "border-transparent text-motive-muted hover:text-motive-ink"
  }`;

function supportsWebGL2(): boolean {
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
}

export default function TruckMap({ onSignedOut }: TruckMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);

  const [source, setSource] = useState("Hanoi");
  const [destination, setDestination] = useState("Ho Chi Minh City");
  const [truckId, setTruckId] = useState("DEMO-001");
  const [mapError, setMapError] = useState(() =>
    supportsWebGL2()
      ? ""
      : "The live map needs WebGL2, which is not available in this browser."
  );
  const [username, setUsername] = useState("");
  const [tab, setTab] = useState<DashboardTab>("map");
  const [history, setHistory] = useState<HistoryResult | null>(null);

  useEffect(() => {
    getCurrentUser()
      .then((user) => setUsername(user.username))
      .catch(() => {});
  }, []);

  useEffect(() => {
    mapRef.current?.resize();
  }, [tab]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) return;

    const clearRoute = () => {
      for (const layerId of ["history-route-line", "history-route-points"]) {
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId);
        }
      }
      for (const sourceId of ["history-route-line", "history-route-points"]) {
        if (map.getSource(sourceId)) {
          map.removeSource(sourceId);
        }
      }
    };

    const points = (history?.records ?? [])
      .filter((record) => record.latitude && record.longitude)
      .map(
        (record) =>
          [Number(record.longitude), Number(record.latitude)] as [number, number]
      )
      .filter(
        ([lng, lat]) =>
          Number.isFinite(lat) &&
          Number.isFinite(lng) &&
          Math.abs(lat) <= 90 &&
          Math.abs(lng) <= 180
      );

    if (tab !== "history" || points.length === 0 || !map.isStyleLoaded()) {
      clearRoute();
      return;
    }

    const route = [...points].reverse();

    map.addSource("history-route-line", {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: route },
      },
    });

    map.addSource("history-route-points", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: route.map((coordinates) => ({
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates },
        })),
      },
    });

    map.addLayer({
      id: "history-route-line",
      type: "line",
      source: "history-route-line",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": "#005be2", "line-width": 3 },
    });

    map.addLayer({
      id: "history-route-points",
      type: "circle",
      source: "history-route-points",
      paint: {
        "circle-radius": 4.5,
        "circle-color": "#005be2",
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#ffffff",
      },
    });

    const bounds = new LngLatBounds(route[0], route[0]);
    for (const coordinates of route) {
      bounds.extend(coordinates);
    }
    map.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 500 });

    return clearRoute;
  }, [history, tab]);

  const [startResults, setStartResults] = useState<PlaceResult[]>([]);
  const [endResults, setEndResults] = useState<PlaceResult[]>([]);

  const [selectedSource, setSelectedSource] = useState<PlaceResult>();
  const [selectedDestination, setSelectedDestination] = useState<PlaceResult>();

  const [mapReady, setMapReady] = useState(false);

  async function goToLogin() {
    stopDemo();

    try {
      await signOut();
    } catch (error) {
      console.error("Sign out failed:", error);
    }
    onSignedOut();
  }

  useEffect(() => {
    if (!containerRef.current || !supportsWebGL2()) return;

    let map: Map;

    try {
      map = new Map({
        container: containerRef.current,
        style: `https://maps.geo.${region}.amazonaws.com/maps/v0/maps/${mapName}/style-descriptor?key=${apiKey}`,
        center: [105.8342, 21.0278],
        zoom: 11,
      });
    } catch (error) {
      console.error("Map initialization failed:", error);
      queueMicrotask(() =>
        setMapError("The live map could not start in this browser.")
      );
      return;
    }

    mapRef.current = map;
    queueMicrotask(() => setMapReady(true));

    map.addControl(new NavigationControl(), "top-right");

    const markers = new globalThis.Map<string, Marker>();
    let cancelled = false;
    const intervalId = setInterval(() => {
      void loadTrucks();
    }, 3000);
    let requestInProgress = false;

    async function loadTrucks() {
      if (cancelled || requestInProgress) return;
      requestInProgress = true;

      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();

        if (!idToken) {
          throw new Error("No Cognito ID token found");
        }

        const response = await fetch(truckApiUrl, {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Truck API returned ${response.status}`);
        }

        const trucks: Truck[] = await response.json();
        if (cancelled) return;

        const currentTruckIds = new Set<string>();

        for (const truck of trucks) {
          currentTruckIds.add(truck.truckId);

          const coordinates: [number, number] = [
            truck.longitude,
            truck.latitude,
          ];

          let marker = markers.get(truck.truckId);

          if (marker) {
            marker.setLngLat(coordinates);

            marker.setPopup(
              new Popup().setText(
                `${truck.truckId}\n${new Date(
                  truck.sampleTime
                ).toLocaleString()}`
              )
            );
          } else {
            marker = new Marker({ color: "#d64545" })
              .setLngLat(coordinates)
              .setPopup(
                new Popup().setText(
                  `${truck.truckId}\n${new Date(
                    truck.sampleTime
                  ).toLocaleString()}`
                )
              )
              .addTo(map);

            markers.set(truck.truckId, marker);
          }
        }

        for (const [truckId, marker] of markers) {
          if (!currentTruckIds.has(truckId)) {
            marker.remove();
            markers.delete(truckId);
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Could not load truck locations:", error);
        }
      } finally {
        requestInProgress = false;
      }
    }

    map.on("error", (event) => {
      console.error("Map error:", event.error);
    });

    void loadTrucks();

    return () => {
      cancelled = true;

      stopDemo();
      clearInterval(intervalId);

      for (const marker of markers.values()) {
        marker.remove();
      }

      markers.clear();
      map.remove();
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    if (selectedSource && selectedSource.Title === source) {
      return;
    }
    if (!source.trim()) {
      return;
    }
    const center = mapRef.current.getCenter();
    const mapCenter: [number, number] = [
      center.lng,
      center.lat,
    ];
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const results = await SearchPlace(source.trim(), mapCenter);
        if (!cancelled) {
          setStartResults(results);
        }
      } catch (error) {
        console.error("Could not load source places:", error);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [source, selectedSource, mapReady]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    if (selectedDestination && selectedDestination.Title === destination) {
      return;
    }
    if (!destination.trim()) {
      return;
    }

    const center = mapRef.current.getCenter();
    const mapCenter: [number, number] = [
      center.lng,
      center.lat,
    ];
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const results = await SearchPlace(destination.trim(), mapCenter);
        if (!cancelled) {
          setEndResults(results);
        }
      } catch (error) {
        console.error("Could not load destination places:", error);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [destination, selectedDestination, mapReady]);

  return (
    <div className="flex min-h-svh bg-motive-surface text-left text-motive-ink">
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col bg-motive-sidebar md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <SnowflakeIcon className="h-6 w-6 text-white" />
          <span className="text-[22px] font-semibold tracking-tight text-white">coldchain</span>
        </div>

        <nav className="mt-2 flex flex-col gap-0.5 px-2">
          <button
            type="button"
            onClick={() => setTab("map")}
            className={`flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
              tab === "map"
                ? "bg-white/10 text-white"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <MapIcon className="h-5 w-5" />
            Fleet View
          </button>
          <button
            type="button"
            onClick={() => setTab("history")}
            className={`flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
              tab === "history"
                ? "bg-white/10 text-white"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <ClockIcon className="h-5 w-5" />
            Route history
          </button>
        </nav>

        <div className="mt-auto px-3 pb-4">
          <div className="flex items-center gap-2 rounded-md px-2 py-2">
            <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-motive-blue text-[11px] font-semibold text-white">
              {username ? (
                username.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "CC"
              ) : (
                <SnowflakeIcon className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {username || "Fleet manager"}
              </p>
              <p className="truncate text-xs text-gray-400">ColdChain</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-motive-line bg-white px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-motive-sidebar text-white md:hidden">
              <SnowflakeIcon className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-motive-ink">
                {tab === "map" ? "Fleet View" : "Route history"}
              </h1>
              <p className="mt-0.5 hidden text-xs text-motive-muted sm:block">
                {tab === "map"
                  ? "Live cold-chain tracking across your fleet"
                  : "Past trips from the Athena data lake"}
              </p>
            </div>
          </div>

          <div className="flex items-center">
            <button
              type="button"
              onClick={goToLogin}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-motive-line bg-white px-3.5 text-sm font-medium text-motive-ink transition-colors hover:bg-motive-surface"
            >
              <LogOutIcon className="h-4 w-4 text-motive-muted" />
              Sign out
            </button>
          </div>
        </header>

        <div className="flex items-center gap-6 border-b border-motive-line bg-white px-4 md:hidden">
          <button
            type="button"
            onClick={() => setTab("map")}
            className={tabItemClass(tab === "map")}
          >
            Fleet View
          </button>
          <button
            type="button"
            onClick={() => setTab("history")}
            className={tabItemClass(tab === "history")}
          >
            Route history
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
          <div
            className={`grid gap-4 ${
              tab === "history" ? "xl:grid-cols-[minmax(0,1fr)_380px]" : ""
            }`}
          >
            <div className="flex min-w-0 flex-col gap-4">
              <section className="overflow-hidden rounded-xl border border-motive-line bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-motive-line px-4 py-3">
                  <div>
                    <h2 className="text-sm font-semibold text-motive-ink">
                      {tab === "map" ? "Live fleet map" : "Route map"}
                    </h2>
                    <p className="text-xs text-motive-muted">
                      {tab === "map"
                        ? "Vehicle positions refresh every 3 seconds"
                        : "Route for the queried truck"}
                    </p>
                  </div>
                </div>
                <div className="relative">
                  <div ref={containerRef} className="h-[420px] w-full sm:h-[560px] xl:h-[640px]" />
                  {mapError && (
                    <div className="absolute inset-0 grid place-items-center bg-motive-surface p-6">
                      <div className="max-w-xs text-center">
                        <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-white text-motive-muted shadow-sm">
                          <MapIcon className="h-5 w-5" />
                        </span>
                        <p className="mt-3 text-sm font-medium text-motive-ink">Map unavailable</p>
                        <p className="mt-1 text-xs text-motive-muted">{mapError}</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {tab === "map" && (
                <DemoJourney
                  source={source}
                  destination={destination}
                  truckId={truckId}
                  sourceResults={startResults}
                  destinationResults={endResults}
                  selectedSource={selectedSource}
                  selectedDestination={selectedDestination}
                  onSourceSelect={(place) => {
                    setSource(place.Title);
                    setSelectedSource(place);
                    setStartResults([]);
                  }}
                  onDestinationSelect={(place) => {
                    setDestination(place.Title);
                    setSelectedDestination(place);
                    setEndResults([]);
                  }}
                  onSourceChange={(value) => {
                    setSource(value);
                    setSelectedSource(undefined);
                    setStartResults([]);
                  }}
                  onDestinationChange={(value) => {
                    setDestination(value);
                    setSelectedDestination(undefined);
                    setEndResults([]);
                  }}
                  onTruckIdChange={setTruckId}
                  onStart={() => {
                    if (!selectedSource || !selectedDestination) {
                      return;
                    }

                    if (!mapRef.current) {
                      setMapError("The live map must be available before starting a demo journey.");
                      return;
                    }

                    startDemo(
                      selectedSource.Position,
                      selectedDestination.Position,
                      truckId
                    ).catch((error) => {
                      console.error("ROUTE ERROR:", error);
                    });
                  }}
                />
              )}
            </div>

            <aside className={tab === "history" ? "min-w-0" : "hidden"}>
              <QueryHistory onResult={setHistory} />
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
