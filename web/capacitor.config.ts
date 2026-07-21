import type { CapacitorConfig } from "@capacitor/cli";

// APK 빌드: CAPACITOR_BUILD=1 NEXT_PUBLIC_API_ABSOLUTE=https://<백엔드> npm run build
// → npx cap sync → Android Studio에서 android/ 빌드
const config: CapacitorConfig = {
  appId: "com.agentguard.app",
  appName: "AgentGuard",
  webDir: "out",
  android: { allowMixedContent: false },
};

export default config;
