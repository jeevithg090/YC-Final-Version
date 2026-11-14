# YOGO Campus

**One app for everyday student life on campus.** YOGO Campus is a cross-platform (iOS, Android, web) companion app built with React Native and Expo. It brings the things students juggle across WhatsApp groups, notice boards and spreadsheets — mess menus, ride sharing, buying and selling, splitting bills, timetables, Q&A and more — into a single signed-in experience backed by Firebase.

## Features

| Area                    | What it does                                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dashboard**           | Greeting, upcoming class, current meal, latest event, next academic-calendar date, weather and points/badges at a glance.                      |
| **Food**                | Mess menus (veg / non-veg) per mess, meal notifications, dish "hearts" and a restaurants directory.                                            |
| **Rides**               | Auto share and cab share: publish a ride, find matching rides, join, see fare per person and seats left, ride group chat, "Your Rides".        |
| **Marketplace**         | Buy and sell listings with image upload and buyer/seller chat; Lost & Found board.                                                             |
| **Smart Bill Splitter** | Photograph a receipt, extract items with OCR (OCR.space) and AI parsing (OpenRouter, with a rule-based fallback), assign items, split tax.     |
| **Academics**           | Timetable extraction from a photo (Google Gemini), daily timetable with class reminders, academic calendar (MIT / ICAS), previous-year papers. |
| **Community**           | Q&A forum with voting and reputation, study groups, club recruitment, roommate finder with chat, sports places and groups, events.             |
| **Messaging**           | Direct messages, product chats, roommate chats and ride group chats (Firestore real-time listeners).                                           |
| **AI assistant**        | Text assistant via OpenRouter (multiple model fallbacks) and an optional Tavus video assistant.                                                |
| **Gamification**        | Points for actions, daily streaks and unlockable badges.                                                                                       |

## Tech stack

- **App:** React Native 0.79, React 19, TypeScript (strict), Expo SDK 53
- **Navigation:** React Navigation 7 (native stack)
- **Backend:** Firebase Authentication, Cloud Firestore, Realtime Database, Cloud Storage
- **AI / OCR:** Google Gemini (`@google/generative-ai`), OpenRouter, OCR.space, Tavus
- **Device APIs:** Expo Image Picker, Notifications, Location, Haptics, Linear Gradient, Blur
- **Animation:** React Native Reanimated, Moti
- **Tooling:** ESLint (`eslint-config-expo`), Prettier, Jest (`jest-expo`) + React Native Testing Library, GitHub Actions

## Architecture

```text
index.ts ─► src/App.tsx
              ├─ Firebase config missing? ─► ConfigurationRequired screen
              └─ AuthProvider (Firebase Auth state)
                   └─ NavigationContainer ─► navigation/router.tsx (native stack)
                        └─ features/*  (one screen per file)
                              ├─ services/*   Firebase, OCR, OpenRouter, Gemini, notifications, points
                              ├─ utils/*      pure, unit-tested logic (calendar, bill split, rides)
                              └─ components/* shared UI
```

- **Client-only app.** Screens talk to Firebase directly with the modular JS SDK; there is no custom backend.
- **Auth.** `AuthContext` subscribes to Firebase Auth; the router starts signed-in users on the Dashboard. On iOS/Android the session is persisted with AsyncStorage.
- **Configuration.** `src/config/firebaseConfig.ts` validates the `EXPO_PUBLIC_FIREBASE_*` variables. If any are missing the app shows a setup screen instead of crashing.
- **API keys.** Third-party keys come from `EXPO_PUBLIC_*` variables or, at runtime, the Firestore document `api_keys/keys` (`services/apiKeysService.ts`).
- **Pure logic is separated from screens** in `src/utils` so it can be unit-tested without Firebase or a device.

## Getting started

### Prerequisites

