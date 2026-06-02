package com.budgetbee.ui.activities;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import androidx.appcompat.app.AppCompatActivity;
import com.budgetbee.R;
import com.budgetbee.utils.AuthManager;

public class SplashActivity extends AppCompatActivity {
    private static final long SPLASH_DURATION = 3000; // 3 seconds

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_splash);

        // Hide action bar for splash screen
        if (getSupportActionBar() != null) {
            getSupportActionBar().hide();
        }

        // Check if user is already logged in
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            AuthManager authManager = new AuthManager(SplashActivity.this);
            
            Intent intent;
            if (authManager.isLoggedIn()) {
                // User is logged in, go to main activity
                intent = new Intent(SplashActivity.this, MainActivity.class);
            } else {
                // User is not logged in, go to login activity
                intent = new Intent(SplashActivity.this, LoginActivity.class);
            }
            
            startActivity(intent);
            finish();
        }, SPLASH_DURATION);
    }
}
