package vn.avora.bankconnect.core.database.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "app_configs")
data class ConfigEntity(
    @PrimaryKey
    val key: String,
    val value: String
)

