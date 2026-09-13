import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zcode.currencywars',
  appName: '货币战争·零和博弈',
  webDir: 'dist',
  android: {
    allowMixedContent: false
  }
};

export default config;
