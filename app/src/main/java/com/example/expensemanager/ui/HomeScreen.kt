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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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
    
    // State để theo dõi thay đổi avatar để UI cập nhật ngay lập tức
    var currentAvatarPath by remember(username) { mutableStateOf(prefs.getAvatarUri(username)) }
    
    val photoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri ->
        uri?.let {
            val savedPath = ImageStorageHelper.saveImageToInternalStorage(context, it, "avatars")
            if (savedPath != null) {
                prefs.saveAvatarUri(username, savedPath)
                currentAvatarPath = savedPath
                Toast.makeText(context, "Đã cập nhật ảnh chân dung", Toast.LENGTH_SHORT).show()
            }
        }
    }

    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicturePreview()
    ) { bitmap ->
        if (bitmap != null) {
            val savedPath = ImageStorageHelper.saveBitmapToInternalStorage(context, bitmap, "avatars")
            if (savedPath != null) {
                prefs.saveAvatarUri(username, savedPath)
                currentAvatarPath = savedPath
                Toast.makeText(context, "Đã cập nhật ảnh Face ID từ Camera", Toast.LENGTH_SHORT).show()
            }
        }
    }

    var showPhotoOptions by remember { mutableStateOf(false) }
    
    if (showPhotoOptions) {
        AlertDialog(
            onDismissRequest = { showPhotoOptions = false },
            title = { Text("Cập nhật ảnh Face ID") },
            text = { Text("Chọn ảnh từ thư viện hoặc chụp ảnh mới để làm mẫu đối soát Face ID.") },
            confirmButton = {
                TextButton(onClick = { 
                    cameraLauncher.launch(null)
                    showPhotoOptions = false 
                }) { Text("Chụp ảnh") }
            },
            dismissButton = {
                TextButton(onClick = { 
                    photoPickerLauncher.launch("image/*")
                    showPhotoOptions = false 
                }) { Text("Thư viện") }
            }
        )
    }
    
    val (totalIncome, totalExpense, balance) = stats
    var showAddDialog by remember { mutableStateOf(false) }
    var editingTransaction by remember { mutableStateOf<Transaction?>(null) }
    var isBalanceVisible by remember { mutableStateOf(false) }
    var showPinDialog by remember { mutableStateOf(false) }
    var isSimulatingFaceID by remember { mutableStateOf(false) }

    if (showPinDialog) {
        // Lấy ảnh riêng biệt của từng User từ Database
        var matchProgress by remember { mutableStateOf(0f) }

        AlertDialog(
            onDismissRequest = { 
                showPinDialog = false 
                isSimulatingFaceID = false
            },
            title = { 
                Text(
                    if (isSimulatingFaceID) "Xác thực danh tính chủ sở hữu" else "Bảo mật tài khoản",
                    fontWeight = FontWeight.Bold
                ) 
            },
            text = {
                var pinInput by remember { mutableStateOf("") }

                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    if (isSimulatingFaceID) {
                        // GIAO DIỆN ĐỐI SOÁT KHUÔN MẶT
                        Box(contentAlignment = Alignment.Center) {
                            // Vòng tròn chứa ảnh đại diện của User đang đăng nhập
                            Box(
                                modifier = Modifier
                                    .size(160.dp)
                                    .clip(CircleShape)
                                    .background(Color.LightGray.copy(alpha = 0.2f))
                                    .padding(4.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                if (currentAvatarPath != null) {
                                    AsyncImage(
                                        model = currentAvatarPath,
                                        contentDescription = "Registered Face",
                                        modifier = Modifier.fillMaxSize().clip(CircleShape),
                                        contentScale = ContentScale.Crop
                                    )
                                } else {
                                    Icon(Icons.Default.Person, null, modifier = Modifier.size(80.dp), tint = Color.Gray)
                                }
                            }
                            
                            // Hiệu ứng vòng quét laser (mô phỏng đối soát)
                            CircularProgressIndicator(
                                progress = matchProgress,
                                modifier = Modifier.size(170.dp),
                                color = if (matchProgress >= 1f) Color(0xFF4CAF50) else MaterialTheme.colorScheme.primary,
                                strokeWidth = 6.dp
                            )
                        }

                        Spacer(modifier = Modifier.height(20.dp))
                        Text(
                            text = "Đang so khớp với dữ liệu của: $username",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = if (matchProgress < 1f) "Đang phân tích đặc điểm khuôn mặt..." else "Đã khớp 100% - Danh tính xác thực",
                            fontSize = 12.sp,
                            color = if (matchProgress >= 1f) Color(0xFF4CAF50) else Color.Gray
                        )
                        
                        // Logic mô phỏng việc so sánh (Verification)
                        LaunchedEffect(isSimulatingFaceID) {
                            if (isSimulatingFaceID) {
                                for (i in 1..100) {
                                    kotlinx.coroutines.delay(20)
                                    matchProgress = i / 100f
                                }
                                
                                // Kiểm tra xem người dùng hiện tại có ảnh trong database không
                                if (currentAvatarPath != null) {
                                    // Hiệu ứng rung khi hoàn tất 100%
                                    try {
                                        val vibrator = context.getSystemService(android.os.Vibrator::class.java)
                                        if (vibrator != null) {
                                            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                                                vibrator.vibrate(android.os.VibrationEffect.createOneShot(200, android.os.VibrationEffect.DEFAULT_AMPLITUDE))
                                            } else {
                                                @Suppress("DEPRECATION")
                                                vibrator.vibrate(200)
                                            }
                                        }
                                        
                                        // Hiệu ứng âm thanh hệ thống (Success)
                                        val notification = android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION)
                                        val r = android.media.RingtoneManager.getRingtone(context, notification)
                                        r.play()
                                    } catch (e: Exception) {
                                        android.util.Log.e("Feedback", "Error providing feedback: ${e.message}")
                                    }

                                    isBalanceVisible = true
                                    kotlinx.coroutines.delay(800)
                                    showPinDialog = false
                                    isSimulatingFaceID = false
                                    Toast.makeText(context, "Chào mừng $username quay trở lại!", Toast.LENGTH_SHORT).show()
                                } else {
                                    isSimulatingFaceID = false
                                    Toast.makeText(context, "Lỗi: Bạn chưa đăng ký khuôn mặt cho tài khoản này!", Toast.LENGTH_LONG).show()
                                }
                            }
                        }
                    } else {
                        // Giao diện nhập PIN cũ
                        Text("Chủ tài khoản: $username", fontSize = 14.sp, color = Color.Gray)
                        Spacer(modifier = Modifier.height(20.dp))
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
                                    Toast.makeText(context, "Mã PIN không khớp với tài khoản", Toast.LENGTH_SHORT).show()
                                    pinInput = ""
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                if (!isSimulatingFaceID) {
                    Button(
                        onClick = {
                            val hasFace = prefs.getAvatarUri(username) != null
                            if (!hasFace) {
                                Toast.makeText(context, "Vui lòng đăng ký Face ID trong Profile trước!", Toast.LENGTH_LONG).show()
                            } else {
                                val biometricHelper = com.example.expensemanager.security.BiometricHelper(context)
                                if (biometricHelper.isBiometricAvailable()) {
                                    onAuthenticate {
                                        isBalanceVisible = true
                                        showPinDialog = false
                                    }
                                } else {
                                    matchProgress = 0f
                                    isSimulatingFaceID = true
                                }
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                    ) {
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
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.clickable { showPhotoOptions = true }
                    ) {
                        if (currentAvatarPath != null) {
                            AsyncImage(
                                model = currentAvatarPath,
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
                        onEdit = { editingTransaction = transaction },
                        onSetAsAvatar = { path ->
                            prefs.saveAvatarUri(username, path)
                            currentAvatarPath = path
                            Toast.makeText(context, "Đã dùng ảnh giao dịch này làm Face ID", Toast.LENGTH_SHORT).show()
                        }
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
fun TransactionItem(transaction: Transaction, onDelete: () -> Unit, onEdit: () -> Unit, onSetAsAvatar: (String) -> Unit) {
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
                    if (!transaction.imagePath.isNullOrEmpty()) {
                        IconButton(onClick = { onSetAsAvatar(transaction.imagePath) }, modifier = Modifier.size(24.dp)) {
                            Icon(Icons.Default.Face, contentDescription = "FaceID", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(16.dp))
                        }
                    }
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
