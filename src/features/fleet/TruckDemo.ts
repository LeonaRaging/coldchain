import { TruckPath } from "./location";
import { fetchAuthSession } from "aws-amplify/auth";

const TruckCreateUrl = import.meta.env.VITE_TRUCKS_CREATE_URL;
let activeDemo:
  | {
      timer?: ReturnType<typeof setTimeout>;
      cancelled: boolean;
    }
  | undefined;

export function stopDemo() {
  if (activeDemo?.timer !== undefined) {
    clearTimeout(activeDemo.timer);
  }

  if (activeDemo) {
    activeDemo.cancelled = true;
    activeDemo = undefined;
  }
}

export async function startDemo(
  selectedSource: [number, number],
  selectedDestination: [number, number],
  truckId: string
) {
  if (activeDemo) {
    throw new Error("A demo is already running");
  }

  const demo: {
    timer?: ReturnType<typeof setTimeout>;
    cancelled: boolean;
  } = {
    cancelled: false,
  };
  activeDemo = demo;

  try {
    const lineStringPath = await TruckPath(selectedSource, selectedDestination);

    if (!lineStringPath || lineStringPath.length === 0) {
      throw new Error("No route returned");
    }

    const lineString = lineStringPath;
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();

    if (!idToken) {
      throw new Error("No Cognito ID token found");
    }

    let time = 0;

    async function sendTruckData() {
      if (demo.cancelled || activeDemo !== demo) {
        return;
      }

      try {
        const response = await fetch(TruckCreateUrl, {
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

        if (!response.ok) {
          throw new Error(`Failed to send truck data: ${response.status} ${response.statusText}`);
        }
        time++;
      } catch (error) {
        console.error("Failed to send truck data:", error);
        stopDemo();
        return;
      }

      if (time < lineString.length) {
        demo.timer = setTimeout(sendTruckData, 5000);
      } else if (activeDemo === demo) {
        activeDemo = undefined;
      }
    }

    void sendTruckData();

  } catch (error) {
    console.error("ROUTE ERROR:", error);
    if (activeDemo === demo) {
      stopDemo();
    }
    throw error;
  }
}