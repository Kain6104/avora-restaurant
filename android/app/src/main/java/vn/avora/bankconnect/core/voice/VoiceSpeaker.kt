package vn.avora.bankconnect.core.voice

import android.content.Context
import android.media.AudioAttributes
import android.os.Build
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import java.util.Locale
import java.util.concurrent.ConcurrentLinkedQueue

class VoiceSpeaker private constructor(private val appContext: Context) : TextToSpeech.OnInitListener {

    companion object {
        private const val TAG = "AVORA_VoiceSpeaker"

        @Volatile
        private var instance: VoiceSpeaker? = null

        fun getInstance(context: Context): VoiceSpeaker {
            return instance ?: synchronized(this) {
                instance ?: VoiceSpeaker(context.applicationContext).also { instance = it }
            }
        }

        /**
         * Chuyển đổi số tiền VNĐ sang chuỗi chữ tiếng Việt tự nhiên, chuẩn phát âm
         * Ví dụ: 50000 -> "năm mươi nghìn đồng"
         */
        fun formatVndToWords(amount: Long): String {
            if (amount <= 0) return "không đồng"

            val units = arrayOf("", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ")
            var n = amount
            val groups = mutableListOf<Long>()

            while (n > 0) {
                groups.add(n % 1000)
                n /= 1000
            }

            val words = mutableListOf<String>()
            for (i in groups.indices.reversed()) {
                val groupVal = groups[i]
                if (groupVal > 0) {
                    val groupWords = readThreeDigits(groupVal.toInt(), i < groups.size - 1)
                    val unit = units[i]
                    if (unit.isNotEmpty()) {
                        words.add("$groupWords $unit")
                    } else {
                        words.add(groupWords)
                    }
                }
            }

            val result = words.joinToString(" ").trim() + " đồng"
            return result.replace(Regex("\\s+"), " ")
        }

        private fun readThreeDigits(number: Int, hasHigherGroup: Boolean): String {
            val digits = arrayOf("không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín")
            val hundreds = number / 100
            val tens = (number % 100) / 10
            val ones = number % 10

            val parts = mutableListOf<String>()

            if (hundreds > 0 || hasHigherGroup) {
                parts.add("${digits[hundreds]} trăm")
            }

            if (tens > 1) {
                parts.add("${digits[tens]} mươi")
                if (ones == 1) parts.add("mốt")
                else if (ones == 5) parts.add("lăm")
                else if (ones > 0) parts.add(digits[ones])
            } else if (tens == 1) {
                parts.add("mười")
                if (ones == 5) parts.add("lăm")
                else if (ones > 0) parts.add(digits[ones])
            } else if (tens == 0 && ones > 0) {
                if (hundreds > 0 || hasHigherGroup) {
                    parts.add("lẻ")
                }
                parts.add(digits[ones])
            }

            return parts.joinToString(" ")
        }
    }

    private var tts: TextToSpeech? = null
    private var isInitialized = false
    private val pendingQueue = ConcurrentLinkedQueue<String>()

    init {
        try {
            tts = TextToSpeech(appContext, this)
        } catch (e: Exception) {
            Log.e(TAG, "Lỗi khởi tạo TextToSpeech: ${e.message}", e)
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            val vietnamese = Locale("vi", "VN")
            val langResult = tts?.setLanguage(vietnamese)

            if (langResult == TextToSpeech.LANG_MISSING_DATA || langResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                Log.w(TAG, "Gói giọng đọc vi-VN chưa được cài đặt, thử dùng Locale('vi')")
                tts?.setLanguage(Locale("vi"))
            }

            // Tối ưu tông giọng và tốc độ nói tự nhiên, rõ ràng
            tts?.setPitch(1.0f)
            tts?.setSpeechRate(1.0f)

            // Cấu hình phát âm thanh dạng Notification/Speech với âm lượng lớn
            val audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()
            tts?.setAudioAttributes(audioAttributes)

            // Tìm giọng đọc tiếng Việt miền Nam nếu khả dụng
            try {
                val voices = tts?.voices
                if (voices != null) {
                    val southernVoice = voices.find { voice ->
                        voice.locale.language.equals("vi", ignoreCase = true) &&
                                (voice.name.contains("vic", ignoreCase = true) ||
                                 voice.name.contains("south", ignoreCase = true) ||
                                 voice.name.contains("sg", ignoreCase = true))
                    } ?: voices.find { it.locale.language.equals("vi", ignoreCase = true) }

                    if (southernVoice != null) {
                        tts?.voice = southernVoice
                        Log.i(TAG, "Đã chọn giọng đọc tiếng Việt: ${southernVoice.name}")
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Không thể chọn voice chi tiết: ${e.message}")
            }

            tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {
                    Log.d(TAG, "Bắt đầu phát âm thanh: $utteranceId")
                }
                override fun onDone(utteranceId: String?) {
                    Log.d(TAG, "Phát âm thanh hoàn tất: $utteranceId")
                }
                override fun onError(utteranceId: String?) {
                    Log.e(TAG, "Lỗi phát âm thanh: $utteranceId")
                }
            })

            isInitialized = true
            Log.i(TAG, "TextToSpeech tiếng Việt đã sẵn sàng hoạt động ngầm 24/7")

            // Phát các câu trong hàng đợi
            while (!pendingQueue.isEmpty()) {
                val pendingText = pendingQueue.poll() ?: break
                speakImmediate(pendingText)
            }
        } else {
            Log.e(TAG, "TextToSpeech onInit thất bại với mã status: $status")
        }
    }

    /**
     * Đọc thông báo chuyển khoản ngân hàng thành công
     * Ví dụ: "Vietcombank, đã nhận năm mươi nghìn đồng"
     */
    fun speakTransactionReceived(bankName: String, amount: Long) {
        val cleanBank = when (bankName.uppercase().trim()) {
            "VIETCOMBANK", "VCB" -> "Vietcombank"
            "OCB" -> "Ngân hàng Phương Đông OCB"
            "BIDV" -> "BIDV"
            "VIETINBANK", "CTG" -> "VietinBank"
            "MBBANK", "MB" -> "MB Bank"
            "TECHCOMBANK", "TCB" -> "Techcombank"
            "ACB" -> "ACB"
            "AGRIBANK", "VBA" -> "Agribank"
            "VPBANK", "VPB" -> "VPBank"
            "TPBANK", "TPB" -> "TPBank"
            "SACOMBANK", "STB" -> "Sacombank"
            "HDBANK", "HDB" -> "HDBank"
            else -> bankName
        }

        val amountWords = formatVndToWords(amount)
        val speechText = "$cleanBank, đã nhận $amountWords."
        speak(speechText)
    }

    /**
     * Đọc thông báo đơn hàng được gạch nợ thành công
     */
    fun speakOrderMatched(orderCode: String, amount: Long) {
        val cleanCode = orderCode.replace("-", " ")
        val amountWords = formatVndToWords(amount)
        val speechText = "Đã nhận $amountWords cho đơn hàng $cleanCode."
        speak(speechText)
    }

    /**
     * Phát một câu thoại bất kỳ
     */
    fun speak(text: String) {
        if (!isInitialized) {
            Log.i(TAG, "TTS chưa khởi tạo xong, đẩy vào hàng đợi: $text")
            pendingQueue.add(text)
            return
        }
        speakImmediate(text)
    }

    private fun speakImmediate(text: String) {
        try {
            val utteranceId = "AVORA_TTS_${System.currentTimeMillis()}"
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                val params = Bundle().apply {
                    putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1.0f)
                }
                tts?.speak(text, TextToSpeech.QUEUE_ADD, params, utteranceId)
            } else {
                val params = HashMap<String, String>().apply {
                    put(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, utteranceId)
                    put(TextToSpeech.Engine.KEY_PARAM_VOLUME, "1.0")
                }
                @Suppress("DEPRECATION")
                tts?.speak(text, TextToSpeech.QUEUE_ADD, params)
            }
            Log.i(TAG, "Đang đọc thông báo âm thanh: $text")
        } catch (e: Exception) {
            Log.e(TAG, "Lỗi khi gọi tts.speak(): ${e.message}", e)
        }
    }

    fun shutdown() {
        try {
            tts?.stop()
            tts?.shutdown()
            tts = null
            isInitialized = false
        } catch (e: Exception) {
            Log.e(TAG, "Lỗi shutdown TTS: ${e.message}")
        }
    }
}

