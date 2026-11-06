package vn.avora.bankconnect.core.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow
import vn.avora.bankconnect.core.database.entity.ConfigEntity

@Dao
interface ConfigDao {

    @Query("SELECT value FROM app_configs WHERE `key` = :key LIMIT 1")
    suspend fun get(key: String): String?

    @Query("SELECT value FROM app_configs WHERE `key` = :key LIMIT 1")
    fun getFlow(key: String): Flow<String?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun set(config: ConfigEntity)

    @Query("DELETE FROM app_configs WHERE `key` = :key")
    suspend fun delete(key: String)
}

