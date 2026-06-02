package com.budgetbee.database;

import android.content.Context;
import androidx.room.Database;
import androidx.room.Room;
import androidx.room.RoomDatabase;
import com.budgetbee.models.Budget;
import com.budgetbee.models.Transaction;
import com.budgetbee.models.User;

@Database(entities = {User.class, Transaction.class, Budget.class}, version = 1)
public abstract class BudgetBeeDatabase extends RoomDatabase {
    private static volatile BudgetBeeDatabase INSTANCE;

    public abstract UserDao userDao();
    public abstract TransactionDao transactionDao();
    public abstract BudgetDao budgetDao();

    public static BudgetBeeDatabase getInstance(Context context) {
        if (INSTANCE == null) {
            synchronized (BudgetBeeDatabase.class) {
                if (INSTANCE == null) {
                    INSTANCE = Room.databaseBuilder(
                            context.getApplicationContext(),
                            BudgetBeeDatabase.class,
                            "budgetbee.db"
                    ).build();
                }
            }
        }
        return INSTANCE;
    }
}
