package com.example.expensemanager.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.expensemanager.data.Transaction
import com.example.expensemanager.viewmodel.TransactionViewModel
import java.text.NumberFormat
import java.util.*
import androidx.compose.runtime.LaunchedEffect
import kotlinx.coroutines.delay

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(viewModel: TransactionViewModel, onLogout: () -> Unit) {
    val transactions by viewModel.transactions.collectAsState()
    val username by viewModel.currentUsername.collectAsState()
    var showAddDialog by remember { mutableStateOf(false) }
    var editingTransaction by remember { mutableStateOf<Transaction?>(null) }
    var isBalanceVisible by remember { mutableStateOf(false) }

    val totalIncome = transactions.filter { it.type == "income" }.sumOf { it.amount }
    val totalExpense = transactions.filter { it.type == "expense" }.sumOf { it.amount }
    val balance = totalIncome - totalExpense

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { 
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("Budget Bee", fontWeight = FontWeight.Bold)
                        Text("Chào, $username", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                    }
                },
                actions = {
                    IconButton(onClick = {
                        // Logout an toàn: Xóa trạng thái và gọi callback
                        viewModel.setUsername("") 
                        onLogout()
                    }) {
                        Icon(Icons.Default.ExitToApp, contentDescription = "Logout")
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                )
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { showAddDialog = true }, shape = CircleShape) {
                Icon(Icons.Default.Add, contentDescription = "Add")
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
        ) {
            // Summary Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)
            ) {
                Column(modifier = Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Số dư hiện tại", style = MaterialTheme.typography.titleMedium)
                        IconButton(onClick = { isBalanceVisible = !isBalanceVisible }) {
                            Icon(
                                imageVector = if (isBalanceVisible) Icons.Filled.Visibility else Icons.Filled.VisibilityOff,
                                contentDescription = null,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }
                    Text(
                        if (isBalanceVisible) formatCurrency(balance) else "**********",
                        style = MaterialTheme.typography.headlineLarge,
                        fontWeight = FontWeight.ExtraBold,
                        color = if (balance >= 0) Color(0xFF2E7D32) else Color.Red
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        SummaryItem("Thu nhập", totalIncome, Icons.Default.KeyboardArrowUp, Color(0xFF2E7D32), isBalanceVisible)
                        SummaryItem("Chi tiêu", totalExpense, Icons.Default.KeyboardArrowDown, Color.Red, isBalanceVisible)
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))
            Text("Giao dịch gần đây", fontWeight = FontWeight.Bold, fontSize = 18.sp)
            Spacer(modifier = Modifier.height(10.dp))

            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(transactions) { transaction ->
                    TransactionItem(
                        transaction = transaction,
                        onDelete = { viewModel.delete(transaction) },
                        onEdit = { editingTransaction = transaction }
                    )
                }
            }
        }
    }

    if (showAddDialog) {
        AddTransactionDialog(
            onDismiss = { showAddDialog = false },
            onConfirm = { title, amount, type, category ->
                viewModel.add(title, amount, type, category)
                showAddDialog = false
            }
        )
    }

    if (editingTransaction != null) {
        AddTransactionDialog(
            initialTransaction = editingTransaction,
            onDismiss = { editingTransaction = null },
            onConfirm = { title, amount, type, category ->
                editingTransaction?.let {
                    viewModel.update(it.copy(title = title, amount = amount, type = type, category = category))
                }
                editingTransaction = null
            }
        )
    }
}

@Composable
fun SummaryItem(label: String, amount: Double, icon: ImageVector, color: Color, isVisible: Boolean) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(24.dp))
        Column {
            Text(label, fontSize = 12.sp)
            Text(
                if (isVisible) formatCurrency(amount) else "****",
                fontWeight = FontWeight.Bold,
                color = color
            )
        }
    }
}

@Composable
fun TransactionItem(transaction: Transaction, onDelete: () -> Unit, onEdit: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .padding(16.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Text(transaction.title, fontWeight = FontWeight.Bold)
                Text(transaction.category, fontSize = 12.sp, color = Color.Gray)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = (if (transaction.type == "income") "+" else "-") + formatCurrency(transaction.amount),
                    color = if (transaction.type == "income") Color(0xFF2E7D32) else Color.Red,
                    fontWeight = FontWeight.Bold
                )
                IconButton(onClick = onEdit) {
                    Icon(Icons.Default.Edit, contentDescription = "Edit", tint = Color.Gray, modifier = Modifier.size(20.dp))
                }
                IconButton(onClick = onDelete) {
                    Icon(Icons.Default.Delete, contentDescription = "Delete", tint = Color.Gray, modifier = Modifier.size(20.dp))
                }
            }
        }
    }
}

@Composable
fun AddTransactionDialog(
    initialTransaction: Transaction? = null,
    onDismiss: () -> Unit,
    onConfirm: (String, Double, String, String) -> Unit
) {
    var title by remember { mutableStateOf(initialTransaction?.title ?: "") }
    var amount by remember { mutableStateOf(initialTransaction?.amount?.toString() ?: "") }
    var type by remember { mutableStateOf(initialTransaction?.type ?: "expense") }
    var category by remember { mutableStateOf(initialTransaction?.category ?: "Ăn uống") }

    val categories = listOf("Ăn uống", "Di chuyển", "Mua sắm", "Giải trí", "Lương", "Khác")

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (initialTransaction == null) "Thêm giao dịch mới" else "Sửa giao dịch") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("Nội dung") })
                OutlinedTextField(value = amount, onValueChange = { amount = it }, label = { Text("Số tiền") })
                
                Text("Loại giao dịch:")
                Row {
                    RadioButton(selected = type == "income", onClick = { type = "income" })
                    Text("Thu nhập", Modifier.align(Alignment.CenterVertically))
                    Spacer(Modifier.width(8.dp))
                    RadioButton(selected = type == "expense", onClick = { type = "expense" })
                    Text("Chi tiêu", Modifier.align(Alignment.CenterVertically))
                }
            }
        },
        confirmButton = {
            Button(onClick = { onConfirm(title, amount.toDoubleOrNull() ?: 0.0, type, category) }) {
                Text("Lưu")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Hủy") }
        }
    )
}

fun formatCurrency(amount: Double): String {
    val format = NumberFormat.getCurrencyInstance(Locale("vi", "VN"))
    return format.format(amount)
}
