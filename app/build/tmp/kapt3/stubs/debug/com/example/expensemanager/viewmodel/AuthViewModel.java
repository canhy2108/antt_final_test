package com.example.expensemanager.viewmodel;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000&\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\u000b\n\u0000\n\u0002\u0010\u000e\n\u0002\b\u0004\n\u0002\u0010\u0002\n\u0000\u0018\u00002\u00020\u0001B\r\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u00a2\u0006\u0002\u0010\u0004J\u000e\u0010\u0005\u001a\u00020\u00062\u0006\u0010\u0007\u001a\u00020\bJ\u0016\u0010\t\u001a\u00020\u00062\u0006\u0010\n\u001a\u00020\b2\u0006\u0010\u000b\u001a\u00020\bJ\u0016\u0010\f\u001a\u00020\r2\u0006\u0010\n\u001a\u00020\b2\u0006\u0010\u000b\u001a\u00020\bR\u000e\u0010\u0002\u001a\u00020\u0003X\u0082\u0004\u00a2\u0006\u0002\n\u0000\u00a8\u0006\u000e"}, d2 = {"Lcom/example/expensemanager/viewmodel/AuthViewModel;", "Landroidx/lifecycle/ViewModel;", "prefs", "Lcom/example/expensemanager/security/SecurePreferences;", "(Lcom/example/expensemanager/security/SecurePreferences;)V", "isCorrectPin", "", "input", "", "login", "username", "password", "register", "", "app_debug"})
public final class AuthViewModel extends androidx.lifecycle.ViewModel {
    @org.jetbrains.annotations.NotNull()
    private final com.example.expensemanager.security.SecurePreferences prefs = null;
    
    public AuthViewModel(@org.jetbrains.annotations.NotNull()
    com.example.expensemanager.security.SecurePreferences prefs) {
        super();
    }
    
    public final boolean isCorrectPin(@org.jetbrains.annotations.NotNull()
    java.lang.String input) {
        return false;
    }
    
    public final void register(@org.jetbrains.annotations.NotNull()
    java.lang.String username, @org.jetbrains.annotations.NotNull()
    java.lang.String password) {
    }
    
    public final boolean login(@org.jetbrains.annotations.NotNull()
    java.lang.String username, @org.jetbrains.annotations.NotNull()
    java.lang.String password) {
        return false;
    }
}