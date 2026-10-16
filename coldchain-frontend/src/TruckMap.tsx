
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
    
    let cancelled = false;

    async function loadTrucks() {
      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();

        if (!idToken) {
          throw new Error("No Cognito ID token found");
        }

        const response = await fetch(truckApiUrl, {
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Truck API returned ${response.status}`);
        }

        const apiResponse = await response.json();
        const trucks: Truck[] =
          typeof apiResponse.body === "string"
            ? JSON.parse(apiResponse.body)
            : apiResponse.body;

        if (cancelled) return;

        for (const truck of trucks) {
          new Marker({ color: "#d64545" })
            .setLngLat([truck.longitude, truck.latitude])
            .setPopup(
              new Popup().setText(
                `${truck.truckId}\n${new Date(truck.sampleTime).toLocaleString()}`
              )
            )
            .addTo(map);
        }
      } catch (error) {
        console.error("Could not load truck locations:", error);
      }
    }

    loadTrucks();

    map.on("error", (event) => {
      console.error("Map error:", event.error);
    });

    return () => {
      cancelled = true;
      map.remove();
    }
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "600px" }}
    />
  );
}
