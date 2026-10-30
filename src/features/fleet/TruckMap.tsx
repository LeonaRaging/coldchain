import { useEffect, useRef, useState } from "react";
import {
  LngLatBounds,
  Map,
  Marker,
  NavigationControl,
  Popup,
  setWorkerUrl,
} from "maplibre-gl";
import type { MapLayerMouseEvent } from "maplibre-gl";
import { fetchAuthSession, getCurrentUser, signOut } from "aws-amplify/auth";
import "maplibre-gl/dist/maplibre-gl.css";
import { startDemo, stopDemo } from "./TruckDemo";
import QueryHistory from "../history/QueryHistory";
import type { HistoryResult } from "../history/api";
import {
  ClockIcon,
  AlertIcon,
  LogOutIcon,
  MapIcon,
  RouteIcon,
  SnowflakeIcon,
} from "../../components/icons";
import {
  ReverseGeocode,
  SearchPlace,
  TruckPath,
  type PlaceResult,
} from "./location";
import {
  createTruck,
  deleteTruck,
  fetchUserTrucks,
  type UserTruck,
} from "./trucksApi";
import TripsPanel from "../trips/TripsPanel";
import DemoJourneyPanel, { type DemoTruck } from "../trips/DemoJourneyPanel";
import TrucksPanel from "./TrucksPanel";
import { truckDisplayNameForId } from "./trucksApi";
import {
  fetchCompletedTrips,
  fetchTruckTrips,
  displayStatus,
  hasTripName,
  oneTripPerTruck,
  readStoredTrips,
  type Trip,
} from "../trips/api";

const apiKey = import.meta.env.VITE_LOCATION_API_KEY;
const region = import.meta.env.VITE_AWS_REGION;
const mapName = import.meta.env.VITE_LOCATION_MAP_NAME;
const truckApiUrl = import.meta.env.VITE_TRUCKS_API_URL;

setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());

type TruckMapProps = {
  onSignedOut: () => void;
};

type DashboardTab = "map" | "history";
type MapPickTarget = "source" | "destination";
type RoutePoints = [number, number][];
type CachedTripRoute = {
  destination: RoutePoints;
  approach?: RoutePoints;
  approachStart?: [number, number];
};

