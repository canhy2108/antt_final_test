# Wiring the BiometricHardware native module

This document covers what to do AFTER `expo prebuild` to get the
hardware-backed Phase B path working. Without these steps,
`biometricKeysApi.isAvailable()` returns `false` and the app falls
back to Phase A (opaque `bio_token` gated by OS biometric).

## Prerequisites

The managed Expo workflow does not allow adding bare native modules.
You must eject (prebuild) once:

```bash
cd expo-app
npx expo prebuild --platform all
```

This generates the `android/` and `ios/` directories that Xcode and
Android Studio open.

## Android

The Kotlin module already lives at
`src/native/android/BiometricModule.kt`. Move it into the Android project:

```bash
mkdir -p android/app/src/main/java/com/budgetbee/biometric
cp src/native/android/BiometricModule.kt \
   android/app/src/main/java/com/budgetbee/biometric/
```

Add the React Native package class:

```kotlin
// android/app/src/main/java/com/budgetbee/biometric/BiometricPackage.kt
package com.budgetbee.biometric

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class BiometricPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(BiometricModule(reactContext))
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
```

Register in `android/app/src/main/java/<package>/MainApplication.kt`:

```kotlin
override fun getPackages(): List<ReactPackage> {
    return PackageList(this).packages.apply {
        add(BiometricPackage())   // ← add this
    }
}
```

Add the AndroidX biometric dependency:

```gradle
// android/app/build.gradle
dependencies {
    implementation("androidx.biometric:biometric:1.2.0-alpha05")
    // ...existing...
}
```

Required `AndroidManifest.xml` permissions:

```xml
<uses-permission android:name="android.permission.USE_BIOMETRIC" />
<uses-permission android:name="android.permission.USE_FINGERPRINT" />
```

## iOS

The Swift module lives at `src/native/ios/BiometricModule.swift`. Copy
into the Xcode workspace:

```bash
mkdir -p ios/BudgetBee/Biometric
cp src/native/ios/BiometricModule.swift ios/BudgetBee/Biometric/
```

Open `ios/BudgetBee.xcworkspace` in Xcode and:

1. Right-click the `BudgetBee` group → "Add Files to BudgetBee…"
2. Select the new `Biometric/BiometricModule.swift`
3. Make sure "Copy items if needed" is OFF, target = BudgetBee
4. When prompted to create a bridging header, accept ("Create Bridging Header")

Add the React module export in a new file
`ios/BudgetBee/Biometric/BiometricModuleBridge.m`:

```objc
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(BiometricHardware, NSObject)
RCT_EXTERN_METHOD(enroll:(NSString *)alias
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(sign:(NSString *)challengeB64
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
@end
```

Required `Info.plist` entry:

```xml
<key>NSFaceIDUsageDescription</key>
<string>Dùng Face ID để đăng nhập nhanh và bảo vệ tài khoản BudgetBee.</string>
```

## Verifying the wire-up

After rebuilding:

```bash
# Android
npx expo run:android

# iOS
npx expo run:ios
```

In the JS console:

```ts
import BiometricNative from '@/native/BiometricNative';
BiometricNative.canAuthenticate().then(console.log);
// Expected on real device: { status: 0, message: 'BIOMETRIC_SUCCESS' }
```

If you get "BiometricHardware native module not installed", check:

- Did you re-run `expo run:android` / `expo run:ios` after editing
  MainApplication / Xcode project? Reloading JS is not enough.
- On Android: is `BiometricPackage` in `getPackages()`?
- On iOS: does the bridging header import `<React/RCTBridgeModule.h>`?

## Threat model coverage

| Attack | Phase A only | Phase B (this wire-up) |
|---|---|---|
| Root extracts `bio_token` from Keystore | ✗ Replay works | ✓ Only public key on server; private key in StrongBox |
| MitM captures login packet | ✗ Replay works | ✓ Nonce is one-shot, expires in 60s |
| User adds another fingerprint after enrol | Snapshot mismatch invalidates locally (defence-in-depth) | ✓ Key auto-invalidated by `setInvalidatedByBiometricEnrollment(true)` |
| Modified APK / emulator forges biometric | ✗ OS prompt may fake-pass | Partially: combine with Play Integrity (`/attest/verify`) |
| Server DB leak | ✓ Only hashes leak | ✓ Only public keys leak (not usable for forging) |

Phase B closes the holes Phase A leaves, but the OS-biometric-is-device-
owner-not-account-owner issue is fundamental to mobile platforms.
See `docs/EKYC_FACE_RECOGNITION_DESIGN.md` for the Phase C plan that
actually verifies "the BudgetBee account owner is the one scanning" via
server-side face embeddings.
