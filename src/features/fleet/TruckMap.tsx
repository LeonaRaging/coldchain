import { useEffect, useRef, useState } from "react";
import { Map, Marker, NavigationControl, Popup, setWorkerUrl } from "maplibre-gl";
import { fetchAuthSession, signOut } from "aws-amplify/auth";
import "maplibre-gl/dist/maplibre-gl.css";
import { startDemo } from "./TruckDemo";
import DemoJourney from "./DemoJourney";
import QueryHistory from "../history/QueryHistory";

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

export default function TruckMap({ onSignedOut }: TruckMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);

  const [source, setSource] = useState("Hanoi");
  const [destination, setDestination] = useState("Ho Chi Minh City");
  const [truckId, setTruckId] = useState("DEMO-001");

  async function goToLogin() {
    try {
      await signOut();
    } catch (error) {
      console.error("Sign out failed:", error);
    }
    onSignedOut();
  }

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
    const intervalId = setInterval(() => {
      void loadTrucks();
    }, 5000);
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

      clearInterval(intervalId);

      for (const marker of markers.values()) {
        marker.remove();
      }

      markers.clear();
      map.remove();
    };
  }, []);

  return (
    <div className="box-border min-h-screen bg-slate-950 p-6 text-left text-gray-100">
      <div className="grid grid-cols-[minmax(0,1fr)_1078px_minmax(0,1fr)] items-start gap-6 max-2xl:mx-auto max-2xl:flex max-2xl:max-w-5xl max-2xl:flex-col max-2xl:gap-4">
        <aside className="min-w-0 pt-22 max-2xl:order-2 max-2xl:w-full max-2xl:pt-0">
          <QueryHistory />
        </aside>

        <main className="min-w-0 max-2xl:order-1 max-2xl:w-full">
          {/* Fleet Locations */}
          <section>
        <div className="mb-3 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={goToLogin}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg border-none bg-cyan-500 px-5 py-2.5 text-sm font-bold text-cyan-950 shadow-lg shadow-cyan-500/30"
          >
            Sign out
          </button>
        </div>
        <div className="mb-3.5 text-xl font-bold tracking-wide">
          FLEET LOCATIONS
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-700 bg-gray-900">
          <div
            ref={containerRef}
            className="h-105 w-full"
          />
        </div>
      </section>

      {/* Demo Journey */}
      <div className="mt-5 overflow-hidden rounded-lg border border-gray-700">
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
        </main>
      </div>
    </div>
  );
}
