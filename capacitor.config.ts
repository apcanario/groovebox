import type { CapacitorConfig } from "@capacitor/cli";

// G6: the APK wraps the built web app (dist/, built with `npm run build:android`).
const config: CapacitorConfig = {
  appId: "com.apcanario.groovebox",
  appName: "Groovebox",
  webDir: "dist",
  android: { backgroundColor: "#0a0a0c" },
};

export default config;
