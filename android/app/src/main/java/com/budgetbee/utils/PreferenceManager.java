package com.budgetbee.utils;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;

import java.io.IOException;
import java.security.GeneralSecurityException;

public class PreferenceManager {
    private static final String TAG = "PreferenceManager";
    private static final String PREF_NAME = "BudgetBeePrefEnc";
    private static final String KEY_AUTH_TOKEN = "auth_token";
    private static final String KEY_USER_ID = "user_id";
    private static final String KEY_USER_NAME = "user_name";
    private static final String KEY_USER_EMAIL = "user_email";
    private static final String KEY_IS_LOGGED_IN = "is_logged_in";
    private static final String KEY_SERVER_URL = "server_url";

    private static SharedPreferences sharedPreferences;

    public PreferenceManager(Context context) {
        if (sharedPreferences != null) return;
        try {
            MasterKey masterKey = new MasterKey.Builder(context)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build();
            sharedPreferences = EncryptedSharedPreferences.create(
                    context,
                    PREF_NAME,
                    masterKey,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            );
        } catch (GeneralSecurityException | IOException e) {
            Log.e(TAG, "Failed to init EncryptedSharedPreferences, falling back", e);
            sharedPreferences = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        }
    }

    // Auth Token
    public static void saveAuthToken(String token) {
        sharedPreferences.edit().putString(KEY_AUTH_TOKEN, token).apply();
    }

    public static String getAuthToken() {
        return sharedPreferences.getString(KEY_AUTH_TOKEN, "");
    }

    public static void clearAuthToken() {
        sharedPreferences.edit().remove(KEY_AUTH_TOKEN).apply();
    }

    // User Info
    public static void saveUserInfo(int userId, String name, String email) {
        sharedPreferences.edit()
                .putInt(KEY_USER_ID, userId)
                .putString(KEY_USER_NAME, name)
                .putString(KEY_USER_EMAIL, email)
                .apply();
    }

    public static int getUserId() {
        return sharedPreferences.getInt(KEY_USER_ID, -1);
    }

    public static String getUserName() {
        return sharedPreferences.getString(KEY_USER_NAME, "");
    }

    public static String getUserEmail() {
        return sharedPreferences.getString(KEY_USER_EMAIL, "");
    }

    // Login Status
    public static void setIsLoggedIn(boolean isLoggedIn) {
        sharedPreferences.edit().putBoolean(KEY_IS_LOGGED_IN, isLoggedIn).apply();
    }

    public static boolean isLoggedIn() {
        return sharedPreferences.getBoolean(KEY_IS_LOGGED_IN, false);
    }

    // Server URL
    public static void saveServerUrl(String url) {
        sharedPreferences.edit().putString(KEY_SERVER_URL, url).apply();
    }

    public static String getServerUrl() {
        return sharedPreferences.getString(KEY_SERVER_URL, "http://192.168.1.100:8000/");
    }

    // Clear all
    public static void clearAll() {
        sharedPreferences.edit().clear().apply();
    }

    // Logout
    public static void logout() {
        clearAuthToken();
        setIsLoggedIn(false);
    }
}
