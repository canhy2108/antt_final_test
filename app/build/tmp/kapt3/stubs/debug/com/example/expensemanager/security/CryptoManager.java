package com.example.expensemanager.security;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000*\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u0012\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0004\u0018\u0000 \u00102\u00020\u0001:\u0001\u0010B\u0005\u00a2\u0006\u0002\u0010\u0002J\b\u0010\u0006\u001a\u00020\u0007H\u0002J\u0016\u0010\b\u001a\u00020\t2\u0006\u0010\n\u001a\u00020\t2\u0006\u0010\u000b\u001a\u00020\tJ\u001a\u0010\f\u001a\u000e\u0012\u0004\u0012\u00020\t\u0012\u0004\u0012\u00020\t0\r2\u0006\u0010\u000e\u001a\u00020\tJ\b\u0010\u000f\u001a\u00020\u0007H\u0002R\u0016\u0010\u0003\u001a\n \u0005*\u0004\u0018\u00010\u00040\u0004X\u0082\u0004\u00a2\u0006\u0002\n\u0000\u00a8\u0006\u0011"}, d2 = {"Lcom/example/expensemanager/security/CryptoManager;", "", "()V", "keyStore", "Ljava/security/KeyStore;", "kotlin.jvm.PlatformType", "createKey", "Ljavax/crypto/SecretKey;", "decrypt", "", "ciphertext", "iv", "encrypt", "Lkotlin/Pair;", "data", "getKey", "Companion", "app_debug"})
public final class CryptoManager {
    private final java.security.KeyStore keyStore = null;
    @org.jetbrains.annotations.NotNull()
    private static final java.lang.String ALGORITHM = "AES";
    @org.jetbrains.annotations.NotNull()
    private static final java.lang.String BLOCK_MODE = "GCM";
    @org.jetbrains.annotations.NotNull()
    private static final java.lang.String PADDING = "NoPadding";
    @org.jetbrains.annotations.NotNull()
    private static final java.lang.String TRANSFORMATION = "AES/GCM/NoPadding";
    @org.jetbrains.annotations.NotNull()
    public static final com.example.expensemanager.security.CryptoManager.Companion Companion = null;
    
    public CryptoManager() {
        super();
    }
    
    private final javax.crypto.SecretKey getKey() {
        return null;
    }
    
    private final javax.crypto.SecretKey createKey() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final kotlin.Pair<byte[], byte[]> encrypt(@org.jetbrains.annotations.NotNull()
    byte[] data) {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final byte[] decrypt(@org.jetbrains.annotations.NotNull()
    byte[] ciphertext, @org.jetbrains.annotations.NotNull()
    byte[] iv) {
        return null;
    }
    
    @kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000\u0014\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0002\n\u0002\u0010\u000e\n\u0002\b\u0004\b\u0086\u0003\u0018\u00002\u00020\u0001B\u0007\b\u0002\u00a2\u0006\u0002\u0010\u0002R\u000e\u0010\u0003\u001a\u00020\u0004X\u0082T\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0005\u001a\u00020\u0004X\u0082T\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0006\u001a\u00020\u0004X\u0082T\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0007\u001a\u00020\u0004X\u0082T\u00a2\u0006\u0002\n\u0000\u00a8\u0006\b"}, d2 = {"Lcom/example/expensemanager/security/CryptoManager$Companion;", "", "()V", "ALGORITHM", "", "BLOCK_MODE", "PADDING", "TRANSFORMATION", "app_debug"})
    public static final class Companion {
        
        private Companion() {
            super();
        }
    }
}