import { Map, Marker, Popup, LngLatBounds } from "maplibre-gl";
import { TruckPath, SearchPlace } from "./location";
import { fetchAuthSession } from "aws-amplify/auth";

const TruckCreateUrl = import.meta.env.VITE_TRUCKS_CREATE_URL;

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

    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();

    let time = 0;

    async function sendTruckData() {
      try {
        await fetch(TruckCreateUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            truck_id: truckId,
            longitude: lineString[time][0],
            latitude: lineString[time][1],
            temperature: 0
          }),
        });

        time++;
      } catch (error) {
        console.error("Failed to send truck data:", error);
      }

      if (time < lineString.length) {
        setTimeout(sendTruckData, 5000);
      }
    }

    sendTruckData();

  } catch (error) {
    console.error("ROUTE ERROR:", error);
  }
}