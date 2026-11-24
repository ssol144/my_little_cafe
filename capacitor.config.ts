import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mylittlecafe.game',
  appName: 'MY LITTLE CAFE',
  webDir: 'dist',
  backgroundColor: '#f6ead8',
  android: {
    allowMixedContent: false,
  },
};

export default config;
