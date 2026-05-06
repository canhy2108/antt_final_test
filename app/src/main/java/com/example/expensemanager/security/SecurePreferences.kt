package com.example.expensemanager.security

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class SecurePreferences(context: Context) {

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs = EncryptedSharedPreferences.create(
        context,
        "secure_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun savePin(pin: String) {
        prefs.edit().putString("pin", pin).apply()
    }

    fun getPin(): String? = prefs.getString("pin", null)

    fun saveUser(username: String, password: String) {
        prefs.edit()
            .putString("username_$username", username)
            .putString("password_$username", password)
            .apply()
    }

    fun checkUser(username: String, password: String): Boolean {
        val savedPassword = prefs.getString("password_$username", null)
        return savedPassword != null && savedPassword == password
    }
}