package com.example.expensemanager.security

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class SecurePreferences(context: Context) {

    private var prefs: SharedPreferences? = null

    init {
        try {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()

            prefs = EncryptedSharedPreferences.create(
                context,
                "secure_prefs",
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) {
            Log.e("SecurePreferences", "Error initializing EncryptedSharedPreferences", e)
            // Nếu lỗi KeyStore, xóa file cũ để khởi tạo lại, tránh crash app
            context.getSharedPreferences("secure_prefs", Context.MODE_PRIVATE).edit().clear().apply()
            try {
                val masterKey = MasterKey.Builder(context)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build()
                prefs = EncryptedSharedPreferences.create(
                    context,
                    "secure_prefs",
                    masterKey,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
                )
            } catch (e2: Exception) {
                // Fallback về SharedPreferences thông thường nếu vẫn lỗi (vẫn tốt hơn là crash)
                prefs = context.getSharedPreferences("secure_prefs_fallback", Context.MODE_PRIVATE)
            }
        }
    }

    fun saveUser(username: String, password: String) {
        prefs?.edit()?.apply {
            putString("username_$username", username)
            putString("password_$username", password)
            apply()
        }
    }

    fun checkUser(username: String, password: String): Boolean {
        val savedPassword = prefs?.getString("password_$username", null)
        return savedPassword != null && savedPassword == password
    }

    fun isCorrectPin(input: String): Boolean {
        return input == "1234"
    }
}
