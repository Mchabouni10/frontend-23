import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rawdahremodeling.app',
  appName: 'Rawdah Remodeling',
  webDir: 'build',
  android: {
    // Only allow mixed content (http:// from an https:// origin) when we
    // are explicitly developing against a local backend. Production MUST
    // use HTTPS and have this set to false.
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: 'https',
    // Allow plain http requests ONLY to localhost (dev backend). Production
    // API must be served over HTTPS.
    cleartext: false,
    // Capacitor 5+ uses allowNavigation to limit which URLs the WebView can
    // navigate to. Keep this strict.
    allowNavigation: [
      'https://rawdahremodeling.com',
      'https://*.rawdahremodeling.com',
    ],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: '#ffffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: true,
      androidSpinnerStyle: 'large',
      iosSpinnerStyle: 'small',
      spinnerColor: '#999999',
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
  ios: {
    // Add iOS-specific configurations here if needed
  },
};

export default config;