package com.budgetbee.models;

import androidx.room.Entity;
import androidx.room.PrimaryKey;
import com.google.gson.annotations.SerializedName;

@Entity(tableName = "budgets")
public class Budget {
    @PrimaryKey(autoGenerate = true)
    public int id;

    @SerializedName("id")
    public int budgetId;

    @SerializedName("user_id")
    public int userId;

    @SerializedName("category")
    public String category;

    @SerializedName("limit_amount")
    public double limitAmount;

    @SerializedName("spent_amount")
    public double spentAmount;

    @SerializedName("month")
    public String month;

    @SerializedName("created_at")
    public String createdAt;

    @SerializedName("updated_at")
    public String updatedAt;

    public Budget() {}

    public Budget(String category, double limitAmount, String month) {
        this.category = category;
        this.limitAmount = limitAmount;
        this.month = month;
        this.spentAmount = 0;
    }

    public double getRemainingAmount() {
        return limitAmount - spentAmount;
    }

    public double getPercentageUsed() {
        if (limitAmount == 0) return 0;
        return (spentAmount / limitAmount) * 100;
    }

    @Override
    public String toString() {
        return "Budget{" +
                "id=" + budgetId +
                ", category='" + category + '\'' +
                ", limitAmount=" + limitAmount +
                ", spentAmount=" + spentAmount +
                ", month='" + month + '\'' +
                '}';
    }
}
