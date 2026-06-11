package com.example.expensemanager

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.WindowManager
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.example.expensemanager.data.AppDatabase
import androidx.fragment.app.FragmentActivity
import com.example.expensemanager.security.BiometricHelper
import com.example.expensemanager.security.SecurePreferences
import com.example.expensemanager.ui.AuthScreen
import com.example.expensemanager.ui.HomeScreen
import com.example.expensemanager.viewmodel.AuthViewModel
import com.example.expensemanager.viewmodel.TransactionViewModel

class MainActivity : FragmentActivity() {

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

    // Hàm "cưỡng chế" xóa cờ bảo mật và ép vẽ lại màn hình triệt để
    private fun forceClearSecureFlag() {
        try {
            val win = window ?: return
            
            // 1. Xóa qua flag tiêu chuẩn
            win.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
            
            // 2. Can thiệp trực tiếp vào bitmask của LayoutParams
            val attrs = win.attributes
            if ((attrs.flags and WindowManager.LayoutParams.FLAG_SECURE) != 0) {
                attrs.flags = attrs.flags and WindowManager.LayoutParams.FLAG_SECURE.inv()
                win.attributes = attrs
                
                // 3. Chỉ ép vẽ lại khi thực sự có thay đổi cờ
                win.decorView.post {
                    win.decorView.requestLayout()
                    win.decorView.invalidate()
                }
                android.util.Log.d("SecurityFix", ">>> FORCE CLEAR FLAG SUCCESS <<<")
            }
        } catch (e: Exception) {
            android.util.Log.e("SecurityFix", "Non-fatal error in forceClearSecureFlag", e)
        }
    }

    private var securityCheckStartTime: Long = 0
    private val handler = Handler(Looper.getMainLooper())
    private val securityTask = object : Runnable {
        override fun run() {
            forceClearSecureFlag()
            // Lặp lại mỗi 300ms trong 2 giây đầu để "đấu" lại hệ thống (đặc biệt là Xiaomi/Samsung)
            if (System.currentTimeMillis() - securityCheckStartTime < 2000) {
                handler.postDelayed(this, 300)
            }
        }
    }

    override fun onStart() {
        super.onStart()
        securityCheckStartTime = System.currentTimeMillis()
        handler.post(securityTask)
    }

    override fun onStop() {
        super.onStop()
        handler.removeCallbacks(securityTask)
    }

    override fun onResume() {
        super.onResume()
        forceClearSecureFlag()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        // Ép Light Mode trước khi super.onCreate
        AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO)
        super.onCreate(savedInstanceState)
        
        // Cưỡng chế xóa cờ ngay lập tức
        forceClearSecureFlag()
        
        // Đặt nền trắng cho Window để không bị lộ nền đen của hệ thống
        window.setBackgroundDrawableResource(android.R.color.white)
        
        val biometricHelper = BiometricHelper(this)
        val prefs = SecurePreferences(applicationContext)

        setContent {
            // Chỉ chạy xóa cờ khi màn hình được khởi tạo hoặc quay lại, không chạy mỗi lần Recompose
            LaunchedEffect(Unit) {
                forceClearSecureFlag()
            }

            val customColorScheme = lightColorScheme(
                primary = Color(0xFF1976D2),
                onPrimary = Color.White,
                background = Color.White,
                onBackground = Color.Black,
                surface = Color.White,
                onSurface = Color.Black,
                secondaryContainer = Color(0xFFE3F2FD),
                onSecondaryContainer = Color.Black,
                primaryContainer = Color(0xFFBBDEFB),
                onPrimaryContainer = Color.Black
            )

            MaterialTheme(colorScheme = customColorScheme) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Color.White
                ) {
                    val savedUser = remember { prefs.getCurrentUser() }
                    // Ép về false để luôn yêu cầu đăng nhập khi mở app
                    var isAuthenticated by remember { mutableStateOf(false) }

                    // Tự động nạp ảnh từ Assets khi đăng nhập thành công
                    LaunchedEffect(isAuthenticated) {
                        if (isAuthenticated) {
                            val username = prefs.getCurrentUser()
                            if (username != null) {
                                try {
                                    val assetManager = assets
                                    val assetFiles = assetManager.list("") ?: emptyArray()
                                    
                                    // Ưu tiên: face_username.jpg -> debug_face.jpg
                                    val targetName = "face_$username.jpg"
                                    val debugName = "debug_face.jpg"
                                    
                                    val fileName = when {
                                        assetFiles.contains(targetName) -> targetName
                                        assetFiles.contains(debugName) -> debugName
                                        else -> null
                                    }

                                    fileName?.let { name ->
                                        val outFile = java.io.File(filesDir, "face_$username.jpg")
                                        assetManager.open(name).use { input ->
                                            java.io.FileOutputStream(outFile).use { output ->
                                                input.copyTo(output)
                                            }
                                        }
                                        prefs.saveAvatarUri(username, outFile.absolutePath)
                                        Toast.makeText(this@MainActivity, "Đã khớp mẫu FaceID: $name", Toast.LENGTH_SHORT).show()
                                    }
                                } catch (e: Exception) {
                                    android.util.Log.e("FaceID", "Lỗi nạp ảnh: ${e.message}")
                                }
                            }
                        }
                    }

                    LaunchedEffect(Unit) {
                        savedUser?.let {
                            transactionViewModel.setUsername(it)
                        }
                    }

                    val permissionLauncher = rememberLauncherForActivityResult(
                        ActivityResultContracts.RequestMultiplePermissions()
                    ) { permissions ->
                        val allGranted = permissions.entries.all { it.value }
                        if (!allGranted) {
                            Toast.makeText(this@MainActivity, "Cần quyền SMS", Toast.LENGTH_SHORT).show()
                        }
                    }

                    LaunchedEffect(isAuthenticated) {
                        if (isAuthenticated) {
                            val permissionsNeeded = arrayOf(
                                Manifest.permission.RECEIVE_SMS,
                                Manifest.permission.READ_SMS
                            )
                            val needsPermission = permissionsNeeded.any {
                                ContextCompat.checkSelfPermission(this@MainActivity, it) != PackageManager.PERMISSION_GRANTED
                            }
                            if (needsPermission) {
                                permissionLauncher.launch(permissionsNeeded)
                            }
                        }
                    }

                    if (isAuthenticated) {
                        HomeScreen(
                            viewModel = transactionViewModel,
                            onAuthenticate = { onSuccess ->
                                try {
                                    biometricHelper.showBiometricPrompt(
                                        activity = this@MainActivity as androidx.fragment.app.FragmentActivity,
                                        onSuccess = { onSuccess() },
                                        onError = { error ->
                                            Toast.makeText(this@MainActivity, error, Toast.LENGTH_SHORT).show()
                                        }
                                    )
                                } catch (e: Exception) {
                                    Toast.makeText(this@MainActivity, "Lỗi: ${e.message}", Toast.LENGTH_SHORT).show()
                                }
                            },
                            onLogout = { 
                                prefs.setCurrentUser(null)
                                transactionViewModel.setUsername("")
                                isAuthenticated = false 
                            }
                        )
                    } else {
                        AuthScreen(
                            viewModel = authViewModel,
                            onAuthenticated = { username ->
                                prefs.setCurrentUser(username)
                                transactionViewModel.setUsername(username)
                                isAuthenticated = true
                            }
                        )
                    }
                }
            }
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            forceClearSecureFlag()
        }
    }
}
