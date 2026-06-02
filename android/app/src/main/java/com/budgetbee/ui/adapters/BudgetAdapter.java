package com.budgetbee.ui.adapters;

import android.graphics.Color;
import android.view.LayoutInflater;
import android.view.ViewGroup;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import com.budgetbee.databinding.ItemBudgetBinding;
import com.budgetbee.models.Budget;
import com.budgetbee.utils.Utils;
import java.util.List;

public class BudgetAdapter extends RecyclerView.Adapter<BudgetAdapter.ViewHolder> {
    private List<Budget> budgets;
    private OnBudgetClickListener listener;

    public BudgetAdapter(List<Budget> budgets, OnBudgetClickListener listener) {
        this.budgets = budgets;
        this.listener = listener;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        ItemBudgetBinding binding = ItemBudgetBinding.inflate(
                LayoutInflater.from(parent.getContext()), parent, false);
        return new ViewHolder(binding);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Budget budget = budgets.get(position);
        holder.bind(budget);
    }

    @Override
    public int getItemCount() {
        return budgets != null ? budgets.size() : 0;
    }

    public void updateBudgets(List<Budget> newBudgets) {
        budgets = newBudgets;
        notifyDataSetChanged();
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        private ItemBudgetBinding binding;

        public ViewHolder(ItemBudgetBinding binding) {
            super(binding.getRoot());
            this.binding = binding;
        }

        public void bind(Budget budget) {
            binding.budgetCategory.setText(budget.category);
            binding.budgetAmount.setText(Utils.formatCurrency(budget.limitAmount));
            binding.budgetSpent.setText("Spent: " + Utils.formatCurrency(budget.spentAmount));
            binding.budgetRemaining.setText("Remaining: " + Utils.formatCurrency(budget.getRemainingAmount()));

            double percentage = budget.getPercentageUsed();
            binding.budgetProgress.setProgress((int) Math.min(percentage, 100));

            // Change progress bar color based on usage
            int color = Color.GREEN;
            if (percentage > 75) {
                color = Color.RED;
            } else if (percentage > 50) {
                color = Color.YELLOW;
            }
            binding.budgetProgress.setProgressTintList(
                    android.content.res.ColorStateList.valueOf(color));

            itemView.setOnClickListener(v -> {
                if (listener != null) {
                    listener.onBudgetClick(budget);
                }
            });
        }
    }

    public interface OnBudgetClickListener {
        void onBudgetClick(Budget budget);
    }
}
