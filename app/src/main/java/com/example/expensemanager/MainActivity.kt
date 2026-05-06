package com.example.expensemanager

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.*
import androidx.room.Room
import com.example.expensemanager.data.AppDatabase
import com.example.expensemanager.security.SecurePreferences
import com.example.expensemanager.ui.AuthScreen
import com.example.expensemanager.ui.HomeScreen
import com.example.expensemanager.viewmodel.AuthViewModel
import com.example.expensemanager.viewmodel.TransactionViewModel

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Ngăn chặn chụp ảnh màn hình để bảo mật
        window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        )

        // Khởi tạo Database và Preferences
        val db = AppDatabase.getDatabase(applicationContext)
        val prefs = SecurePreferences(applicationContext)
        
        val authViewModel = AuthViewModel(prefs)
        val transactionViewModel = TransactionViewModel(db.transactionDao())

        setContent {
            var isAuthenticated by remember { mutableStateOf(false) }

            if (isAuthenticated) {
                HomeScreen(transactionViewModel, onLogout = { isAuthenticated = false })
            } else {
                AuthScreen(authViewModel) { username ->
                    transactionViewModel.setUsername(username)
                    isAuthenticated = true
                }
            }
        }
    }
}
