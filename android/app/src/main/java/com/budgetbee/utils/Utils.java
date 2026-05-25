package com.budgetbee.utils;

import android.content.Context;
import android.widget.Toast;

public class Utils {
    public static void showToast(Context context, String message) {
        Toast.makeText(context, message, Toast.LENGTH_SHORT).show();
    }

    public static void showToastLong(Context context, String message) {
        Toast.makeText(context, message, Toast.LENGTH_LONG).show();
    }

    public static boolean isValidEmail(String email) {
        return email != null && android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches();
    }

    public static boolean isValidPassword(String password) {
        return password != null && password.length() >= 6;
    }

    public static String formatCurrency(double amount) {
        return String.format("$%.2f", amount);
    }

    public static String formatDate(String dateString) {
        // You can implement date formatting based on your requirement
        return dateString;
    }

    public static double getBalance(double income, double expense) {
        return income - expense;
    }

    public static String getTransactionIcon(String type) {
        return type.equals("income") ? "+" : "-";
    }

    public static int getTransactionColor(String type) {
        return type.equals("income") ? android.graphics.Color.GREEN : android.graphics.Color.RED;
    }
}
