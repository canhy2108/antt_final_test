package com.example.expensemanager.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.expensemanager.data.Transaction
import com.example.expensemanager.data.TransactionDao
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

class TransactionViewModel(private val dao: TransactionDao) : ViewModel() {

    private val _currentUsername = MutableStateFlow("")
    val currentUsername: StateFlow<String> = _currentUsername.asStateFlow()

    fun setUsername(username: String) {
        _currentUsername.value = username
    }

    @OptIn(ExperimentalCoroutinesApi::class)
    val transactions = _currentUsername.flatMapLatest { username ->
        dao.getAllForUser(username)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(), emptyList())

    fun add(title: String, amount: Double, type: String, category: String) {
        viewModelScope.launch {
            dao.insert(
                Transaction(
                    username = _currentUsername.value,
                    title = title,
                    amount = amount,
                    type = type,
                    category = category,
                    date = System.currentTimeMillis()
                )
            )
        }
    }

    fun delete(t: Transaction) {
        viewModelScope.launch {
            dao.delete(t)
        }
    }

    fun update(transaction: Transaction) {
        viewModelScope.launch {
            dao.update(transaction)
        }
    }
}
