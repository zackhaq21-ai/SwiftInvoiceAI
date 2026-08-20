import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.crewbillai.app',
  appName: 'Crewbill',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor',
  },
  android: {
    backgroundColor: '#f8fafc',
    allowMixedContent: false,
  },
  ios: {
    backgroundColor: '#f8fafc',
    contentInset: 'always',
    scrollEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#f8fafc',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      iosSpinnerMode: 'small',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#f8fafc',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true,
    },
    Browser: {
      windowStyle: 'fullscreen',
    },
  },
};

export default config;
