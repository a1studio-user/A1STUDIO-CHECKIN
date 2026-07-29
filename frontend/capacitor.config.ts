import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.a1studio.checkin",
  appName: "A1打卡",
  webDir: "dist",
  ios: {
    contentInset: "automatic"
  },
  server: {
    cleartext: false
  }
};

export default config;
