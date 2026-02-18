import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.venecambioapp.official',
  appName: 'VeneCambio',
  webDir: 'out',
  server: {
    url: 'https://venecambio.com',
    cleartext: true
  }
};

export default config;
