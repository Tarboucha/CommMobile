# KoDo Mobile App

Mobile App for KoDo — Dein Dorf in der Stadt. A community marketplace connecting local providers with members.

Built with [Expo](https://expo.dev) & React Native.

---

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Add your API URLs and Supabase credentials
   ```

3. **Start the app**
   ```bash
   npx expo start
   ```

4. **Run on device**
   - **Android**: `npx expo run:android` (USB debugging required)
   - **iOS**: `npx expo run:ios` (macOS only)
   - **Development Build**: Required for custom native configs

---

## Tech Stack

- **Framework**: React Native + Expo SDK 54
- **Routing**: Expo Router (File-based)
- **Authentication**: Supabase
- **State Management**: Zustand + React Context
- **Storage**: AsyncStorage
- **API Client**: Fetch with Auth + Retry
- **Styling**: NativeWind (Tailwind CSS)
- **Theme**: Dark/Light Mode

---

## Environment Variables

Create `.env` file:
```bash
EXPO_PUBLIC_API_URL=your-api-url
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

---

## Building

### Development Build
```bash
# Android
npx expo run:android

# iOS (macOS only)
npx expo run:ios
```

### Production Build
```bash
eas build --platform android
eas build --platform ios
```

---

This project is part of the KoDo platform.
