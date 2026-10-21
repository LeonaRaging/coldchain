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
  const response = await client.send(command);

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
    QueryText: `${text}, Vietnam`,
    BiasPosition: biasPosition,
    MaxResults: 7,
    Filter: {
      IncludeCountries: ["VNM"],
    },
  });

  const response = await client.send(command);

  return response.ResultItems?.map((item) => ({
    Title: item.Title || "",
    Position: item.Position as [number, number],
  })) || [];
}