# Android Setup Guide - Smart System Native App

## Prerequisites

- **Node.js** 18+
- **Android Studio** (latest stable)
- **Java JDK 17+**
- **Android SDK** (API level 33+)

---

## 1. Clone & Install

```bash
git pull origin main
npm install
```

## 2. Add Android Platform

```bash
npx cap add android
```

## 3. Build & Sync

```bash
npm run build
npx cap sync android
```

## 4. Open in Android Studio

```bash
npx cap open android
```

---

## Required Capacitor Plugins (Already Installed)

| Plugin | Package | Purpose |
|--------|---------|---------|
| Core | `@capacitor/core` | Capacitor runtime |
| App | `@capacitor/app` | App lifecycle, deep links |
| Browser | `@capacitor/browser` | OAuth external browser |
| Camera | `@capacitor/camera` | Receipt/document photos |
| Clipboard | `@capacitor/clipboard` | Copy invoice data |
| Device | `@capacitor/device` | Device ID & info |
| Filesystem | `@capacitor/filesystem` | PDF/backup export |
| Geolocation | `@capacitor/geolocation` | GPS tracking |
| Haptics | `@capacitor/haptics` | Tactile feedback |
| Keyboard | `@capacitor/keyboard` | Keyboard management |
| Local Notifications | `@capacitor/local-notifications` | Offline alerts |
| Preferences | `@capacitor/preferences` | Key-value storage |
| Push Notifications | `@capacitor/push-notifications` | Firebase push |
| Share | `@capacitor/share` | Native share sheet |
| Splash Screen | `@capacitor/splash-screen` | Launch screen |
| Status Bar | `@capacitor/status-bar` | Status bar styling |
| Biometric | `capacitor-native-biometric` | Fingerprint/Face ID |

---

## 5. Android Permissions

Add the following permissions to `android/app/src/main/AndroidManifest.xml` inside the `<manifest>` tag (before `<application>`):

```xml
<!-- Internet & Network -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

<!-- GPS & Location (for agent tracking) -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />

<!-- Camera (for receipts/documents) -->
<uses-permission android:name="android.permission.CAMERA" />

<!-- Storage (for PDF export, backups) -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />

<!-- Push Notifications -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />

<!-- Biometric Authentication -->
<uses-permission android:name="android.permission.USE_BIOMETRIC" />
<uses-permission android:name="android.permission.USE_FINGERPRINT" />

<!-- Foreground Service (for background GPS) -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />

<!-- Hardware Features (optional) -->
<uses-feature android:name="android.hardware.camera" android:required="false" />
<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
<uses-feature android:name="android.hardware.location.gps" android:required="false" />
<uses-feature android:name="android.hardware.fingerprint" android:required="false" />
```

---

## 6. Firebase Setup (Push Notifications)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a project or use existing
3. Add an Android app with package: `app.lovable.a40b1c0fcee6438e9babe3634d908e73`
4. Download `google-services.json`
5. Place it in: `android/app/google-services.json`
6. Add to `android/build.gradle`:
   ```gradle
   buildscript {
       dependencies {
           classpath 'com.google.gms:google-services:4.4.2'
       }
   }
   ```
7. Add to `android/app/build.gradle`:
   ```gradle
   apply plugin: 'com.google.gms.google-services'
   ```

---

## 7. Deep Link / OAuth Setup

In `android/app/src/main/AndroidManifest.xml`, inside the main `<activity>` tag, add:

```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="myapp" />
</intent-filter>
```

---

## 8. ProGuard / Minification

Add to `android/app/proguard-rules.pro`:

```proguard
-keep class com.getcapacitor.** { *; }
-keep class app.lovable.** { *; }
-dontwarn com.google.android.gms.**
```

---

## 9. Build Commands

### Debug Build
```bash
npm run build
npx cap sync android
npx cap run android
```

### Release APK
```bash
npm run build
npx cap sync android
cd android
./gradlew assembleRelease
```

The APK will be at: `android/app/build/outputs/apk/release/app-release.apk`

### Release AAB (for Play Store)
```bash
cd android
./gradlew bundleRelease
```

The AAB will be at: `android/app/build/outputs/bundle/release/app-release.aab`

---

## 10. Signing the Release

1. Generate a keystore:
   ```bash
   keytool -genkey -v -keystore smart-system.keystore -alias smart-system -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Add to `android/app/build.gradle`:
   ```gradle
   android {
       signingConfigs {
           release {
               storeFile file('smart-system.keystore')
               storePassword 'YOUR_STORE_PASSWORD'
               keyAlias 'smart-system'
               keyPassword 'YOUR_KEY_PASSWORD'
           }
       }
       buildTypes {
           release {
               signingConfig signingConfigs.release
               minifyEnabled true
               proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
           }
       }
   }
   ```

---

## 11. Before Publishing Checklist

- [ ] `google-services.json` placed in `android/app/`
- [ ] All permissions added to `AndroidManifest.xml`
- [ ] Deep link scheme `myapp` configured
- [ ] Splash screen assets in `android/app/src/main/res/drawable/`
- [ ] App icon in all `mipmap-*` folders
- [ ] Release signing configured
- [ ] `capacitor.config.ts` → `server.url` is **commented out** (load from local dist)
- [ ] `cleartext: false` in capacitor config
- [ ] Test on physical device with GPS, notifications, biometric

---

## 12. Common Issues

| Issue | Solution |
|-------|----------|
| GPS not working | Ensure location permissions granted at runtime |
| Push not received | Verify `google-services.json` and Firebase project |
| OAuth redirect fails | Check `myapp://` scheme in AndroidManifest |
| White screen on launch | Run `npx cap sync` after `npm run build` |
| Biometric not working | Device must have fingerprint/face enrolled |

---

## Quick Commands Reference

```bash
# Full rebuild cycle
npm run build && npx cap sync android && npx cap run android

# Just sync after code changes
npx cap sync android

# Open in Android Studio
npx cap open android

# Check Capacitor doctor
npx cap doctor
```
