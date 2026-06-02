package com.budgetbee.ui.adapters;

import android.graphics.Color;
import android.view.LayoutInflater;
import android.view.ViewGroup;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import com.budgetbee.databinding.ItemTransactionBinding;
import com.budgetbee.models.Transaction;
import com.budgetbee.utils.Utils;
import java.util.List;

public class TransactionAdapter extends RecyclerView.Adapter<TransactionAdapter.ViewHolder> {
    private List<Transaction> transactions;
    private OnTransactionClickListener listener;

    public TransactionAdapter(List<Transaction> transactions, OnTransactionClickListener listener) {
        this.transactions = transactions;
        this.listener = listener;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        ItemTransactionBinding binding = ItemTransactionBinding.inflate(
                LayoutInflater.from(parent.getContext()), parent, false);
        return new ViewHolder(binding);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Transaction transaction = transactions.get(position);
        holder.bind(transaction);
    }

    @Override
    public int getItemCount() {
        return transactions != null ? transactions.size() : 0;
    }

    public void updateTransactions(List<Transaction> newTransactions) {
        transactions = newTransactions;
        notifyDataSetChanged();
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        private ItemTransactionBinding binding;

        public ViewHolder(ItemTransactionBinding binding) {
            super(binding.getRoot());
            this.binding = binding;
        }

        public void bind(Transaction transaction) {
            String icon = transaction.type.equals("income") ? "+" : "-";
            binding.transactionIcon.setText(icon);
            binding.transactionIcon.setTextColor(
                    transaction.type.equals("income") ? Color.GREEN : Color.RED);

            binding.transactionCategory.setText(transaction.category);
            binding.transactionDescription.setText(transaction.description);
            binding.transactionAmount.setText(Utils.formatCurrency(transaction.amount));
            binding.transactionAmount.setTextColor(
                    transaction.type.equals("income") ? Color.GREEN : Color.RED);
            binding.transactionDate.setText(transaction.date);

            itemView.setOnClickListener(v -> {
                if (listener != null) {
                    listener.onTransactionClick(transaction);
                }
            });

            itemView.setOnLongClickListener(v -> {
                if (listener != null) {
                    listener.onTransactionLongClick(transaction);
                }
                return true;
            });
        }
    }

    public interface OnTransactionClickListener {
        void onTransactionClick(Transaction transaction);
        void onTransactionLongClick(Transaction transaction);
    }
}
