import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mylittlecafe.game',
  appName: 'MY LITTLE CAFE',
  webDir: 'dist',
  backgroundColor: '#f6ead8',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    // Native Google account picker; the web Firebase SDK signs in with the returned credential.
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ['google.com'],
    },
  },
};

export default config;
