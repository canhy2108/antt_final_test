package com.budgetbee.models;

import androidx.room.Entity;
import androidx.room.PrimaryKey;
import com.google.gson.annotations.SerializedName;

@Entity(tableName = "transactions")
public class Transaction {
    @PrimaryKey(autoGenerate = true)
    public int id;

    @SerializedName("id")
    public int transactionId;

    @SerializedName("user_id")
    public int userId;

    @SerializedName("type")
    public String type; // "income" or "expense"

    @SerializedName("amount")
    public double amount;

    @SerializedName("category")
    public String category;

    @SerializedName("description")
    public String description;

    @SerializedName("date")
    public String date;

    @SerializedName("created_at")
    public String createdAt;

    @SerializedName("updated_at")
    public String updatedAt;

    public Transaction() {}

    public Transaction(String type, double amount, String category, String description, String date) {
        this.type = type;
        this.amount = amount;
        this.category = category;
        this.description = description;
        this.date = date;
    }

    @Override
    public String toString() {
        return "Transaction{" +
                "id=" + transactionId +
                ", type='" + type + '\'' +
                ", amount=" + amount +
                ", category='" + category + '\'' +
                ", description='" + description + '\'' +
                ", date='" + date + '\'' +
                '}';
    }
}
