package com.budgetbee.api;

import com.budgetbee.models.ApiResponse;
import com.budgetbee.models.AuthResponse;
import com.budgetbee.models.Budget;
import com.budgetbee.models.Transaction;
import com.budgetbee.models.User;

import java.util.List;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.DELETE;
import retrofit2.http.GET;
import retrofit2.http.Header;
import retrofit2.http.POST;
import retrofit2.http.PUT;
import retrofit2.http.Path;
import retrofit2.http.Query;

public interface ApiService {
    // Auth Endpoints
    @POST("api/auth/login")
    Call<AuthResponse> login(@Body LoginRequest request);

    @POST("api/auth/register")
    Call<AuthResponse> register(@Body RegisterRequest request);

    @POST("api/auth/logout")
    Call<ApiResponse<Void>> logout(@Header("Authorization") String token);

    @GET("api/user")
    Call<ApiResponse<User>> getCurrentUser(@Header("Authorization") String token);

    // Transaction Endpoints
    @GET("api/transactions")
    Call<ApiResponse<List<Transaction>>> getTransactions(
            @Header("Authorization") String token,
            @Query("type") String type,
            @Query("category") String category
    );

    @POST("api/transactions")
    Call<ApiResponse<Transaction>> createTransaction(
            @Header("Authorization") String token,
            @Body Transaction transaction
    );

    @GET("api/transactions/{id}")
    Call<ApiResponse<Transaction>> getTransaction(
            @Header("Authorization") String token,
            @Path("id") int id
    );

    @PUT("api/transactions/{id}")
    Call<ApiResponse<Transaction>> updateTransaction(
            @Header("Authorization") String token,
            @Path("id") int id,
            @Body Transaction transaction
    );

    @DELETE("api/transactions/{id}")
    Call<ApiResponse<Void>> deleteTransaction(
            @Header("Authorization") String token,
            @Path("id") int id
    );

    // Budget Endpoints
    @GET("api/budgets")
    Call<ApiResponse<List<Budget>>> getBudgets(
            @Header("Authorization") String token,
            @Query("month") String month
    );

    @POST("api/budgets")
    Call<ApiResponse<Budget>> createBudget(
            @Header("Authorization") String token,
            @Body Budget budget
    );

    @GET("api/budgets/{id}")
    Call<ApiResponse<Budget>> getBudget(
            @Header("Authorization") String token,
            @Path("id") int id
    );

    @PUT("api/budgets/{id}")
    Call<ApiResponse<Budget>> updateBudget(
            @Header("Authorization") String token,
            @Path("id") int id,
            @Body Budget budget
    );

    @DELETE("api/budgets/{id}")
    Call<ApiResponse<Void>> deleteBudget(
            @Header("Authorization") String token,
            @Path("id") int id
    );

    // Request Models
    class LoginRequest {
        public String email;
        public String password;

        public LoginRequest(String email, String password) {
            this.email = email;
            this.password = password;
        }
    }

    class RegisterRequest {
        public String name;
        public String email;
        public String password;
        public String password_confirmation;

        public RegisterRequest(String name, String email, String password) {
            this.name = name;
            this.email = email;
            this.password = password;
            this.password_confirmation = password;
        }
    }
}
