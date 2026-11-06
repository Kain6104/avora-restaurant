package vn.avora.bankconnect.core.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import vn.avora.bankconnect.core.database.dao.ConfigDao
import vn.avora.bankconnect.core.database.dao.TransactionDao
import vn.avora.bankconnect.core.database.entity.ConfigEntity
import vn.avora.bankconnect.core.database.entity.TransactionEntity

@Database(
    entities = [TransactionEntity::class, ConfigEntity::class],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun transactionDao(): TransactionDao
    abstract fun configDao(): ConfigDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "avora_bank_connect.db"
                ).fallbackToDestructiveMigration()
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}

