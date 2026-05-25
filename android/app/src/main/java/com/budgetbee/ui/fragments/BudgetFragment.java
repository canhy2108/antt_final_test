package com.budgetbee.ui.fragments;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.google.android.material.floatingactionbutton.FloatingActionButton;
import com.budgetbee.R;
import com.budgetbee.api.ApiClient;
import com.budgetbee.api.ApiService;
import com.budgetbee.models.ApiResponse;
import com.budgetbee.models.Budget;
import com.budgetbee.ui.adapters.BudgetAdapter;
import com.budgetbee.utils.AuthManager;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class BudgetFragment extends Fragment {
    private RecyclerView budgetRecyclerView;
    private FloatingActionButton addBudgetButton;
    private BudgetAdapter budgetAdapter;
    private List<Budget> budgetList;
    private ApiService apiService;
    private AuthManager authManager;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_budget, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        // Initialize views
        budgetRecyclerView = view.findViewById(R.id.budgetRecyclerView);
        addBudgetButton = view.findViewById(R.id.addBudgetButton);

        // Initialize managers
        apiService = ApiClient.getApiService();
        authManager = new AuthManager(requireContext());

        // Initialize list and adapter
        budgetList = new ArrayList<>();
        budgetAdapter = new BudgetAdapter(budgetList, budget -> onBudgetClick(budget));

        // Set up RecyclerView
        budgetRecyclerView.setLayoutManager(new LinearLayoutManager(requireContext()));
        budgetRecyclerView.setAdapter(budgetAdapter);

        // Load budgets for current month
        loadBudgets();

        // Set up FAB click listener
        addBudgetButton.setOnClickListener(v -> onAddBudgetClick());
    }

    private void loadBudgets() {
        String authHeader = authManager.getAuthorizationHeader();
        
        // Get current month in format YYYY-MM
        String currentMonth = YearMonth.now().format(DateTimeFormatter.ofPattern("yyyy-MM"));
        
        apiService.getBudgets(authHeader, currentMonth).enqueue(new Callback<ApiResponse<List<Budget>>>() {
            @Override
            public void onResponse(Call<ApiResponse<List<Budget>>> call, Response<ApiResponse<List<Budget>>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    List<Budget> budgets = response.body().data;
                    if (budgets != null) {
                        budgetList.clear();
                        budgetList.addAll(budgets);
                        budgetAdapter.notifyDataSetChanged();
                    }
                } else {
                    Toast.makeText(getContext(), "Failed to load budgets", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<List<Budget>>> call, Throwable t) {
                Toast.makeText(getContext(), "Error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void onBudgetClick(Budget budget) {
        Toast.makeText(getContext(), "Clicked: " + budget.category, Toast.LENGTH_SHORT).show();
    }

    private void onAddBudgetClick() {
        Toast.makeText(getContext(), "Add budget feature coming soon", Toast.LENGTH_SHORT).show();
    }
}
