package com.example.expensemanager.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import com.example.expensemanager.data.AppDatabase
import com.example.expensemanager.data.Transaction
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.regex.Pattern

import com.example.expensemanager.security.SecurePreferences

class SmsReceiver : BroadcastReceiver() {

    private val scope = CoroutineScope(Dispatchers.IO)

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
            val prefs = SecurePreferences(context)
            val currentUser = prefs.getCurrentUser() ?: "DefaultUser"
            
            val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
            for (sms in messages) {
                val body = sms.displayMessageBody
                val address = sms.displayOriginatingAddress ?: "Unknown"

                Log.d("SmsReceiver", "Tin nhắn từ $address: $body")

                parseBankSms(body, address, currentUser)?.let { transaction ->
                    saveTransaction(context, transaction)
                }
            }
        }
    }

    private fun parseBankSms(body: String, address: String, username: String): Transaction? {
        val lowerBody = body.lowercase()
        
        // Regex 1: Tìm số tiền (hỗ trợ định dạng ngân hàng Việt Nam: +1,000,000 hoặc -50.000)
        // Ưu tiên tìm các cụm có biến động số dư "SD: +..." hoặc "GD: -..."
        val patterns = listOf(
            Pattern.compile("(?:sd|gd|sodu|sotien|ps)\\s*([+-])\\s*([\\d,.]+)"),
            Pattern.compile("([+-])\\s*([\\d,.]+)\\s*(?:vnd|d)"),
            Pattern.compile("thay doi\\s*([+-])\\s*([\\d,.]+)")
        )

        for (pattern in patterns) {
            val matcher = pattern.matcher(body.lowercase())
            if (matcher.find()) {
                val typeIndicator = matcher.group(1)
                val amountStr = matcher.group(2)?.replace(".", "")?.replace(",", "") ?: "0"
                val amount = amountStr.toDoubleOrNull() ?: 0.0
                val type = if (typeIndicator == "+") "income" else "expense"
                
                // Phân loại nâng cao dựa trên nội dung
                val category = when {
                    lowerBody.contains("rut tien") || lowerBody.contains("atm") -> "Rút tiền"
                    lowerBody.contains("an uong") || lowerBody.contains("food") || lowerBody.contains("grabfood") || lowerBody.contains("shopeefood") -> "Ăn uống"
                    lowerBody.contains("mua sam") || lowerBody.contains("shopee") || lowerBody.contains("lazada") || lowerBody.contains("tiki") -> "Mua sắm"
                    lowerBody.contains("tien dien") || lowerBody.contains("evn") -> "Tiền điện"
                    lowerBody.contains("tien nuoc") -> "Tiền nước"
                    lowerBody.contains("internet") || lowerBody.contains("viettel") || lowerBody.contains("fpt") -> "Internet/Cước"
                    lowerBody.contains("chuyen khoan") || lowerBody.contains("ck") || lowerBody.contains("ct") -> "Chuyển khoản"
                    lowerBody.contains("tra luong") || lowerBody.contains("luong") || lowerBody.contains("salary") -> "Lương"
                    else -> "Giao dịch SMS"
                }

                return Transaction(
                    username = username,
                    title = "SMS: $address",
                    amount = amount,
                    type = type,
                    category = category,
                    date = System.currentTimeMillis()
                )
            }
        }

        return null
    }

    private fun saveTransaction(context: Context, transaction: Transaction) {
        val pendingResult = goAsync()
        scope.launch {
            try {
                val db = AppDatabase.getDatabase(context)
                db.transactionDao().insert(transaction)
                Log.d("SmsReceiver", "Đã tự động thêm giao dịch: ${transaction.amount}")
            } catch (e: Exception) {
                Log.e("SmsReceiver", "Lỗi lưu giao dịch", e)
            } finally {
                pendingResult.finish()
            }
        }
    }
}
