Native Biometric Module Implementation Guide
==========================================

This document provides sample native implementations for the `BiometricHardware`
module used by the JS wrapper in `expo-app/src/native/BiometricNative.ts`.

Android (Kotlin)
-----------------

Create a native module that exposes two async methods: `enroll(alias: String): String`
and `sign(alias: String, challenge: String): String`.

Enrollment (creates ECC P-256 keypair in Android Keystore / StrongBox):

```kotlin
fun enrollDevice(alias: String): String? {
    val kpg = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore")
    val parameterSpec = KeyGenParameterSpec.Builder(
        alias,
        KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
    ).run {
        setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
        setDigests(KeyProperties.DIGEST_SHA256)
        setUserAuthenticationRequired(true)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            setInvalidatedByBiometricEnrollment(true)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            setIsStrongBoxBacked(true)
        }
        build()
    }
    kpg.initialize(parameterSpec)
    val keyPair = kpg.generateKeyPair()
    return Base64.encodeToString(keyPair.public.encoded, Base64.DEFAULT)
}
```

Authentication / Signing (prompt user with BiometricPrompt and sign a challenge):

```kotlin
fun signChallenge(alias: String, challenge: String, callback: (String?) -> Unit) {
    val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    val privateKey = ks.getKey(alias, null) as PrivateKey
    val signature = Signature.getInstance("SHA256withECDSA").apply { initSign(privateKey) }

    val cryptoObject = BiometricPrompt.CryptoObject(signature)

    val biometricPrompt = BiometricPrompt(activity, executor, object : BiometricPrompt.AuthenticationCallback() {
        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
            val signedSignature = result.cryptoObject?.signature
            signedSignature?.update(challenge.toByteArray())
            val signedBytes = signedSignature?.sign()
            callback(Base64.encodeToString(signedBytes, Base64.DEFAULT))
        }
    })

    val promptInfo = BiometricPrompt.PromptInfo.Builder()
        .setTitle("Xác thực sinh trắc học")
        .setNegativeButtonText("Hủy")
        .build()

    biometricPrompt.authenticate(promptInfo, cryptoObject)
}
```

Notes for Android implementers:
- Handle errors such as `BIOMETRIC_ERROR_LOCKOUT` and `BIOMETRIC_ERROR_HW_NOT_PRESENT`.
- Use `setInvalidatedByBiometricEnrollment(true)` so keys become invalid if the biometric set changes.
- Prefer StrongBox (`setIsStrongBoxBacked(true)`) when available.
- Return the public key as Base64 (or PEM) to be uploaded to the server.


iOS (Swift)
-------------

Create a native module that exposes `enroll(alias: String) -> String?` and
`sign(alias: String, challenge: String, completion: (String?) -> Void)`.

Enrollment (create key in Secure Enclave with biometryCurrentSet access):

```swift
func enrollDevice(alias: String) -> String? {
    let access = SecAccessControlCreateWithFlags(
        nil,
        kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
        .biometryCurrentSet,
        nil
    )

    let attributes: [String: Any] = [
        kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
        kSecAttrKeySizeInBits as String: 256,
        kSecAttrTokenID as String: kSecAttrTokenIDSecureEnclave,
        kSecPrivateKeyAttrs as String: [
            kSecAttrIsPermanent as String: true,
            kSecAttrApplicationTag as String: alias.data(using: .utf8)!,
            kSecAttrAccessControl as String: access!
        ]
    ]

    var error: Unmanaged<CFError>?
    guard let privateKey = SecKeyCreateRandomKey(attributes as CFDictionary, &error) else { return nil }
    let publicKey = SecKeyCopyPublicKey(privateKey)
    let publicKeyData = SecKeyCopyExternalRepresentation(publicKey!, &error) as Data?
    return publicKeyData?.base64EncodedString()
}
```

Signing (prompt system biometric UI and sign inside Secure Enclave):

```swift
func signChallenge(alias: String, challenge: String, completion: @escaping (String?) -> Void) {
    let query: [String: Any] = [
        kSecClass as String: kSecClassKey,
        kSecAttrApplicationTag as String: alias.data(using: .utf8)!,
        kSecReturnRef as String: true,
        kSecUseOperationPrompt as String: "Xác thực để ký giao dịch"
    ]

    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)

    if status == errSecSuccess, let privateKey = item as! SecKey? {
        let challengeData = challenge.data(using: .utf8)!
        var error: Unmanaged<CFError>?
        if let signature = SecKeyCreateSignature(privateKey, .ecdsaSignatureMessageX962SHA256, challengeData as CFData, &error) {
            completion((signature as Data).base64EncodedString())
            return
        }
    }
    completion(nil)
}
```

Notes for iOS implementers:
- Use `.biometryCurrentSet` to tie the key to the current set of enrolled biometrics.
- The system will present FaceID/TouchID UI when `SecItemCopyMatching` is called with `kSecUseOperationPrompt`.
- Store only the public key on the server; never send or store private key or raw biometric images.


Additional Recommendations
-----------------------

- Server endpoints: `/biometric/register`, `/biometric/challenge`, `/biometric/verify`.
- Server should store `public_key` per `user_id` and `device_id` (table `user_devices`).
- Server should generate short-lived nonces in cache/Redis and verify signatures using the stored public key.
- Implement Refresh Token Rotation as described in OWASP guidance.
- Integrate Play Integrity (Android) and App Attest (iOS) to reduce risk from modified clients.

Play Integrity (Android) / App Attest (iOS)
-----------------------------------------

Before performing any sensitive operation (enrollment/signing), call the platform attestation service to ensure the app and device are trustworthy.

Android (Play Integrity) - high level:
- Use Google Play Integrity API to request an integrity token from the device (via Google Play Services).
- Send the token to your backend for verification (check APK signing, device tampering, etc.).
- Only proceed with key generation/signing on the client if the attestation indicates a valid environment.

iOS (App Attest) - high level:
- Use DeviceCheck / App Attest to generate an attestation object tied to your app instance.
- Send the attestation to the server to verify the key and app integrity before allowing enrollment or signing.

Biometric error handling (Android)
---------------------------------

The Android native module exposes `canAuthenticate()` and returns structured errors from `onAuthenticationError`.
Handle important codes in JS:
- `BIOMETRIC_ERROR_LOCKOUT` (temporary lockout): show a message and fallback to PIN.
- `BIOMETRIC_ERROR_LOCKOUT_PERMANENT`: prompt the user to confirm device credential (PIN) to re-enable.
- `BIOMETRIC_ERROR_USER_CANCELED` / negative button: treat as user-cancel and return to password flow.

Note: iOS will surface system dialogs automatically when using `kSecUseOperationPrompt`; handle `errSecAuthFailed` and display alternatives.

Suggested next steps I can implement for you:
1. Create Laravel migration + model for `user_devices` and a basic controller with `/biometric/challenge` and `/biometric/verify` endpoints.
2. Produce full native module skeletons (Kotlin + Swift) that compile and expose RN methods.
3. Add CI checks or lint rules to detect accidental commits of biometric images.

Tell me which of the above you want me to start next.
