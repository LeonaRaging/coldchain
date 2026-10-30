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
  RouteIcon,
  SnowflakeIcon,
} from "../../components/icons";
import { SearchPlace, TruckPath, type PlaceResult } from "./location";
import TripsPanel from "../trips/TripsPanel";
import { fetchTruckTrips, displayStatus, readStoredTrips, type Trip } from "../trips/api";

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

function completedTripIds(): Set<string> {
  return new Set(
    readStoredTrips()
      .filter((trip) => displayStatus(trip.status) === "COMPLETED")
      .map((trip) => trip.tripId)
  );
}

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
  const [tripRoute, setTripRoute] = useState<{
    tripId: string;
    truckId: string;
    points: [number, number][];
  } | null>(null);
  const [tripsOpen, setTripsOpen] = useState(false);
  const [truckTick, setTruckTick] = useState(0);
  const markersRef = useRef(new globalThis.Map<string, Marker>());
  const lastFittedRoute = useRef<{
    tripId: string;
    truckId: string;
    points: [number, number][];
  } | null>(null);
  const tripRouteRef = useRef<{
    tripId: string;
    truckId: string;
    points: [number, number][];
  } | null>(null);
  const ongoingTripsRef = useRef<Trip[]>([]);
  const routeCacheRef = useRef(new globalThis.Map<string, [number, number][]>());
  const routePendingRef = useRef(new Set<string>());
  const routeFailedRef = useRef(new Set<string>());

  function updateTripRoute(
    value: {
      tripId: string;
      truckId: string;
      points: [number, number][];
    } | null
  ) {
    tripRouteRef.current = value;
    setTripRoute(value);
  }

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

  useEffect(() => {
    const map = mapRef.current;

    if (!map) return;

    const clearRoute = () => {
      let currentStyle;
      try {
        currentStyle = map.getStyle();
      } catch {
        currentStyle = undefined;
      }
      if (!currentStyle) return;
      for (const layer of currentStyle.layers ?? []) {
        if (layer.id.startsWith("trip-route")) {
          map.removeLayer(layer.id);
        }
      }
      for (const sourceId of Object.keys(currentStyle.sources ?? {})) {
        if (sourceId.startsWith("trip-route")) {
          map.removeSource(sourceId);
        }
      }
    };

    const drawSplitRoute = (
      suffix: string,
      route: [number, number][],
      truckId: string,
      withDots: boolean
    ) => {
      const truckLngLat = markersRef.current.get(truckId)?.getLngLat();
      const truckPos = truckLngLat ? ([truckLngLat.lng, truckLngLat.lat] as [number, number]) : undefined;

      let splitIndex = -1;
      if (truckPos) {
        let best = Number.POSITIVE_INFINITY;
        for (let index = 0; index < route.length; index += 1) {
          const [lng, lat] = route[index];
          const distance = (lng - truckPos[0]) ** 2 + (lat - truckPos[1]) ** 2;
          if (distance < best) {
            best = distance;
            splitIndex = index;
          }
        }
      }

      const redRoute = truckPos ? [...route.slice(0, splitIndex + 1), truckPos] : [];
      const blueRoute = truckPos ? [truckPos, ...route.slice(splitIndex)] : route;
      const RED = "#b91c1c";
      const BLUE = "#005be2";

      const addLine = (id: string, color: string, coordinates: [number, number][]) => {
        map.addSource(id, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates },
          },
        });
        map.addLayer({
          id,
          type: "line",
          source: id,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": color,
            "line-width": 3.5,
            "line-blur": 0,
            "line-opacity": 0.9,
          },
        });
      };

      if (truckPos) {
        addLine(`trip-route-${suffix}-red`, RED, redRoute);
        addLine(`trip-route-${suffix}-blue`, BLUE, blueRoute);
      } else {
        addLine(`trip-route-${suffix}-blue`, BLUE, blueRoute);
      }

      if (withDots) {
        map.addSource(`trip-route-${suffix}-points`, {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
              { coordinates: route[0], color: truckPos ? RED : BLUE },
              { coordinates: route[route.length - 1], color: BLUE },
            ].map(({ coordinates, color }) => ({
              type: "Feature",
              properties: { color },
              geometry: { type: "Point", coordinates },
            })),
          },
        });
        map.addLayer({
          id: `trip-route-${suffix}-points`,
          type: "circle",
          source: `trip-route-${suffix}-points`,
          paint: {
            "circle-radius": 6,
            "circle-color": ["get", "color"],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });
      }
    };

    const completed = completedTripIds();
    const activeSelection =
      tripRoute && !completed.has(tripRoute.tripId) ? tripRoute : null;

    if (activeSelection) {
      drawSplitRoute(
        activeSelection.truckId,
        activeSelection.points,
        activeSelection.truckId,
        true
      );

      const bounds = new LngLatBounds(activeSelection.points[0], activeSelection.points[0]);
      for (const coordinates of activeSelection.points) {
        bounds.extend(coordinates);
      }
      if (lastFittedRoute.current !== activeSelection) {
        lastFittedRoute.current = activeSelection;
        map.fitBounds(bounds, { padding: 70, maxZoom: 12, duration: 600 });
      }
    } else {
      for (const trip of ongoingTripsRef.current) {
        if (completed.has(trip.tripId)) {
          continue;
        }
        const points = routeCacheRef.current.get(trip.tripId);
        if (points && points.length >= 2) {
          drawSplitRoute(trip.tripId, points, trip.truckId, false);
        }
      }
    }

    return clearRoute;
  }, [tripRoute, truckTick]);

  const [startResults, setStartResults] = useState<PlaceResult[]>([]);
  const [endResults, setEndResults] = useState<PlaceResult[]>([]);

  const [selectedSource, setSelectedSource] = useState<PlaceResult>();
  const [selectedDestination, setSelectedDestination] = useState<PlaceResult>();

  const [mapReady, setMapReady] = useState(false);
  const [demoError, setDemoError] = useState("");

  async function goToLogin() {
    stopDemo();
    try {
      await signOut();
    } catch (error) {
      console.error("Sign out failed:", error);
    }
    onSignedOut();
  }

  function showTrip(trip: Trip) {
    setTripsOpen(false);
    setDemoError("");

    void TruckPath(
      [trip.source.longitude, trip.source.latitude],
      [trip.destination.longitude, trip.destination.latitude]
    )
      .then((points) => {
        if (!points || points.length < 2) {
          updateTripRoute(null);
          setDemoError("No road route was returned for this trip.");
          return;
        }
        routeCacheRef.current.set(trip.tripId, points);
        updateTripRoute({ tripId: trip.tripId, truckId: trip.truckId, points });
      })
      .catch((error) => {
        updateTripRoute(null);
        setDemoError(
          error instanceof Error ? error.message : "No road route can be found for this trip."
        );
      });
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

    const markers = markersRef.current;
    let cancelled = false;
    const intervalId = setInterval(() => {
      void loadTrucks();
    }, 3000);
    let requestInProgress = false;

    const markerAnimations = new globalThis.Map<
      string,
      { frame: number }
    >();

    function stopMarkerAnimation(truckId: string) {
      const animation = markerAnimations.get(truckId);
      if (animation) {
        cancelAnimationFrame(animation.frame);
        markerAnimations.delete(truckId);
      }
    }

    function animateMarkerTo(
      marker: Marker,
      truckId: string,
      [lng, lat]: [number, number],
      durationMs = 1500
    ) {
      const current = marker.getLngLat();
      const fromLng = current.lng;
      const fromLat = current.lat;
      const delta = Math.abs(fromLng - lng) + Math.abs(fromLat - lat);

      if (delta < 1e-6) {
        marker.setLngLat([lng, lat]);
        return;
      }

      stopMarkerAnimation(truckId);
      const record = { frame: 0 };
      markerAnimations.set(truckId, record);

      const startedAt = performance.now();
      const step = (now: number) => {
        const progress = Math.min((now - startedAt) / durationMs, 1);
        const eased =
          progress < 0.5
            ? 2 * progress * progress
            : 1 - (-2 * progress + 2) ** 2 / 2;
        marker.setLngLat([
          fromLng + (lng - fromLng) * eased,
          fromLat + (lat - fromLat) * eased,
        ]);
        if (progress < 1) {
          record.frame = requestAnimationFrame(step);
        } else {
          markerAnimations.delete(truckId);
        }
      };
      record.frame = requestAnimationFrame(step);
    }

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

        const ongoingResults = await Promise.all(
          trucks.map(async (truck) => {
            try {
              const trips = await fetchTruckTrips(truck.truckId, "ONGOING");
              return { truckId: truck.truckId, trips, failed: false };
            } catch {
              return { truckId: truck.truckId, trips: [] as Trip[], failed: true };
            }
          })
        );
        if (cancelled) return;

        const completed = completedTripIds();
        const selected = tripRouteRef.current;
        const selectionDone = selected ? completed.has(selected.tripId) : false;
        const desired = new Set<string>();
        const ongoing: Trip[] = [];

        for (const { truckId: id, trips, failed } of ongoingResults) {
          for (const trip of trips) {
            if (completed.has(trip.tripId)) {
              routeCacheRef.current.delete(trip.tripId);
              continue;
            }
            ongoing.push(trip);
          }
          if (failed && !(selected && !selectionDone)) {
            desired.add(id);
          }
        }

        for (const trip of ongoing) {
          desired.add(trip.truckId);
        }

        if (selectionDone) {
          updateTripRoute(null);
        } else if (selected) {
          desired.clear();
          desired.add(selected.truckId);
        }

        for (const trip of ongoing) {
          if (
            routeCacheRef.current.has(trip.tripId) ||
            routePendingRef.current.has(trip.tripId) ||
            routeFailedRef.current.has(trip.tripId)
          ) {
            continue;
          }
          routePendingRef.current.add(trip.tripId);
          const { tripId, source: tripSource, destination: tripDestination } = trip;
          void TruckPath(
            [tripSource.longitude, tripSource.latitude],
            [tripDestination.longitude, tripDestination.latitude]
          )
            .then((points) => {
              if (points && points.length >= 2) {
                routeCacheRef.current.set(tripId, points);
              } else {
                routeFailedRef.current.add(tripId);
              }
              setTruckTick((tick) => tick + 1);
            })
            .catch(() => {
              routeFailedRef.current.add(tripId);
            })
            .finally(() => {
              routePendingRef.current.delete(tripId);
            });
        }

        ongoingTripsRef.current = ongoing;

        for (const truck of trucks) {
          const coordinates: [number, number] = [
            truck.longitude,
            truck.latitude,
          ];

          let marker = markers.get(truck.truckId);

          if (!desired.has(truck.truckId)) {
            stopMarkerAnimation(truck.truckId);
            marker?.remove();
            markers.delete(truck.truckId);
            continue;
          }

          if (marker) {
            animateMarkerTo(marker, truck.truckId, coordinates);

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

        if (!cancelled) {
          setTruckTick((tick) => tick + 1);
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

      for (const animation of markerAnimations.values()) {
        cancelAnimationFrame(animation.frame);
      }
      markerAnimations.clear();

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
            onClick={() => { setTab("map"); setTripsOpen(false); }}
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
            onClick={() => { setTab("history"); setTripsOpen(false); }}
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

      <div className="relative flex min-w-0 flex-1 flex-col">
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
                  ? tripRoute
                    ? "Route of the selected trip"
                    : "Live cold-chain tracking across your fleet"
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
            onClick={() => { setTab("map"); setTripsOpen(false); }}
            className={tabItemClass(tab === "map")}
          >
            Fleet View
          </button>
          <button
            type="button"
            onClick={() => { setTab("history"); setTripsOpen(false); }}
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
                      {tab === "map"
                        ? tripRoute
                          ? "Trip route"
                          : "Live fleet map"
                        : "Route map"}
                    </h2>
                    <p className="text-xs text-motive-muted">
                      {tab === "map"
                        ? tripRoute
                          ? "Route of the selected trip"
                          : "Vehicle positions refresh every 3 seconds"
                        : "Route for the queried truck"}
                    </p>
                  </div>
                  {tab === "map" && (
                    <button
                      type="button"
                      onClick={() => setTripsOpen((open) => !open)}
                      aria-pressed={tripsOpen}
                      className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors ${
                        tripsOpen
                          ? "border-transparent bg-motive-blue text-white hover:bg-motive-blue-dark"
                          : "border-motive-line bg-white text-motive-ink hover:bg-motive-surface"
                      }`}
                    >
                      <RouteIcon className="h-4 w-4" />
                      Trips
                    </button>
                  )}
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
                    setDemoError("");

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
                    )
                      .catch((error) => {
                        console.error("ROUTE ERROR:", error);
                        setDemoError(
                          error instanceof Error
                            ? error.message
                            : "Failed to create the demo route. Try different locations."
                        );
                      });
                  }}
                  error={demoError}
                />
              )}
            </div>

            <aside className={tab === "history" ? "min-w-0" : "hidden"}>
              <QueryHistory onResult={setHistory} />
            </aside>
          </div>

          {tripsOpen && tab === "map" && (
            <aside data-drawer="trips" className="absolute inset-y-0 left-0 z-30 flex w-[340px] flex-col border-r border-motive-line bg-white shadow-xl">
              <TripsPanel onShowTrip={showTrip} />
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
