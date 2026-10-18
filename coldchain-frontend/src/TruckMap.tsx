import { useEffect, useRef } from "react";
import { Map, Marker, NavigationControl, Popup, setWorkerUrl } from "maplibre-gl";
import { fetchAuthSession } from "aws-amplify/auth";
import "maplibre-gl/dist/maplibre-gl.css";

const apiKey = import.meta.env.VITE_LOCATION_API_KEY;
const region = import.meta.env.VITE_AWS_REGION;
const mapName = import.meta.env.VITE_LOCATION_MAP_NAME;
const truckApiUrl = import.meta.env.VITE_TRUCKS_API_URL;

setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());

type Truck = {
  truckId: string,
  longitude: number,
  latitude: number;
  sampleTime: string;
}

export default function TruckMap() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new Map({
      container: containerRef.current,
      style: `https://maps.geo.${region}.amazonaws.com/maps/v0/maps/${mapName}/style-descriptor?key=${apiKey}`,
      center: [105.8342, 21.0278],
      zoom: 11,
    });

    map.addControl(new NavigationControl(), "top-right");

    const markers = new globalThis.Map<string, Marker>();
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;
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

    intervalId = setInterval(() => {
      void loadTrucks();
    }, 5000);

    return () => {
      cancelled = true;

      if (intervalId !== undefined) {
        clearInterval(intervalId);
      }

      for (const marker of markers.values()) {
        marker.remove();
      }

      markers.clear();
      map.remove();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "600px" }}
    />
  );
}