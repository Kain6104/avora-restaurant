/**
 * AVORA RESTAURANT - BỘ LỌC TỪ NGỮ KHIẾM NHÃ & KIỂM DUYỆT BÌNH LUẬN
 * Hỗ trợ tiếng Việt có dấu, không dấu, leet-speak, chèn ký tự đặc biệt, viết tắt.
 */

// Danh sách các từ cấm / chửi bậy / khiếm nhã cốt lõi
const PROFANITY_WORDS: string[] = [
  // Tiếng Việt thông tục & tục tĩu
  'đụ',
  'du me',
  'dume',
  'đụ mẹ',
  'đụ má',
  'duma',
  'đuma',
  'đụt',
  'đụ cha',
  'đụ bà',
  'đụ con',
  'đĩ',
  'con đĩ',
  'thằng đĩ',
  'đĩ điếm',
  'đĩ mẹ',
  'địt',
  'địt mẹ',
  'dit me',
  'ditme',
  'địt con mẹ',
  'dit con me',
  'địt bà',
  'địt cụ',
  'địt con',
  'đéo',
  'đéo mẹ',
  'đéo cần',
  'đéo thèm',
  'deo',
  'cặc',
  'con cặc',
  'buồi',
  'con buồi',
  'lồn',
  'cái lồn',
  'con lồn',
  'loz',
  'lon',
  'l0n',
  'c@c',
  'c4c',
  'bướm',
  'vú',
  'chim',
  'dái',
  'bìu',
  'chó đẻ',
  'chó chết',
  'óc chó',
  'súc vật',
  'đồ chó',
  'con chó',
  'chó má',
  'mẹ mày',
  'bố mày',
  'ông nội mày',
  'bà nội mày',
  'mả mẹ',
  'mả cha',
  'thằng chó',
  'đồ khốn',
  'khốn nạn',
  'chết tiệt',
  'hãm lồn',
  'hãm lol',
  'xàm lồn',
  'xàm lol',
  'ngu lồn',
  'rác rưởi',
  'con mẹ mày',
  'thằng cha mày',
  'đầu buồi',
  'đầu cặc',
  'hột le',

  // Viết tắt phổ biến trên MXH
  'dm',
  'đm',
  'dcm',
  'đcm',
  'dkm',
  'đkm',
  'dmm',
  'đmm',
  'vcl',
  'vcll',
  'vl',
  'vcc',
  'vkl',
  'vlon',
  'clgt',
  'cc',
  'cl',
  'cmn',
  'cmnr',
  'đkmm',
  'dkmm',
  'vđ',
  'vler',

  // Tiếng Anh
  'fuck',
  'fucker',
  'fucking',
  'motherfucker',
  'shit',
  'bullshit',
  'bitch',
  'asshole',
  'dick',
  'pussy',
  'cunt',
  'bastard',
  'slut',
  'whore',
  'cock',
  'porn',
  'nude',
  'sex',
];

/**
 * Chuẩn hóa chuỗi tiếng Việt loại bỏ dấu và ký tự đặc biệt
 */
function removeAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd');
}

/**
 * Chuẩn hóa các biến thể Leet-speak (0 -> o, 3 -> e, 1 -> i, @ -> a, v.v.)
 */
function normalizeLeetSpeak(str: string): string {
  return str
    .replace(/[@4]/g, 'a')
    .replace(/[3]/g, 'e')
    .replace(/[1!|]/g, 'i')
    .replace(/[0]/g, 'o')
    .replace(/[5$]/g, 's')
    .replace(/[7]/g, 't')
    .replace(/[\-_.*+~#^&]/g, ' ');
}

/**
 * Kiểm tra xem văn bản có chứa từ ngữ vi phạm tiêu chuẩn cộng đồng hay không
 */
export function checkProfanity(rawText: string): {
  isProfane: boolean;
  matchedWord?: string;
} {
  if (!rawText || !rawText.trim()) {
    return { isProfane: false };
  }

  const rawLower = rawText.toLowerCase();
  const normalizedWithAccents = normalizeLeetSpeak(rawLower);
  const normalizedNoAccents = removeAccents(normalizedWithAccents);

  // Chuỗi nén (loại bỏ toàn bộ dấu cách và ký tự ngăn cách để chống d.u.m.e, d u m e)
  const compactWithAccents = normalizedWithAccents.replace(/\s+/g, '');
  const compactNoAccents = normalizedNoAccents.replace(/\s+/g, '');

  for (const word of PROFANITY_WORDS) {
    const wordLower = word.toLowerCase();
    const wordNoAccent = removeAccents(wordLower);
    const wordCompact = wordNoAccent.replace(/\s+/g, '');

    // 1. Kiểm tra trực tiếp regex word boundary
    const regexPatternWithAccent = new RegExp(`\\b${escapeRegExp(wordLower)}\\b`, 'i');
    if (regexPatternWithAccent.test(rawLower) || regexPatternWithAccent.test(normalizedWithAccents)) {
      return { isProfane: true, matchedWord: word };
    }

    const regexPatternNoAccent = new RegExp(`\\b${escapeRegExp(wordNoAccent)}\\b`, 'i');
    if (regexPatternNoAccent.test(normalizedNoAccents)) {
      return { isProfane: true, matchedWord: word };
    }

    // 2. Kiểm tra chuỗi nén (nếu từ khóa dài >= 2 ký tự và không phải từ quá phổ biến đơn lẻ)
    if (wordCompact.length >= 2) {
      if (
        compactWithAccents.includes(wordLower) ||
        compactNoAccents.includes(wordCompact)
      ) {
        // Chỉ bắt khi từ khóa là cụm từ (>= 3 ký tự) hoặc các từ chửi đặc trưng
        if (
          wordCompact.length >= 3 ||
          ['dm', 'đm', 'vl', 'cc', 'cl', 'du', 'đụ'].includes(wordLower)
        ) {
          return { isProfane: true, matchedWord: word };
        }
      }
    }
  }

  return { isProfane: false };
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
