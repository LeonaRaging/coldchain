import { useEffect, useRef, useState } from "react";
import { Map, Marker, NavigationControl, Popup, setWorkerUrl } from "maplibre-gl";
import { fetchAuthSession } from "aws-amplify/auth";
import "maplibre-gl/dist/maplibre-gl.css";
import { startDemo } from "./TruckDemo";
import DemoJourney from "./DemoJourney";

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
  const mapRef = useRef<Map | null>(null);

  const [source, setSource] = useState("Hanoi");
  const [destination, setDestination] = useState("Ho Chi Minh City");
  const [truckId, setTruckId] = useState("DEMO-001");

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new Map({
      container: containerRef.current,
      style: `https://maps.geo.${region}.amazonaws.com/maps/v0/maps/${mapName}/style-descriptor?key=${apiKey}`,
      center: [105.8342, 21.0278],
      zoom: 11,
    });

    mapRef.current = map;

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
      style={{
        minHeight: "100vh",
        background: "#0b1120",
        color: "#f3f4f6",
        padding: "24px",
        boxSizing: "border-box",
      }}
    >
      {/* Fleet Locations */}
      <section>
        <div
          style={{
            fontSize: "20px",
            fontWeight: 700,
            letterSpacing: "0.04em",
            marginBottom: "14px",
          }}
        >
          FLEET LOCATIONS
        </div>

        <div
          style={{
            border: "1px solid #374151",
            borderRadius: "8px",
            overflow: "hidden",
            background: "#111827",
          }}
        >
          <div
            ref={containerRef}
            style={{
              width: "100%",
              height: "420px",
            }}
          />
        </div>
      </section>

      {/* Demo Journey */}
      <div
        style={{
          marginTop: "18px",
          border: "1px solid #374151",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <DemoJourney
          source={source}
          destination={destination}
          truckId={truckId}
          onSourceChange={setSource}
          onDestinationChange={setDestination}
          onTruckIdChange={setTruckId}
          onStart={() => {
            startDemo(
              mapRef.current!,
              source,
              destination,
              truckId
            ).catch((error) => {
              console.error("ROUTE ERROR:", error);
            });
          }}
        />
      </div>
    </div>
  );
}
