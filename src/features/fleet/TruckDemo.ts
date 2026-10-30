import { TruckPath } from "./location";
import { fetchAuthSession } from "aws-amplify/auth";

const TruckCreateUrl = import.meta.env.VITE_TRUCKS_CREATE_URL;

type Demo = {
  timer?: ReturnType<typeof setTimeout>;
  cancelled: boolean;
  controller: AbortController;
};

const activeDemos = new Map<string, Demo>();
const demoStatusListeners = new Set<(running: boolean, truckId: string) => void>();

function notifyDemoStatus(running: boolean, truckId: string) {
  for (const listener of demoStatusListeners) {
    listener(running, truckId);
  }
}

export function isDemoRunning(): boolean {
  return activeDemos.size > 0;
}

export function subscribeDemoStatus(
  listener: (running: boolean, truckId: string) => void
): () => void {
  demoStatusListeners.add(listener);
  return () => demoStatusListeners.delete(listener);
}

export function stopDemo(truckId?: string) {
  const demos = truckId
    ? [[truckId, activeDemos.get(truckId)] as const]
    : [...activeDemos.entries()];

  for (const [id, demo] of demos) {
    if (!demo) continue;
    if (demo.timer !== undefined) clearTimeout(demo.timer);
    demo.cancelled = true;
    demo.controller.abort();
    activeDemos.delete(id);
    notifyDemoStatus(false, id);
  }
}

export async function startDemo(
  currentLocation: [number, number],
  selectedSource: [number, number],
  selectedDestination: [number, number],
  truckId: string,
  simulateTemperatureExcursion: boolean,
  minimumTemperature: number,
  maximumTemperature: number
) {
  if (activeDemos.has(truckId)) {
    throw new Error(`A demo is already running for ${truckId}`);
  }

  const demo: Demo = {
    cancelled: false,
    controller: new AbortController(),
  };
  activeDemos.set(truckId, demo);
  notifyDemoStatus(true, truckId);

  try {
    const approachPath = await TruckPath(currentLocation, selectedSource);
    const destinationPath = await TruckPath(selectedSource, selectedDestination);

    if (
      !approachPath ||
      approachPath.length === 0 ||
      !destinationPath ||
      destinationPath.length === 0
    ) {
      throw new Error("No road route was returned for this demo journey.");
    }

    const lineString = [
      ...getSamplePath(approachPath),
      ...getSamplePath(destinationPath).slice(1),
    ];
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();

    if (!idToken) {
      throw new Error("No Cognito ID token found");
    }

    let time = 0;
    const durationMs = 60 * 1000;
    const startedAt = performance.now();
    const excursionStartMs = 10_000 + Math.random() * 30_000;
    const excursionDurationMs = 5_000 + Math.random() * 10_000;
    const excursionEndMs = excursionStartMs + excursionDurationMs;
    const normalTemperature = () =>
      minimumTemperature +
      Math.random() * (maximumTemperature - minimumTemperature);
    const excursionTemperature =
      Math.random() < 0.5
        ? minimumTemperature - Math.max(1, Math.abs(maximumTemperature - minimumTemperature) * 0.1)
        : maximumTemperature + Math.max(1, Math.abs(maximumTemperature - minimumTemperature) * 0.1);

    async function sendTruckData() {
      if (demo.cancelled || activeDemos.get(truckId) !== demo) {
        return;
      }

      try {
        const response = await fetch(TruckCreateUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          signal: demo.controller.signal,
          body: JSON.stringify({
            truck_id: truckId,
            longitude: lineString[time][0],
            latitude: lineString[time][1],
            temperature:
              simulateTemperatureExcursion &&
              performance.now() - startedAt >= excursionStartMs &&
              performance.now() - startedAt <= excursionEndMs
                ? excursionTemperature
                : normalTemperature(),
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to send truck data: ${response.status} ${response.statusText}`);
        }
        time++;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        console.error("Failed to send truck data:", error);
        stopDemo(truckId);
        return;
      }

      if (time < lineString.length) {
        const progress = time / Math.max(1, lineString.length - 1);
        const nextDelay = Math.max(
          0,
          startedAt + progress * durationMs - performance.now()
        );
        demo.timer = setTimeout(sendTruckData, nextDelay);
      } else if (activeDemos.get(truckId) === demo) {
        activeDemos.delete(truckId);
        notifyDemoStatus(false, truckId);
      }
    }

    void sendTruckData();

  } catch (error) {
    console.error("ROUTE ERROR:", error);
    if (activeDemos.get(truckId) === demo) {
      stopDemo(truckId);
    }
    throw error;
  }
}

function getSamplePath(
  path: [number, number][],
  numPositions: number = 20
): [number, number][] {
  if (path.length <= numPositions) {
    return path;
  }
  const sampledPath: [number, number][] = [];
  const step = (path.length - 1) / (numPositions - 1);

  for (let i = 0; i < numPositions; i++) {
    const index = Math.floor(i * step);
    sampledPath.push(path[index]);
  }

  if (sampledPath[sampledPath.length - 1] !== path[path.length - 1]) {
    sampledPath.push(path[path.length - 1]);
  }

  return sampledPath;
}