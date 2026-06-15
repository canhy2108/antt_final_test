package com.example.expensemanager.viewmodel

import androidx.lifecycle.ViewModel
import com.example.expensemanager.security.SecurePreferences

class AuthViewModel(private val prefs: SecurePreferences) : ViewModel() {

    fun isCorrectPin(username: String, input: String): Boolean {
        return prefs.isCorrectPin(username, input)
    }

    fun register(username: String, password: String, pin: String, question: String, answer: String) {
        prefs.saveUser(username, password, pin, question, answer)
    }

    fun login(username: String, password: String): Boolean {
        return prefs.checkUser(username, password)
    }

    fun getSecurityQuestion(username: String): String? {
        return prefs.getSecurityQuestion(username)
    }

    fun verifyRecovery(username: String, answer: String): Boolean {
        return prefs.verifyRecovery(username, answer)
    }

    fun resetCredentials(username: String, newPass: String, newPin: String) {
        prefs.resetCredentials(username, newPass, newPin)
    }
}