- Node.js 20+ (22 recommended; see `.nvmrc`) and npm
- A Firebase project with Authentication (Email/Password), Firestore, Realtime Database and Storage enabled
- For devices: [Expo Go](https://expo.dev/go) or a development build; Xcode / Android Studio for simulators

### 1. Install

```bash
git clone https://github.com/jeevithg090/YC-Final-Version.git
cd YC-Final-Version
npm ci
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in `.env`. Expo loads it automatically; restart the dev server after changes.

| Variable                                   | Required | Purpose                                    |
| ------------------------------------------ | -------- | ------------------------------------------ |
| `EXPO_PUBLIC_FIREBASE_API_KEY`             | Yes      | Firebase web config                        |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`         | Yes      | Firebase web config                        |
| `EXPO_PUBLIC_FIREBASE_DATABASE_URL`        | Yes      | Realtime Database URL (weather, mess data) |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID`          | Yes      | Firebase web config                        |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`      | Yes      | Image uploads                              |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Yes      | Firebase web config                        |
| `EXPO_PUBLIC_FIREBASE_APP_ID`              | Yes      | Firebase web config                        |
| `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID`      | No       | Google Analytics                           |
| `EXPO_PUBLIC_OPENROUTER_API_KEY`           | No       | AI assistant, AI bill parsing              |
| `EXPO_PUBLIC_OCR_API_KEY`                  | No       | Receipt OCR (OCR.space)                    |
| `EXPO_PUBLIC_GEMINI_API_KEY`               | No       | Timetable extraction from images           |
| `EXPO_PUBLIC_TAVUS_API_KEY`                | No       | Video assistant                            |
| `EXPO_PUBLIC_WEATHER_API_KEY`              | No       | Live weather (WeatherAPI.com)              |

> **Security:** `EXPO_PUBLIC_*` values are compiled into the app bundle and are visible to anyone who inspects it. That is expected for the Firebase web config, which is protected by security rules. For the paid third-party APIs, set usage quotas, and for a public release move those calls behind a server (for example Cloud Functions).

### 3. Set up Firebase

1. **Security rules.** Deploy the baseline rules in this repo (they require sign-in everywhere and make `api_keys` read-only from clients):

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use <your-project-id>
   firebase deploy --only firestore:rules,storage,database
   ```

   The rules are intentionally coarse; tighten them per collection before a public launch.

2. **Optional API-key document.** Instead of (or in addition to) env vars, create the Firestore document `api_keys/keys` in the Firebase console with the shape shown in [`firestore-data/api_keys.json`](firestore-data/api_keys.json).

3. **Collections** such as `users`, `cab_rides`, `auto_rides`, `products`, `qna_questions` and `billSplits` are created automatically on first write.

### 4. Academic calendar data

The academic calendar reads `src/data/calendars/MITCalendar.json` and `src/data/calendars/ICAS.json`. They ship empty (`{ "months": [] }`); fill them with your institution's dates:

```json
{
  "months": [
    {
      "name": "August",
      "events": [{ "date": "1", "day": "Fri", "event": "Commencement of classes" }]
    }
  ]
}
```

Month names are full English names; the academic year is treated as July–June.

### 5. Run

```bash
npm start          # Expo dev server; press i (iOS), a (Android) or w (web)
npm run ios        # open directly in the iOS simulator
npm run android    # open directly on an Android emulator/device
npm run web        # open in the browser
```

## Scripts

| Command                | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `npm start`            | Start the Expo dev server                       |
| `npm run lint`         | ESLint (`eslint-config-expo` + Prettier compat) |
| `npm run lint:fix`     | ESLint with auto-fix                            |
| `npm run format`       | Format all files with Prettier                  |
| `npm run format:check` | Check formatting                                |
| `npm run typecheck`    | TypeScript type-check (`tsc --noEmit`)          |
| `npm test`             | Run unit and component tests (Jest)             |
| `npm run test:ci`      | Tests with coverage, CI mode                    |
| `npm run build:web`    | Export a static web build to `dist/`            |

## Testing

Tests live next to the code in `__tests__` folders and run with Jest and the `jest-expo` preset:

- `src/utils/__tests__` — academic-calendar date maths (year rollover, DST), bill splitting (shared items, tax, rounding, unassigned items), ride occupancy and fare, display names
- `src/config/__tests__` — Firebase environment validation
- `src/components/__tests__` — `Collapsible` and `ConfigurationRequired` rendering and interaction

CI (`.github/workflows/ci.yml`) runs lint, format check, type-check, tests, a web export and an Android JS bundle on every push and pull request.

## Deployment

- **Web:** `npm run build:web` produces a static single-page app in `dist/` that can be hosted on any static host (Firebase Hosting, Netlify, Vercel). Configure the host to serve `index.html` for unknown paths. Set the `EXPO_PUBLIC_*` variables in the build environment, since they are inlined at build time.
- **iOS / Android:** build with [EAS Build](https://docs.expo.dev/build/introduction/) (`npx eas-cli build --platform ios|android`). `app.json` already contains the bundle identifiers and an EAS project ID; replace them with your own if you fork the project. Provide the `EXPO_PUBLIC_*` variables as [EAS environment variables](https://docs.expo.dev/eas/environment-variables/).

## Project structure

```text
.
├── index.ts                    # Entry point: registers src/App
├── app.json                    # Expo app config (icons, splash, plugins, web metadata)
├── assets/                     # App icons, splash, badge artwork
├── firestore-data/             # Example shape of the api_keys/keys document
├── firebase.json               # Points the Firebase CLI at the rules files
├── firestore.rules             # Firestore security rules
├── storage.rules               # Cloud Storage security rules
├── database.rules.json         # Realtime Database rules
├── src/
│   ├── App.tsx                 # Providers, config gate, navigation container
│   ├── components/             # Shared UI (Collapsible, ConfigurationRequired, ...)
│   ├── config/                 # Environment/config parsing
│   ├── constants/              # App constants
│   ├── context/                # AuthContext (Firebase Auth state)
│   ├── data/calendars/         # Academic calendar JSON
│   ├── features/               # Screens: dashboard, rides, marketplace, Q&A, ...
│   │   └── auth/               # Login, sign-up, forgot password
│   ├── hooks/                  # Shared hooks (useWeather)
│   ├── navigation/router.tsx   # Stack navigator and route params
│   ├── services/               # Firebase, OCR, OpenRouter, Gemini, notifications, points
│   ├── types/                  # Shared TypeScript types
│   └── utils/                  # Pure, unit-tested logic
└── .github/workflows/ci.yml    # Continuous integration
```

## Known limitations

- Several social features (sports groups, Q&A anonymous posts, roommate "my listings") still use placeholder user identifiers in places and need to be wired to the signed-in user.
- `SportsSocial`, `SportsLeaderboard` and `RideMatchNotifier` screens exist in `src/features` but are not registered in the navigator yet.
- The default security rules allow any signed-in user to read and write most collections.
- ESLint reports warnings (mainly unused variables and hook dependency arrays) in the larger screens; errors are enforced in CI.
