# ColdChain Watch

A near-real-time cold-chain monitoring platform built serverless on AWS.

A device on each truck sends temperature and GPS coordinates through an API. The system authenticates the sender, tags each record with the right user and trip, shows trucks on a live map, alerts when the temperature leaves the allowed range, and lets users look up the route and temperature history of completed trips.

Live app: https://main.d1ursqkxmch3uk.amplifyapp.com/

## Features

- Sign up, sign in and password reset with Amazon Cognito; each user sees only their own trucks and trips.
- Create and delete refrigerated trucks.
- Declare trips (truck, origin, destination, allowed temperature range) and move them through `PLANNED → ONGOING → COMPLETED`.
- Map with each truck's current position and temperature, refreshed every 3 seconds.
- Dashboard alert and browser notification when the temperature leaves the trip's allowed range.
- Route and temperature history per trip, read from raw data in S3 and queried with Athena.
- An in-browser simulator that stands in for the in-truck device.

## Architecture

<img width="1204" height="983" alt="image" src="https://github.com/user-attachments/assets/4fa00743-0825-4663-ab20-7da7c805f235" />

```
Browser (React, Amplify)
   │  Cognito ID token
   ▼
API Gateway (ColdChainTelemetryAPI, stage1) ──► Lambda (trucks, trips) ──► DynamoDB
   │
   └─ POST /telemetry ─► Lambda Ingest ─► Kinesis Data Streams (coldchain)
                                              ├─► Lambda LocationProcessor ─► Location Tracker (latest position)
                                              └─► Firehose ─► S3 (user_id/trip_id) ─► Athena ─► GET /trips/{id}/locations
```

`user_id` comes from the `sub` claim of the Cognito token. `user_id` and `trip_id` are added to each record by the server, never taken from the client.

AWS services: Cognito, API Gateway, Lambda, DynamoDB, Kinesis Data Streams, Data Firehose, S3, Athena and Glue, Amazon Location Service, Amplify Hosting.

## Repository layout

```
.
├── src/
│   ├── app/            # App and routing
│   ├── config/         # Amplify/Cognito configuration
│   ├── features/
│   │   ├── auth/       # Login, register, forgot password
│   │   ├── fleet/      # Truck list, map, device simulator
│   │   ├── trips/      # Trip creation and management
│   │   └── history/    # Completed-trip route lookup
│   ├── components/
│   └── styles/
├── backend/            # AWS Lambda functions (Python), see backend/README.md
└── package.json
```

## Run the frontend locally

Requires Node.js 20 or later.

```bash
npm install
cp .env.example .env     # then fill in the values below
npm run dev
```

Other commands:

| Command | Purpose |
| --- | --- |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests (Vitest) |

### Environment variables

| Variable | Meaning |
| --- | --- |
| `VITE_AWS_REGION` | AWS region, e.g. `ap-southeast-1` |
| `VITE_LOCATION_API_KEY` | Amazon Location Service API key (maps, place search, routes) |
| `VITE_LOCATION_MAP_NAME` | Map name, e.g. `ColdChainMap` |
| `VITE_TRUCKS_API_URL` | API Gateway URL for `/trucks` |
| `VITE_GET_USER_TRUCKS_API_URL` | URL for `GET /trucks` |
| `VITE_CREATE_TRUCKS_API_URL`, `VITE_TRUCKS_CREATE_URL` | URL for `POST /trucks/create` |
| `VITE_TRIPS_API_URL` | API Gateway URL for `/trips` |

`VITE_*` values are bundled into code that runs in the browser, so restrict the Location Service key to the app's domain in AWS.

The Cognito User Pool and app client IDs are set in `src/config/amplify.ts`. Change them there to use a different AWS account.

## REST API

Every endpoint requires an `Authorization` header with a Cognito ID token.

| Endpoint | Lambda | Purpose |
| --- | --- | --- |
| `POST /telemetry` | `ColdChainTelemetryIngest` | Receive a sensor record |
| `GET /trucks` | `GetUserTrucks` | List trucks with latest temperature |
| `POST /trucks/create` | `CreateTruck` | Create a truck |
| `DELETE /trucks/{truck_id}` | `DeleteTruck` | Delete a truck |
| `GET /trucks/positions` | `GetTruckPositions` | Current truck positions |
| `GET /trucks/{truck_id}/trips` | `GetTruckTrips` | Trips of one truck |
| `POST /trips` | `CreateTrip` | Create a trip with a temperature range |
| `PATCH /trips/{tripId}/status` | `updateTripStatus` | Change trip status |
| `GET /trips/{tripId}/locations` | `GetTripLocations` | Trip route and temperature (Athena) |

Body for `POST /telemetry`:

```json
{ "truck_id": "Truck001", "temperature": 4.2, "latitude": 21.0285, "longitude": 105.8048 }
```

Data is accepted only while the truck has an `ONGOING` trip.
