import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Native shell config for the Android APK build.
 *
 *   npm run build
 *   npx cap add android      # once
 *   npx cap sync android
 *   cd android && ./gradlew assembleDebug
 *
 * The resulting APK lives at android/app/build/outputs/apk/debug/app-debug.apk
 */
const config: CapacitorConfig = {
  appId: 'com.bazaar.marketplace',
  appName: 'Bazaar',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: '#0B1220',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
  },
};

export default config;
