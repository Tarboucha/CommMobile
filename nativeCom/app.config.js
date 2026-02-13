export default {
  expo: {
    name: 'KoDo',
    slug: 'kodo',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './src/assets/images/icon.png',
    scheme: 'kodo',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    splash: {
      image: './src/assets/images/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.kodo.app',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './src/assets/images/android-icon-foreground.png',
        backgroundImage: './src/assets/images/android-icon-background.png',
        monochromeImage: './src/assets/images/android-icon-monochrome.png',
        backgroundColor: '#ffffff',
      },
      package: 'com.kodo.app',
      // Allow HTTP traffic for local development
      usesCleartextTraffic: true,
      // Firebase for push notifications
      googleServicesFile: './google-services.json',
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './src/assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      'expo-font',
      '@react-native-community/datetimepicker',
      [
        'expo-build-properties',
        {
          android: {
            usesCleartextTraffic: true,
          },
        },
      ],
      [
        'expo-notifications',
        {
          icon: './src/assets/images/android-icon-monochrome.png',
          color: '#ffffff',
          sounds: [],
          mode: 'production',
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      // Development
      apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.140:3002',
      socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL || 'http://192.168.0.140:3002',

      // Production
      apiUrlProd: process.env.EXPO_PUBLIC_API_URL_PROD || 'https://api.kodo.app',
      socketUrlProd: process.env.EXPO_PUBLIC_SOCKET_URL_PROD || 'https://api.kodo.app',

      // Supabase - IMPORTANT: Use EXPO_PUBLIC_ vars for mobile (not SUPABASE_URL which is for backend proxy)
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://tfqnsdhgvpxjzerdbmim.supabase.co',
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',

      eas: {
        projectId: '50a07a1c-018f-48b1-9f8d-6f179c5789f5',
      },
    },
  },
};
