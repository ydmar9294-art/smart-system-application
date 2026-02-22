import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.bac2f6ed2db54e828d262c37cac1581f',
  appName: 'Smart System',
  webDir: 'dist',
  server: {
    url: 'https://bac2f6ed-2db5-4e82-8d26-2c37cac1581f.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#488AFF',
      sound: 'beep.wav'
    }
  },
  // Allow navigation within the app for hash-based routing
  android: {
    allowMixedContent: true,
  }
};

export default config;
