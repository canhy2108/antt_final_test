package com.example.expensemanager.security;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000.\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u000b\n\u0000\n\u0002\u0010\u000e\n\u0002\b\u0007\n\u0002\u0010\u0002\n\u0002\b\f\u0018\u0000 \u001d2\u00020\u0001:\u0001\u001dB\r\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u00a2\u0006\u0002\u0010\u0004J\u0016\u0010\u0007\u001a\u00020\b2\u0006\u0010\t\u001a\u00020\n2\u0006\u0010\u000b\u001a\u00020\nJ\u0010\u0010\f\u001a\u0004\u0018\u00010\n2\u0006\u0010\t\u001a\u00020\nJ\b\u0010\r\u001a\u0004\u0018\u00010\nJ\u0010\u0010\u000e\u001a\u0004\u0018\u00010\n2\u0006\u0010\t\u001a\u00020\nJ\u0016\u0010\u000f\u001a\u00020\b2\u0006\u0010\t\u001a\u00020\n2\u0006\u0010\u0010\u001a\u00020\nJ\u001e\u0010\u0011\u001a\u00020\u00122\u0006\u0010\t\u001a\u00020\n2\u0006\u0010\u0013\u001a\u00020\n2\u0006\u0010\u0014\u001a\u00020\nJ\u0016\u0010\u0015\u001a\u00020\u00122\u0006\u0010\t\u001a\u00020\n2\u0006\u0010\u0016\u001a\u00020\nJ.\u0010\u0017\u001a\u00020\u00122\u0006\u0010\t\u001a\u00020\n2\u0006\u0010\u000b\u001a\u00020\n2\u0006\u0010\u0018\u001a\u00020\n2\u0006\u0010\u0019\u001a\u00020\n2\u0006\u0010\u001a\u001a\u00020\nJ\u0010\u0010\u001b\u001a\u00020\u00122\b\u0010\t\u001a\u0004\u0018\u00010\nJ\u0016\u0010\u001c\u001a\u00020\b2\u0006\u0010\t\u001a\u00020\n2\u0006\u0010\u001a\u001a\u00020\nR\u000e\u0010\u0005\u001a\u00020\u0006X\u0082\u0004\u00a2\u0006\u0002\n\u0000\u00a8\u0006\u001e"}, d2 = {"Lcom/example/expensemanager/security/SecurePreferences;", "", "context", "Landroid/content/Context;", "(Landroid/content/Context;)V", "prefs", "Landroid/content/SharedPreferences;", "checkUser", "", "username", "", "password", "getAvatarUri", "getCurrentUser", "getSecurityQuestion", "isCorrectPin", "input", "resetCredentials", "", "newPass", "newPin", "saveAvatarUri", "uri", "saveUser", "pin", "question", "answer", "setCurrentUser", "verifyRecovery", "Companion", "app_debug"})
public final class SecurePreferences {
    @org.jetbrains.annotations.NotNull()
    private final android.content.SharedPreferences prefs = null;
    @kotlin.jvm.Volatile()
    @org.jetbrains.annotations.Nullable()
    private static volatile android.content.SharedPreferences INSTANCE;
    @org.jetbrains.annotations.NotNull()
    public static final com.example.expensemanager.security.SecurePreferences.Companion Companion = null;
    
    public SecurePreferences(@org.jetbrains.annotations.NotNull()
    android.content.Context context) {
        super();
    }
    
    public final void saveUser(@org.jetbrains.annotations.NotNull()
    java.lang.String username, @org.jetbrains.annotations.NotNull()
    java.lang.String password, @org.jetbrains.annotations.NotNull()
    java.lang.String pin, @org.jetbrains.annotations.NotNull()
    java.lang.String question, @org.jetbrains.annotations.NotNull()
    java.lang.String answer) {
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.String getCurrentUser() {
        return null;
    }
    
    public final void setCurrentUser(@org.jetbrains.annotations.Nullable()
    java.lang.String username) {
    }
    
    public final void saveAvatarUri(@org.jetbrains.annotations.NotNull()
    java.lang.String username, @org.jetbrains.annotations.NotNull()
    java.lang.String uri) {
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.String getAvatarUri(@org.jetbrains.annotations.NotNull()
    java.lang.String username) {
        return null;
    }
    
    public final boolean checkUser(@org.jetbrains.annotations.NotNull()
    java.lang.String username, @org.jetbrains.annotations.NotNull()
    java.lang.String password) {
        return false;
    }
    
    public final boolean isCorrectPin(@org.jetbrains.annotations.NotNull()
    java.lang.String username, @org.jetbrains.annotations.NotNull()
    java.lang.String input) {
        return false;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.String getSecurityQuestion(@org.jetbrains.annotations.NotNull()
    java.lang.String username) {
        return null;
    }
    
    public final boolean verifyRecovery(@org.jetbrains.annotations.NotNull()
    java.lang.String username, @org.jetbrains.annotations.NotNull()
    java.lang.String answer) {
        return false;
    }
    
    public final void resetCredentials(@org.jetbrains.annotations.NotNull()
    java.lang.String username, @org.jetbrains.annotations.NotNull()
    java.lang.String newPass, @org.jetbrains.annotations.NotNull()
    java.lang.String newPin) {
    }
    
    @kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000\u001c\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\b\u0086\u0003\u0018\u00002\u00020\u0001B\u0007\b\u0002\u00a2\u0006\u0002\u0010\u0002J\u0010\u0010\u0005\u001a\u00020\u00042\u0006\u0010\u0006\u001a\u00020\u0007H\u0002J\u0010\u0010\b\u001a\u00020\u00042\u0006\u0010\u0006\u001a\u00020\u0007H\u0002R\u0010\u0010\u0003\u001a\u0004\u0018\u00010\u0004X\u0082\u000e\u00a2\u0006\u0002\n\u0000\u00a8\u0006\t"}, d2 = {"Lcom/example/expensemanager/security/SecurePreferences$Companion;", "", "()V", "INSTANCE", "Landroid/content/SharedPreferences;", "getPrefs", "context", "Landroid/content/Context;", "initPrefs", "app_debug"})
    public static final class Companion {
        
        private Companion() {
            super();
        }
        
        private final android.content.SharedPreferences getPrefs(android.content.Context context) {
            return null;
        }
        
        private final android.content.SharedPreferences initPrefs(android.content.Context context) {
            return null;
        }
    }
}