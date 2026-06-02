package com.example.expensemanager

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.example.expensemanager.data.AppDatabase
import com.example.expensemanager.security.SecurePreferences
import com.example.expensemanager.ui.AuthScreen
import com.example.expensemanager.ui.HomeScreen
import com.example.expensemanager.viewmodel.AuthViewModel
import com.example.expensemanager.viewmodel.TransactionViewModel

class MainActivity : ComponentActivity() {

    // Khởi tạo ViewModel đúng cách thông qua Factory để giữ dữ liệu khi xoay màn hình
    private val authViewModel: AuthViewModel by viewModels {
        object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                return AuthViewModel(SecurePreferences(applicationContext)) as T
            }
        }
    }

    private val transactionViewModel: TransactionViewModel by viewModels {
        object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                val db = AppDatabase.getDatabase(applicationContext)
                return TransactionViewModel(db.transactionDao()) as T
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Ngăn chặn chụp ảnh màn hình để bảo mật
        window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        )

        setContent {
            // Sử dụng rememberSaveable để không bị mất trạng thái khi xoay màn hình
            var isAuthenticated by rememberSaveable { mutableStateOf(false) }

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
