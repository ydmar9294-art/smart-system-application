import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.bac2f6ed2db54e828d262c37cac1581f',
  appName: 'Smart System',
  webDir: 'dist',
  server: {
    // Production: load from local dist folder (no remote URL)
    // Development: uncomment the url below for hot-reload
    // url: 'https://bac2f6ed-2db5-4e82-8d26-2c37cac1581f.lovableproject.com?forceHideBadge=true',
    cleartext: false,
    androidScheme: 'myapp',
    allowNavigation: [
      '*.supabase.co',
      '*.supabase.in',
      'accounts.google.com',
    ],
  },

  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#488AFF',
      sound: 'beep.wav'
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#1e293b',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#1e293b'
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true
    }
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#1e293b'
  },
  ios: {
    backgroundColor: '#1e293b',
    contentInset: 'automatic'
  }
};

export default config;
