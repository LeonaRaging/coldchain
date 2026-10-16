
import { useEffect, useRef } from "react";
import { Map, NavigationControl, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const apiKey = import.meta.env.VITE_LOCATION_API_KEY;
const region = import.meta.env.VITE_AWS_REGION;
const mapName = import.meta.env.VITE_LOCATION_MAP_NAME;

setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());

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

    map.on("error", (event) => {
      console.error("Map error:", event.error);
    });

    return () => map.remove();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "600px" }}
    />
  );
}
