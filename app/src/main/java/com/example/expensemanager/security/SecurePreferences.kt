package com.example.expensemanager.security

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class SecurePreferences(context: Context) {

    private val prefs: SharedPreferences

    companion object {
        @Volatile
        private var INSTANCE: SharedPreferences? = null

        private fun getPrefs(context: Context): SharedPreferences {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: initPrefs(context.applicationContext).also { INSTANCE = it }
            }
        }

        private fun initPrefs(context: Context): SharedPreferences {
            return try {
                val masterKey = MasterKey.Builder(context)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build()

                EncryptedSharedPreferences.create(
                    context,
                    "secure_prefs",
                    masterKey,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
                )
            } catch (e: Exception) {
                Log.e("SecurePreferences", "Error initializing EncryptedSharedPreferences", e)
                try {
                    context.getSharedPreferences("secure_prefs", Context.MODE_PRIVATE).edit().clear().apply()
                    val masterKey = MasterKey.Builder(context)
                        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                        .build()
                    EncryptedSharedPreferences.create(
                        context,
                        "secure_prefs",
                        masterKey,
                        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
                    )
                } catch (e2: Exception) {
                    Log.e("SecurePreferences", "Fallback to regular SharedPreferences", e2)
                    context.getSharedPreferences("secure_prefs_fallback", Context.MODE_PRIVATE)
                }
            }
        }
    }

    init {
        prefs = getPrefs(context)
    }

    fun saveUser(username: String, password: String, pin: String, question: String, answer: String) {
        prefs.edit().apply {
            putString("username_$username", username)
            putString("password_$username", password)
            putString("pin_$username", pin)
            putString("question_$username", question)
            putString("answer_$username", answer)
            putString("last_active_user", username)
            apply()
        }
    }

    fun getCurrentUser(): String? {
        return prefs.getString("last_active_user", null)
    }

    fun setCurrentUser(username: String?) {
        if (username.isNullOrEmpty()) {
            prefs.edit().remove("last_active_user").apply()
        } else {
            prefs.edit().putString("last_active_user", username).apply()
        }
    }

    fun saveAvatarUri(username: String, uri: String) {
        prefs.edit().putString("avatar_$username", uri).apply()
    }

    fun getAvatarUri(username: String): String? {
        return prefs.getString("avatar_$username", null)
    }

    fun checkUser(username: String, password: String): Boolean {
        val savedPassword = prefs.getString("password_$username", null)
        return savedPassword != null && savedPassword == password
    }

    fun isCorrectPin(username: String, input: String): Boolean {
        val savedPin = prefs.getString("pin_$username", null)
        return savedPin != null && savedPin == input
    }

    fun getSecurityQuestion(username: String): String? {
        return prefs.getString("question_$username", null)
    }

    fun verifyRecovery(username: String, answer: String): Boolean {
        val savedAnswer = prefs.getString("answer_$username", null)
        return savedAnswer != null && savedAnswer.equals(answer, ignoreCase = true)
    }

    fun resetCredentials(username: String, newPass: String, newPin: String) {
        prefs.edit().apply {
            putString("password_$username", newPass)
            putString("pin_$username", newPin)
            apply()
        }
    }
}
