# GeoField Mobile

GeoField Mobile is a cross-platform fieldwork app built with Expo and React Native. It connects to the GeoField API so users can manage projects and tasks, record observations at GPS coordinates, and view those observations on a map.

## Features

- Register an account and sign in to an existing account.
- View dashboard totals and project progress.
- Create projects and manage their tasks, including filtering, completing, and deleting tasks.
- Capture the device's current location and save titled observations with optional notes to a project.
- View project observations on a map, inspect observation details, and show the current location and GPS accuracy.
- Store native sign-in tokens with Expo SecureStore.

## Requirements

- Node.js and npm
- A running GeoField backend API
- Expo Go for compatible workflows, or an Android/iOS development build for native development

## Getting started

From this directory, install dependencies and configure the API URL:

```bash
npm install
```

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_API_URL=http://localhost:8000
```

Set the value to the base URL of your backend (without a trailing slash). When using a physical device, `localhost` points to the device itself. Use your computer's LAN IP address instead, and make sure the phone and computer can reach each other on the network. Restart Expo after changing environment variables.

Start the development server:

```bash
npx expo start
```

Then open the project in Expo Go, an emulator/simulator, or a development build. Available platform shortcuts are:

```bash
npm run android
npm run ios
npm run web
```

Some native modules and map workflows may require a development build instead of Expo Go. To run a native development build locally, use `npx expo run:android` or `npx expo run:ios` after setting up the relevant platform toolchain.

## App structure

| Path | Purpose |
| --- | --- |
| `src/app/(tabs)/index.tsx` | Sign-in screen |
| `src/app/register.tsx` | Account registration |
| `src/app/(tabs)/dashboard.tsx` | Workspace summary and project progress |
| `src/app/projects.tsx` | Project list and project creation |
| `src/app/tasks.tsx` | Project task management |
| `src/app/observations.tsx` | Capture and manage field observations |
| `src/app/map.tsx` | Map and inspect project observations |
| `src/components/ObservationMap.tsx` | Interactive observation map |
| `src/lib/api.ts` | Shared API request helper |

Navigation uses Expo Router file-based routes. The backend API is responsible for authentication, project/task/observation data, and dashboard summaries.

## Backend API

The app expects a GeoField backend reachable at `EXPO_PUBLIC_API_URL`. Its current requests include:

- `POST /register` and `POST /login`
- `GET /me` and `GET /dashboard`
- `GET /projects` and `POST /projects`
- Project task endpoints under `/projects/{projectId}/tasks`
- Project observation endpoints under `/projects/{projectId}/observations`

Sign-in uses an OAuth2 password form and saves the returned access token for authenticated requests. Ensure the API's CORS and network settings allow requests from the platform where the app is running.

## Development commands

```bash
npm run start       # Start Expo
npm run android     # Start Expo for Android
npm run ios         # Start Expo for iOS
npm run web         # Start Expo for web
npm run lint        # Run Expo lint
npm run reset-project # Run the Expo starter reset script (destructive to starter app files)
```

The reset script is inherited from the Expo starter and is not part of normal GeoField development.

## Notes

- Expo app configuration is in `app.json`; routes and screens live in `src/app/`.
- Foreground location permission is requested when capturing or displaying the user's location.
- The observation map loads Leaflet and OpenStreetMap tiles over the network.
- Do not commit `.env` files or place private credentials in `EXPO_PUBLIC_*` variables. Expo public variables are bundled into the client app.
