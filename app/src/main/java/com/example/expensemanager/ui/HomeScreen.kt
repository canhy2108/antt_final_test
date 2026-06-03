package com.example.expensemanager.ui

import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.rememberVectorPainter
import androidx.compose.ui.graphics.vector.rememberVectorPainter
import androidx.compose.ui.graphics.vector.rememberVectorPainter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.style.TextAlign
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.example.expensemanager.data.Transaction
import com.example.expensemanager.security.SecurePreferences
import com.example.expensemanager.viewmodel.TransactionViewModel
import com.example.expensemanager.ui.components.PinInput
import com.example.expensemanager.utils.ImageStorageHelper
import java.text.NumberFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    viewModel: TransactionViewModel,
    onAuthenticate: (onSuccess: () -> Unit) -> Unit,
    onLogout: () -> Unit
) {
    val context = LocalContext.current
    val prefs = remember { SecurePreferences(context) }
    val transactions by viewModel.transactions.collectAsState()
    val username by viewModel.currentUsername.collectAsState()
    val stats by viewModel.balanceStats.collectAsState()
    
    val photoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri ->
        uri?.let {
            val savedPath = ImageStorageHelper.saveImageToInternalStorage(context, it, "avatars")
            if (savedPath != null) {
                prefs.saveAvatarUri(username, savedPath)
                Toast.makeText(context, "Đã cập nhật ảnh chân dung", Toast.LENGTH_SHORT).show()
            }
        }
    }

    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicturePreview()
    ) { bitmap ->
        if (bitmap != null) {
            Toast.makeText(context, "Tính năng chụp ảnh đang được hoàn thiện", Toast.LENGTH_SHORT).show()
        }
    }
    
    val (totalIncome, totalExpense, balance) = stats
    var showAddDialog by remember { mutableStateOf(false) }
    var editingTransaction by remember { mutableStateOf<Transaction?>(null) }
    var isBalanceVisible by remember { mutableStateOf(false) }
    var showPinDialog by remember { mutableStateOf(false) }
    var isSimulatingFaceID by remember { mutableStateOf(false) }

    if (showPinDialog) {
        AlertDialog(
            onDismissRequest = { 
                showPinDialog = false 
                isSimulatingFaceID = false
            },
            title = { Text(if (isSimulatingFaceID) "Đang nhận diện khuôn mặt..." else "Xác thực quyền truy cập") },
            text = {
                var pinInput by remember { mutableStateOf("") }
                val userAvatar = remember { prefs.getAvatarUri(username) }

                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    if (isSimulatingFaceID) {
                        // Hiển thị ảnh khuôn mặt để giả lập FaceID
                        Box(
                            modifier = Modifier
                                .size(150.dp)
                                .clip(CircleShape)
                                .background(Color.LightGray),
                            contentAlignment = Alignment.Center
                        ) {
                            // Ưu tiên: 1. Ảnh đã chọn, 2. Icon mặc định
                            val faceModel = userAvatar ?: Icons.Default.Face
                            
                            AsyncImage(
                                model = faceModel,
                                contentDescription = null,
                                modifier = Modifier.fillMaxSize(),
                                contentScale = ContentScale.Crop,
                                error = rememberVectorPainter(Icons.Default.AccountCircle)
                            )
                            
                            // Hiệu ứng vòng tròn quét
                            CircularProgressIndicator(
                                modifier = Modifier.size(150.dp),
                                color = MaterialTheme.colorScheme.primary,
                                strokeWidth = 4.dp
                            )
                        }
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("Vui lòng nhìn thẳng vào camera máy ảo", fontSize = 12.sp, color = Color.Gray)
                        
                        // Sau 2 giây tự động báo thành công (Giả lập)
                        LaunchedEffect(Unit) {
                            kotlinx.coroutines.delay(2000)
                            isBalanceVisible = true
                            showPinDialog = false
                            isSimulatingFaceID = false
                            Toast.makeText(context, "Xác thực khuôn mặt thành công!", Toast.LENGTH_SHORT).show()
                        }
                    } else {
                        Text("Nhập mã PIN hoặc sử dụng khuôn mặt để xem số dư", textAlign = TextAlign.Center)
                        Spacer(modifier = Modifier.height(24.dp))
                        PinInput(
                            value = pinInput,
                            onValueChange = { pinInput = it }
                        )
                        
                        if (pinInput.length == 4) {
                            LaunchedEffect(pinInput) {
                                if (prefs.isCorrectPin(username, pinInput)) {
                                    isBalanceVisible = true
                                    showPinDialog = false
                                } else {
                                    Toast.makeText(context, "Mã PIN không đúng", Toast.LENGTH_SHORT).show()
                                    pinInput = ""
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                if (!isSimulatingFaceID) {
                    Button(onClick = {
                        val biometricHelper = com.example.expensemanager.security.BiometricHelper(context)
                        if (biometricHelper.isBiometricAvailable()) {
                            // Nếu là máy thật có FaceID, gọi hàng thật
                            onAuthenticate {
                                isBalanceVisible = true
                                showPinDialog = false
                            }
                        } else {
                            // Nếu là máy ảo, bật chế độ mô phỏng bằng ảnh
                            isSimulatingFaceID = true
                        }
                    }) {
                        Icon(Icons.Default.Face, null)
                        Spacer(Modifier.width(8.dp))
                        Text("Dùng Face ID")
                    }
                }
            },
            dismissButton = {
                if (!isSimulatingFaceID) {
                    TextButton(onClick = { showPinDialog = false }) { Text("Hủy") }
                }
            }
        )
    }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { 
                    val userAvatar = remember { prefs.getAvatarUri(username) }
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.clickable { photoPickerLauncher.launch("image/*") }
                    ) {
                        if (userAvatar != null) {
                            AsyncImage(
                                model = userAvatar,
                                contentDescription = null,
                                modifier = Modifier
                                    .size(32.dp)
                                    .clip(CircleShape),
                                contentScale = ContentScale.Crop
                            )
                            Spacer(Modifier.width(8.dp))
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("Budget Bee", fontWeight = FontWeight.Bold)
                            Text(
                                "Chào, $username (Đổi ảnh mặt)", 
                                style = MaterialTheme.typography.labelSmall, 
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                },
                actions = {
                    IconButton(onClick = {
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
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)
            ) {
                Column(modifier = Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Số dư hiện tại", style = MaterialTheme.typography.titleMedium)
                        IconButton(onClick = {
                            if (!isBalanceVisible) {
                                showPinDialog = true
                            } else {
                                isBalanceVisible = false
                            }
                        }) {
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
                        SummaryItem("Thu nhập", totalIncome, Icons.Default.ArrowUpward, Color(0xFF2E7D32), isBalanceVisible)
                        SummaryItem("Chi tiêu", totalExpense, Icons.Default.ArrowDownward, Color.Red, isBalanceVisible)
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
            onConfirm = { title, amount, type, category, imagePath ->
                viewModel.add(title, amount, type, category, imagePath)
                showAddDialog = false
            }
        )
    }

    if (editingTransaction != null) {
        AddTransactionDialog(
            initialTransaction = editingTransaction,
            onDismiss = { editingTransaction = null },
            onConfirm = { title, amount, type, category, imagePath ->
                editingTransaction?.let {
                    viewModel.update(it.copy(title = title, amount = amount, type = type, category = category, imagePath = imagePath))
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
            modifier = Modifier.padding(16.dp).fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (!transaction.imagePath.isNullOrEmpty()) {
                AsyncImage(
                    model = ImageRequest.Builder(LocalContext.current)
                        .data(transaction.imagePath)
                        .crossfade(true)
                        .build(),
                    contentDescription = "Bill",
                    modifier = Modifier.size(50.dp).clip(RoundedCornerShape(8.dp)),
                    contentScale = ContentScale.Crop
                )
                Spacer(modifier = Modifier.width(12.dp))
            } else {
                Box(
                    modifier = Modifier.size(50.dp).clip(RoundedCornerShape(8.dp)).background(MaterialTheme.colorScheme.surfaceVariant),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Receipt, contentDescription = null, tint = Color.Gray)
                }
                Spacer(modifier = Modifier.width(12.dp))
            }

            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(transaction.title, fontWeight = FontWeight.Bold)
                    if (transaction.title.startsWith("SMS:")) {
                        Spacer(modifier = Modifier.width(4.dp))
                        Surface(
                            color = MaterialTheme.colorScheme.primaryContainer,
                            shape = RoundedCornerShape(4.dp)
                        ) {
                            Text(
                                "Auto",
                                modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onPrimaryContainer
                            )
                        }
                    }
                }
                Text(transaction.category, fontSize = 12.sp, color = Color.Gray)
            }
            
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = (if (transaction.type == "income") "+" else "-") + formatCurrency(transaction.amount),
                    color = if (transaction.type == "income") Color(0xFF2E7D32) else Color.Red,
                    fontWeight = FontWeight.Bold
                )
                Row {
                    IconButton(onClick = onEdit, modifier = Modifier.size(24.dp)) {
                        Icon(Icons.Default.Edit, contentDescription = "Edit", tint = Color.Gray, modifier = Modifier.size(16.dp))
                    }
                    IconButton(onClick = onDelete, modifier = Modifier.size(24.dp)) {
                        Icon(Icons.Default.Delete, contentDescription = "Delete", tint = Color.Gray, modifier = Modifier.size(16.dp))
                    }
                }
            }
        }
    }
}

@Composable
fun AddTransactionDialog(
    initialTransaction: Transaction? = null,
    onDismiss: () -> Unit,
    onConfirm: (String, Double, String, String, String?) -> Unit
) {
    val context = LocalContext.current
    var title by remember { mutableStateOf(initialTransaction?.title ?: "") }
    var amount by remember { mutableStateOf(initialTransaction?.amount?.toString() ?: "") }
    var type by remember { mutableStateOf(initialTransaction?.type ?: "expense") }
    var category by remember { mutableStateOf(initialTransaction?.category ?: "Ăn uống") }
    var imagePath by remember { mutableStateOf(initialTransaction?.imagePath) }

    val imagePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri ->
        uri?.let {
            val savedPath = ImageStorageHelper.saveImageToInternalStorage(context, it, "receipts")
            if (savedPath != null) {
                imagePath = savedPath
            }
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (initialTransaction == null) "Thêm giao dịch mới" else "Sửa giao dịch") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("Nội dung") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = amount, onValueChange = { amount = it }, label = { Text("Số tiền") }, modifier = Modifier.fillMaxWidth())
                
                Text("Ảnh hóa đơn:")
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Button(onClick = { imagePickerLauncher.launch("image/*") }) {
                        Icon(Icons.Default.PhotoCamera, null)
                        Spacer(Modifier.width(8.dp))
                        Text(if (imagePath == null) "Chọn ảnh" else "Đổi ảnh")
                    }
                    if (imagePath != null) {
                        Spacer(Modifier.width(8.dp))
                        AsyncImage(
                            model = imagePath,
                            contentDescription = null,
                            modifier = Modifier.size(40.dp).clip(RoundedCornerShape(4.dp)),
                            contentScale = ContentScale.Crop
                        )
                    }
                }

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
            Button(onClick = { onConfirm(title, amount.toDoubleOrNull() ?: 0.0, type, category, imagePath) }) {
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
