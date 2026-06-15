package com.example.expensemanager;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000D\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0005\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\t\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0004\n\u0002\u0010\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0005\n\u0002\u0010\u000b\n\u0000\u0018\u00002\u00020\u0001B\u0005\u00a2\u0006\u0002\u0010\u0002J\b\u0010\u0014\u001a\u00020\u0015H\u0002J\u0012\u0010\u0016\u001a\u00020\u00152\b\u0010\u0017\u001a\u0004\u0018\u00010\u0018H\u0014J\b\u0010\u0019\u001a\u00020\u0015H\u0014J\b\u0010\u001a\u001a\u00020\u0015H\u0014J\b\u0010\u001b\u001a\u00020\u0015H\u0014J\u0010\u0010\u001c\u001a\u00020\u00152\u0006\u0010\u001d\u001a\u00020\u001eH\u0016R\u001b\u0010\u0003\u001a\u00020\u00048BX\u0082\u0084\u0002\u00a2\u0006\f\n\u0004\b\u0007\u0010\b\u001a\u0004\b\u0005\u0010\u0006R\u000e\u0010\t\u001a\u00020\nX\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u000b\u001a\u00020\fX\u0082\u000e\u00a2\u0006\u0002\n\u0000R\u000e\u0010\r\u001a\u00020\u000eX\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u001b\u0010\u000f\u001a\u00020\u00108BX\u0082\u0084\u0002\u00a2\u0006\f\n\u0004\b\u0013\u0010\b\u001a\u0004\b\u0011\u0010\u0012\u00a8\u0006\u001f"}, d2 = {"Lcom/example/expensemanager/MainActivity;", "Landroidx/fragment/app/FragmentActivity;", "()V", "authViewModel", "Lcom/example/expensemanager/viewmodel/AuthViewModel;", "getAuthViewModel", "()Lcom/example/expensemanager/viewmodel/AuthViewModel;", "authViewModel$delegate", "Lkotlin/Lazy;", "handler", "Landroid/os/Handler;", "securityCheckStartTime", "", "securityTask", "Ljava/lang/Runnable;", "transactionViewModel", "Lcom/example/expensemanager/viewmodel/TransactionViewModel;", "getTransactionViewModel", "()Lcom/example/expensemanager/viewmodel/TransactionViewModel;", "transactionViewModel$delegate", "forceClearSecureFlag", "", "onCreate", "savedInstanceState", "Landroid/os/Bundle;", "onResume", "onStart", "onStop", "onWindowFocusChanged", "hasFocus", "", "app_debug"})
public final class MainActivity extends androidx.fragment.app.FragmentActivity {
    @org.jetbrains.annotations.NotNull()
    private final kotlin.Lazy authViewModel$delegate = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlin.Lazy transactionViewModel$delegate = null;
    private long securityCheckStartTime = 0L;
    @org.jetbrains.annotations.NotNull()
    private final android.os.Handler handler = null;
    @org.jetbrains.annotations.NotNull()
    private final java.lang.Runnable securityTask = null;
    
    public MainActivity() {
        super();
    }
    
    private final com.example.expensemanager.viewmodel.AuthViewModel getAuthViewModel() {
        return null;
    }
    
    private final com.example.expensemanager.viewmodel.TransactionViewModel getTransactionViewModel() {
        return null;
    }
    
    private final void forceClearSecureFlag() {
    }
    
    @java.lang.Override()
    protected void onStart() {
    }
    
    @java.lang.Override()
    protected void onStop() {
    }
    
    @java.lang.Override()
    protected void onResume() {
    }
    
    @java.lang.Override()
    protected void onCreate(@org.jetbrains.annotations.Nullable()
    android.os.Bundle savedInstanceState) {
    }
    
    @java.lang.Override()
    public void onWindowFocusChanged(boolean hasFocus) {
    }
}