package com.budgetbee.biometric

import android.os.Build
import android.util.Base64
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.Signature
import java.security.interfaces.ECPrivateKey
import java.util.concurrent.Executors
import javax.security.auth.x500.X500Principal
import java.security.spec.ECGenParameterSpec
import android.app.Activity

class BiometricModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private val ctx = reactContext

    override fun getName(): String {
        return "BiometricHardware"
    }

    @ReactMethod
    fun enroll(alias: String, promise: Promise) {
        try {
            val kpg = KeyPairGenerator.getInstance("EC", "AndroidKeyStore")
            val specBuilder = android.security.keystore.KeyGenParameterSpec.Builder(
                alias,
                android.security.keystore.KeyProperties.PURPOSE_SIGN or android.security.keystore.KeyProperties.PURPOSE_VERIFY
            )
            specBuilder.setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
            specBuilder.setDigests(android.security.keystore.KeyProperties.DIGEST_SHA256)
            specBuilder.setUserAuthenticationRequired(true)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                specBuilder.setInvalidatedByBiometricEnrollment(true)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                specBuilder.setIsStrongBoxBacked(true)
            }

            kpg.initialize(specBuilder.build())
            val kp = kpg.generateKeyPair()
            val pub = kp.public.encoded
            val pubB64 = Base64.encodeToString(pub, Base64.NO_WRAP)
            promise.resolve(mapOf("publicKey" to pubB64))
        } catch (e: Exception) {
            promise.reject("ENROLL_ERROR", e)
        }
    }

    @ReactMethod
    fun sign(challengeB64: String, promise: Promise) {
        try {
            val activity: Activity = currentActivity ?: run {
                promise.reject("NO_ACTIVITY", "No activity available for biometric prompt")
                return
            }

            val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
            // We don't know alias here; assume caller used a well-known alias per device.
            // Expect JS to pass alias-prefixed challenge like "alias::base64" or set alias elsewhere.
            // For backwards compatibility, this module will try to find the first key.
            val aliases = ks.aliases()
            var aliasToUse: String? = null
            while (aliases.hasMoreElements()) {
                val a = aliases.nextElement()
                if (ks.getCertificate(a) != null) { aliasToUse = a; break }
            }
            if (aliasToUse == null) { promise.reject("NO_KEY", "No key found in AndroidKeyStore"); return }

            val privateKey = ks.getKey(aliasToUse, null) as? ECPrivateKey
            if (privateKey == null) { promise.reject("NO_PRIVATE", "Private key not available"); return }

            val signature = Signature.getInstance("SHA256withECDSA")
            signature.initSign(privateKey)

            // Wrap in CryptoObject and prompt biometric
            val crypto = BiometricPrompt.CryptoObject(signature)
            val executor = Executors.newSingleThreadExecutor()
            val prompt = BiometricPrompt(activity, executor, object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    try {
                        val sig = result.cryptoObject?.signature
                        val raw = android.util.Base64.decode(challengeB64, android.util.Base64.DEFAULT)
                        sig?.update(raw)
                        val signed = sig?.sign()
                        val out = Base64.encodeToString(signed, Base64.NO_WRAP)
                        promise.resolve(mapOf("signature" to out))
                    } catch (e: Exception) {
                        promise.reject("SIGN_FAIL", e)
                    }
                }
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    // Map important biometric error codes to structured errors for JS
                    val errMap = mapOf(
                        "code" to errorCode,
                        "message" to errString.toString(),
                        "recoverable" to when (errorCode) {
                            BiometricPrompt.ERROR_NEGATIVE_BUTTON,
                            BiometricPrompt.ERROR_USER_CANCELED -> true
                            BiometricPrompt.ERROR_LOCKOUT,
                            BiometricPrompt.ERROR_LOCKOUT_PERMANENT -> false
                            else -> false
                        }
                    )
                    promise.reject("AUTH_ERROR", errString.toString(), Throwable(errMap.toString()))
                }
            })

            val info = BiometricPrompt.PromptInfo.Builder()
                .setTitle("Xác thực sinh trắc học")
                .setNegativeButtonText("Hủy")
                .build()

            prompt.authenticate(info, crypto)
        } catch (e: Exception) {
            promise.reject("SIGN_ERROR", e)
        }
    }

    @ReactMethod
    fun canAuthenticate(promise: Promise) {
        try {
            val bm = androidx.biometric.BiometricManager.from(ctx)
            val status = bm.canAuthenticate(androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG or androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL)
            // Return status integer and a helpful message
            val msg = when (status) {
                androidx.biometric.BiometricManager.BIOMETRIC_SUCCESS -> "BIOMETRIC_SUCCESS"
                androidx.biometric.BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> "NO_HARDWARE"
                androidx.biometric.BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> "HW_UNAVAILABLE"
                androidx.biometric.BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> "NONE_ENROLLED"
                else -> "UNKNOWN"
            }
            promise.resolve(mapOf("status" to status, "message" to msg))
        } catch (e: Exception) {
            promise.reject("CAN_AUTH_ERROR", e)
        }
    }
}
