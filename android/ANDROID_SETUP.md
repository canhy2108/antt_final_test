# BudgetBee - Native Android App Setup Guide

## 📱 Overview

BudgetBee Native Android App is a mobile application built with Java/Kotlin that connects to the Laravel backend API. The app allows users to manage their budgets and transactions on their Android devices.

## ✅ Completed Components

### 1. **Activities** ✅
- **SplashActivity**: Initial splash screen with auto-navigation
- **LoginActivity**: Login screen with email/password validation
- **RegisterActivity**: Registration screen with password strength validation
- **MainActivity**: Main app screen with bottom navigation

### 2. **Fragments** ✅
- **TransactionFragment**: Display list of transactions with RecyclerView
- **BudgetFragment**: Display list of budgets with progress indicators

### 3. **Adapters** ✅
- **TransactionAdapter**: RecyclerView adapter for transactions
- **BudgetAdapter**: RecyclerView adapter for budgets

### 4. **API Integration** ✅
- **ApiClient**: Retrofit client with OkHttp interceptor
- **ApiService**: Retrofit interface with all endpoints
- Authentication endpoints (login, register, logout)
- Transaction endpoints (CRUD operations)
- Budget endpoints (CRUD operations)

### 5. **UI Layouts** ✅
- activity_splash.xml
- activity_login.xml
- activity_register.xml
- activity_main.xml
- fragment_transaction.xml
- fragment_budget.xml
- item_transaction.xml (existing)
- item_budget.xml (existing)

### 6. **Resources** ✅
- Color definitions
- String resources
- Drawable resources (button_background, edit_text_background)
- Menu resources (bottom_navigation_menu, menu_main)

### 7. **Security & Storage** ✅
- **AuthManager**: Manages authentication state and headers
- **PreferenceManager**: SharedPreferences for storing auth tokens and user info
- HttpOnly cookie handling (configured)
- Secure token management

## 🚀 Getting Started

### Prerequisites
- Android Studio (latest version)
- Android SDK (API level 24+)
- Java 11 or higher
- A running instance of the BudgetBee Laravel API

### Step 1: Clone/Open the Project

Open the Android project in Android Studio:
```bash
cd android
```

### Step 2: Update API Server URL

Update the base URL in `ApiClient.java`:

```java
// Change this line to your server IP/domain
private static final String BASE_URL = "http://192.168.1.100:8000/";
// or use your deployed server URL
private static final String BASE_URL = "https://your-domain.com/";
```

### Step 3: Build the Project

1. Click on **Build** → **Rebuild Project**
2. Wait for the build to complete
3. Resolve any dependency issues if prompted

### Step 4: Run the App

#### Option A: On Android Emulator
1. Click **AVD Manager** (Android Virtual Device)
2. Create or select an emulator (API level 24+)
3. Click **Run** → **Run 'app'**
4. Select the emulator

#### Option B: On Physical Device
1. Enable USB debugging on your Android device
2. Connect device via USB cable
3. Click **Run** → **Run 'app'**
4. Select your device

### Step 5: Test the App

1. **Splash Screen**: Should display for 3 seconds then navigate to login
2. **Login**: Use credentials from your BudgetBee API
3. **Register**: Create a new account if needed
4. **Main Screen**: View transactions and budgets

## 📋 Features

### ✅ Implemented Features
- User authentication (Login/Register)
- View transactions list
- View budgets list with progress indicators
- Logout functionality
- Secure token management
- Bottom navigation between sections
- Material Design UI

### 🚧 Future Features (TODO)
- Add/Edit/Delete transactions
- Add/Edit/Delete budgets
- Transaction filtering and search
- Budget analytics and charts
- Push notifications
- Offline support with local database
- Export reports

## 🔒 Security Features

- ✅ HTTPS/TLS encryption support
- ✅ Bearer token authentication
- ✅ HttpOnly cookie handling
- ✅ Secure SharedPreferences for token storage
- ✅ Input validation on login/register
- ✅ Password strength validation

