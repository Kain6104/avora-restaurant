import { MenuGroundingService } from './menu-grounding.service';
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, Inject, forwardRef, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationService } from '../reservation/reservation.service';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { ChatbotToolEngineService } from './chatbot-tool-engine.service';
import { ALL_CHATBOT_TOOL_DECLARATIONS } from './chatbot-tool-declarations';
import * as crypto from 'crypto';
import { ChatSessionContext, ChatbotSuggestion } from './dto/chatbot-tool.dto';
import { getRequiredEnv } from '../common/utils/env.util';
import { toCleanSlug } from '../common/utils/slug.util';
import { ChatbotCacheRegistry, ChatbotCacheScope } from './chatbot-cache.registry';

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private genAI: GoogleGenerativeAI;
  private apiKeys: string[] = [];
  private currentKeyIndex = 0;
  private readonly disabledKeyIndexes = new Set<number>();
  private readonly keyCooldownUntil = new Map<number, number>();
  private readonly maxTransientRetries = 6;
  private readonly retryBaseDelayMs = 400;
  private readonly guestSessionSecret = getRequiredEnv('CHATBOT_GUEST_SESSION_SECRET');
  private lastGcAt = 0;
  private cachedLinkValidSlugs: {
    branchSlugs: Set<string>;
    categorySlugs: Set<string>;
    categoriesList: Array<{ id: string; name: string; slug: string }>;
  } | null = null;
  private cachedLinkValidSlugsExpiresAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ReservationService))
    private readonly reservationService: ReservationService,
    private readonly toolEngine: ChatbotToolEngineService,
    private readonly menuGroundingService: MenuGroundingService,
  ) {
    const envKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
    this.apiKeys = envKeys.split(',').map((k) => k.trim()).filter((k) => k);
    if (this.apiKeys.length === 0) {
      throw new Error('GEMINI_API_KEY or GEMINI_API_KEYS is required for chatbot');
    }
    this.genAI = new GoogleGenerativeAI(this.apiKeys[this.currentKeyIndex]);
    ChatbotCacheRegistry.register((scope) => {
      this.invalidateCache(scope);
    });
  }

  public invalidateCache(scope: ChatbotCacheScope = 'ALL'): void {
    if (scope === 'ALL' || scope === 'BRANCH' || scope === 'CATEGORY' || scope === 'MENU') {
      this.cachedLinkValidSlugs = null;
      this.cachedLinkValidSlugsExpiresAt = 0;
    }
  }

  public invalidateAllChatbotCaches(scope: ChatbotCacheScope = 'ALL', entityId?: string): number {
    return ChatbotCacheRegistry.invalidate(scope, entityId);
  }

  private rotateKey(): boolean {
    const now = Date.now();
    let bestCandidate = -1;
    let minCooldown = Infinity;

    for (let offset = 1; offset <= this.apiKeys.length; offset += 1) {
      const candidate = (this.currentKeyIndex + offset) % this.apiKeys.length;
      if (this.disabledKeyIndexes.has(candidate)) continue;
      const cooldown = this.keyCooldownUntil.get(candidate) || 0;
      if (cooldown <= now) {
        this.currentKeyIndex = candidate;
        this.logger.warn(`Đã chuyển sang API key dự phòng ở vị trí ${this.currentKeyIndex}`);
        this.genAI = new GoogleGenerativeAI(this.apiKeys[this.currentKeyIndex]);
        return true;
      }
      if (cooldown < minCooldown) {
        minCooldown = cooldown;
        bestCandidate = candidate;
      }
    }

    if (bestCandidate !== -1 && minCooldown !== Infinity) {
      this.currentKeyIndex = bestCandidate;
      this.logger.warn(`Tất cả key đang cooldown, chọn key ${this.currentKeyIndex} (hết cooldown sau ${Math.max(0, Math.round((minCooldown - now) / 1000))}s)`);
      this.genAI = new GoogleGenerativeAI(this.apiKeys[this.currentKeyIndex]);
      return true;
    }

    return false;
  }

  public getActiveApiKey(): { key: string; index: number } {
    return {
      key: this.apiKeys[this.currentKeyIndex],
      index: this.currentKeyIndex,
    };
  }

  public reportApiKeyError(index: number, error: unknown): boolean {
    const classification = this.classifyGeminiError(error);
    if (classification.invalidKey) {
      this.disabledKeyIndexes.add(index);
      this.keyCooldownUntil.delete(index);
      this.logger.warn(`[Voice/Shared] Bỏ qua API key ở vị trí ${index} do provider từ chối key`);
    } else if (classification.status === 429) {
      this.keyCooldownUntil.set(index, Date.now() + 15_000);
    } else {
      this.keyCooldownUntil.set(index, Date.now() + 5_000);
    }
    if (this.currentKeyIndex === index) {
      return this.rotateKey();
    }
    return true;
  }

  private async getValidSlugsAndCategoriesCached() {
    const now = Date.now();
    if (this.cachedLinkValidSlugs && now < this.cachedLinkValidSlugsExpiresAt) {
      return this.cachedLinkValidSlugs;
    }
    const [branches, categories] = await Promise.all([
      this.prisma.branch.findMany({ select: { name: true } }),
      this.prisma.category.findMany({
        select: { id: true, name: true, slug: true },
        orderBy: { displayOrder: 'asc' },
      }),
    ]);
    this.cachedLinkValidSlugs = {
      branchSlugs: new Set(branches.map((b) => toCleanSlug(b.name))),
      categorySlugs: new Set(categories.map((c) => c.slug)),
      categoriesList: categories,
    };
    this.cachedLinkValidSlugsExpiresAt = now + 5 * 60 * 1000;
    return this.cachedLinkValidSlugs;
  }

  private classifyGeminiError(error: unknown): {
    status?: number;
    retryable: boolean;
    invalidKey: boolean;
  } {
    const candidate = error as { status?: number; statusCode?: number; code?: number | string; message?: string };
    const status = Number(candidate?.status ?? candidate?.statusCode ?? candidate?.code);
    const message = String(candidate?.message || error || '');
    const invalidKey =
      /API_KEY_INVALID|api key not valid|invalid api key|no longer available/i.test(message) ||
      status === 401 ||
      status === 403 ||
      status === 404;
    const retryable =
      !invalidKey &&
      ([429, 500, 502, 503, 504].includes(status) || /RESOURCE_EXHAUSTED|UNAVAILABLE|temporarily unavailable|high demand/i.test(message));

    return { status: Number.isFinite(status) ? status : undefined, retryable, invalidKey };
  }

  private async waitBeforeRetry(delayMs: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
  }

  private signGuestSession(sessionId: string): string {
    return crypto.createHmac('sha256', this.guestSessionSecret).update(sessionId).digest('base64url');
  }

  private isValidGuestSessionToken(sessionId: string, token?: string): boolean {
    if (!token) return false;
    const expected = Buffer.from(this.signGuestSession(sessionId));
    const provided = Buffer.from(token);
    return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
  }

  private async resolveGuestSession(
    sessionId: string | undefined,
    token: string | undefined,
    message: string,
    channel: 'TEXT' | 'VOICE' = 'TEXT',
  ) {
    if (sessionId && this.isValidGuestSessionToken(sessionId, token)) {
      const existingSession = await this.prisma.chatSession.findFirst({
        where: { id: sessionId, userId: null },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
      if (existingSession) {
        return { session: existingSession, guestSessionToken: token! };
      }
    }

    const newSession = await this.prisma.chatSession.create({
      data: {
        userId: null,
        title: message.substring(0, 50),
        channel,
      },
    });
    return {
      session: { ...newSession, messages: [] },
      guestSessionToken: this.signGuestSession(newSession.id),
    };
  }

  async resolveVoiceSession(
    userId: string | undefined,
    sessionId?: string,
    guestSessionToken?: string,
  ) {
    if (userId) {
      const existingSession = sessionId
        ? await this.prisma.chatSession.findFirst({
            where: { id: sessionId, userId },
            select: { id: true, contextData: true },
          })
        : null;

      const session = existingSession || await this.prisma.chatSession.create({
        data: { userId, channel: 'VOICE', title: 'Voice chat Avora' },
        select: { id: true, contextData: true },
      });

      return {
        sessionId: session.id,
        guestSessionToken: undefined,
        contextData: session.contextData,
      };
    }

    const guestSession = await this.resolveGuestSession(
      sessionId,
      guestSessionToken,
      'Voice chat Avora',
      'VOICE',
    );
    return {
      sessionId: guestSession.session.id,
      guestSessionToken: guestSession.guestSessionToken,
      contextData: guestSession.session.contextData,
    };
  }

  private getPersonalityInstruction(personality?: string): string {
    switch (personality) {
      case 'Hài hước':
        return `[TÍNH CÁCH BẮT BUỘC: HÀI HƯỚC, DÍ DỎM, VUI NHỘN]:
- Bạn là một nhân viên phục vụ kiêm trợ lý cực kỳ duyên dáng, hài hước, dí dỏm, luôn biết cách chọc cười và tạo không khí vui nhộn cho thực khách.
- Hay pha trò dí dỏm, chơi chữ ẩm thực thông minh (ví dụ: "Ăn miếng sushi là bay màu áp lực!", "Đói bụng mà chạm mặt món này thì dạ dày chỉ có nước gật đầu lia lịa", "Ăn ngon thế này thì chỉ có tăng chỉ số hạnh phúc thôi quý khách ơi!").
- Luôn trả lời vui tươi, mặn mà, lém lỉnh nhưng thông tin món ăn, giá cả, chi nhánh và mã giảm giá phải chính xác 100%.`;
      case 'Thân thiện':
        return `[TÍNH CÁCH BẮT BUỘC: THÂN THIỆN, ẤM ÁP, NGỌT NGÀO]:
- Bạn ngọt ngào, gần gũi, ân cần và chu đáo như người thân đón khách quý về nhà ăn cơm, xưng em nhẹ nhàng và tận tình hỗ trợ.`;
      case 'Nhanh gọn':
        return `[TÍNH CÁCH BẮT BUỘC: NHANH GỌN, SÚC TÍCH, DỨT KHOÁT]:
- Bạn nói ít hiểu nhiều, trả lời ngắn gọn, trực diện, gạch đầu dòng rõ ràng, không vòng vo.`;
      case 'Chuyên nghiệp':
      default:
        return `[TÍNH CÁCH BẮT BUỘC: CHUYÊN NGHIỆP, LỊCH THIỆP, ĐẲNG CẤP]:
- Bạn chuẩn mực, lịch sự, nhã nhặn, phong thái quản lý nhà hàng ẩm thực 5 sao.`;
    }
  }

  private getModel(personality?: string, userContext?: string) {
    const now = new Date();
    const vnDateFormatter = new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      weekday: 'long',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    const vnISODateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const todayStr = vnISODateFormatter.format(now);
    const tomorrowStr = vnISODateFormatter.format(new Date(now.getTime() + 86400000));
    const formattedNowVN = vnDateFormatter.format(now);

    return this.genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
      systemInstruction: `Bạn là Trợ lý AI Thông minh (AI Restaurant Assistant) cao cấp của hệ thống nhà hàng Avora Restaurant.
Bạn đang tương tác trực tiếp với khách hàng để hỗ trợ thực đơn, tư vấn món ăn, đặt bàn và đặt món - thanh toán.
Giọng điệu: Thân thiện, lịch thiệp, chu đáo, tự nhiên, chuyên nghiệp và hiếu khách. Xưng "em", gọi khách là "quý khách" hoặc "anh/chị". ${userContext || ''}

[THỜI GIAN THỰC TẾ HIỆN TẠI (VIỆT NAM GMT+7)]:
- Thời gian hiện tại: ${formattedNowVN}.
- Ngày hôm nay: ${todayStr}.
- Ngày mai: ${tomorrowStr}.
- Khi khách hỏi đặt giao hàng hoặc đặt bàn hôm nay/ngày mai hay bất kỳ ngày nào, BẮT BUỘC truyền đúng ngày thực tế này dạng YYYY-MM-DD (hoặc 'today', 'tomorrow') vào tham số date của công cụ getAvailableOrderSlots và getReservationSlots!

[QUY TẮC TUYỆT ĐỐI VỀ TƯ VẤN MÓN ĂN & THỰC ĐƠN - CHỐNG BỊA MÓN (ZERO HALLUCINATION)]:
- BẮT BUỘC gọi tool searchMenu khi khách hỏi bất kỳ thông tin gì về: gợi ý món ăn, món ngon, món bán chạy (bestseller), thực đơn, combo ăn uống, món chay, món tráng miệng, nước uống, v.v.
- TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ BỊA RA BẤT KỲ MÓN ĂN NÀO không tồn tại trong cơ sở dữ liệu hoặc không có trong kết quả trả về của searchMenu!
- Chỉ được nhắc đến và tư vấn đúng các món ăn và giá tiền có trong danh sách do searchMenu trả về!
- Khi giới thiệu món ăn, BẮT BUỘC chèn liên kết dạng markdown [Tên món](/slug-danh-muc/slug-mon-an) dựa trên categorySlug và slug thật sự do công cụ searchMenu trả về (ví dụ: [Nước Ép Cam](/nuoc-ep-trai-cay/nuoc-ep-cam)).
- Nếu searchMenu không tìm thấy món khách yêu cầu, thành thật trả lời: "Dạ hiện tại nhà hàng chưa có món này trong thực đơn ạ, quý khách có thể tham khảo các món đặc sắc khác như..." kèm các món có thật do searchMenu gợi ý.

${this.getPersonalityInstruction(personality)}

[PHONG CÁCH GIAO TIẾP NHÀ HÀNG CAO CẤP]:
- TUYỆT ĐỐI KHÔNG lặp đi lặp lại tên tài khoản, nickname hoặc username của khách (như "HTP Official") trong mọi câu nói. Chỉ xưng hô "quý khách" hoặc "anh/chị" một cách tự nhiên.
- Hiểu rõ ngữ cảnh các tin nhắn trước: "món này", "món đó", "thêm món vừa rồi vào giỏ", "cho tôi món rẻ hơn", "đổi món khác".
- Khi khách hỏi tư vấn theo ngân sách (VD: "Tôi có 150k", "Gợi ý bữa ăn cho 2 người khoảng 300k"): BẮT BUỘC gọi tool \`searchMenu\` với tham số \`budget\` để tra cứu các món có thật từ thực đơn nhà hàng. Tính toán chính xác tổng tiền dựa trên giá thực tế, đề xuất phương án tối ưu và giải thích ngắn gọn vì sao chọn những món đó.
- TUYỆT ĐỐI KHÔNG tự bịa món ăn, giá tiền hoặc tự nhận món tốt cho sức khỏe/giảm giá nếu không có dữ liệu thực tế.
- Trả lời súc tích, ngắn gọn, có cấu trúc rõ ràng.
- TUYỆT ĐỐI KHÔNG SỬ DỤNG BẤT KỲ BIỂU TƯỢNG EMOJI HOẶC KÝ TỰ HÌNH VẼ NÀO (như 🎁, 🛵, 🍜, ✨, v.v.) trong toàn bộ câu trả lời. Giữ phong cách chuyên nghiệp, sang trọng, thanh lịch chuẩn nhà hàng ẩm thực AVORA.

[GỢI Ý HÀNH ĐỘNG TIẾP THEO (SMART SUGGESTIONS)]:
Ở cuối mỗi câu trả lời, bạn HÃY ĐỀ XUẤT từ 1 đến 3 hành động tiếp theo hữu ích nhất cho khách dưới dạng tag JSON đặc biệt:
<<<SUGGESTIONS>>>[{"label": "Nội dung ngắn gọn trên nút", "action": "SEND_MESSAGE", "payload": "Câu yêu cầu gửi đi"}]
Quy tắc cho SUGGESTIONS:
- Nếu bạn nhắc đến danh mục món ăn (ví dụ: Sushi & Maki, Sashimi Tươi Sống): Hãy tạo nút dạng: "Gợi ý món trong danh mục Sushi & Maki", "Gợi ý món trong danh mục Sashimi Tươi Sống".
- Nếu khách hỏi món bán chạy: Tạo nút: "Xem chi tiết món bán chạy nhất", "Gợi ý món phù hợp ngân sách".
- Nếu khách quan tâm ngân sách: Tạo nút: "Gợi ý món dưới 100.000đ", "Gợi ý một phần ăn cho hai người".
- Nếu khách hỏi về ưu đãi/khuyến mãi: Tạo nút: "Xem ưu đãi đang áp dụng", "Kiểm tra ưu đãi tôi có thể dùng".
- Nếu khách đang xem món cụ thể: Tạo nút: "Thêm món vào giỏ hàng", "Gợi ý món ăn kèm".
- Nhãn nút ngắn gọn (dưới 35 ký tự), phản ánh đúng hành động thực tế. Luôn đặt tag <<<SUGGESTIONS>>>[...] ở dòng cuối cùng của câu trả lời.

[QUY TẮC CHECKOUT & ĐẶT MÓN TỐI ƯU NHẤT]:
0. TÌM KIẾM MÓN, GỢI Ý MÂM ĂN & TÙY CHỌN (OPTIONS / TOPPING):
- KHI KHÁCH HỎI GỢI Ý MÂM ĂN / SET ĂN / COMBO NHIỀU MÓN THEO NGÂN SÁCH HOẶC SỐ NGƯỜI (VD: "5 món khoảng 500k phải có sashimi, cơm, món phụ, nước nha 5 người ăn", "gợi ý bữa ăn 200k cho 2 người"):
  + BẮT BUỘC gọi ngay tool \`searchMenu\` với toàn bộ nội dung câu hỏi của khách (hoặc truyền \`budget\`). Tool \`searchMenu\` đã tích hợp thuật toán AI bóc tách đa danh mục tự động ghép mâm ăn từ database thật 100%!
  + Phản hồi đầy đủ danh sách món ăn kèm tổng tiền và nút "Thêm cả mâm vào giỏ hàng".
- KHI KHÁCH NÓI VỀ ĐẶT BÀN / GIỮ CHỖ (VD: "Đặt bàn tại chi nhánh...", "Đặt bàn 4 người", "Giữ bàn..."):
  + TUYỆT ĐỐI KHÔNG GỌI \`searchMenu\`! Không được tìm kiếm món ăn tên là "bàn" hay "bàn t"!
  + BẮT BUỘC chuyển sang quy tắc Đặt bàn (Reservation) ở mục 5 bên dưới.
- Khi khách nói "cho tôi món đó", "lấy món này", "thêm món vừa gợi ý", "lấy món 1": BẮT BUỘC gọi ngay \`addToCart\` với tên món vừa đề xuất trong câu trước.
- Xử lý Tùy chọn (Options: Size, Vị, Topping, Độ ngọt/đá):
  + Nếu khách nói rõ (VD: "Size L", "ít đá", "50% đường"): Truyền vào tham số \`optionNames\` của \`addToCart\`.
  + Nếu khách KHÔNG nói gì về options: CỨ GỌI NGAY \`addToCart\` với tên món! Máy chủ đã có cơ chế TỰ ĐỘNG CHỌN tùy chọn mặc định (Regular size, 100% đường đá) giúp khách đặt hàng trơn tru không bị nghẽn.

1. CHI NHÁNH & TÌM CHI NHÁNH GẦN NHẤT:
- Khi khách hỏi về chi nhánh, địa chỉ, bản đồ hoặc tìm chi nhánh gần nhất ("tìm chi nhánh gần nhất", "quán ở đâu gần đây", "chi nhánh nào gần tôi", "các chi nhánh của quán"): Nếu chưa có tọa độ GPS, BẮT BUỘC gọi ngay tool \`findNearestBranch\` (không cần tham số). Hệ thống sẽ tự động gửi thẻ định vị GPS kèm đồng hồ đếm ngược 7 giây và bản đồ trực tiếp vào khung chat cho khách.
- Khi nhận được tin nhắn tọa độ GPS dạng "[HỆ THỐNG: Vị trí của khách hàng là vĩ độ X, kinh độ Y]": Nếu khách đang tìm chi nhánh, BẮT BUỘC gọi ngay \`findNearestBranch\` với latitude và longitude đó để phản hồi danh sách chi nhánh gần nhất kèm bản đồ tương tác!
- Nếu đang đặt món và trong ngữ cảnh đã có thông tin chi nhánh hiện tại của khách, SỬ DỤNG LUÔN chi nhánh đó làm mặc định. Không bắt khách chọn lại chi nhánh từ đầu!

1B. HỎI THÔNG TIN CHUNG, TIỆN ÍCH NHÀ HÀNG & KHẢ NĂNG CỦA TRỢ LÝ AI:
- Khi khách hỏi: "bạn có thể làm được gì", "bạn giúp được gì", giờ mở cửa/đóng cửa, chỗ đậu xe ô tô/xe máy, phòng VIP riêng tư, ghế trẻ em, tổ chức sinh nhật, xuất hóa đơn đỏ VAT, tích điểm thành viên:
  + TUYỆT ĐỐI KHÔNG GỌI \`searchMenu\` và KHÔNG ĐƯỢC trả lời "Hiện tại AVORA chưa có món... trong thực đơn"!
  + Có thể gọi \`getRestaurantInfo\` với \`topic\` tương ứng hoặc trả lời trực tiếp dựa trên thông tin hệ thống đã cung cấp, kèm các nút gợi ý hữu ích.

2. HÌNH THỨC PHỤC VỤ (GIAO HÀNG HOẶC TỰ ĐẾN LẤY):
- NẾU KHÁCH NÓI "tự đến lấy", "mang về", "qua quán lấy", "takeaway", "lấy tại quán", "đến lấy":
  + BẮT BUỘC thiết lập hình thức phục vụ là TAKEAWAY bằng cách gọi \`previewOrder\` với \`fulfillmentType: 'TAKEAWAY'\`.
  + Phí ship TỰ ĐỘNG MIỄN PHÍ 100% (0đ).
  + TUYỆT ĐỐI KHÔNG yêu cầu khách chia sẻ GPS hay nhập địa chỉ nhận hàng!
  + Chỉ cần xác nhận tên chi nhánh khách sẽ đến lấy món và khung giờ hẹn lấy.
- NẾU KHÁCH CHỌN Giao hàng tận nơi (DELIVERY) mà chưa có địa chỉ: BẮT BUỘC gọi \`getUserAddresses\` (hệ thống sẽ tự gửi nút "📍 Chia sẻ vị trí của tôi" vào khung chat nếu khách chưa lưu địa chỉ).
- Khi khách hàng nói "Không, đổi địa chỉ khác", "dùng địa chỉ khác", "thêm địa chỉ mới", "giao nơi khác", "đổi địa chỉ": BẮT BUỘC gọi ngay tool \`requestDeliveryLocation\` để hệ thống hiển thị nút "📍 Chia sẻ vị trí của tôi" cho khách chọn GPS hoặc nhập địa chỉ mới!
- Khi nhận được tin nhắn tọa độ GPS từ hệ thống dạng: "[HỆ THỐNG: Vị trí của khách hàng là vĩ độ X, kinh độ Y]", nếu khách đang đặt giao hàng, BẮT BUỘC gọi ngay \`validateDeliveryAddress\` với latitude và longitude đó để máy chủ tự động quy đổi thành địa chỉ thực tế và tính phí giao hàng chính xác!
- Không bắt khách gõ tay lại địa chỉ nếu đã có tọa độ GPS.
- Khi khách hàng hỏi hoặc yêu cầu dùng điểm tích lũy ("dùng điểm", "trừ điểm", "tiêu điểm"): BẮT BUỘC gọi tool \`previewOrder\` với tham số \`usePoints: true\` để hệ thống tự động trừ điểm tối đa theo % quy định của chi nhánh!
- Khi khách hàng nói "KHÔNG DÙNG ĐIỂM", "không dùng điểm", "bỏ điểm", "không trừ điểm": BẮT BUỘC gọi tool \`previewOrder\` với tham số \`usePoints: false, pointsToUse: 0\` để cập nhật lại bảng giá KHÔNG trừ điểm!
- Khi khách hàng gửi tin nhắn xác nhận đơn hàng (VD: "Tôi xác nhận đơn hàng trên với phương thức thanh toán [Chuyển khoản], hãy tạo đơn giúp tôi."): BẮT BUỘC gọi ngay tool \`placeOrder\` với \`paymentMethod\` tương ứng (nếu là Chuyển khoản / SePay thì truyền \`paymentMethod: 'SEPAY_QR'\`, nếu Tiền mặt / COD thì truyền \`paymentMethod: 'COD'\`, nếu Quẹt thẻ thì \`paymentMethod: 'CARD'\`, Tiền mặt quầy thì \`paymentMethod: 'CASH'\`).

3. KHUNG GIỜ NHẬN ĐƠN (OPERATING SLOTS):
- BẮT BUỘC gọi \`getAvailableOrderSlots\`. Máy chủ sẽ tự động tính toán chi nhánh và khung giờ khả dụng cho ngày hôm nay hoặc ngày mai.
- Nếu khách nói giờ cụ thể (ví dụ: "11h45", "12h trưa", "tầm 7 giờ tối", "18h30"): BẮT BUỘC truyền tham số \`requestedTime\` vào tool \`getAvailableOrderSlots\` để hệ thống tự động đối chiếu và chọn khung giờ phù hợp nhất!
- Luôn có khung giờ khả dụng cho khách. TUYỆT ĐỐI KHÔNG báo "không lấy được dữ liệu khung giờ", hãy gọi \`getAvailableOrderSlots\` hoặc \`previewOrder\` và đọc khung giờ do máy chủ trả về!

4. TINH GỌN THÔNG TIN KHÁCH HÀNG:
- TẬN DỤNG HỌ TÊN VÀ SĐT ĐÃ CÓ trong hồ sơ khách hàng. TUYỆT ĐỐI KHÔNG hỏi lại tên hay SĐT nếu tài khoản đã có sẵn!
- Ngay khi đã đủ: Món trong giỏ + Chi nhánh + Địa chỉ giao hàng + Khung giờ: BẮT BUỘC GỌI NGAY \`previewOrder\` để hiện bảng xem trước và tổng tiền từ máy chủ.
- CHỈ KHI KHÁCH NÓI XÁC NHẬN ĐỒNG Ý thì mới gọi \`placeOrder\` để tạo đơn hàng chính thức.

5. ĐẶT BÀN NHÀ HÀNG (RESERVATION):
- Sử dụng luôn chi nhánh hiện tại nếu khách không yêu cầu đổi.
- Kiểm tra khung giờ còn chỗ: BẮT BUỘC gọi \`getReservationSlots\` với chi nhánh, ngày và số khách.
- THÔNG TIN NGƯỜI ĐẶT: Tận dụng tên và SĐT trong hồ sơ khách hàng nếu có. TUYỆT ĐỐI KHÔNG TỰ BỊA SỐ ĐIỆN THOẠI (như 0900000000, 0123456789) hay tên khách ('Quý khách') nếu chưa có! Nếu tài khoản chưa có SĐT hoặc khách chưa cung cấp, HÃY HỎI THẲNG KHÁCH: "Dạ để giữ bàn chu đáo, anh/chị cho em xin Tên và Số điện thoại liên hệ nhé!".
- Khi đủ thông tin (Chi nhánh, Ngày, Giờ, Số khách, Tên, SĐT hợp lệ): BẮT BUỘC gọi \`previewReservation\` để hiện bảng tóm tắt và hỏi xác nhận từ khách.
- Khi khách hàng bấm hoặc nhắn "Xác nhận đặt bàn" / "Đồng ý" / "Chốt đặt bàn": BẮT BUỘC GỌI NGAY \`createReservation\` để hệ thống tạo mã đặt bàn chính thức trong cơ sở dữ liệu! TUYỆT ĐỐI KHÔNG hỏi lại hoặc yêu cầu xác nhận vòng lặp. Sau khi \`createReservation\` thành công, thông báo mã đặt bàn cho khách!

[QUY TẮC TƯ VẤN ƯU ĐÃI & VOUCHER KHUYẾN MÃI]:
- Khi khách hỏi về ưu đãi, mã giảm giá, khuyến mãi, voucher: BẮT BUỘC gọi tool findApplicableVouchers để hệ thống tự động kiểm tra điều kiện thực tế từ cơ sở dữ liệu!
- TUYỆT ĐỐI KHÔNG tự bịa mã voucher không có thật (như TRIAN_THANK15, NEWYEAR27_10K nếu không có trong dữ liệu trả về, TRIAN_FREESHIP40, vv.).
- TUYỆT ĐỐI KHÔNG tạo đường dẫn dạng /voucher/[mã] hay /voucher/... vì website không có route này! Nếu muốn dẫn khách xem tất cả ưu đãi, BẮT BUỘC dùng liên kết [Xem danh sách ưu đãi](/vouchers).
- Chỉ tư vấn mã voucher có thật do tool trả về:
  + Nêu rõ điều kiện: Đơn tối thiểu bao nhiêu (minOrderValue), giảm bao nhiêu (% hoặc số tiền), áp dụng cho món hay freeship vận chuyển.
  + Nếu giá trị đơn của khách chưa đủ điều kiện (ví dụ: đơn 435.000đ mà voucher yêu cầu từ 450.000đ), BẮT BUỘC nói rõ khách cần mua thêm bao nhiêu tiền để được áp dụng!
  + Nếu không có voucher nào phù hợp, trả lời thành thật: "Hiện tại nhà hàng chưa có voucher phù hợp với đơn hàng này của quý khách ạ."

[QUY TẮC LIÊN KẾT CHI NHÁNH]:
- Khi giới thiệu hoặc nhắc đến chi nhánh (ví dụ: Avora Landmark 81, Avora West Lake, Avora Hoàn Kiếm, Avora Premium Thảo Điền, Avora Signature Quận 1): Chèn liên kết chuẩn dạng [Tên chi nhánh](/chi-nhanh/slug-chi-nhanh) (ví dụ: [Avora Landmark 81](/chi-nhanh/avora-landmark-81)) để khách bấm vào xem không gian, thực đơn và chỉ đường!

[QUY TẮC TUYỆT ĐỐI VỀ ĐƯỜNG DẪN URL]:
- TUYỆT ĐỐI KHÔNG tự tạo các đường dẫn nội bộ không có thật.
- Chỉ các định dạng URL sau được phép xuất hiện:
  + Món ăn: [Tên món](/slug-danh-muc/slug-mon-an)
  + Chi nhánh: [Tên chi nhánh](/chi-nhanh/slug-chi-nhanh)
  + Trang ưu đãi chung: [Ưu đãi](/vouchers)
  + Thực đơn chung: [Thực đơn](/menu)
  + Đặt bàn: [Đặt bàn](/reservation)
  + Giỏ hàng: [Giỏ hàng](/cart)
  + Thanh toán: [Thanh toán](/checkout)

[QUY TẮC BẤT DI BẤT DỊCH]:
- BỔ SUNG LIÊN KẾT MÓN ĂN: Khi giới thiệu, tư vấn hoặc nhắc đến bất kỳ món ăn nào trong thực đơn (ví dụ: Nước Ép Cam, Cơm Cá Hồi Sốt Tery, Cuộn Rainbow, Lẩu Kim Chi,...): BẮT BUỘC chèn liên kết markdown trực tiếp dạng [Tên Món](/slug-danh-muc/slug-mon-an) để khách hàng có thể bấm trực tiếp vào tên món ăn để xem chi tiết và chi nhánh khả dụng!
- QUY TẮC PHẢN HỒI KHI TẠO ĐƠN THANH TOÁN CHUYỂN KHOẢN (SEPAY/VIETQR):
  + TUYỆT ĐỐI KHÔNG NÓI BẾP ĐANG CHUẨN BỊ HOẶC ĐÃ ĐÓNG GÓI SẴN KHI KHÁCH CHƯA THANH TOÁN.
  + BẮT BUỘC nói rõ với khách: Sau khi quý khách hoàn tất quét mã QR thanh toán chuyển khoản SePay thành công, hệ thống sẽ xác nhận và chuyển đơn xuống bếp chi nhánh để các đầu bếp bắt đầu chế biến nóng sốt, đóng gói chỉn chu và giao tận nơi theo đúng lịch hẹn.
- TUYỆT ĐỐI KHÔNG BAO GIỜ thông báo "Đặt hàng thành công" hoặc "Đơn hàng đã được tạo" nếu tool placeOrder trả về thất bại hoặc chưa được gọi. Chỉ thông báo thành công KHI VÀ CHỈ KHI tool placeOrder trả về success: true kèm mã đơn hàng thật sự từ máy chủ!
- HỦY ĐƠN HÀNG: Khi khách hàng yêu cầu hủy đơn hàng ("hủy đơn", "hủy đơn vừa đặt", "hủy đơn giúp tôi"): BẮT BUỘC gọi tool cancelOrder ngay lập tức. Nếu khách không nhớ mã đơn, cứ gọi cancelOrder (máy chủ sẽ tự động tìm và hủy đơn gần nhất của khách).
- TUYỆT ĐỐI KHÔNG tự bịa giá tiền, mã giảm giá, món ăn, số bàn hay trạng thái đơn hàng.
- Toàn bộ tính toán tài chính (tiền hàng, VAT, phí ship, điểm thưởng) đều do máy chủ tính toán qua tool \`previewOrder\`.
- Khách tức giận hoặc yêu cầu gặp người thật -> gọi \`handoffToHuman\`.
- Câu trả lời sau khi gọi tool cần rõ ràng, ngắn gọn, súc tích, dễ đọc.`,
      tools: [{ functionDeclarations: ALL_CHATBOT_TOOL_DECLARATIONS }],
    });
  }

  private async sendMessageWithRetry(chat: any, payload: any[], history: any[], personality?: string, userContext?: string) {
    let result;
    let currentChat = chat;
    let transientRetries = 0;

    while (true) {
      try {
        result = await currentChat.sendMessage(payload);
        return { result, newChat: currentChat };
      } catch (error: unknown) {
        this.logger.error(`Gemini sendMessage error: ${(error as any)?.message || error}`, (error as any)?.stack);
        const classification = this.classifyGeminiError(error);
        const keyIndex = this.currentKeyIndex;

        if (classification.invalidKey) {
          this.disabledKeyIndexes.add(keyIndex);
          this.keyCooldownUntil.delete(keyIndex);
          this.logger.warn(`Bỏ qua API key ở vị trí ${keyIndex} do provider từ chối key`);
        } else if (classification.status === 429) {
          this.keyCooldownUntil.set(keyIndex, Date.now() + 15_000);
        } else if (classification.retryable) {
          this.keyCooldownUntil.set(keyIndex, Date.now() + 5_000);
        }

        if (!classification.retryable && !classification.invalidKey) {
          this.logger.warn(`Gemini trả lỗi không retry, status=${classification.status ?? 'unknown'}`);
          break;
        }
        if (!classification.invalidKey && transientRetries >= this.maxTransientRetries) {
          this.logger.warn(`Gemini vẫn lỗi sau ${transientRetries} lần retry, status=${classification.status ?? 'unknown'}`);
          break;
        }

        if (!this.rotateKey()) {
          this.logger.warn('Không còn API key Gemini khả dụng');
          break;
        }
        transientRetries += classification.invalidKey ? 0 : 1;
        const delayMs = classification.invalidKey ? 0 : this.retryBaseDelayMs * 2 ** (transientRetries - 1);
        if (delayMs > 0) await this.waitBeforeRetry(delayMs);
        const currentModel = this.getModel(personality, userContext);
        currentChat = currentModel.startChat({ history });
      }
    }
    throw new Error('Hệ thống AI đang bảo trì hoặc quá tải. Vui lòng thử lại sau ít phút nhé!');
  }

  private buildModelHistory(messages: Array<{ senderType: string; content?: string | null; functionName?: string | null; actionPayload?: string | null }>): Array<{ role: string; parts: Part[] }> {
    const rawHistory = messages.filter((message) => ['USER', 'AI'].includes(message.senderType));
    const recentMessages = rawHistory.slice(-8);
    while (recentMessages.length > 0 && recentMessages[0].senderType !== 'USER') recentMessages.shift();

    const history: Array<{ role: string; parts: Part[] }> = [];
    for (const msg of recentMessages) {
      const role = msg.senderType === 'USER' ? 'user' : 'model';
      const text = (msg.content || '').slice(0, 4_000);
      if (!text.trim()) continue;

      if (history.length > 0 && history[history.length - 1].role === role) {
        history[history.length - 1].parts[0] = {
          text: ((history[history.length - 1].parts[0] as any).text || '') + '\n' + text,
        };
      } else {
        history.push({ role, parts: [{ text }] });
      }
    }
    return history;
  }

  async chat(
    userId: string | undefined,
    sessionId: string | undefined,
    message: string,
    branchId?: string,
    clientHistory?: any[],
    personality?: string,
    cartTotal?: number,
    cartSummary?: string,
    guestSessionToken?: string,
    cartItems?: any[],
  ) {
    // 1. Throttled Non-Blocking Garbage Collection (Runs at most once every 6 hours in background)
    const nowMs = Date.now();
    if (nowMs - this.lastGcAt > 6 * 60 * 60 * 1000) {
      this.lastGcAt = nowMs;
      const sevenDaysAgo = new Date(nowMs - 7 * 24 * 60 * 60 * 1000);
      this.prisma.chatMessage
        .deleteMany({
          where: {
            createdAt: { lt: sevenDaysAgo },
            session: { userId: null },
          },
        })
        .catch((e) => this.logger.warn(`Background GC warning: ${e?.message || e}`));
    }

    // 2. Fetch User Profile Context & Branch Context
    let userContext = '';
    if (userId) {
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          include: { membershipTier: true },
        });
        if (user) {
          const rawName = (user.fullName || '').trim();
          const cleanPhone = (user.phone || '').trim();
          const userEmail = (user.email || '').trim();
          const isBrandOrNick = /official|admin|user|tester|bot|shop|store|\d{3,}/i.test(rawName);
          const displayName = (!isBrandOrNick && rawName.length > 1 && rawName.length < 25) ? rawName : 'Quý khách';

          userContext = `[HỒ SƠ TÀI KHOẢN ĐÃ ĐĂNG NHẬP CỦA KHÁCH HÀNG]:
- Tên khách hàng: "${rawName || 'Quý khách'}"
- Số điện thoại: "${cleanPhone || 'Chưa cung cấp'}"
- Email: "${userEmail || 'Chưa cung cấp'}"
- Hạng thành viên: ${user.membershipTier?.name || 'Thành viên'}
[QUY TẮC BẮT BUỘC KHI KHÁCH ĐẶT BÀN]:
1. KHÁCH HÀNG ĐÃ ĐĂNG NHẬP TÀI KHOẢN. Nếu tài khoản đã có SĐT ("${cleanPhone}") và Tên ("${rawName}"), TUYỆT ĐỐI KHÔNG ĐƯỢC HỎI LẠI TÊN VÀ SỐ ĐIỆN THOẠI CỦA KHÁCH! Hãy tự động điền và sử dụng luôn thông tin này khi gọi previewReservation.
2. Khi khách hỏi đặt bàn, hãy chủ động hỏi: "Quý khách có muốn đặt trước món ăn dùng tại quán (Dine-in) luôn không ạ để bếp Avora chuẩn bị sẵn chu đáo khi quý khách đến nơi?".
3. TUYỆT ĐỐI KHÔNG tự động gọi createReservation khi chưa có sự đồng ý xác nhận bản xem trước từ khách!
`;
        }
      } catch (e) {
        console.error('Error fetching user context:', e);
      }
    }

    if (!branchId) {
      try {
        const defaultBranch = await this.prisma.branch.findFirst({
          where: { onlineOrderingEnabled: true },
          orderBy: { createdAt: 'asc' },
        });
        if (defaultBranch) {
          branchId = defaultBranch.id;
        }
      } catch (e) {
        console.error('Error fetching default branch:', e);
      }
    }

    if (branchId) {
      try {
        const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
        if (branch) {
          const branchAddr = [branch.street, branch.ward, branch.district, branch.province].filter(Boolean).join(', ');
          userContext += `[CHI NHÁNH HIỆN TẠI]: Khách hàng đã chọn chi nhánh "${branch.name}" (Địa chỉ: ${branchAddr || 'Avora'}, ID: ${branch.id}). Hãy sử dụng luôn chi nhánh này làm mặc định, chỉ cần nhắc lại để xác nhận, TUYỆT ĐỐI KHÔNG bắt chọn lại từ đầu! `;
        }
      } catch (e) {
        console.error('Error fetching branch context:', e);
      }
    }

    if (cartItems && cartItems.length > 0) {
      const itemsList = cartItems.map((item: any) => `${item.quantity}x ${item.name || item.productName} (${Number(item.price || item.priceAtSale || 0).toLocaleString('vi-VN')}đ)`).join(', ');
      userContext += ` [GIỎ HÀNG HIỆN TẠI CỦA KHÁCH]: Đang có ${cartItems.length} món: ${itemsList}. Tổng tiền: ${(cartTotal || 0).toLocaleString('vi-VN')}đ. Khách hàng ĐÃ CÓ MÓN TRONG GIỎ HÀNG, TUYỆT ĐỐI KHÔNG ĐƯỢC BẢO GIỎ HÀNG TRỐNG! `;
    } else if (cartSummary && !cartSummary.includes('trống')) {
      userContext += ` [GIỎ HÀNG HIỆN TẠI CỦA KHÁCH]: ${cartSummary}. Tổng tiền: ${(cartTotal || 0).toLocaleString('vi-VN')}đ. Khách hàng ĐÃ CÓ MÓN TRONG GIỎ HÀNG! `;
    }

    // Tra cứu thực tế cơ sở dữ liệu thực đơn để định hình ngữ cảnh chuẩn (Grounded Menu AI)
    const queryAnalysis = this.menuGroundingService.analyzeUserQuery(message);
    const groundTruth = await this.menuGroundingService.getGroundTruthMenuContext(queryAnalysis, branchId);
    const groundingInstruction = this.menuGroundingService.buildGroundingInstruction(groundTruth);
    if (groundingInstruction) {
      userContext += ` ${groundingInstruction} `;
    }

    // 3. Load Session
    let session: any = null;

    if (userId) {
      if (sessionId) {
        session = await this.prisma.chatSession.findFirst({
          where: { id: sessionId, userId },
          include: { messages: { orderBy: { createdAt: 'asc' } } },
        });
      }

      if (!session) {
        const newSession = await this.prisma.chatSession.create({
          data: {
            userId: userId,
            title: message.substring(0, 50),
            channel: 'TEXT',
          },
        });
        session = { ...newSession, messages: [] };
      }
    } else {
      const guestSession = await this.resolveGuestSession(sessionId, guestSessionToken, message);
      session = guestSession.session;
      guestSessionToken = guestSession.guestSessionToken;
    }

    // 4. Convert history for Gemini with Sliding Window
    const history = this.buildModelHistory(session.messages);

    // Auto update session title from user message if default
    if (session && (!session.title || session.title === 'Cuộc trò chuyện mới') && message) {
      const cleanTitle = message.trim().replace(/^[\r\n\s]+|[\r\n\s]+$/g, '').substring(0, 48);
      await this.prisma.chatSession.update({
        where: { id: session.id },
        data: { title: cleanTitle, updatedAt: new Date() },
      }).catch(() => null);
      session.title = cleanTitle;
    }

    // 5. Save User Message
    const savedUserMessage = await this.prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        senderType: 'USER',
        content: message,
      },
    });
    const userMessage = {
      ...savedUserMessage,
      createdAt: savedUserMessage.createdAt.toISOString(),
    };
    session.messages.push(userMessage);

    // Xử lý siêu tốc độ (Zero-Latency Fast-Path) khi khách bấm nút Chia sẻ vị trí GPS
    const gpsMatch = message.match(/vĩ độ\s*([-\d.]+)\s*,\s*kinh độ\s*([-\d.]+)/i);
    if (message.startsWith('[HỆ THỐNG:') && gpsMatch && (!cartItems || cartItems.length === 0)) {
      try {
        const branchArgs = { latitude: parseFloat(gpsMatch[1]), longitude: parseFloat(gpsMatch[2]) };
        const toolRes = await this.executeToolCall(
          { name: 'findNearestBranch', args: branchArgs },
          userId,
          branchId,
          cartTotal,
          session.id,
          cartItems,
        );
        const fastAiMsg = await this.prisma.chatMessage.create({
          data: {
            sessionId: session.id,
            senderType: 'AI',
            content: toolRes.content || 'Dạ em đã tìm thấy chi nhánh gần vị trí của bạn nhất rồi đây ạ:',
            actionType: toolRes.lastActionType as any,
            actionPayload: toolRes.lastActionPayload,
          },
        });
        return {
          sessionId: session.id,
          message: toolRes.content || 'Dạ em đã tìm thấy chi nhánh gần vị trí của bạn nhất rồi đây ạ:',
          actionType: toolRes.lastActionType,
          actionPayload: toolRes.lastActionPayload,
          suggestedReplies: toolRes.suggestedReplies || [],
          chatMessageId: fastAiMsg.id,
        };
      } catch (fastErr) {
        this.logger.warn(`Fast-path findNearestBranch failed, falling back to Gemini: ${fastErr}`);
      }
    }

    // 6. Start Gemini Chat & Process Function Calls
    let currentModel = this.getModel(personality, userContext);
    let chat = currentModel.startChat({ history });

    let result;
    try {
      const retryRes = await this.sendMessageWithRetry(chat, [{ text: message }], history, personality, userContext);
      result = retryRes.result;
      chat = retryRes.newChat;
    } catch (error: any) {
      await this.prisma.chatMessage.delete({ where: { id: userMessage.id } }).catch(() => {});
      throw error;
    }

    let lastActionType: any = null;
    let lastActionPayload: string | null = null;
    let lastContent: string | null = null;
    let lastSuggestedReplies: (string | ChatbotSuggestion)[] | null = null;

    let functionCalls =
      typeof result.response.functionCalls === 'function'
        ? result.response.functionCalls()
        : result.response.functionCalls;

    let toolIterations = 0;
    const maxToolIterations = 5;

    while (functionCalls && functionCalls.length > 0 && toolIterations < maxToolIterations) {
      toolIterations += 1;
      const toolResultParts: Array<{ text: string }> = [];

      for (const call of functionCalls) {
        // Save AI tool call
        const toolCallMessage = {
          id: crypto.randomUUID(),
          sessionId: session.id,
          senderType: 'AI',
          functionName: call.name,
          actionPayload: JSON.stringify(call.args),
          createdAt: new Date().toISOString(),
        };

        await this.prisma.chatMessage.create({
          data: {
            sessionId: session.id,
            senderType: 'AI',
            content: '',
            functionName: call.name,
            actionPayload: JSON.stringify(call.args),
          },
        });
        session.messages.push(toolCallMessage);

        // Execute through Central Shared Tool Engine
        const { functionResult, lastActionType: type, lastActionPayload: payload, content: extraContent, suggestedReplies: sr } =
          await this.executeToolCall(call, userId, branchId, cartTotal, session.id, cartItems);

        if (type) lastActionType = type;
        if (payload) lastActionPayload = payload;
        if (extraContent) lastContent = extraContent;
        if (sr) lastSuggestedReplies = sr;

        // Save tool response
        const toolResponseMessage = {
          id: crypto.randomUUID(),
          sessionId: session.id,
          senderType: 'TOOL',
          functionName: call.name,
          actionPayload: JSON.stringify(functionResult),
          createdAt: new Date().toISOString(),
        };

        await this.prisma.chatMessage.create({
          data: {
            sessionId: session.id,
            senderType: 'TOOL',
            content: '',
            functionName: call.name,
            actionPayload: JSON.stringify(functionResult),
          },
        });
        session.messages.push(toolResponseMessage);

        toolResultParts.push({
          text: `[KẾT QUẢ DỮ LIỆU TỪ HỆ THỐNG CHO HÀM ${call.name}]: ${JSON.stringify(functionResult)}`,
        });
      }

      // Send all tool results back to Gemini in one batch
      const retryRes = await this.sendMessageWithRetry(
        chat,
        toolResultParts,
        history,
        personality,
        userContext,
      );
      result = retryRes.result;
      chat = retryRes.newChat;

      functionCalls =
        typeof result.response.functionCalls === 'function'
          ? result.response.functionCalls()
          : result.response.functionCalls;
    }

    // Guarantee rich REQUEST_LOCATION + Map card when user asks about branches/locations
    if (queryAnalysis.intent === 'BRANCH_LOCATION' && !lastActionType) {
      try {
        const gpsMatch = message.match(/vĩ độ\s*([-\d.]+)\s*,\s*kinh độ\s*([-\d.]+)/i);
        const branchArgs = gpsMatch
          ? { latitude: parseFloat(gpsMatch[1]), longitude: parseFloat(gpsMatch[2]) }
          : {};
        const fallbackBranchTool = await this.executeToolCall(
          { name: 'findNearestBranch', args: branchArgs },
          userId,
          branchId,
          cartTotal,
          session.id,
          cartItems,
        );
        if (fallbackBranchTool.lastActionType) lastActionType = fallbackBranchTool.lastActionType;
        if (fallbackBranchTool.lastActionPayload) lastActionPayload = fallbackBranchTool.lastActionPayload;
        if (fallbackBranchTool.suggestedReplies && !lastSuggestedReplies) {
          lastSuggestedReplies = fallbackBranchTool.suggestedReplies;
        }
      } catch (err) {
        this.logger.warn(`Fallback findNearestBranch failed: ${err}`);
      }
    }

    // 7. Final Message & Smart Suggestion Chips
    let textResponse = '';
    try {
      textResponse = result.response.text();
    } catch (e) {
      console.error('Error getting text response:', e);
    }

    if (!textResponse) {
      textResponse = lastContent || (lastActionType ? 'Dạ em đã chuẩn bị thông tin bên dưới cho quý khách nhé:' : 'Xin lỗi, em chưa hiểu rõ yêu cầu của quý khách. Quý khách có thể nói rõ hơn được không ạ?');
    }

    // Lớp bảo vệ chống bịa thực đơn bằng code (Zero-Hallucination Post-Verification Guard)
    const enforcement = await this.menuGroundingService.verifyAndEnforceGrounding(textResponse, groundTruth, branchId);
    textResponse = enforcement.verifiedText;
    if (
      !lastActionType &&
      enforcement.verifiedProducts &&
      enforcement.verifiedProducts.length > 0 &&
      queryAnalysis.isFoodRelated &&
      !groundTruth.isPromptInjection &&
      (groundTruth.status === 'FOUND' || groundTruth.status === 'GENERAL_SUGGESTIONS')
    ) {
      lastActionType = 'SHOW_PRODUCT';
      lastActionPayload = JSON.stringify({ products: enforcement.verifiedProducts.slice(0, 4) });
    }

    // Trích xuất SUGGESTIONS tag nếu Gemini trả về (hỗ trợ mọi định dạng: <<<SUGGESTIONS>>>, <<<SUGGESTIONS>...</SUGGESTIONS>, <SUGGESTIONS>...)
    let extractedSuggestions: any[] | null = null;
    const suggestionsTagRegex = /(?:<{1,3}SUGGESTIONS>{1,3}|<SUGGESTIONS>)([\s\S]*?)(?:<\/{0,1}SUGGESTIONS>{0,3}|<\/SUGGESTIONS>|$)/i;
    const suggestionsMatch = textResponse.match(suggestionsTagRegex);
    if (suggestionsMatch && suggestionsMatch[1]) {
      try {
        let rawJson = suggestionsMatch[1].trim();
        // Tìm cặp ngoặc vuông [ ... ] hợp lệ nếu Gemini bao quanh bởi text khác
        const arrayStart = rawJson.indexOf('[');
        const arrayEnd = rawJson.lastIndexOf(']');
        if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
          rawJson = rawJson.substring(arrayStart, arrayEnd + 1);
        }
        const parsed = JSON.parse(rawJson);
        if (Array.isArray(parsed) && parsed.length > 0) {
          extractedSuggestions = parsed.map((item) => {
            if (typeof item === 'string') {
              return { label: item, action: 'SEND_MESSAGE', payload: item };
            }
            return {
              label: item.label || item.text || 'Gợi ý',
              action: item.action || 'SEND_MESSAGE',
              payload: item.payload || item.label || item.text,
              entityId: item.entityId,
            };
          });
        }
      } catch (err) {
        console.warn('Failed to parse SUGGESTIONS from Gemini:', err);
      }
    }
    // Xóa sạch toàn bộ các tag SUGGESTIONS và nội dung bên trong để không bao giờ lộ ra tin nhắn người dùng
    textResponse = textResponse
      .replace(/(?:<{1,3}SUGGESTIONS>{1,3}|<SUGGESTIONS>)[\s\S]*?(?:<\/{0,1}SUGGESTIONS>{0,3}|<\/SUGGESTIONS>|$)/gi, '')
      .trim();

    textResponse = await this.sanitizeAndVerifyLinks(textResponse);

    // Hợp nhất gợi ý: Ưu tiên tool suggestions, rồi đến suggestions từ Gemini
    let finalSuggestions: any[] | null = lastSuggestedReplies || extractedSuggestions;

    // Smart Contextual Fallback: Nếu câu trả lời nhắc đến tên danh mục trong DB (ví dụ: Sushi & Maki, Sashimi Tươi Sống...)
    if (!finalSuggestions || finalSuggestions.length === 0) {
      try {
        const { categoriesList: allCategories } = await this.getValidSlugsAndCategoriesCached();

        const matchedCats = allCategories.filter((cat) => {
          const lowerName = cat.name.toLowerCase();
          const lowerText = textResponse.toLowerCase();
          return lowerText.includes(lowerName);
        });

        if (matchedCats.length > 0) {
          finalSuggestions = matchedCats.slice(0, 3).map((cat) => ({
            label: `Gợi ý món trong danh mục ${cat.name}`,
            action: 'SEND_MESSAGE',
            payload: `Gợi ý cho tôi các món trong danh mục ${cat.name}`,
            entityId: cat.id,
          }));
        } else if (
          queryAnalysis.intent === 'CAPABILITY_GREETING' ||
          queryAnalysis.intent === 'RESTAURANT_FAQ_POLICY'
        ) {
          finalSuggestions = [
            { label: 'Gợi ý món bán chạy nhất', action: 'SEND_MESSAGE', payload: 'Gợi ý cho tôi các món bán chạy nhất' },
            { label: 'Tìm chi nhánh gần nhất', action: 'SEND_MESSAGE', payload: 'Tìm chi nhánh AVORA gần tôi nhất' },
            { label: 'Đặt bàn trước', action: 'SEND_MESSAGE', payload: 'Tôi muốn đặt bàn trước' },
          ];
        }
      } catch (err) {
        console.warn('Error matching categories for suggestion chips:', err);
      }
    }

    let persistedActionPayload = lastActionPayload;
    if (persistedActionPayload) {
      try {
        const parsedPayload = JSON.parse(persistedActionPayload);
        if (parsedPayload && typeof parsedPayload === 'object' && 'previewToken' in parsedPayload) {
          delete parsedPayload.previewToken;
          persistedActionPayload = JSON.stringify(parsedPayload);
        }
      } catch {
        persistedActionPayload = null;
      }
    }

    const finalMessage: any = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      senderType: 'AI',
      content: textResponse,
      actionType: lastActionType,
      actionPayload: lastActionPayload,
      suggestedReplies: finalSuggestions,
      createdAt: new Date().toISOString(),
    };

    const savedMessage = await this.prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        senderType: 'AI',
        content: textResponse,
        actionType: lastActionType,
        actionPayload: persistedActionPayload,
      },
    });
    finalMessage.id = savedMessage.id;
    finalMessage.createdAt = savedMessage.createdAt;

    return {
      sessionId: session.id,
      guestSessionToken: userId ? undefined : guestSessionToken,
      messages: [finalMessage],
      actionType: lastActionType,
      actionPayload: lastActionPayload,
      suggestedReplies: finalSuggestions,
    };
  }

  // Delegate directly to Central Tool Engine
  public async executeToolCall(
    call: any,
    userId?: string,
    branchId?: string,
    cartTotal?: number,
    sessionId?: string,
    cartItems?: any[],
  ) {
    const res = await this.toolEngine.executeTool(call.name, call.args, userId, sessionId, branchId, undefined, cartItems);
    return {
      functionResult: res.data || { success: res.success, message: res.message, code: res.code },
      lastActionType: res.actionType || null,
      lastActionPayload: res.actionPayload || null,
      content: res.content || null,
      suggestedReplies: res.suggestedReplies || null,
    };
  }

  async confirmTransaction(
    userId: string,
    sessionId: string,
    operation: 'ORDER' | 'RESERVATION',
    previewToken: string,
    paymentMethod?: string,
    usePoints?: boolean,
  ) {
    if (!sessionId || !previewToken || !['ORDER', 'RESERVATION'].includes(operation)) {
      throw new BadRequestException('Invalid confirmation request');
    }

    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true, contextData: true, version: true },
    });
    if (!session) throw new NotFoundException('Session not found');

    const context: ChatSessionContext = session.contextData
      ? JSON.parse(session.contextData)
      : { cart: [] };
    const state = operation === 'ORDER'
      ? context.orderConfirmation
      : context.reservationConfirmation;
    const suppliedHash = crypto.createHash('sha256').update(previewToken).digest('hex');

    if (!state || state.status !== 'PREVIEWED' || state.previewTokenHash !== suppliedHash) {
      throw new BadRequestException('Confirmation is invalid or already used');
    }
    if (new Date(state.expiresAt).getTime() <= Date.now()) {
      throw new BadRequestException('Confirmation has expired');
    }

    if (operation === 'ORDER') {
      if (paymentMethod) {
        let norm = paymentMethod.toUpperCase().trim();
        if (norm === 'TRANSFER' || norm === 'SEPAY' || norm === 'CHUYEN_KHOAN') {
          norm = 'SEPAY_QR';
        }
        context.paymentMethod = norm;
      }
      if (usePoints !== undefined) {
        (context as any).usePoints = usePoints;
        if (!usePoints) context.pointsToUse = 0;
      }

      // Recompute payloadHash with updated paymentMethod / pointsToUse so requireConfirmation passes cleanly
      const confirmationPayload = {
        branchId: context.currentBranchId,
        fulfillmentType: context.fulfillmentType,
        addressId: context.deliveryAddressId,
        operatingSlotId: context.operatingSlotId,
        deliveryDate: context.deliveryDate,
        paymentMethod: context.paymentMethod || 'COD',
        discountVoucherCode: context.discountVoucherCode,
        shippingVoucherCode: context.shippingVoucherCode,
        pointsToUse: context.pointsToUse || 0,
        expectedTotalAmount: context.expectedTotalAmount,
        cart: context.cart,
      };
      state.payloadHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(confirmationPayload))
        .digest('hex');
    }

    state.status = 'CONFIRMED';
    const updateResult = await this.prisma.chatSession.updateMany({
      where: { id: session.id, version: session.version },
      data: {
        contextData: JSON.stringify(context),
        version: { increment: 1 },
      },
    });

    if (updateResult.count !== 1) {
      throw new ConflictException({
        error: 'CHAT_SESSION_CONFLICT',
        message: 'Phiên chatbot vừa thay đổi. Vui lòng tải lại bản xem trước trước khi xác nhận.',
      });
    }

    return { success: true };
  }

  async getUserSessions(userId: string) {
    if (!userId) return [];

    // Clean up empty sessions with 0 messages
    try {
      await this.prisma.chatSession.deleteMany({
        where: { userId, messages: { none: {} } },
      });
    } catch (e) {
      // ignore
    }

    const sessions = await this.prisma.chatSession.findMany({
      where: { userId, messages: { some: {} } },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        channel: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { content: true, senderType: true, createdAt: true },
        },
      },
    });

    return sessions.map((s) => ({
      id: s.id,
      title: s.title || (s.messages[0]?.content ? s.messages[0].content.substring(0, 45) : 'Cuộc trò chuyện mới'),
      channel: s.channel,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      messageCount: s._count.messages,
      lastMessage: s.messages[0]?.content || null,
    }));
  }

  async createNewSession(userId?: string, title?: string, channel: 'TEXT' | 'VOICE' = 'TEXT') {
    const session = await this.prisma.chatSession.create({
      data: {
        userId: userId || null,
        title: title || 'Cuộc trò chuyện mới',
        channel,
      },
      select: {
        id: true,
        title: true,
        channel: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      session,
      guestSessionToken: !userId ? this.signGuestSession(session.id) : undefined,
    };
  }

  async getSession(sessionId: string, userId?: string, guestSessionToken?: string) {
    if (!sessionId) throw new BadRequestException('Session ID required');

    let session: any = null;
    if (userId) {
      session = await this.prisma.chatSession.findFirst({
        where: { id: sessionId, userId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
    } else if (guestSessionToken && this.isValidGuestSessionToken(sessionId, guestSessionToken)) {
      session = await this.prisma.chatSession.findFirst({
        where: { id: sessionId, userId: null },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
    } else {
      session = await this.prisma.chatSession.findFirst({
        where: { id: sessionId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
    }

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session && Array.isArray(session.messages)) {
      session.messages = session.messages.filter(
        (m) =>
          (m.senderType === 'USER' || m.senderType === 'AI') &&
          ((typeof m.content === 'string' && m.content.trim().length > 0) || Boolean(m.actionType))
      );
    }

    return session;
  }

  async deleteSession(sessionId: string, userId?: string, guestSessionToken?: string) {
    if (!sessionId) throw new BadRequestException('Session ID required');

    let session: any = null;
    if (userId) {
      session = await this.prisma.chatSession.findFirst({
        where: { id: sessionId, userId },
        select: { id: true },
      });
    } else if (guestSessionToken && this.isValidGuestSessionToken(sessionId, guestSessionToken)) {
      session = await this.prisma.chatSession.findFirst({
        where: { id: sessionId, userId: null },
        select: { id: true },
      });
    } else {
      session = await this.prisma.chatSession.findFirst({
        where: { id: sessionId },
        select: { id: true },
      });
    }

    if (!session) throw new NotFoundException('Session not found');

    await this.prisma.chatSession.delete({ where: { id: session.id } });
    return { success: true };
  }

  public async sanitizeAndVerifyLinks(text: string): Promise<string> {
    if (!text) return text;
    // Strip emojis to guarantee clean, professional text
    const cleanText = text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, '');
    if (!cleanText.includes('](')) return cleanText;

    try {
      const { branchSlugs: validBranchSlugs, categorySlugs: validCategorySlugs } =
        await this.getValidSlugsAndCategoriesCached();

      const linkMatches = Array.from(cleanText.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g));
      const dishCandidates = linkMatches.map(m => m[1].trim()).filter(l => l.length > 2 && !['menu', 'thực đơn', 'vouchers', 'khuyến mãi'].includes(l.toLowerCase()));

      const productUrlMap = new Map<string, string>();
      if (dishCandidates.length > 0) {
        const foundProducts = await this.prisma.product.findMany({
          where: {
            OR: [
              { name: { in: dishCandidates } },
              ...dishCandidates.slice(0, 5).map(name => ({ name: { contains: name } })),
            ],
          },
          include: { category: true },
        });
        for (const p of foundProducts) {
          if (p.category?.slug && p.slug) {
            productUrlMap.set(p.name.toLowerCase().trim(), `/${p.category.slug}/${p.slug}`);
            productUrlMap.set(p.slug.toLowerCase().trim(), `/${p.category.slug}/${p.slug}`);
          }
        }
      }

      return cleanText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
        const cleanUrl = url.trim();

        // 1. External maps
        if (cleanUrl.includes('google.com/maps') || cleanUrl.includes('maps.google')) {
          return match;
        }

        // 2. Relative URLs
        const pathOnly = cleanUrl.replace(/^https?:\/\/[^\/]+/, '');

        // If label or single slug matches a real dish in database, prioritize dish detail URL
        const matchedDishUrl = productUrlMap.get(label.toLowerCase().trim());
        if (matchedDishUrl && (pathOnly === '/menu' || !pathOnly.includes('/') || pathOnly.split('/').length <= 2)) {
          return `[${label}](${matchedDishUrl})`;
        }

        // Whitelisted static routes
        if (['/vouchers', '/menu', '/cart', '/checkout', '/reservation', '/search', '/profile'].includes(pathOnly)) {
          return `[${label}](${pathOnly})`;
        }

        // 3. Branch detail URL: /chi-nhanh/[slug]
        const branchMatch = pathOnly.match(/^\/chi-nhanh\/([a-z0-9-]+)$/i);
        if (branchMatch) {
          const branchSlug = branchMatch[1].toLowerCase();
          if (validBranchSlugs.has(branchSlug)) {
            return `[${label}](/chi-nhanh/${branchSlug})`;
          }
          return `**${label}**`;
        }

        // 4. Fake voucher routes: /voucher/... or /vouchers/...
        if (pathOnly.startsWith('/voucher/') || pathOnly.startsWith('/vouchers/')) {
          return `**${label}**`;
        }

        // 5. Dish detail URL: /[category]/[slug]
        const dishMatch = pathOnly.match(/^\/([a-z0-9-]+)\/([a-z0-9-]+)$/i);
        if (dishMatch) {
          const catSlug = dishMatch[1].toLowerCase();
          if (validCategorySlugs.has(catSlug)) {
            return `[${label}](/${catSlug}/${dishMatch[2]})`;
          }
        }

        // Single slug fallback check against database
        const singleSlug = pathOnly.replace(/^\//, '').toLowerCase();
        if (productUrlMap.has(singleSlug)) {
          return `[${label}](${productUrlMap.get(singleSlug)})`;
        }

        // If unrecognized internal link, strip link and preserve text
        if (pathOnly.startsWith('/')) {
          return `**${label}**`;
        }

        return match;
      });
    } catch (e) {
      this.logger.warn(`Error sanitizing chatbot links: ${e}`);
      return text;
    }
  }

  public maskSensitiveData(text: string): string {
    if (!text) return text;
    let masked = text;

    // 1. Che số điện thoại: 0839654952 -> 083*****52
    masked = masked.replace(/(0[3|5|7|8|9]\d)(\d{5})(\d{2})/g, '$1*****$3');
    masked = masked.replace(/(0[3|5|7|8|9]\d)[\s.]?(\d{2,3})[\s.]?(\d{3,4})/g, (match, p1, p2, p3) => {
      return `${p1}*****${p3.slice(-2)}`;
    });

    // 2. Che địa chỉ nhà / số nhà / đường (giữ lại Phường, Quận, Tỉnh)
    masked = masked.replace(/(?:số\s*)?[0-9a-zA-ZÀ-ỹ\s/]+?,\s*(Phường|Xã|Thị trấn|P\.|Q\.|Quận|Huyện|Thành phố|TP|Tỉnh)/gi, '***, $1');

    // 3. Che Email: phamvanphat@gmail.com -> p***t@gmail.com
    masked = masked.replace(/([a-zA-Z0-9_\-.]{2})([a-zA-Z0-9_\-.]*)(@[\w.-]+\.\w+)/g, (match, start, mid, domain) => {
      return `${start[0]}***${start.slice(-1)}${domain}`;
    });

    return masked;
  }

  public async createShareLink(
    sessionId: string,
    userId?: string,
    duration: string = '24h',
    maskSensitive: boolean = true,
  ) {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Không tìm thấy phiên trò chuyện để chia sẻ');
    }

    // Tính thời gian hết hạn
    let expiresAt: Date | null = null;
    const now = new Date();
    if (duration === '1h') {
      expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
    } else if (duration === '24h') {
      expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    } else if (duration === '7d') {
      expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    const token = 'sh_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);

    // Lọc và mask nội dung các tin nhắn
    const sanitizedMessages = session.messages.map((m) => {
      const cleanContent = maskSensitive ? this.maskSensitiveData(m.content) : m.content;
      return {
        id: m.id,
        senderType: m.senderType,
        content: cleanContent,
        actionType: m.actionType,
        actionPayload: m.actionPayload ? (maskSensitive ? this.maskSensitiveData(m.actionPayload) : m.actionPayload) : null,
        createdAt: m.createdAt,
      };
    });

    // Lưu vào contextData của session
    let existingContext: any = {};
    try {
      if (session.contextData) {
        existingContext = JSON.parse(session.contextData);
      }
    } catch {}

    const shares = Array.isArray(existingContext.shares) ? existingContext.shares : [];
    shares.push({
      token,
      duration,
      maskSensitive,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      createdAt: now.toISOString(),
      messages: sanitizedMessages,
      title: session.title || 'Cuộc trò chuyện Avora',
    });

    existingContext.shares = shares.slice(-10);

    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        contextData: JSON.stringify(existingContext),
      },
    });

    return {
      success: true,
      token,
      shareUrl: `https://avorafnb.com/share/chat/${token}`,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      duration,
      maskSensitive,
    };
  }

  public async getSharedChat(token: string) {
    if (!token || !token.trim()) {
      throw new BadRequestException('Mã liên kết chia sẻ không hợp lệ');
    }

    const session = await this.prisma.chatSession.findFirst({
      where: {
        contextData: { contains: token },
      },
    });

    if (!session || !session.contextData) {
      throw new NotFoundException('Không tìm thấy cuộc trò chuyện được chia sẻ');
    }

    let contextObj: any = {};
    try {
      contextObj = JSON.parse(session.contextData);
    } catch {
      throw new NotFoundException('Dữ liệu chia sẻ không hợp lệ');
    }

    const shares = Array.isArray(contextObj.shares) ? contextObj.shares : [];
    const shareRecord = shares.find((s: any) => s.token === token);

    if (!shareRecord) {
      throw new NotFoundException('Liên kết chia sẻ không tồn tại hoặc đã bị xóa');
    }

    if (shareRecord.isRevoked) {
      throw new HttpException('Liên kết chia sẻ này đã bị người dùng hủy bỏ quyền truy cập', HttpStatus.GONE);
    }

    if (shareRecord.expiresAt && new Date() > new Date(shareRecord.expiresAt)) {
      throw new HttpException('Liên kết chia sẻ này đã hết thời hạn truy cập', HttpStatus.GONE);
    }

    return {
      success: true,
      title: shareRecord.title || session.title || 'Cuộc trò chuyện với AvoBOT',
      createdAt: shareRecord.createdAt,
      expiresAt: shareRecord.expiresAt,
      isMasked: shareRecord.maskSensitive,
      messages: shareRecord.messages || [],
    };
  }

  public async revokeShareLink(token: string) {
    if (!token || !token.trim()) {
      throw new BadRequestException('Mã liên kết chia sẻ không hợp lệ');
    }

    const session = await this.prisma.chatSession.findFirst({
      where: {
        contextData: { contains: token },
      },
    });

    if (!session || !session.contextData) {
      throw new NotFoundException('Không tìm thấy cuộc trò chuyện được chia sẻ');
    }

    let contextObj: any = {};
    try {
      contextObj = JSON.parse(session.contextData);
    } catch {
      throw new NotFoundException('Dữ liệu không hợp lệ');
    }

    const shares = Array.isArray(contextObj.shares) ? contextObj.shares : [];
    const index = shares.findIndex((s: any) => s.token === token);

    if (index === -1) {
      throw new NotFoundException('Liên kết chia sẻ không tồn tại hoặc đã bị xóa trước đó');
    }

    // Đánh dấu đã hủy chia sẻ
    shares[index].isRevoked = true;
    shares[index].revokedAt = new Date().toISOString();

    contextObj.shares = shares;

    await this.prisma.chatSession.update({
      where: { id: session.id },
      data: {
        contextData: JSON.stringify(contextObj),
      },
    });

    return {
      success: true,
      message: 'Đã hủy liên kết chia sẻ thành công. Người khác sẽ không thể truy cập liên kết này nữa.',
    };
  }
}
