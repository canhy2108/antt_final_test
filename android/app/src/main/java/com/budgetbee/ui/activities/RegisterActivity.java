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

public class RegisterActivity extends AppCompatActivity {
    private EditText nameEditText;
    private EditText emailEditText;
    private EditText passwordEditText;
    private EditText confirmPasswordEditText;
    private Button registerButton;
    private TextView loginLink;
    private ProgressBar progressBar;
    private AuthManager authManager;
    private ApiService apiService;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_register);

        // Initialize views
        nameEditText = findViewById(R.id.nameEditText);
        emailEditText = findViewById(R.id.emailEditText);
        passwordEditText = findViewById(R.id.passwordEditText);
        confirmPasswordEditText = findViewById(R.id.confirmPasswordEditText);
        registerButton = findViewById(R.id.registerButton);
        loginLink = findViewById(R.id.loginLink);
        progressBar = findViewById(R.id.progressBar);

        // Initialize managers
        authManager = new AuthManager(this);
        apiService = ApiClient.getApiService();

        // Set up listeners
        registerButton.setOnClickListener(v -> performRegister());
        loginLink.setOnClickListener(v -> {
            startActivity(new Intent(RegisterActivity.this, LoginActivity.class));
            finish();
        });
    }

    private void performRegister() {
        String name = nameEditText.getText().toString().trim();
        String email = emailEditText.getText().toString().trim();
        String password = passwordEditText.getText().toString().trim();
        String confirmPassword = confirmPasswordEditText.getText().toString().trim();

        // Validation
        if (name.isEmpty()) {
            nameEditText.setError("Name is required");
            return;
        }
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
        if (password.length() < 8) {
            passwordEditText.setError("Password must be at least 8 characters");
            return;
        }
        if (!password.equals(confirmPassword)) {
            confirmPasswordEditText.setError("Passwords do not match");
            return;
        }
        if (!hasValidPassword(password)) {
            passwordEditText.setError("Password must contain uppercase, lowercase, number, and special character");
            return;
        }

        // Show progress bar
        showProgress(true);

        // Create register request
        ApiService.RegisterRequest registerRequest = new ApiService.RegisterRequest(name, email, password);

        // Make API call
        apiService.register(registerRequest).enqueue(new Callback<AuthResponse>() {
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

                    Toast.makeText(RegisterActivity.this, "Registration successful", Toast.LENGTH_SHORT).show();

                    // Navigate to MainActivity
                    Intent intent = new Intent(RegisterActivity.this, MainActivity.class);
                    startActivity(intent);
                    finish();
                } else {
                    Toast.makeText(RegisterActivity.this, "Registration failed: " + response.message(), Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<AuthResponse> call, Throwable t) {
                showProgress(false);
                Toast.makeText(RegisterActivity.this, "Error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private boolean isValidEmail(String email) {
        return email.contains("@") && email.contains(".");
    }

    private boolean hasValidPassword(String password) {
        boolean hasUppercase = password.matches(".*[A-Z].*");
        boolean hasLowercase = password.matches(".*[a-z].*");
        boolean hasDigit = password.matches(".*\\d.*");
        boolean hasSpecialChar = password.matches(".*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>/?].*");
        return hasUppercase && hasLowercase && hasDigit && hasSpecialChar;
    }

    private void showProgress(boolean show) {
        progressBar.setVisibility(show ? View.VISIBLE : View.GONE);
        registerButton.setEnabled(!show);
        nameEditText.setEnabled(!show);
        emailEditText.setEnabled(!show);
        passwordEditText.setEnabled(!show);
        confirmPasswordEditText.setEnabled(!show);
    }
}
