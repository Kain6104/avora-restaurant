# AVORA Bank Connect Proguard Rules
-keep class vn.avora.bankconnect.core.network.models.** { *; }
-keepclassmembers class * {
    @androidx.room.Entity *;
    @androidx.room.Dao *;
}

