import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'app.kube.music', appName: 'Kube', webDir: 'dist',
  android: { backgroundColor: '#101113' },
  plugins: {
    SystemBars: { hidden: true, style: 'DARK', insetsHandling: 'css', initialViewportFitValueHint: 'cover' },
  },
};
export default config;
