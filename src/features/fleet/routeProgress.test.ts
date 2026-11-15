import { describe, expect, it } from "vitest";
import { distanceMeters, projectOntoRoute, splitRoute, type LngLat } from "./routeProgress";

// A straight eastbound road with vertices roughly 1.1 km apart near Hanoi.
const straight: LngLat[] = [
  [105.8, 21.0],
  [105.81, 21.0],
  [105.82, 21.0],
  [105.83, 21.0],
];

describe("projectOntoRoute", () => {
  it("snaps between vertices instead of to the nearest vertex", () => {
    // Just past the first vertex: the nearest *vertex* is index 0, but the truck is
    // on segment 0 a little way along it.
    const projection = projectOntoRoute(straight, [105.803, 21.0001])!;
    expect(projection.segment).toBe(0);
    expect(projection.point[0]).toBeCloseTo(105.803, 6);
    expect(projection.point[1]).toBeCloseTo(21.0, 6);
    expect(projection.distanceMeters).toBeLessThan(15);
  });

  it("does not backtrack or overshoot when splitting", () => {
    const projection = projectOntoRoute(straight, [105.817, 21.0])!;
    const { traveled, remaining } = splitRoute(straight, projection);
    expect(traveled.at(-1)).toEqual(projection.point);
    expect(remaining[0]).toEqual(projection.point);
    // Every traveled point is at or before the truck; every remaining one at or after.
    expect(traveled.every(([lng]) => lng <= 105.817 + 1e-9)).toBe(true);
    expect(remaining.every(([lng]) => lng >= 105.817 - 1e-9)).toBe(true);
  });

  it("reports distance along the route", () => {
    const projection = projectOntoRoute(straight, [105.82, 21.0])!;
    expect(projection.alongMeters).toBeCloseTo(
      distanceMeters(straight[0], straight[2]),
      0
    );
  });

  it("prefers the earlier pass on a route that revisits the same place", () => {
    // Out east and back west along the same road.
    const outAndBack: LngLat[] = [
      [105.8, 21.0],
      [105.82, 21.0],
      [105.8, 21.0],
    ];
    const projection = projectOntoRoute(outAndBack, [105.805, 21.0])!;
    expect(projection.segment).toBe(0);
  });

  it("keeps progress monotonic using the forward hint", () => {
    const outAndBack: LngLat[] = [
      [105.8, 21.0],
      [105.82, 21.0],
      [105.8, 21.0],
    ];
    const projection = projectOntoRoute(outAndBack, [105.805, 21.0], 1)!;
    expect(projection.segment).toBe(1);
  });

  it("ignores a stale forward hint when the truck is far from the forward part", () => {
    const projection = projectOntoRoute(straight, [105.801, 21.0], 2)!;
    expect(projection.segment).toBe(0);
  });
});