## 🛠️ Project Structure

```
android/
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/budgetbee/
│   │   │   │   ├── api/
│   │   │   │   │   ├── ApiClient.java
│   │   │   │   │   └── ApiService.java
│   │   │   │   ├── models/
│   │   │   │   │   ├── User.java
│   │   │   │   │   ├── Transaction.java
│   │   │   │   │   ├── Budget.java
│   │   │   │   │   ├── AuthResponse.java
│   │   │   │   │   └── ApiResponse.java
│   │   │   │   ├── ui/
│   │   │   │   │   ├── activities/
│   │   │   │   │   │   ├── SplashActivity.java
│   │   │   │   │   │   ├── LoginActivity.java
│   │   │   │   │   │   ├── RegisterActivity.java
│   │   │   │   │   │   └── MainActivity.java
│   │   │   │   │   ├── fragments/
│   │   │   │   │   │   ├── TransactionFragment.java
│   │   │   │   │   │   └── BudgetFragment.java
│   │   │   │   │   └── adapters/
│   │   │   │   │       ├── TransactionAdapter.java
│   │   │   │   │       └── BudgetAdapter.java
│   │   │   │   ├── database/
│   │   │   │   │   ├── BudgetBeeDatabase.java
│   │   │   │   │   ├── BudgetDao.java
│   │   │   │   │   ├── TransactionDao.java
│   │   │   │   │   └── UserDao.java
│   │   │   │   └── utils/
│   │   │   │       ├── AuthManager.java
│   │   │   │       ├── PreferenceManager.java
│   │   │   │       └── Utils.java
│   │   │   ├── res/
│   │   │   │   ├── layout/
│   │   │   │   ├── drawable/
│   │   │   │   ├── menu/
│   │   │   │   └── values/
│   │   │   └── AndroidManifest.xml
│   ├── build.gradle
│   └── proguard-rules.pro
├── build.gradle
├── settings.gradle
└── README.md (this file)
```

## 🐛 Troubleshooting

### Issue: Cannot connect to API
**Solution**: Check the BASE_URL in ApiClient.java matches your server address

### Issue: Login fails with 404
**Solution**: Verify the Laravel API is running and the routes are correct

### Issue: App crashes on launch
**Solution**: Check logcat in Android Studio for detailed error messages

### Issue: Emulator cannot access localhost
**Solution**: Use `10.0.2.2` instead of `127.0.0.1` or `localhost`

## 📚 API Endpoints

The app uses the following endpoints:

```
POST   /api/auth/login
POST   /api/auth/register
POST   /api/auth/logout
GET    /api/user
GET    /api/transactions
POST   /api/transactions
GET    /api/transactions/{id}
PUT    /api/transactions/{id}
DELETE /api/transactions/{id}
GET    /api/budgets
POST   /api/budgets
GET    /api/budgets/{id}
PUT    /api/budgets/{id}
DELETE /api/budgets/{id}
```

## 📦 Dependencies

Key libraries used:
- **Retrofit 2**: REST API client
- **OkHttp 3**: HTTP client with logging
- **Gson**: JSON serialization
- **AndroidX**: Modern Android libraries
- **Material Design**: UI components
- **Room Database**: Local data persistence
- **Lifecycle**: Activity/Fragment lifecycle management

## 🎓 Learning Resources

- [Android Developer Guide](https://developer.android.com/guide)
- [Retrofit Documentation](https://square.github.io/retrofit/)
- [Android Architecture Components](https://developer.android.com/jetpack/docs/guide)
- [Material Design](https://material.io/)

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the logcat output in Android Studio
3. Check if the Laravel API is running and accessible
4. Verify network connectivity

## 📄 License

This project is licensed under the MIT License - see the LICENSE file in the parent directory.

---

**Last Updated**: April 2026
**App Version**: 1.0.0
**API Version**: v1
