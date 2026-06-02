package com.budgetbee.database;

import androidx.room.Dao;
import androidx.room.Delete;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;
import androidx.room.Update;
import com.budgetbee.models.Budget;
import java.util.List;

@Dao
public interface BudgetDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    void insert(Budget budget);

    @Update
    void update(Budget budget);

    @Delete
    void delete(Budget budget);

    @Query("SELECT * FROM budgets WHERE id = :id")
    Budget getBudgetById(int id);

    @Query("SELECT * FROM budgets WHERE userId = :userId AND month = :month")
    List<Budget> getUserBudgetsByMonth(int userId, String month);

    @Query("SELECT * FROM budgets WHERE userId = :userId")
    List<Budget> getUserBudgets(int userId);

    @Query("SELECT * FROM budgets WHERE userId = :userId AND category = :category AND month = :month")
    Budget getBudgetByCategory(int userId, String category, String month);

    @Query("DELETE FROM budgets WHERE id = :id")
    void deleteById(int id);

    @Query("DELETE FROM budgets")
    void deleteAll();
}
