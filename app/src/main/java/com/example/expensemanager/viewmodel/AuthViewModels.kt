package com.example.expensemanager.viewmodel

import androidx.lifecycle.ViewModel
import com.example.expensemanager.security.SecurePreferences

class AuthViewModel(private val prefs: SecurePreferences) : ViewModel() {

    fun isCorrectPin(input: String): Boolean {
        // Yêu cầu mã pin cố định là 1234
        return input == "1234"
    }

    fun register(username: String, password: String) {
        prefs.saveUser(username, password)
    }

    fun login(username: String, password: String): Boolean {
        return prefs.checkUser(username, password)
    }
}