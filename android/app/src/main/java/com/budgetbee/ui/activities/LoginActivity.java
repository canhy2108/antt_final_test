package com.budgetbee.ui.activities;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import com.budgetbee.R;
import com.budgetbee.api.ApiClient;
import com.budgetbee.api.ApiService;
import com.budgetbee.models.AuthResponse;
import com.budgetbee.utils.AuthManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class LoginActivity extends AppCompatActivity {
    private EditText emailEditText;
    private EditText passwordEditText;
    private Button loginButton;
    private TextView registerLink;
    private ProgressBar progressBar;
    private AuthManager authManager;
    private ApiService apiService;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_login);

        // Initialize views
        emailEditText = findViewById(R.id.emailEditText);
        passwordEditText = findViewById(R.id.passwordEditText);
        loginButton = findViewById(R.id.loginButton);
        registerLink = findViewById(R.id.registerLink);
        progressBar = findViewById(R.id.progressBar);

        // Initialize managers
        authManager = new AuthManager(this);
        apiService = ApiClient.getApiService();

        // Set up listeners
        loginButton.setOnClickListener(v -> performLogin());
        registerLink.setOnClickListener(v -> {
            startActivity(new Intent(LoginActivity.this, RegisterActivity.class));
            finish();
        });
    }

    private void performLogin() {
        String email = emailEditText.getText().toString().trim();
        String password = passwordEditText.getText().toString().trim();

        // Validation
        if (email.isEmpty()) {
            emailEditText.setError("Email is required");
            return;
        }
        if (!isValidEmail(email)) {
            emailEditText.setError("Please enter a valid email");
            return;
        }
        if (password.isEmpty()) {
            passwordEditText.setError("Password is required");
            return;
        }
        if (password.length() < 6) {
            passwordEditText.setError("Password must be at least 6 characters");
            return;
        }

        // Show progress bar
        showProgress(true);

        // Create login request
        ApiService.LoginRequest loginRequest = new ApiService.LoginRequest(email, password);

        // Make API call
        apiService.login(loginRequest).enqueue(new Callback<AuthResponse>() {
            @Override
            public void onResponse(Call<AuthResponse> call, Response<AuthResponse> response) {
                showProgress(false);

                if (response.isSuccessful() && response.body() != null) {
                    AuthResponse authResponse = response.body();
                    
                    // Save login credentials
                    authManager.saveLoginCredentials(
                            authResponse.token,
                            authResponse.user.userId,
                            authResponse.user.name,
                            authResponse.user.email
                    );

                    Toast.makeText(LoginActivity.this, "Login successful", Toast.LENGTH_SHORT).show();

                    // Navigate to MainActivity
                    Intent intent = new Intent(LoginActivity.this, MainActivity.class);
                    startActivity(intent);
                    finish();
                } else {
                    Toast.makeText(LoginActivity.this, "Login failed: " + response.message(), Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<AuthResponse> call, Throwable t) {
                showProgress(false);
                Toast.makeText(LoginActivity.this, "Error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private boolean isValidEmail(String email) {
        return email.contains("@") && email.contains(".");
    }

    private void showProgress(boolean show) {
        progressBar.setVisibility(show ? View.VISIBLE : View.GONE);
        loginButton.setEnabled(!show);
        emailEditText.setEnabled(!show);
        passwordEditText.setEnabled(!show);
    }
}
