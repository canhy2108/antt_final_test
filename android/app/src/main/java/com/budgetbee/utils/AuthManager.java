package com.budgetbee.utils;

import android.content.Context;

public class AuthManager {
    private Context context;
    private PreferenceManager preferenceManager;

    public AuthManager(Context context) {
        this.context = context;
        this.preferenceManager = new PreferenceManager(context);
    }

    /**
     * Check if user is logged in
     */
    public boolean isLoggedIn() {
        return PreferenceManager.isLoggedIn() && !PreferenceManager.getAuthToken().isEmpty();
    }

    /**
     * Get authorization header
     */
    public String getAuthorizationHeader() {
        String token = PreferenceManager.getAuthToken();
        if (token != null && !token.isEmpty()) {
            return "Bearer " + token;
        }
        return "";
    }

    /**
     * Save login credentials
     */
    public void saveLoginCredentials(String token, int userId, String userName, String userEmail) {
        PreferenceManager.saveAuthToken(token);
        PreferenceManager.saveUserInfo(userId, userName, userEmail);
        PreferenceManager.setIsLoggedIn(true);
    }

    /**
     * Get current user ID
     */
    public int getCurrentUserId() {
        return PreferenceManager.getUserId();
    }

    /**
     * Get current user name
     */
    public String getCurrentUserName() {
        return PreferenceManager.getUserName();
    }

    /**
     * Get current user email
     */
    public String getCurrentUserEmail() {
        return PreferenceManager.getUserEmail();
    }

    /**
     * Clear all auth data and logout
     */
    public void logout() {
        PreferenceManager.logout();
    }

    /**
     * Clear all data
     */
    public void clearAllData() {
        PreferenceManager.clearAll();
    }
}
