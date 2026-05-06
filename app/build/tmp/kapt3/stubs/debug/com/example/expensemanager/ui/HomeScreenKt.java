package com.example.expensemanager.ui;

@kotlin.Metadata(mv = {1, 9, 0}, k = 2, xi = 48, d1 = {"\u0000@\n\u0000\n\u0002\u0010\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\u0010\u000e\n\u0002\u0010\u0006\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0005\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u000b\n\u0002\b\b\u001aH\u0010\u0000\u001a\u00020\u00012\n\b\u0002\u0010\u0002\u001a\u0004\u0018\u00010\u00032\f\u0010\u0004\u001a\b\u0012\u0004\u0012\u00020\u00010\u00052$\u0010\u0006\u001a \u0012\u0004\u0012\u00020\b\u0012\u0004\u0012\u00020\t\u0012\u0004\u0012\u00020\b\u0012\u0004\u0012\u00020\b\u0012\u0004\u0012\u00020\u00010\u0007H\u0007\u001a\u001e\u0010\n\u001a\u00020\u00012\u0006\u0010\u000b\u001a\u00020\f2\f\u0010\r\u001a\b\u0012\u0004\u0012\u00020\u00010\u0005H\u0007\u001a:\u0010\u000e\u001a\u00020\u00012\u0006\u0010\u000f\u001a\u00020\b2\u0006\u0010\u0010\u001a\u00020\t2\u0006\u0010\u0011\u001a\u00020\u00122\u0006\u0010\u0013\u001a\u00020\u00142\u0006\u0010\u0015\u001a\u00020\u0016H\u0007\u00f8\u0001\u0000\u00a2\u0006\u0004\b\u0017\u0010\u0018\u001a,\u0010\u0019\u001a\u00020\u00012\u0006\u0010\u001a\u001a\u00020\u00032\f\u0010\u001b\u001a\b\u0012\u0004\u0012\u00020\u00010\u00052\f\u0010\u001c\u001a\b\u0012\u0004\u0012\u00020\u00010\u0005H\u0007\u001a\u000e\u0010\u001d\u001a\u00020\b2\u0006\u0010\u0010\u001a\u00020\t\u0082\u0002\u0007\n\u0005\b\u00a1\u001e0\u0001\u00a8\u0006\u001e"}, d2 = {"AddTransactionDialog", "", "initialTransaction", "Lcom/example/expensemanager/data/Transaction;", "onDismiss", "Lkotlin/Function0;", "onConfirm", "Lkotlin/Function4;", "", "", "HomeScreen", "viewModel", "Lcom/example/expensemanager/viewmodel/TransactionViewModel;", "onLogout", "SummaryItem", "label", "amount", "icon", "Landroidx/compose/ui/graphics/vector/ImageVector;", "color", "Landroidx/compose/ui/graphics/Color;", "isVisible", "", "SummaryItem-42QJj7c", "(Ljava/lang/String;DLandroidx/compose/ui/graphics/vector/ImageVector;JZ)V", "TransactionItem", "transaction", "onDelete", "onEdit", "formatCurrency", "app_debug"})
public final class HomeScreenKt {
    
    @kotlin.OptIn(markerClass = {androidx.compose.material3.ExperimentalMaterial3Api.class})
    @androidx.compose.runtime.Composable()
    public static final void HomeScreen(@org.jetbrains.annotations.NotNull()
    com.example.expensemanager.viewmodel.TransactionViewModel viewModel, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function0<kotlin.Unit> onLogout) {
    }
    
    @androidx.compose.runtime.Composable()
    public static final void TransactionItem(@org.jetbrains.annotations.NotNull()
    com.example.expensemanager.data.Transaction transaction, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function0<kotlin.Unit> onDelete, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function0<kotlin.Unit> onEdit) {
    }
    
    @androidx.compose.runtime.Composable()
    public static final void AddTransactionDialog(@org.jetbrains.annotations.Nullable()
    com.example.expensemanager.data.Transaction initialTransaction, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function0<kotlin.Unit> onDismiss, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function4<? super java.lang.String, ? super java.lang.Double, ? super java.lang.String, ? super java.lang.String, kotlin.Unit> onConfirm) {
    }
    
    @org.jetbrains.annotations.NotNull()
    public static final java.lang.String formatCurrency(double amount) {
        return null;
    }
}