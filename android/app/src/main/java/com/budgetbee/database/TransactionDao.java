package com.budgetbee.database;

import androidx.room.Dao;
import androidx.room.Delete;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;
import androidx.room.Update;
import com.budgetbee.models.Transaction;
import java.util.List;

@Dao
public interface TransactionDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    void insert(Transaction transaction);

    @Update
    void update(Transaction transaction);

    @Delete
    void delete(Transaction transaction);

    @Query("SELECT * FROM transactions WHERE id = :id")
    Transaction getTransactionById(int id);

    @Query("SELECT * FROM transactions WHERE userId = :userId ORDER BY date DESC")
    List<Transaction> getUserTransactions(int userId);

    @Query("SELECT * FROM transactions WHERE userId = :userId AND type = :type ORDER BY date DESC")
    List<Transaction> getUserTransactionsByType(int userId, String type);

    @Query("SELECT * FROM transactions WHERE userId = :userId AND category = :category ORDER BY date DESC")
    List<Transaction> getUserTransactionsByCategory(int userId, String category);

    @Query("SELECT * FROM transactions WHERE userId = :userId AND date LIKE :monthYear ORDER BY date DESC")
    List<Transaction> getUserTransactionsByMonth(int userId, String monthYear);

    @Query("SELECT SUM(amount) FROM transactions WHERE userId = :userId AND type = 'income'")
    double getTotalIncome(int userId);

    @Query("SELECT SUM(amount) FROM transactions WHERE userId = :userId AND type = 'expense'")
    double getTotalExpense(int userId);

    @Query("DELETE FROM transactions WHERE id = :id")
    void deleteById(int id);

    @Query("DELETE FROM transactions")
    void deleteAll();
}
