import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.disha.diagnostics.phlebo',
  appName: 'Disha Phlebo',
  webDir: 'dist',
  // Fix: Removed 'bundledWebRuntime' as it is no longer part of CapacitorConfig in modern versions
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#5F259F",
      showSpinner: true,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#ffffff"
    }
  }
};

export default config;