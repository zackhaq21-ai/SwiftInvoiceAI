# Mobile App Setup Guide (Capacitor)

This project is configured as a cross-platform mobile app using [Capacitor](https://capacitorjs.com).
The web app builds into native iOS and Android wrappers that can be submitted to the App Store and Google Play.

## What's already done

- Capacitor core + plugins installed (`@capacitor/core`, `@capacitor/app`, `@capacitor/browser`, `@capacitor/status-bar`, `@capacitor/splash-screen`, `@capacitor/keyboard`, `@capacitor/preferences`, `@capacitor/ios`, `@capacitor/android`)
- `capacitor.config.ts` configured with app ID `com.crewbillai.app`, splash screen, status bar, and keyboard settings
- Vite `base: './'` so assets load from the bundled WebView (not a dev server origin)
- Safe-area insets added to CSS (`env(safe-area-inset-*)`) so content isn't hidden behind notches or home indicators
- Stripe Checkout now opens in the system browser via `@capacitor/browser` (required for Stripe redirects to work on mobile)
- Redirect URLs use a configurable web base URL instead of `window.location.origin` (which is `capacitor://` or `https://localhost` on native — unreachable by external services)
- `viewport-fit=cover` added for edge-to-edge layout

## Prerequisites (on your dev machine)

### For iOS (requires a Mac)
1. **macOS** (latest)
2. **Xcode 15+** from the Mac App Store
3. **CocoaPods**: `sudo gem install cocoapods`
4. Apple Developer account ($99/year) — [developer.apple.com](https://developer.apple.com)
5. App Store Connect access

### For Android (Mac, Windows, or Linux)
1. **Android Studio** (latest) — [developer.android.com/studio](https://developer.android.com/studio)
2. **Java 17+** (bundled with Android Studio)
3. Google Play Developer account ($25 one-time) — [play.google.com/console](https://play.google.com/console)

## Step-by-step: iOS

### 1. Add the iOS platform
```bash
npm run cap:sync
npx cap add ios
```
This creates an `ios/` folder with an Xcode project.

### 2. Open in Xcode
```bash
npx cap open ios
```

### 3. Configure signing in Xcode
- Click the project root in the file navigator
- Select the "Crewbill" target
- Under **Signing & Capabilities**:
  - Check "Automatically manage signing"
  - Select your Team (Apple Developer account)
  - Xcode will generate the Bundle Identifier automatically (it should be `com.crewbillai.app`)
- If you need push notifications or other capabilities, add them here

### 4. Set app icon and splash screen
- Create an app icon at 1024×1024 PNG
- In Xcode, go to `Images.xcassets` → `AppIcon` → drag your icon into the 1024 slot
- For splash screen, replace `ios/App/App/Assets.xcassets/Splash.imageset/` images with your branded splash

### 5. Configure App Store metadata
In [App Store Connect](https://appstoreconnect.apple.com):
- Create a new App
- Bundle ID: `com.crewbillai.app`
- Set app name, description, keywords, screenshots, etc.

### 6. Build and archive
- In Xcode: select a real device or "Any iOS Device"
- **Product → Archive**
- In the Organizer window that appears, click **Distribute App** → **App Store Connect**
- Follow the prompts to upload

### 7. Submit for review
- Back in App Store Connect, the build will appear under your app
- Add screenshots, description, and submit for review

## Step-by-step: Android

### 1. Add the Android platform
```bash
npm run cap:sync
npx cap add android
```
This creates an `android/` folder with a Gradle project.

### 2. Open in Android Studio
```bash
npx cap open android
```

### 3. Configure app icon and splash
- Right-click `res` → New → Image Asset
- Import your app icon (1024×1024 PNG)
- Configure splash screen in `res/values/styles.xml` (already partially set by Capacitor)

### 4. Set application ID
In `android/app/build.gradle`:
```gradle
applicationId "com.crewbillai.app"
minSdkVersion 23   // Android 6.0+
targetSdkVersion 34
```

### 5. Generate signing key
```bash
keytool -genkey -v -keystore crewbillai-release.keystore -alias crewbillai -keyalg RSA -keysize 2048 -validity 10000
```
**Keep this keystore file safe** — you need the same key for all future updates.

### 6. Configure signing in Gradle
In `android/app/build.gradle`, add inside `android { signingConfigs { ... } }`:
```gradle
signingConfigs {
    release {
        storeFile file('../crewbillai-release.keystore')
        storePassword 'your-store-password'
        keyAlias 'crewbillai'
        keyPassword 'your-key-password'
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
    }
}
```
(Or use `key.properties` file — see [Android docs](https://developer.android.com/build/building-cmdline#sign_cmdline))

### 7. Build the release bundle
```bash
cd android
./gradlew bundleRelease
```
This produces `app/build/outputs/bundle/release/app-release.aab` — the format Google Play requires.

### 8. Upload to Google Play
- Go to [Play Console](https://play.google.com/console)
- Create a new app → package name `com.crewbillai.app`
- Under **Release → Production**, click **Create release**
- Upload the `.aab` file
- Fill in store listing (screenshots, description, etc.)
- Submit for review

## Configuring the redirect URL for Stripe

Stripe Checkout needs a URL to redirect users back to after payment. On mobile, `window.location.origin` is `capacitor://` (iOS) or `https://localhost` (Android) — which Stripe can't reach.

The app uses a **deployed web URL** as the redirect target. Set it in two ways:

### Option A: Environment variable
Add to `.env`:
```
VITE_APP_URL=https://your-deployed-domain.com
```

### Option B: Runtime (persisted on device)
The app will prompt you to set this, or you can call it from a settings screen:
```ts
import { setWebBaseUrl } from '@/lib/mobile';
await setWebBaseUrl('https://your-deployed-domain.com');
```

You need a deployed web version of Crewbill (e.g., on Vercel, Netlify, or your own domain). After Stripe redirects there, the web version can deep-link back into the app if you set up a custom URL scheme.

## Custom URL scheme (optional, for deep-linking back after payment)

### iOS
In `capacitor.config.ts`, the scheme is already set to `capacitor`. To use a custom scheme like `crewbillai://`:
1. In Xcode, go to your target → **Info** → **URL Types**
2. Add URL scheme: `crewbillai`
3. Update `capacitor.config.ts`:
```ts
server: {
  iosScheme: 'crewbillai',
}
```

### Android
Add an intent filter in `android/app/src/main/AndroidManifest.xml`:
```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="crewbillai" />
</intent-filter>
```

## Workflow for updates

Every time you change the web code:
```bash
npm run cap:sync    # builds web assets + copies to native projects
npx cap open ios     # then Archive in Xcode
npx cap open android # then Build > Generate Signed Bundle in Android Studio
```

## Supabase configuration

No changes needed to Supabase — the mobile app uses the same Supabase URL and anon key from `.env`.
Session persistence works via `@capacitor/preferences` (Capacitor's secure storage), which the Supabase JS client uses automatically when running in a native WebView.

## Stripe configuration

No changes needed to your Stripe account or the edge functions. The mobile app calls the same Supabase Edge Functions (`create-checkout-session`, `create-subscription-session`), which create Stripe Checkout sessions as before. The only difference is the `success_url` / `cancel_url` now points to your deployed web URL instead of `window.location.origin`.

For App Store compliance, ensure your Stripe checkout doesn't violate Apple's rules on digital goods. Physical services (like invoicing for HVAC work) are typically fine, but review [Apple's guidelines](https://developer.apple.com/app-store/review/guidelines/) for your specific use case.