function completedTripIds(): Set<string> {
  return new Set(
    readStoredTrips()
    .filter((trip) => hasTripName(trip) && displayStatus(trip.status) === "COMPLETED")
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

type TemperatureAlert = {
  truckId: string;
  tripId: string;
  truckName: string;
  temperature: number;
  minimum: number;
  maximum: number;
};

function tripTemperatureBounds(trip: Trip): [number, number] | null {
  const minimum = Number(
    trip.minTemperature ??
      trip.minTemp ??
      trip.min_temperature ??
      trip.min_temp ??
      trip.minimumTemperature ??
      trip.minimum_temperature
  );
  const maximum = Number(
    trip.maxTemperature ??
      trip.maxTemp ??
      trip.max_temperature ??
      trip.max_temp ??
      trip.maximumTemperature ??
      trip.maximum_temperature
  );
  return Number.isFinite(minimum) && Number.isFinite(maximum)
    ? [minimum, maximum]
    : null;
}

function createTruckMarkerElement(truckName: string): HTMLDivElement {
  const element = document.createElement("div");
  element.className = "relative flex flex-col items-center";

  const label = document.createElement("span");
  label.dataset.truckLabel = "true";
  label.textContent = truckName;
  label.style.display = "block";
  label.style.marginBottom = "3px";
  label.style.borderRadius = "4px";
  label.style.background = "#101828";
  label.style.color = "#ffffff";
  label.style.fontSize = "11px";
  label.style.fontWeight = "600";
  label.style.lineHeight = "1";
  label.style.padding = "4px 6px";
  label.style.whiteSpace = "nowrap";
  label.style.boxShadow = "0 1px 3px rgb(16 24 40 / 25%)";

  const dot = document.createElement("span");
  dot.style.display = "block";
  dot.style.width = "14px";
  dot.style.height = "14px";
  dot.style.borderRadius = "9999px";
  dot.style.border = "2px solid #ffffff";
  dot.style.background = "#d64545";
  dot.style.boxShadow = "0 1px 3px rgb(16 24 40 / 35%)";

  element.append(label, dot);
  return element;
}



export default function TruckMap({ onSignedOut }: TruckMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);

  const [mapError, setMapError] = useState(() =>
    supportsWebGL2()
      ? ""
      : "The live map needs WebGL2, which is not available in this browser."
  );
  const [username, setUsername] = useState("");
  const [tab, setTab] = useState<DashboardTab>("map");
  const tabRef = useRef<DashboardTab>("map");
  const [history, setHistory] = useState<HistoryResult | null>(null);
  const [historyLocation, setHistoryLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [historyLocationName, setHistoryLocationName] = useState("");
  const [completedTrips, setCompletedTrips] = useState<Trip[]>(() =>
    readStoredTrips().filter((trip) => displayStatus(trip.status) === "COMPLETED")
  );
  const [completedTripsLoading, setCompletedTripsLoading] = useState(false);
  const [completedTripsError, setCompletedTripsError] = useState("");
  const [tripRoute, setTripRoute] = useState<{
    tripId: string;
    truckId: string;
    points: [number, number][];
  } | null>(null);
  const [drawers, setDrawers] = useState({ trips: false, demo: false, trucks: false });
  const [mapPickTarget, setMapPickTarget] = useState<MapPickTarget | null>(null);
  const tripMapPickHandlerRef = useRef<
    ((target: MapPickTarget, place: PlaceResult) => void) | null
  >(null);
  const activeMapPickHandlerRef = useRef<
    ((target: MapPickTarget, place: PlaceResult) => void) | null
  >(null);
  const mapPickMarkerRef = useRef<Marker | null>(null);
  const historyLocationMarkerRef = useRef<Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [locationResults, setLocationResults] = useState<PlaceResult[]>([]);
  const [locationSearchLoading, setLocationSearchLoading] = useState(false);
  const [locationSearchError, setLocationSearchError] = useState("");
  const locationSearchRequestRef = useRef(0);
  const [truckTick, setTruckTick] = useState(0);
  const [trucks, setTrucks] = useState<DemoTruck[]>([]);
  const [ownedTrucks, setOwnedTrucks] = useState<UserTruck[]>([]);
  const ownedTrucksRef = useRef<UserTruck[]>([]);
  const [ongoingTrips, setOngoingTrips] = useState<Trip[]>([]);
  const [temperatureAlerts, setTemperatureAlerts] = useState<TemperatureAlert[]>([]);
  const notifiedTemperatureExcursionsRef = useRef(new Set<string>());
  const [demoTrips, setDemoTrips] = useState<Trip[]>([]);
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
  const routeCacheRef = useRef(new globalThis.Map<string, CachedTripRoute>());
  const routePendingRef = useRef(new Set<string>());
  const routeRetryAtRef = useRef(new globalThis.Map<string, number>());
  const approachPendingRef = useRef(new Set<string>());
  const approachRetryAtRef = useRef(new globalThis.Map<string, number>());
  const startedTripsRef = useRef(new Set<string>());
  const routeSelectionRequestRef = useRef(0);
  const activeTripIdsRef = useRef(new Set<string>());
  const deletedTruckIdsRef = useRef(new Set<string>());

  useEffect(() => {
    const alerts: TemperatureAlert[] = [];
    const activeExcursions = new Set<string>();

    for (const trip of ongoingTrips) {
      const bounds = tripTemperatureBounds(trip);
      const truck = ownedTrucks.find((item) => item.truckId === trip.truckId);
      const temperature = Number(truck?.temperature);
      if (!bounds || !Number.isFinite(temperature)) continue;
      const [minimum, maximum] = bounds;
      if (temperature >= minimum && temperature <= maximum) continue;

      const excursionKey = `${trip.truckId}:${trip.tripId}`;
      activeExcursions.add(excursionKey);
      alerts.push({
        truckId: trip.truckId,
        tripId: trip.tripId,
        truckName: truckDisplayNameForId(ownedTrucks, trip.truckId),
        temperature,
        minimum,
        maximum,
      });

      if (notifiedTemperatureExcursionsRef.current.has(excursionKey)) continue;
      notifiedTemperatureExcursionsRef.current.add(excursionKey);
      if (typeof Notification === "undefined" || Notification.permission === "denied") {
        continue;
      }
      const notify = Notification.permission === "granted"
        ? Promise.resolve("granted" as NotificationPermission)
        : Notification.requestPermission();
      void notify.then((permission) => {
        if (permission === "granted") {
          new Notification(`${truckDisplayNameForId(ownedTrucks, trip.truckId)} temperature alert`, {
            body: `${temperature}°C is outside the trip range of ${minimum}°C to ${maximum}°C.`,
          });
        }
      }).catch((error: unknown) => {
        console.error("Could not show temperature notification:", error);
      });
    }

    for (const excursionKey of notifiedTemperatureExcursionsRef.current) {
      if (!activeExcursions.has(excursionKey)) {
        notifiedTemperatureExcursionsRef.current.delete(excursionKey);
      }
    }
    setTemperatureAlerts(alerts);
  }, [ongoingTrips, ownedTrucks]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    async function loadOwnedTrucks() {
      try {
        const trucks = await fetchUserTrucks(controller.signal);
        if (active) setOwnedTrucks(trucks);
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Could not load your trucks:", error);
      }
    }
    void loadOwnedTrucks();
    const intervalId = window.setInterval(() => {
      void loadOwnedTrucks();
    }, 3000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    ownedTrucksRef.current = ownedTrucks;
  }, [ownedTrucks]);

  useEffect(() => {
    for (const [truckId, marker] of markersRef.current) {
      const truckName = truckDisplayNameForId(ownedTrucks, truckId);
      const label = marker
        .getElement()
        .querySelector<HTMLElement>("[data-truck-label='true']");
      if (label) {
        label.textContent = truckName;
      }
    }
  }, [ownedTrucks]);

  useEffect(() => {
    if (ownedTrucks.length === 0) {
      setDemoTrips([]);
      return;
    }

    const ownedTruckIds = new Set(ownedTrucks.map((truck) => truck.truckId));
    const storedTrips = readStoredTrips().filter(
      (trip) =>
        ownedTruckIds.has(trip.truckId) &&
        hasTripName(trip) &&
        displayStatus(trip.status) === "ONGOING"
    );
    setDemoTrips(oneTripPerTruck(storedTrips));

    const controller = new AbortController();
    let active = true;

    async function loadOngoingTrips() {
      try {
        const tripsByTruck = await Promise.all(
          ownedTrucks.map((truck) =>
            fetchTruckTrips(truck.truckId, "ONGOING", controller.signal)
          )
        );
        if (!active) return;
        setDemoTrips(
          oneTripPerTruck(
            tripsByTruck
              .flat()
              .filter(
                (trip) =>
                  ownedTruckIds.has(trip.truckId) && hasTripName(trip)
              )
          )
        );
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Could not load trips for your trucks:", error);
      }
    }

    void loadOngoingTrips();
    const intervalId = window.setInterval(() => {
      void loadOngoingTrips();
    }, 5000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      controller.abort();
    };
  }, [ownedTrucks]);

  async function handleCreateTruck(truckName: string, truckId: string) {
    const truck = await createTruck(truckName, truckId);
    deletedTruckIdsRef.current.delete(truck.truckId);
    setOwnedTrucks((current) =>
      current.some((item) => item.truckId === truck.truckId)
        ? current
        : [...current, truck]
    );
  }

  async function handleDeleteTruck(truckId: string) {
    await deleteTruck(truckId);
    deletedTruckIdsRef.current.add(truckId);
    setOwnedTrucks((current) => current.filter((truck) => truck.truckId !== truckId));
    const marker = markersRef.current.get(truckId);
    marker?.remove();
    markersRef.current.delete(truckId);
    if (tripRouteRef.current?.truckId === truckId) {
      updateTripRoute(null);
    }
    setDemoTrips((current) => current.filter((trip) => trip.truckId !== truckId));
  }

  function handleTripStatusChanged(trip: Trip, status: "ONGOING" | "COMPLETED") {
    setDemoTrips((current) => {
      if (status === "COMPLETED") {
        return current.filter((item) => item.tripId !== trip.tripId);
      }
      return oneTripPerTruck([
        ...current.filter((item) => item.truckId !== trip.truckId),
        trip,
      ]);
    });
  }

  useEffect(() => {
    tabRef.current = tab;
    if (tab !== "map") {
      for (const marker of markersRef.current.values()) {
        marker.remove();
      }
      markersRef.current.clear();
    }
  }, [tab]);

  function updateTripRoute(
    value: {
      tripId: string;
      truckId: string;
      points: [number, number][];
    } | null
  ) {
    if (!value) {
      routeSelectionRequestRef.current += 1;
    }
    tripRouteRef.current = value;
    setTripRoute(value);
  }

  useEffect(() => {
    getCurrentUser()
      .then((user) => setUsername(user.username))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (tab !== "history") return;

    const controller = new AbortController();
    setCompletedTripsLoading(true);
    setCompletedTripsError("");

    fetchCompletedTrips(controller.signal)
      .then((trips) => {
        const byId = new globalThis.Map(
          readStoredTrips()
          .filter((trip) => hasTripName(trip) && displayStatus(trip.status) === "COMPLETED")
            .map((trip) => [trip.tripId, trip])
        );
        for (const trip of trips.filter(hasTripName)) {
          const stored = byId.get(trip.tripId);
          byId.set(
            trip.tripId,
            stored && !trip.tripName ? { ...stored, ...trip, tripName: stored.tripName } : trip
          );
        }
        setCompletedTrips([...byId.values()]);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Could not load completed trips:", error);
        setCompletedTripsError(
          error instanceof Error ? error.message : "Could not load completed trips"
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setCompletedTripsLoading(false);
      });

    return () => controller.abort();
  }, [tab]);

  useEffect(() => {
    mapRef.current?.resize();
  }, [tab]);

  useEffect(() => {
    const query = locationSearch.trim();
    if (query.length < 2) {
      setLocationResults([]);
      setLocationSearchLoading(false);
      setLocationSearchError("");
      return;
    }

    const requestId = ++locationSearchRequestRef.current;
    const timer = window.setTimeout(() => {
      const map = mapRef.current;
      if (!map) return;
      const center = map.getCenter();
      setLocationSearchLoading(true);
      setLocationSearchError("");
      void SearchPlace(query, [center.lng, center.lat])
        .then((results) => {
          if (requestId === locationSearchRequestRef.current) {
            setLocationResults(results);
          }
        })
        .catch((error: unknown) => {
          if (requestId === locationSearchRequestRef.current) {
            setLocationResults([]);
            setLocationSearchError(
              error instanceof Error ? error.message : "Could not search locations"
            );
          }
        })
        .finally(() => {
          if (requestId === locationSearchRequestRef.current) {
            setLocationSearchLoading(false);
          }
        });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [locationSearch]);

  function selectLocation(place: PlaceResult) {
    const map = mapRef.current;
    if (!map) return;
    setLocationSearch(place.Title);
    setLocationResults([]);
    map.flyTo({ center: place.Position, zoom: 14, duration: 800 });
  }

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapPickTarget) return;

    const handleMapPick = (event: { lngLat: { lng: number; lat: number } }) => {
      const { lng, lat } = event.lngLat;
      setMapPickTarget(null);
      const target = mapPickTarget;
      mapPickMarkerRef.current?.remove();
      mapPickMarkerRef.current = new Marker({ color: "#005be2" })
        .setLngLat([lng, lat])
        .addTo(map);

      void ReverseGeocode([lng, lat])
        .catch((error: unknown) => {
          console.error("Could not resolve picked location address:", error);
          return undefined;
        })
        .then((address) => {
          const place: PlaceResult = {
            Title: address || `Pinned location (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
            Position: [lng, lat],
          };
          if (target === "source" || target === "destination") {
            activeMapPickHandlerRef.current?.(target, place);
          }
        });
    };

    map.getCanvas().style.cursor = "crosshair";
    map.on("click", handleMapPick);

    return () => {
      map.off("click", handleMapPick);
      map.getCanvas().style.cursor = "";
    };
  }, [mapPickTarget, mapReady]);

  useEffect(() => {
    if (mapPickTarget || !mapPickMarkerRef.current) return;
    const marker = mapPickMarkerRef.current;
    const timer = window.setTimeout(() => {
      marker.remove();
      if (mapPickMarkerRef.current === marker) {
        mapPickMarkerRef.current = null;
      }
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [mapPickTarget]);

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

    const handleHistoryPointClick = (event: MapLayerMouseEvent) => {
      const geometry = event.features?.[0]?.geometry;
      if (!geometry || geometry.type !== "Point") return;
      const [longitude, latitude] = geometry.coordinates;
      if (
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        Math.abs(latitude) <= 90 &&
        Math.abs(longitude) <= 180
      ) {
        setHistoryLocation({ latitude, longitude });
      }
    };
    map.on("click", "history-route-points", handleHistoryPointClick);
    map.getCanvas().style.cursor = "pointer";

    const bounds = new LngLatBounds(route[0], route[0]);
    for (const coordinates of route) {
      bounds.extend(coordinates);
    }
    map.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 500 });

    return () => {
      map.off("click", "history-route-points", handleHistoryPointClick);
      map.getCanvas().style.cursor = "";
      clearRoute();
    };
  }, [history, mapReady, tab]);

  useEffect(() => {
    const map = mapRef.current;
    historyLocationMarkerRef.current?.remove();
    historyLocationMarkerRef.current = null;

    if (!map || tab !== "history" || !historyLocation) return;

    historyLocationMarkerRef.current = new Marker({ color: "#d64545" })
      .setLngLat([historyLocation.longitude, historyLocation.latitude])
      .setPopup(
        new Popup().setText(
          [
            historyLocationName || "Selected location",
            `${historyLocation.latitude.toFixed(5)}, ${historyLocation.longitude.toFixed(5)}`,
          ].join("\n")
        )
      )
      .addTo(map);
    historyLocationMarkerRef.current.togglePopup();

    return () => {
      historyLocationMarkerRef.current?.remove();
      historyLocationMarkerRef.current = null;
    };
  }, [historyLocation, historyLocationName, mapReady, tab]);

  useEffect(() => {
    if (!historyLocation) {
      setHistoryLocationName("");
      return;
    }

    let cancelled = false;
    setHistoryLocationName("");
    void ReverseGeocode([historyLocation.longitude, historyLocation.latitude])
      .then((name) => {
        if (!cancelled) setHistoryLocationName(name ?? "");
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.error("Could not resolve history location address:", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [historyLocation]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) return;

    const removeRoute = (suffix: string) => {
      let currentStyle;
      try {
        currentStyle = map.getStyle();
      } catch {
        currentStyle = undefined;
      }
      if (!currentStyle) return;
      for (const layer of currentStyle.layers ?? []) {
        if (layer.id.startsWith(`trip-route-${suffix}-`)) {
          map.removeLayer(layer.id);
        }
      }
      for (const sourceId of Object.keys(currentStyle.sources ?? {})) {
        if (sourceId.startsWith(`trip-route-${suffix}-`)) {
          map.removeSource(sourceId);
        }
      }
    };

    const setGeoJsonData = (id: string, data: object) => {
      const source = map.getSource(id);
      if (source && "setData" in source && typeof source.setData === "function") {
        source.setData(data);
        return true;
      }
      return false;
    };

    const drawSplitRoute = (
      suffix: string,
      destinationRoute: RoutePoints,
      approachRoute: RoutePoints | undefined,
      withDots: boolean,
      hasReachedSource: boolean
    ) => {
      const source = destinationRoute[0];
      const truckLngLat = markersRef.current.get(suffix)?.getLngLat();
      const truckPosition = truckLngLat
        ? ([truckLngLat.lng, truckLngLat.lat] as [number, number])
        : undefined;
      const GREEN = "#16a34a";
      const RED = "#b91c1c";
      const BLUE = "#005be2";

      const addLine = (id: string, color: string, coordinates: [number, number][]) => {
        const data = {
          type: "Feature" as const,
          properties: {},
          geometry: { type: "LineString" as const, coordinates },
        };
        if (!setGeoJsonData(id, data)) {
          map.addSource(id, { type: "geojson", data });
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
        }
      };

      const removeLine = (id: string) => {
        if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(id)) map.removeSource(id);
      };

      let traveledRoute: RoutePoints | undefined;
      let remainingRoute = destinationRoute;
      const beforeSource = !hasReachedSource;

      if (truckPosition) {
        let nearestIndex = -1;
        let nearestDistance = Number.POSITIVE_INFINITY;
        for (let index = 0; index < destinationRoute.length; index += 1) {
          const [lng, lat] = destinationRoute[index];
          const distance =
            (lng - truckPosition[0]) ** 2 + (lat - truckPosition[1]) ** 2;
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = index;
          }
        }

        if (!beforeSource && nearestIndex >= 0) {
          traveledRoute = [...destinationRoute.slice(0, nearestIndex + 1), truckPosition];
          remainingRoute = [truckPosition, ...destinationRoute.slice(nearestIndex)];
        }
      }

      if (beforeSource && approachRoute && approachRoute.length >= 2) {
        addLine(`trip-route-${suffix}-green`, GREEN, approachRoute);
      } else {
        removeLine(`trip-route-${suffix}-green`);
      }
      if (!beforeSource && traveledRoute && traveledRoute.length >= 2) {
        addLine(`trip-route-${suffix}-red`, RED, traveledRoute);
      } else {
        removeLine(`trip-route-${suffix}-red`);
      }
      addLine(`trip-route-${suffix}-blue`, BLUE, remainingRoute);

      if (withDots) {
        const pointsId = `trip-route-${suffix}-points`;
        const data = {
          type: "FeatureCollection" as const,
          features: [
            {
              coordinates: beforeSource ? approachRoute?.[0] ?? source : source,
              color: beforeSource && approachRoute ? GREEN : beforeSource ? BLUE : RED,
            },
            {
              coordinates: truckPosition ?? source,
              color: beforeSource && truckPosition && approachRoute ? GREEN : RED,
            },
            { coordinates: destinationRoute[destinationRoute.length - 1], color: BLUE },
          ].map(({ coordinates, color }) => ({
            type: "Feature" as const,
            properties: { color },
            geometry: { type: "Point" as const, coordinates },
          })),
        };
        if (!setGeoJsonData(pointsId, data)) {
          map.addSource(pointsId, { type: "geojson", data });
          map.addLayer({
            id: pointsId,
            type: "circle",
            source: pointsId,
            paint: {
              "circle-radius": 6,
              "circle-color": ["get", "color"],
              "circle-stroke-width": 2,
              "circle-stroke-color": "#ffffff",
            },
          });
        }
      }
    };

    const completed = completedTripIds();
    const activeSelection =
      tripRoute && !completed.has(tripRoute.tripId) ? tripRoute : null;
    const routeSuffixes = new Set<string>();
    if (activeSelection) {
      routeSuffixes.add(activeSelection.truckId);
    }

    let currentStyle;
    try {
      currentStyle = map.getStyle();
    } catch {
      currentStyle = undefined;
    }
    const staleRouteSuffixes = new Set<string>();
    for (const layer of currentStyle?.layers ?? []) {
      if (!layer.id.startsWith("trip-route-")) continue;
      const suffix = layer.id
        .slice("trip-route-".length)
        .replace(/-(red|blue|green|points)$/, "");
      if (!routeSuffixes.has(suffix)) {
        staleRouteSuffixes.add(suffix);
      }
    }
    for (const suffix of staleRouteSuffixes) {
      removeRoute(suffix);
    }

    if (activeSelection) {
      const cachedRoute = routeCacheRef.current.get(activeSelection.tripId);
      drawSplitRoute(
        activeSelection.truckId,
        cachedRoute?.destination ?? activeSelection.points,
        cachedRoute?.approach,
        true,
        startedTripsRef.current.has(activeSelection.tripId)
      );

      const points = [
        ...(cachedRoute?.approach ?? []),
        ...(cachedRoute?.destination ?? activeSelection.points),
      ];
      const bounds = new LngLatBounds(points[0], points[0]);
      for (const coordinates of points) {
        bounds.extend(coordinates);
      }
      if (lastFittedRoute.current !== activeSelection) {
        lastFittedRoute.current = activeSelection;
        map.fitBounds(bounds, { padding: 70, maxZoom: 12, duration: 600 });
      }
    }

  }, [tripRoute, truckTick]);

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
    updateTripRoute(null);
    const requestId = routeSelectionRequestRef.current;

    void TruckPath(
      [trip.source.longitude, trip.source.latitude],
      [trip.destination.longitude, trip.destination.latitude]
    )
      .then((points) => {
        if (
          requestId !== routeSelectionRequestRef.current ||
          completedTripIds().has(trip.tripId)
        ) {
          return;
        }
        if (!points || points.length < 2) {
          console.error("No road route was returned for this trip.");
          return;
        }
        routeCacheRef.current.set(trip.tripId, { destination: points });
        updateTripRoute({ tripId: trip.tripId, truckId: trip.truckId, points });
      })
      .catch((error) => {
        if (requestId !== routeSelectionRequestRef.current) return;
        console.error(
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
    const requestController = new AbortController();
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
          signal: requestController.signal,
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Truck API returned ${response.status}`);
        }

        const trucks: DemoTruck[] = await response.json();
        if (cancelled) return;
        const ownedTruckIds = new Set(
          ownedTrucksRef.current.map((truck) => truck.truckId)
        );
        const visibleTrucks = trucks.filter(
          (truck) =>
            ownedTruckIds.has(truck.truckId) &&
            !deletedTruckIdsRef.current.has(truck.truckId)
        );
        const ongoingResults = await Promise.all(
          visibleTrucks.map(async (truck) => {
            try {
              const trips = await fetchTruckTrips(
                truck.truckId,
                "ONGOING",
                requestController.signal
              );
              return { truckId: truck.truckId, trips, failed: false };
            } catch (error) {
              if (error instanceof DOMException && error.name === "AbortError") {
                throw error;
              }
              return {
                truckId: truck.truckId,
                trips: [] as Trip[],
                failed: true,
              };
            }
          })
        );
        if (cancelled) return;
        setTrucks(visibleTrucks);

        const completed = completedTripIds();
        const selected = tripRouteRef.current;
        const selectionDone = selected ? completed.has(selected.tripId) : false;
        const desired = new Set<string>();
        const ongoing: Trip[] = [];
        const fetchedTripIds = new Set<string>();
        const fetchFailed = ongoingResults.some((result) => result.failed);

        for (const { truckId: id, trips, failed } of ongoingResults) {
          if (!failed) {
            for (const trip of trips) {
              fetchedTripIds.add(trip.tripId);
            }
          }
          for (const trip of trips) {
            if (completed.has(trip.tripId)) {
              routeCacheRef.current.delete(trip.tripId);
              startedTripsRef.current.delete(trip.tripId);
              routeRetryAtRef.current.delete(trip.tripId);
              approachRetryAtRef.current.delete(trip.tripId);
              continue;
            }
            ongoing.push(trip);
          }
          if (failed && !(selected && !selectionDone)) {
            desired.add(id);
          }
        }

        for (const tripId of routeCacheRef.current.keys()) {
          if (
            !fetchFailed &&
            tripId !== selected?.tripId &&
            !fetchedTripIds.has(tripId)
          ) {
            routeCacheRef.current.delete(tripId);
            startedTripsRef.current.delete(tripId);
          }
        }
        for (const tripId of routeRetryAtRef.current.keys()) {
          if (
            !fetchFailed &&
            tripId !== selected?.tripId &&
            !fetchedTripIds.has(tripId)
          ) {
            routeRetryAtRef.current.delete(tripId);
          }
        }
        for (const tripId of approachRetryAtRef.current.keys()) {
          if (
            !fetchFailed &&
            tripId !== selected?.tripId &&
            !fetchedTripIds.has(tripId)
          ) {
            approachRetryAtRef.current.delete(tripId);
          }
        }

        for (const trip of ongoing) {
          desired.add(trip.truckId);
          const truck = visibleTrucks.find((item) => item.truckId === trip.truckId);
          if (truck) {
            const longitudeDelta = truck.longitude - trip.source.longitude;
            const latitudeDelta = truck.latitude - trip.source.latitude;
            if (longitudeDelta ** 2 + latitudeDelta ** 2 <= 0.000001) {
              startedTripsRef.current.add(trip.tripId);
            }
          }
        }

        if (tabRef.current !== "map") {
          desired.clear();
        } else {
          for (const truck of visibleTrucks) {
            desired.add(truck.truckId);
          }
        }

        if (selectionDone) {
          updateTripRoute(null);
        }

        activeTripIdsRef.current = new Set(ongoing.map((trip) => trip.tripId));
        for (const trip of ongoing) {
          if (
            routeCacheRef.current.has(trip.tripId) ||
            routePendingRef.current.has(trip.tripId) ||
            (routeRetryAtRef.current.get(trip.tripId) ?? 0) > Date.now()
          ) {
            continue;
          }
          routeRetryAtRef.current.delete(trip.tripId);
          routePendingRef.current.add(trip.tripId);
          const { tripId, source: tripSource, destination: tripDestination } = trip;
          void TruckPath(
            [tripSource.longitude, tripSource.latitude],
            [tripDestination.longitude, tripDestination.latitude]
          )
            .then((points) => {
              if (
                !activeTripIdsRef.current.has(tripId) &&
                tripRouteRef.current?.tripId !== tripId
              ) {
                return;
              }
              if (points && points.length >= 2) {
                routeCacheRef.current.set(tripId, { destination: points });
                routeRetryAtRef.current.delete(tripId);
              } else {
                routeRetryAtRef.current.set(tripId, Date.now() + 15000);
              }
              setTruckTick((tick) => tick + 1);
            })
            .catch(() => {
              routeRetryAtRef.current.set(tripId, Date.now() + 15000);
            })
            .finally(() => {
              routePendingRef.current.delete(tripId);
            });
        }

        for (const trip of ongoing) {
          const truck = visibleTrucks.find((item) => item.truckId === trip.truckId);
          const cachedRoute = routeCacheRef.current.get(trip.tripId);
          if (!truck || !cachedRoute?.destination) continue;

          const approachStart: [number, number] = [truck.longitude, truck.latitude];
          const previousStart = cachedRoute.approachStart;
          const movedEnough =
            !previousStart ||
            (approachStart[0] - previousStart[0]) ** 2 +
              (approachStart[1] - previousStart[1]) ** 2 >
              0.000001;
          if (
            !movedEnough ||
            approachPendingRef.current.has(trip.tripId) ||
            (approachRetryAtRef.current.get(trip.tripId) ?? 0) > Date.now()
          ) {
            continue;
          }

          approachRetryAtRef.current.delete(trip.tripId);
          approachPendingRef.current.add(trip.tripId);
          void TruckPath(
            approachStart,
            [trip.source.longitude, trip.source.latitude]
          )
            .then((points) => {
              if (
                !activeTripIdsRef.current.has(trip.tripId) &&
                tripRouteRef.current?.tripId !== trip.tripId
              ) {
                return;
              }
              const current = routeCacheRef.current.get(trip.tripId);
              if (!current) return;
              const approach = points && points.length >= 2 ? points : undefined;
              routeCacheRef.current.set(trip.tripId, {
                ...current,
                approach,
                approachStart,
              });
              approachRetryAtRef.current.delete(trip.tripId);
              if (
                !current.approach &&
                approach &&
                tripRouteRef.current?.tripId === trip.tripId
              ) {
                lastFittedRoute.current = null;
              }
              setTruckTick((tick) => tick + 1);
            })
            .catch((error: unknown) => {
              approachRetryAtRef.current.set(trip.tripId, Date.now() + 15000);
              console.error("Could not load truck-to-source route:", error);
            })
            .finally(() => {
              approachPendingRef.current.delete(trip.tripId);
            });
        }

        ongoingTripsRef.current = ongoing;
        setOngoingTrips(ongoing);

        for (const truck of visibleTrucks) {
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
                `${truckDisplayNameForId(ownedTrucksRef.current, truck.truckId)}\n${new Date(
                  truck.sampleTime
                ).toLocaleString()}`
              )
            );
          } else {
            const markerElement = createTruckMarkerElement(
              truckDisplayNameForId(ownedTrucksRef.current, truck.truckId)
            );
            marker = new Marker({ element: markerElement })
              .setLngLat(coordinates)
              .setPopup(
                new Popup().setText(
                  `${truckDisplayNameForId(ownedTrucksRef.current, truck.truckId)}\n${new Date(
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
        if (!cancelled && !(error instanceof DOMException && error.name === "AbortError")) {
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
      requestController.abort();

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

  return (
    <div className="flex h-svh overflow-hidden bg-motive-surface text-left text-motive-ink">
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col bg-motive-sidebar md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <SnowflakeIcon className="h-6 w-6 text-white" />
          <span className="text-[22px] font-semibold tracking-tight text-white">coldchain</span>
        </div>

        <nav className="mt-2 flex flex-col gap-0.5 px-2">
          <button
            type="button"
            onClick={() => { setTab("map"); setDrawers({ trips: false, demo: false, trucks: false }); }}
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
            onClick={() => { setTab("history"); setDrawers({ trips: false, demo: false, trucks: false }); }}
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

        <div className="mt-auto flex items-center gap-2 px-3 pb-4">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2">
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
          <button
            type="button"
            onClick={goToLogin}
            title="Sign out"
            className="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center rounded-md px-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOutIcon className="h-4 w-4" />
          </button>
        </div>
      </aside>

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-6 border-b border-motive-line bg-white px-4 md:hidden">
          <button
            type="button"
            onClick={() => { setTab("map"); setDrawers({ trips: false, demo: false, trucks: false }); }}
            className={tabItemClass(tab === "map")}
          >
            Fleet View
          </button>
          <button
            type="button"
            onClick={() => { setTab("history"); setDrawers({ trips: false, demo: false, trucks: false }); }}
            className={tabItemClass(tab === "history")}
          >
            Route history
          </button>
        </div>

        <div
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          {temperatureAlerts.length > 0 && (
            <div className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-3 text-red-800">
              <div className="flex items-start gap-2">
                <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Temperature alert</p>
                  {temperatureAlerts.map((alert) => (
                    <p key={alert.tripId} className="mt-1 text-xs">
                      {alert.truckName}: {alert.temperature}°C is outside the acceptable
                      range of {alert.minimum}°C to {alert.maximum}°C.
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div
            className={`grid min-h-0 flex-1 ${
              tab === "history" ? "xl:grid-cols-[minmax(0,1fr)_380px]" : ""
            }`}
          >
            <div className="flex min-h-0 min-w-0 flex-col">
              <section
                className="flex min-h-0 flex-1 flex-col overflow-hidden border-x-0 border-b-0 border-motive-line bg-white shadow-sm"
              >
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
                    <div className="flex items-center gap-2">
                      {tripRoute && (
                        <button
                          type="button"
                          onClick={() => updateTripRoute(null)}
                          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-motive-line bg-white px-3 text-sm font-medium text-motive-ink transition-colors hover:bg-motive-surface"
                        >
                          Stop viewing
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDrawers((current) => ({ ...current, trips: !current.trips }))}
                        aria-pressed={drawers.trips}
                        className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors ${
                          drawers.trips
                            ? "border-transparent bg-motive-blue text-white hover:bg-motive-blue-dark"
                            : "border-motive-line bg-white text-motive-ink hover:bg-motive-surface"
                        }`}
                      >
                        <RouteIcon className="h-4 w-4" />
                        Trips
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDrawers((current) => ({
                            ...current,
                            demo: !current.demo,
                            trucks: false,
                          }))
                        }
                        aria-pressed={drawers.demo}
                        className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors ${
                          drawers.demo
                            ? "border-transparent bg-motive-blue text-white hover:bg-motive-blue-dark"
                            : "border-motive-line bg-white text-motive-ink hover:bg-motive-surface"
                        }`}
                      >
                        Demo
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDrawers((current) => ({
                            ...current,
                            trucks: !current.trucks,
                            demo: false,
                          }))
                        }
                        aria-pressed={drawers.trucks}
                        className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors ${
                          drawers.trucks
                            ? "border-transparent bg-motive-blue text-white hover:bg-motive-blue-dark"
                            : "border-motive-line bg-white text-motive-ink hover:bg-motive-surface"
                        }`}
                      >
                        Trucks
                      </button>
                    </div>
                  )}
                </div>
                <div className="relative min-h-0 flex-1">
                  <div
                    ref={containerRef}
                    className="h-full min-h-0 w-full"
                  />
                  {tab === "map" && (
                    <div className="absolute left-4 top-4 z-10 w-[min(360px,calc(100%-2rem))]">
                      <input
                        type="search"
                        value={locationSearch}
                        onChange={(event) => setLocationSearch(event.target.value)}
                        placeholder="Search for a location"
                        aria-label="Search for a location"
                        className="h-10 w-full rounded-md border border-motive-line bg-white px-3 text-sm text-motive-ink shadow-lg outline-none focus:border-motive-blue focus:ring-2 focus:ring-motive-blue/15"
                      />
                      {(locationSearchLoading || locationSearchError || locationResults.length > 0) && (
                        <div className="mt-1 overflow-hidden rounded-md border border-motive-line bg-white shadow-lg">
                          {locationSearchLoading && (
                            <p className="px-3 py-2 text-xs text-motive-muted">Searching…</p>
                          )}
                          {locationSearchError && (
                            <p className="px-3 py-2 text-xs text-red-600">
                              {locationSearchError}
                            </p>
                          )}
                          {!locationSearchLoading &&
                            locationResults.map((place) => (
                              <button
                                key={`${place.Title}-${place.Position.join(",")}`}
                                type="button"
                                onClick={() => selectLocation(place)}
                                className="block w-full border-b border-motive-line px-3 py-2 text-left last:border-b-0 hover:bg-motive-surface"
                              >
                                <span className="block truncate text-xs font-medium text-motive-ink">
                                  {place.Title}
                                </span>
                                {place.Subtitle && (
                                  <span className="block truncate text-[11px] text-motive-muted">
                                    {place.Subtitle}
                                  </span>
                                )}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                  {mapPickTarget && (
                    <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-white px-3 py-2 text-xs font-medium text-motive-ink shadow-lg">
                      <span>
                        Select a {mapPickTarget === "source" ? "source" : "destination"} location
                      </span>
                      <button
                        type="button"
                        onClick={() => setMapPickTarget(null)}
                        className="font-semibold text-motive-blue underline underline-offset-2"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
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

            </div>

            <aside className={tab === "history" ? "min-h-0 min-w-0 overflow-y-auto" : "hidden"}>
              <QueryHistory
                trucks={ownedTrucks}
                onResult={(result) => {
                  setHistory(result);
                  setHistoryLocation(null);
                }}
                completedTrips={completedTrips}
                completedTripsLoading={completedTripsLoading}
                completedTripsError={completedTripsError}
                onLocationSelect={(record) => {
                  const latitude = Number(record.latitude);
                  const longitude = Number(record.longitude);
                  if (
                    Number.isFinite(latitude) &&
                    Number.isFinite(longitude) &&
                    Math.abs(latitude) <= 90 &&
                    Math.abs(longitude) <= 180
                  ) {
                    setHistoryLocation({ latitude, longitude });
                  }
                }}
              />
            </aside>
          </div>

          {tab === "map" && (
            <>
              <aside
              data-drawer="trips"
              aria-hidden={!drawers.trips}
              className={`absolute inset-x-auto bottom-0 left-0 top-[58px] z-30 flex w-[340px] flex-col border-r border-motive-line bg-white shadow-xl transition-transform duration-300 ease-in-out ${
                drawers.trips
                  ? "translate-x-0"
                  : "pointer-events-none -translate-x-full"
              }`}
            >
              <TripsPanel
                onShowTrip={showTrip}
                trucks={ownedTrucks}
                onTripStatusChanged={handleTripStatusChanged}
                mapPickTarget={mapPickTarget}
                onStartMapPick={(target) => {
                  activeMapPickHandlerRef.current = tripMapPickHandlerRef.current;
                  setMapPickTarget(target);
                }}
                onRegisterMapPickHandler={(handler) => {
                  tripMapPickHandlerRef.current = handler;
                }}
              />
              </aside>
              <aside
                data-drawer="trucks"
                aria-hidden={!drawers.trucks}
                className={`absolute bottom-0 right-0 top-[58px] z-30 flex w-[340px] flex-col border-l border-motive-line bg-white shadow-xl transition-transform duration-300 ease-in-out ${
                  drawers.trucks
                    ? "translate-x-0"
                    : "pointer-events-none translate-x-full"
                }`}
              >
                <TrucksPanel
                  trucks={ownedTrucks}
                  onCreateTruck={handleCreateTruck}
                  onDeleteTruck={handleDeleteTruck}
                />
              </aside>
              <aside
              data-drawer="demo"
              aria-hidden={!drawers.demo}
              className={`absolute bottom-0 right-0 top-[58px] z-30 flex w-[340px] flex-col border-l border-motive-line bg-white shadow-xl transition-transform duration-300 ease-in-out ${
                drawers.demo
                  ? "translate-x-0"
                  : "pointer-events-none translate-x-full"
              }`}
            >
              <DemoJourneyPanel
                trucks={trucks}
                ownedTrucks={ownedTrucks}
                trips={demoTrips.length > 0 ? demoTrips : ongoingTrips}
                onDemoTrip={(
                  currentLocation,
                  source,
                  destination,
                  truckId,
                  simulateTemperatureExcursion,
                  minimumTemperature,
                  maximumTemperature
                ) =>
                  startDemo(
                    currentLocation,
                    source,
                    destination,
                    truckId,
                    simulateTemperatureExcursion,
                    minimumTemperature,
                    maximumTemperature
                  )
                }
                onStopDemo={stopDemo}
              />
              </aside>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
