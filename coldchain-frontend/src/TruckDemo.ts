import { Map, Marker, Popup, LngLatBounds } from "maplibre-gl";
import { TruckPath, SearchPlace } from "./location";

let demoMarker: Marker | null = null;

export async function startDemo(
  map: Map,
  source: string,
  destination: string,
  truckId: string
) {
  try {
    const center = map.getCenter();

    const mapCenter: [number, number] = [
      center.lng,
      center.lat,
    ];

    const start = await SearchPlace(source, mapCenter);

    if (!start) {
      throw new Error(`Could not find source: ${source}`);
    }

    const end = await SearchPlace(destination, mapCenter);

    if (!end) {
      throw new Error(`Could not find destination: ${destination}`);
    }  

    const lineStringPath = await TruckPath(start, end);

    if (!lineStringPath) {
      throw new Error("No route returned");
    }

    const lineString = lineStringPath;

    if (demoMarker) {
      demoMarker.remove();
    }

    if (demoMarker) {
      demoMarker.remove();
    }

    demoMarker = new Marker({ color: "#00c8d7" })
      .setLngLat(start)
      .setPopup(
        new Popup().setText(truckId)
    )
    .addTo(map);

    const duration = 60_000;
    const startTime = performance.now();

    function animateTruck(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const index = Math.min(
        Math.floor(progress * (lineString.length - 1)),
        lineString.length - 1
      );

      const point = lineString[index];

      if (!point || point.length < 2) {
        return;
      }

      demoMarker.setLngLat([
        point[0],
        point[1],
      ]);

      if (progress < 1) {
        requestAnimationFrame(animateTruck);
      }
    }

    requestAnimationFrame(animateTruck);

    const geojson = {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: lineString,
      },
    };

    if (map.getLayer("LineString")) {
      map.removeLayer("LineString");
    }

    if (map.getSource("LineString")) {
      map.removeSource("LineString");
    }

    map.addSource("LineString", {
      type: "geojson",
      data: geojson,
    });

    map.addLayer({
      id: "LineString",
      type: "line",
      source: "LineString",
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#BF93E4",
        "line-width": 5,
      },
    });

    const bounds = new LngLatBounds();

    bounds.extend(start);
    bounds.extend(end);

    map.fitBounds(bounds, {
      padding: 80,
      duration: 1000,
    });

  } catch (error) {
    console.error("ROUTE ERROR:", error);
  }
}