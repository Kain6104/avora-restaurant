package vn.avora.bankconnect.core.network

import android.content.Context
import okhttp3.ConnectionPool
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import vn.avora.bankconnect.core.database.AppDatabase
import java.util.concurrent.TimeUnit

object NetworkClient {

    const val DEFAULT_SERVER_URL = "https://avorafnb.com/"

    @Volatile
    private var apiService: BankApiService? = null

    @Volatile
    private var currentBaseUrl: String = DEFAULT_SERVER_URL

    fun getApiService(context: Context): BankApiService {
        return apiService ?: synchronized(this) {
            apiService ?: buildApiService(context, currentBaseUrl).also { apiService = it }
        }
    }

    fun updateBaseUrl(context: Context, newUrl: String) {
        val formatted = if (newUrl.endsWith("/")) newUrl else "$newUrl/"
        if (formatted != currentBaseUrl) {
            currentBaseUrl = formatted
            apiService = buildApiService(context, currentBaseUrl)
        }
    }

    private fun buildApiService(context: Context, baseUrl: String): BankApiService {
        val db = AppDatabase.getInstance(context)

        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.HEADERS // Tránh log raw transaction body
        }

        val securityInterceptor = SecurityInterceptor {
            kotlinx.coroutines.runBlocking {
                db.configDao().get("device_id") ?: "unknown_device"
            }
        }

        val okHttpClient = OkHttpClient.Builder()
            .connectionPool(ConnectionPool(5, 5, TimeUnit.MINUTES))
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .writeTimeout(15, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .addInterceptor(securityInterceptor)
            .addInterceptor(logging)
            .build()

        val retrofit = Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()

        return retrofit.create(BankApiService::class.java)
    }
}

