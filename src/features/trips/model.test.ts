import { describe, expect, it } from "vitest";
import {
  displayStatus,
  mergeTrips,
  normalizeTrip,
  normalizeTripList,
  type Trip,
} from "./model";

const trip = (tripId: string, status?: string): Trip => ({
  tripId,
  tripName: `Trip ${tripId}`,
  truckId: "TRUCK-1",
  source: { latitude: 1, longitude: 2 },
  destination: { latitude: 3, longitude: 4 },
  status,
});

describe("trip model", () => {
  it("normalizes API aliases and numeric coordinates", () => {
    expect(
      normalizeTrip({
        trip_id: "trip-1",
        truck_id: "truck-1",
        origin: { latitude: "1.5", longitude: "2.5" },
        destination: { latitude: 3, longitude: 4 },
      })
    ).toMatchObject({
      tripId: "trip-1",
      truckId: "truck-1",
      source: { latitude: 1.5, longitude: 2.5 },
    });
  });

  it("rejects trips missing required route data", () => {
    expect(normalizeTrip({ id: "trip-1", truck_id: "truck-1" })).toBeNull();
  });

  it("accepts both supported list response shapes", () => {
    const raw = {
      id: "trip-1",
      truck_id: "truck-1",
      source: { latitude: 1, longitude: 2 },
      destination: { latitude: 3, longitude: 4 },
    };
    expect(normalizeTripList([raw])).toHaveLength(1);
    expect(normalizeTripList({ trips: [raw] })).toHaveLength(1);
  });

  it("maps backend status aliases to display statuses", () => {
    expect(displayStatus("in_progress")).toBe("ONGOING");
    expect(displayStatus("finished")).toBe("COMPLETED");
    expect(displayStatus(undefined)).toBe("PLANNED");
  });

  it("prefers remote trips and excludes completed trips", () => {
    expect(mergeTrips([trip("local", "PLANNED"), trip("same", "PLANNED")], [
      trip("same", "ONGOING"),
      trip("done", "COMPLETED"),
    ])).toEqual([trip("local", "PLANNED"), trip("same", "ONGOING")]);
  });
});
