import { GeoRoutesClient, CalculateRoutesCommand } from "@aws-sdk/client-geo-routes";
import { withAPIKey } from "@aws/amazon-location-utilities-auth-helper";
import { GeoPlacesClient, SearchTextCommand } from "@aws-sdk/client-geo-places";

const apiKey = import.meta.env.VITE_LOCATION_API_KEY;
const region = import.meta.env.VITE_AWS_REGION;

export type PlaceResult = {
  Title: string,
  Position: [number, number]
};

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
    MaxResults: 7,
  });

  const response = await client.send(command);

  return response.ResultItems?.map((item) => ({
    Title: item.Title || "",
    Position: item.Position as [number, number],
  })) || [];
}