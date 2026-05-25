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
import com.budgetbee.models.Transaction;
import com.budgetbee.ui.adapters.TransactionAdapter;
import com.budgetbee.utils.AuthManager;
import java.util.ArrayList;
import java.util.List;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class TransactionFragment extends Fragment {
    private RecyclerView transactionRecyclerView;
    private FloatingActionButton addTransactionButton;
    private TransactionAdapter transactionAdapter;
    private List<Transaction> transactionList;
    private ApiService apiService;
    private AuthManager authManager;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_transaction, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        // Initialize views
        transactionRecyclerView = view.findViewById(R.id.transactionRecyclerView);
        addTransactionButton = view.findViewById(R.id.addTransactionButton);

        // Initialize managers
        apiService = ApiClient.getApiService();
        authManager = new AuthManager(requireContext());

        // Initialize list and adapter
        transactionList = new ArrayList<>();
        transactionAdapter = new TransactionAdapter(transactionList, transaction -> onTransactionClick(transaction));

        // Set up RecyclerView
        transactionRecyclerView.setLayoutManager(new LinearLayoutManager(requireContext()));
        transactionRecyclerView.setAdapter(transactionAdapter);

        // Load transactions
        loadTransactions();

        // Set up FAB click listener
        addTransactionButton.setOnClickListener(v -> onAddTransactionClick());
    }

    private void loadTransactions() {
        String authHeader = authManager.getAuthorizationHeader();
        apiService.getTransactions(authHeader, null, null).enqueue(new Callback<ApiResponse<List<Transaction>>>() {
            @Override
            public void onResponse(Call<ApiResponse<List<Transaction>>> call, Response<ApiResponse<List<Transaction>>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    List<Transaction> transactions = response.body().data;
                    if (transactions != null) {
                        transactionList.clear();
                        transactionList.addAll(transactions);
                        transactionAdapter.notifyDataSetChanged();
                    }
                } else {
                    Toast.makeText(getContext(), "Failed to load transactions", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<List<Transaction>>> call, Throwable t) {
                Toast.makeText(getContext(), "Error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void onTransactionClick(Transaction transaction) {
        Toast.makeText(getContext(), "Clicked: " + transaction.description, Toast.LENGTH_SHORT).show();
    }

    private void onAddTransactionClick() {
        Toast.makeText(getContext(), "Add transaction feature coming soon", Toast.LENGTH_SHORT).show();
    }
}
