package com.example.expensemanager.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.expensemanager.ui.components.PinInput
import com.example.expensemanager.viewmodel.AuthViewModel

@Composable
fun AuthScreen(
    viewModel: AuthViewModel,
    onAuthenticated: (String) -> Unit
) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var pin by remember { mutableStateOf("") }
    var securityQuestion by remember { mutableStateOf("Tên con vật đầu tiên của bạn?") }
    var securityAnswer by remember { mutableStateOf("") }
    
    var error by remember { mutableStateOf("") }
    var isRegisterMode by remember { mutableStateOf(false) }
    var showRecoveryDialog by remember { mutableStateOf(false) }
    val scrollState = rememberScrollState()

    Scaffold { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(
                    brush = Brush.verticalGradient(
                        colors = listOf(
                            MaterialTheme.colorScheme.primaryContainer,
                            MaterialTheme.colorScheme.surface
                        )
                    )
                )
                .imePadding() // Tự động đẩy UI lên khi bàn phím hiện
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(scrollState)
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Spacer(modifier = Modifier.height(40.dp))
                
                Surface(
                    modifier = Modifier.size(90.dp),
                    shape = CircleShape,
                    color = MaterialTheme.colorScheme.primary
                ) {
                    Icon(
                        Icons.Default.Lock,
                        contentDescription = null,
                        modifier = Modifier.padding(25.dp),
                        tint = MaterialTheme.colorScheme.onPrimary
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))

                Text(
                    text = if (isRegisterMode) "Tạo tài khoản mới" else "Chào mừng trở lại",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold
                )

                Spacer(modifier = Modifier.height(24.dp))

                OutlinedTextField(
                    value = username,
                    onValueChange = { username = it },
                    label = { Text("Tên đăng nhập") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    singleLine = true
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Mật khẩu") },
                    visualTransformation = PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    singleLine = true
                )

                if (isRegisterMode) {
                    Spacer(modifier = Modifier.height(20.dp))
                    Divider(
                        modifier = Modifier.padding(horizontal = 32.dp),
                        color = MaterialTheme.colorScheme.outlineVariant,
                        thickness = 1.dp
                    )
                    Spacer(modifier = Modifier.height(20.dp))
                    
                    Text(
                        "Thông tin bảo mật bổ sung",
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.fillMaxWidth()
                    )
                    
                    Spacer(modifier = Modifier.height(12.dp))
                    Text("Mã PIN (4 số để xem số dư):", style = MaterialTheme.typography.bodySmall, modifier = Modifier.fillMaxWidth())
                    Spacer(modifier = Modifier.height(8.dp))
                    PinInput(
                        value = pin,
                        onValueChange = { 
                            if (it.length <= 4) pin = it 
                        },
                        isError = error.contains("Mã PIN")
                    )
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    OutlinedTextField(
                        value = securityQuestion,
                        onValueChange = { securityQuestion = it },
                        label = { Text("Câu hỏi bí mật") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text)
                    )
                    
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedTextField(
                        value = securityAnswer,
                        onValueChange = { securityAnswer = it },
                        label = { Text("Câu trả lời của bạn") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text)
                    )
                }

                if (error.isNotEmpty()) {
                    Text(
                        text = error,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(top = 12.dp)
                    )
                }

                Spacer(modifier = Modifier.height(32.dp))

                Button(
                    onClick = {
                        if (username.isEmpty() || password.isEmpty()) {
                            error = "Vui lòng nhập đủ tên đăng nhập và mật khẩu"
                            return@Button
                        }
                        if (isRegisterMode) {
                            if (pin.length != 4) {
                                error = "Mã PIN phải đủ 4 số"
                            } else if (securityAnswer.isEmpty()) {
                                error = "Vui lòng nhập câu trả lời bảo mật"
                            } else {
                                viewModel.register(username, password, pin, securityQuestion, securityAnswer)
                                isRegisterMode = false
                                error = "Đăng ký thành công! Hãy đăng nhập ngay."
                            }
                        } else {
                            if (viewModel.login(username, password)) {
                                onAuthenticated(username)
                            } else {
                                error = "Tài khoản hoặc mật khẩu không đúng"
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        if (isRegisterMode) "XÁC NHẬN ĐĂNG KÝ" else "ĐĂNG NHẬP",
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center
                ) {
                    TextButton(onClick = { 
                        isRegisterMode = !isRegisterMode
                        error = "" 
                    }) {
                        Text(if (isRegisterMode) "Đã có tài khoản? Đăng nhập" else "Chưa có tài khoản? Đăng ký ngay")
                    }
                }
                
                if (!isRegisterMode) {
                    TextButton(onClick = { showRecoveryDialog = true }) {
                        Text("Quên mật khẩu?", color = Color.Gray, fontSize = 14.sp)
                    }
                }
                
                Spacer(modifier = Modifier.height(32.dp))
            }
        }
    }

    if (showRecoveryDialog) {
        RecoveryDialog(
            viewModel = viewModel,
            onDismiss = { showRecoveryDialog = false }
        )
    }
}

@Composable
fun RecoveryDialog(
    viewModel: AuthViewModel,
    onDismiss: () -> Unit
) {
    var step by remember { mutableStateOf(1) }
    var username by remember { mutableStateOf("") }
    var question by remember { mutableStateOf("") }
    var answer by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var newPin by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Khôi phục tài khoản") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (step == 1) {
                    Text("Nhập tên đăng nhập để tìm câu hỏi bảo mật")
                    OutlinedTextField(value = username, onValueChange = { username = it }, label = { Text("Username") })
                } else if (step == 2) {
                    Text("Câu hỏi: $question")
                    OutlinedTextField(value = answer, onValueChange = { answer = it }, label = { Text("Câu trả lời") })
                } else if (step == 3) {
                    Text("Đặt lại thông tin mới")
                    OutlinedTextField(value = newPassword, onValueChange = { newPassword = it }, label = { Text("Mật khẩu mới") }, visualTransformation = PasswordVisualTransformation())
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Mã PIN mới (4 số):")
                    PinInput(value = newPin, onValueChange = { newPin = it })
                }
                if (error.isNotEmpty()) Text(error, color = Color.Red, fontSize = 12.sp)
            }
        },
        confirmButton = {
            Button(onClick = {
                when (step) {
                    1 -> {
                        val q = viewModel.getSecurityQuestion(username)
                        if (q != null) { question = q; step = 2; error = "" }
                        else { error = "Không tìm thấy người dùng" }
                    }
                    2 -> {
                        if (viewModel.verifyRecovery(username, answer)) { step = 3; error = "" }
                        else { error = "Câu trả lời không chính xác" }
                    }
                    3 -> {
                        if (newPassword.isNotEmpty() && newPin.length == 4) {
                            viewModel.resetCredentials(username, newPassword, newPin)
                            onDismiss()
                        } else { error = "Vui lòng nhập đầy đủ thông tin" }
                    }
                }
            }) {
                Text(if (step == 3) "Hoàn tất" else "Tiếp theo")
            }
        }
    )
}
