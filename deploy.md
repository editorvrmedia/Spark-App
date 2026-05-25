# Deployment & Distribution Guide

This document details the step-by-step instructions to deploy the Spark social application to **Vercel** (for the web) and compile it into an **Android APK** using Expo EAS or Capacitor.

---

## 1. Web Deployment (Vercel)

Vercel natively supports Vite-based React applications.

### Prerequisites
- A GitHub, GitLab, or Bitbucket repository containing this codebase.
- A free Vercel account.
- Your production Supabase URL and Anonymous API Key.

### Steps
1. **Push your code** to your remote Git repository:
   ```bash
   git add .
   git commit -m "ready for deployment"
   git push origin main
   ```
2. **Import Project to Vercel**:
   - Go to your [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New** → **Project**.
   - Import your Spark application repository.
3. **Configure Build Settings**:
   - **Framework Preset**: Detects `Vite` automatically.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. **Setup Environment Variables**:
   Under **Environment Variables**, insert the following key-value pairs matching your Supabase configuration:
   - `VITE_SUPABASE_URL` = `https://your-project-id.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `your-anon-key-string`
5. **Deploy**:
   - Click **Deploy**. Vercel will bundle the optimized chunks and assign a public `.vercel.app` URL.

---

## 2. Android APK Packaging (Expo EAS vs. Capacitor)

Since the Spark App is a responsive single-page web app built with React + Vite + TypeScript, you have two pathways to package it into an Android APK.

### Method A: Expo WebView Wrapper (Recommended for EAS Build)
This wraps your production Vercel web application in a lightweight native Expo container.

#### 1. Setup the Companion Expo Project
Create a separate project directory to host the Expo app:
```bash
npx create-expo-app spark-mobile-wrapper
cd spark-mobile-wrapper
npx expo install react-native-webview
```

#### 2. Configure the WebView Source
Replace the contents of `App.js` in your Expo project with a full-screen webview rendering your Vercel deployment:
```javascript
import React from 'react';
import { StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { WebView } from 'react-native-webview';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <WebView 
        source={{ uri: 'https://your-spark-app.vercel.app' }} 
        style={{ flex: 1 }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        allowsBackForwardNavigationGestures={true}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
```

#### 3. Run Expo EAS Build for APK
1. Install EAS CLI globally and log in:
   ```bash
   npm install -g eas-cli
   eas login
   ```
2. Configure EAS project settings:
   ```bash
   eas build:configure
   ```
3. Update `app.json` inside the Expo project to generate an APK (using `"preview"` build profile) instead of an AAB bundle:
   ```json
   {
     "expo": {
       "name": "Spark Social",
       "slug": "spark-social",
       "version": "1.0.0",
       "android": {
         "package": "com.stbrittosacademy.spark",
         "adaptiveIcon": {
           "backgroundColor": "#FFFFFF"
         }
       }
     }
   }
   ```
4. Define the `"preview"` build profile inside `eas.json` to generate an APK output:
   ```json
   {
     "build": {
       "preview": {
         "android": {
           "buildType": "apk"
         }
       }
     }
   }
   ```
5. Trigger the EAS build:
   ```bash
   eas build --platform android --profile preview
   ```
   *EAS will build the project in the cloud and return a download link for your custom `.apk` file.*

---

### Method B: Capacitor Native Wrapper (Direct Packaging)
This packages the compiled assets in the `dist` folder directly into a local Android Studio package.

1. **Install Capacitor dependencies** in this project directory:
   ```bash
   npm install @capacitor/core @capacitor/cli
   ```
2. **Initialize Capacitor configuration**:
   ```bash
   npx cap init "Spark Social" "com.stbrittosacademy.spark" --web-dir=dist
   ```
3. **Add the Android Platform package**:
   ```bash
   npm install @capacitor/android
   npx cap add android
   ```
4. **Compile and Sync Assets**:
   Run the production compiler and push the files into the Android project folder:
   ```bash
   npm run build
   npx cap sync
   ```
5. **Compile APK via Android Studio**:
   Open the native Android project in Android Studio:
   ```bash
   npx cap open android
   ```
   Inside Android Studio, choose **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)** to generate your unsigned APK locally.
