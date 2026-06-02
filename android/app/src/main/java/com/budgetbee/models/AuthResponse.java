package com.budgetbee.models;

import com.google.gson.annotations.SerializedName;

public class AuthResponse {
    @SerializedName("success")
    public boolean success;

    @SerializedName("message")
    public String message;

    @SerializedName("token")
    public String token;

    @SerializedName("user")
    public User user;

    @SerializedName("data")
    public AuthData data;

    public static class AuthData {
        @SerializedName("user")
        public User user;

        @SerializedName("token")
        public String token;

        @SerializedName("access_token")
        public String accessToken;

        public AuthData() {}
    }

    public AuthResponse() {}

    @Override
    public String toString() {
        return "AuthResponse{" +
                "success=" + success +
                ", message='" + message + '\'' +
                ", token='" + token + '\'' +
                ", user=" + user +
                '}';
    }
}

