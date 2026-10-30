import { GeoRoutesClient, CalculateRoutesCommand } from "@aws-sdk/client-geo-routes";
import { withAPIKey } from "@aws/amazon-location-utilities-auth-helper";
import {
  GeoPlacesClient,
  ReverseGeocodeCommand,
  SearchTextCommand,
} from "@aws-sdk/client-geo-places";

const apiKey = import.meta.env.VITE_LOCATION_API_KEY;
const region = import.meta.env.VITE_AWS_REGION;

export type PlaceResult = {
  Title: string,
  Subtitle?: string,
  Position: [number, number]
};

export type ResolvedPlace = {
  name?: string;
  address?: string;
};

const MIN_SUGGESTION_DISTANCE_METERS = 100;

function distanceMeters(
  first: [number, number],
  second: [number, number]
): number {
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = ((second[1] - first[1]) * Math.PI) / 180;
  const longitudeDelta = ((second[0] - first[0]) * Math.PI) / 180;
  const firstLatitude = (first[1] * Math.PI) / 180;
  const secondLatitude = (second[1] * Math.PI) / 180;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine));
}

export async function TruckPath(
  start: [number, number],
  destination: [number, number]
): Promise<[number, number][] | undefined> {
  const authHelper = withAPIKey(apiKey, region);
  const client = new GeoRoutesClient(authHelper.getClientConfig());

  const input = {
    Origin: start,
    Destination: destination,
    OptimizeRoutingFor: "ShortestRoute" as const,
    TravelMode: "Car" as const,
    LegGeometryFormat: "Simple" as const,
  };

  const command = new CalculateRoutesCommand(input);

  let response;

  try {
    response = await client.send(command);
  } catch (error) {
    if (error instanceof Error && error.message.includes("outside of service area")) {
      throw new Error(
        "No road route can be found between these two locations (at least one is outside the service area).",
        { cause: error }
      );
    }
    throw error;
  }

  const lineString =
    response.Routes?.[0].Legs?.[0].Geometry?.LineString;

  if (!lineString) {
    return undefined;
  }

  return lineString.map(
    (point) => [point[0], point[1]] as [number, number]
  );
}

export async function SearchPlace(
  text: string,
  biasPosition: [number, number]
): Promise<PlaceResult[]> {
  const authHelper = withAPIKey(apiKey, region);
  const client = new GeoPlacesClient(authHelper.getClientConfig());

  const command = new SearchTextCommand({
    QueryText: text,
    BiasPosition: biasPosition,
    MaxResults: 10,
  });

  const response = await client.send(command);

  const suggestions = (response.ResultItems ?? [])
    .filter(
      (item) =>
        item.Position &&
        item.Position.length >= 2 &&
        Number.isFinite(item.Position[0]) &&
        Number.isFinite(item.Position[1])
    )
    .map((item) => ({
      Title: item.Title || item.Address?.Label || "",
      Subtitle: item.Address?.Label,
      Position: [item.Position![0], item.Position![1]] as [number, number],
    }))
    .filter((place) => place.Title.trim().length > 0);

  return suggestions.filter((suggestion, index) => {
    for (const previous of suggestions.slice(0, index)) {
      if (
        distanceMeters(suggestion.Position, previous.Position) <
        MIN_SUGGESTION_DISTANCE_METERS
      ) {
        return false;
      }
    }
    return true;
  });
}

export async function ReverseGeocode(
  position: [number, number]
): Promise<string | undefined> {
  const place = await ReverseGeocodePlace(position);
  return place.address || place.name;
}

export async function ReverseGeocodePlace(
  position: [number, number]
): Promise<ResolvedPlace> {
  const authHelper = withAPIKey(apiKey, region);
  const client = new GeoPlacesClient(authHelper.getClientConfig());
  const response = await client.send(
    new ReverseGeocodeCommand({
      QueryPosition: position,
      MaxResults: 1,
    })
  );
  const result = response.ResultItems?.[0];
  return {
    name: result?.Title || undefined,
    address: result?.Address?.Label || undefined,
  };
}