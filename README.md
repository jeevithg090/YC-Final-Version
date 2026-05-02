# University Companion App (YOGO Campus)

Cross-platform student companion app built with React Native + Expo to simplify daily campus workflows such as food planning, ride sharing, marketplace activity, bill splitting, timetable management, and social collaboration.

Repository: [https://github.com/jeevithg090/YC-Final-Version](https://github.com/jeevithg090/YC-Final-Version)

## Project Overview

This project is a full-stack mobile application focused on practical campus use-cases:

- Multi-module student dashboard for quick campus actions
- Mess menu, food updates, and notifications
- Auto/cab share discovery, publishing, and ride group chat
- Campus marketplace (buy/sell + product chat)
- Roommate finder and direct chat
- Smart bill splitting with OCR and AI-assisted parsing
- Q&A forum and student social utilities
- Timetable extraction and management from images (Gemini)
- Firebase-backed auth and data workflows

This is the core codebase behind the University Companion App project.

## Key Features

### Daily Campus Utilities
- Dashboard with campus highlights and quick actions
- Daily timetable and academic calendar tools
- Weather integration and class-related alerts
- Events and campus notices

### Mobility
- Auto share and cab share flows:
  - Find rides
  - Publish rides
  - Ride detail views
  - Group chat per ride
  - Personal ride tracking

### Community and Social
- Study groups
- Club recruitment
- Q&A forum and thread pages
- Roommate finder + roommate chat

### Commerce and Expenses
- Marketplace (buy/sell flows)
- Product-level buyer/seller chat
- Smart bill splitter:
  - OCR-based text extraction
  - AI fallback parsing (OpenRouter)
  - Per-person item assignment and split calculations

### AI Integrations
- Gemini-based timetable image extraction
- OpenRouter model fallback pipeline for bill parsing
- AI assistant/chat module and Tavus video assistant hooks

## Tech Stack

- **Frontend**: React Native, TypeScript, Expo SDK 53
- **Navigation**: React Navigation (Native Stack)
- **Backend Services**: Firebase Auth, Firestore, Realtime DB, Storage
- **AI/OCR**:
  - Google Gemini (`@google/generative-ai`)
  - OpenRouter
  - OCR.space
- **Device Integrations**: Expo Image Picker, Notifications, Location, Calendar, Maps

## Project Structure

```text
YC-Final-Version/
├── app/                        # Expo Router scaffold files
├── assets/                     # Images, icons, media
├── firestore-data/             # Seed-like helper JSON (e.g., api_keys)
├── src/
│   ├── App.tsx                 # Main app composition (providers + router)
│   ├── context/                # Auth context
│   ├── features/               # Feature screens/modules
│   ├── hooks/                  # Shared hooks (e.g., weather)
│   ├── navigation/             # Root navigation stack
│   ├── services/               # Firebase, OCR, AI, notifications, points
│   ├── constants/              # App constants and key bootstrap
│   └── types/                  # TypeScript domain types
├── .env.example
├── app.json
├── package.json
└── tsconfig.json
```

## Setup

### 1. Clone and install

```bash
git clone https://github.com/jeevithg090/YC-Final-Version.git
cd YC-Final-Version
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill values:

```bash
cp .env.example .env
```

Required variables:

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_DATABASE_URL`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID`
- `EXPO_PUBLIC_OPENROUTER_API_KEY`
- `EXPO_PUBLIC_OCR_API_KEY`
- `EXPO_PUBLIC_GEMINI_API_KEY`
- `EXPO_PUBLIC_TAVUS_API_KEY`

### 3. Firebase setup

Create/configure these key collections used by the app:

- `users`
- `billSplits`
- `extracted_timetables`
- `notification_settings`
- `api_keys` (document `keys`)

`firestore-data/api_keys.json` shows the expected API key doc shape:

```json
{
  "keys": {
    "GEMINI_API_KEY": "REPLACE_ME",
    "OPENROUTER_API_KEY": "REPLACE_ME",
    "OCR_API_KEY": "REPLACE_ME",
    "TAVUS_API_KEY": "REPLACE_ME"
  }
}
```

### 4. Run the app

```bash
npm run start
```

Then choose:

- `a` for Android
- `i` for iOS
- `w` for web

## Scripts

- `npm run start` - Start Expo dev server
- `npm run android` - Open Android flow
- `npm run ios` - Open iOS flow
- `npm run web` - Open web build
- `npm run lint` - Run lint checks

## Security Notes

- Never commit real API keys.
- `EXPO_PUBLIC_*` values are client-exposed by design in Expo apps.
- For production, move sensitive AI/OCR operations to a secure backend.

## Status

Active feature-rich campus app codebase with multiple modules integrated into one student platform.

