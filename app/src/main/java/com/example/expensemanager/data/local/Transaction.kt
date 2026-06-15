package com.example.expensemanager.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "transactions")
data class Transaction(
    @PrimaryKey(autoGenerate = true)
    val id: Int = 0,
    val username: String,
    val title: String,
    val amount: Double,
    val type: String, // "income" hoặc "expense"
    val category: String,
    val date: Long,
    val imagePath: String? = null // Thêm trường này để lưu đường dẫn ảnh hóa đơn
)
