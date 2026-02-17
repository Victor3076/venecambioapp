import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.venecambio.app',
  appName: 'VeneCambio',
  webDir: 'out',
  server: {
    url: 'https://venecambioapp.vercel.app',
    cleartext: true
  }
};

export default config;
