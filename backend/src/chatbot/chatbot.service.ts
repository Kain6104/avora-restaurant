import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationService } from '../reservation/reservation.service';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { ChatbotToolEngineService } from './chatbot-tool-engine.service';
import { ALL_CHATBOT_TOOL_DECLARATIONS } from './chatbot-tool-declarations';
import * as crypto from 'crypto';
import { ChatSessionContext, ChatbotSuggestion } from './dto/chatbot-tool.dto';
import { getRequiredEnv } from '../common/utils/env.util';

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private genAI: GoogleGenerativeAI;
  private apiKeys: string[] = [];
  private currentKeyIndex = 0;
  private readonly disabledKeyIndexes = new Set<number>();
  private readonly keyCooldownUntil = new Map<number, number>();
  private readonly maxTransientRetries = 2;
  private readonly retryBaseDelayMs = 250;
  private readonly guestSessionSecret = getRequiredEnv('CHATBOT_GUEST_SESSION_SECRET');

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ReservationService))
    private readonly reservationService: ReservationService,
    private readonly toolEngine: ChatbotToolEngineService,
  ) {
    const envKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
    this.apiKeys = envKeys.split(',').map((k) => k.trim()).filter((k) => k);
    if (this.apiKeys.length === 0) {
      throw new Error('GEMINI_API_KEY or GEMINI_API_KEYS is required for chatbot');
    }
    this.genAI = new GoogleGenerativeAI(this.apiKeys[this.currentKeyIndex]);
  }

  private rotateKey(): boolean {
    const now = Date.now();
    for (let offset = 1; offset <= this.apiKeys.length; offset += 1) {
      const candidate = (this.currentKeyIndex + offset) % this.apiKeys.length;
      if (this.disabledKeyIndexes.has(candidate)) continue;
      if ((this.keyCooldownUntil.get(candidate) || 0) > now) continue;

      this.currentKeyIndex = candidate;
      this.logger.warn(`Đã chuyển sang API key dự phòng ở vị trí ${this.currentKeyIndex}`);
      this.genAI = new GoogleGenerativeAI(this.apiKeys[this.currentKeyIndex]);
      return true;
    }

    if (!this.disabledKeyIndexes.has(this.currentKeyIndex)) {
      this.keyCooldownUntil.delete(this.currentKeyIndex);
      this.genAI = new GoogleGenerativeAI(this.apiKeys[this.currentKeyIndex]);
      return true;
    }
    return false;
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
      /API_KEY_INVALID|api key not valid|invalid api key/i.test(message) ||
      status === 401 ||
      status === 403;
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

  private getModel(personality?: string, userContext?: string) {
    return this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: `Bạn là Trợ lý AI Thông minh (AI Restaurant Assistant) cao cấp của hệ thống nhà hàng Avora Restaurant.
Bạn đang tương tác trực tiếp với khách hàng để hỗ trợ thực đơn, tư vấn món ăn, đặt bàn và đặt món - thanh toán.
Giọng điệu: Thân thiện, lịch thiệp, chu đáo, tự nhiên, chuyên nghiệp và hiếu khách. Xưng "em", gọi khách là "quý khách" hoặc "anh/chị". ${personality ? `Tính cách: ${personality}.` : ''} ${userContext || ''}

[PHONG CÁCH GIAO TIẾP NHÀ HÀNG CAO CẤP]:
- TUYỆT ĐỐI KHÔNG lặp đi lặp lại tên tài khoản, nickname hoặc username của khách (như "HTP Official") trong mọi câu nói. Chỉ xưng hô "quý khách" hoặc "anh/chị" một cách tự nhiên.
- Hiểu rõ ngữ cảnh các tin nhắn trước: "món này", "món đó", "thêm món vừa rồi vào giỏ", "cho tôi món rẻ hơn", "đổi món khác".
- Khi khách hỏi tư vấn theo ngân sách (VD: "Tôi có 150k", "Gợi ý bữa ăn cho 2 người khoảng 300k"): BẮT BUỘC gọi tool \`searchMenu\` với tham số \`budget\` để tra cứu các món có thật từ thực đơn nhà hàng. Tính toán chính xác tổng tiền dựa trên giá thực tế, đề xuất phương án tối ưu và giải thích ngắn gọn vì sao chọn những món đó.
- TUYỆT ĐỐI KHÔNG tự bịa món ăn, giá tiền hoặc tự nhận món tốt cho sức khỏe/giảm giá nếu không có dữ liệu thực tế.
- Trả lời súc tích, ngắn gọn, có cấu trúc rõ ràng.

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
0. TÌM KIẾM MÓN & TÙY CHỌN (OPTIONS / TOPPING):
- Khi khách nói "cho tôi món đó", "lấy món này", "thêm món vừa gợi ý", "lấy món 1": BẮT BUỘC gọi ngay \`addToCart\` với tên món vừa đề xuất trong câu trước.
- Xử lý Tùy chọn (Options: Size, Vị, Topping, Độ ngọt/đá):
  + Nếu khách nói rõ (VD: "Size L", "ít đá", "50% đường"): Truyền vào tham số \`optionNames\` của \`addToCart\`.
  + Nếu khách KHÔNG nói gì về options: CỨ GỌI NGAY \`addToCart\` với tên món! Máy chủ đã có cơ chế TỰ ĐỘNG CHỌN tùy chọn mặc định (Regular size, 100% đường đá) giúp khách đặt hàng trơn tru không bị nghẽn.

1. CHI NHÁNH & TÌM CHI NHÁNH GẦN NHẤT:
- Khi khách hỏi tìm chi nhánh gần nhất ("tìm chi nhánh gần nhất", "quán ở đâu gần đây", "chi nhánh nào gần tôi"): Nếu chưa có tọa độ GPS, BẮT BUỘC gọi ngay tool \`findNearestBranch\` (không cần tham số). Hệ thống sẽ tự động gửi nút "📍 Chia sẻ vị trí của tôi" trực tiếp vào khung chat cho khách.
- Khi nhận được tin nhắn tọa độ GPS dạng "[HỆ THỐNG: Vị trí của khách hàng là vĩ độ X, kinh độ Y]": Nếu khách đang tìm chi nhánh, BẮT BUỘC gọi ngay \`findNearestBranch\` với latitude và longitude đó để phản hồi danh sách chi nhánh gần nhất kèm link Google Maps!
- Nếu đang đặt món và trong ngữ cảnh đã có thông tin chi nhánh hiện tại của khách, SỬ DỤNG LUÔN chi nhánh đó làm mặc định. Không bắt khách chọn lại chi nhánh từ đầu!

2. ĐỊA CHỈ & VỊ TRÍ GIAO HÀNG (DELIVERY):
- Nếu khách chọn Giao hàng (DELIVERY) mà chưa có địa chỉ: BẮT BUỘC gọi \`getUserAddresses\` (hệ thống sẽ tự gửi nút "📍 Chia sẻ vị trí của tôi" vào khung chat nếu khách chưa lưu địa chỉ).
- Khi nhận được tin nhắn tọa độ GPS từ hệ thống dạng: "[HỆ THỐNG: Vị trí của khách hàng là vĩ độ X, kinh độ Y]", nếu khách đang đặt giao hàng, BẮT BUỘC gọi ngay \`validateDeliveryAddress\` với latitude và longitude đó để máy chủ tự động quy đổi thành địa chỉ thực tế và tính phí giao hàng chính xác!
- Không bắt khách gõ tay lại địa chỉ nếu đã có tọa độ GPS.

3. KHUNG GIỜ GIAO HÀNG (OPERATING SLOTS):
- BẮT BUỘC gọi \`getAvailableOrderSlots\`.
- Nếu khách nói giờ cụ thể (ví dụ: "11h45", "12h trưa", "tầm 7 giờ tối", "18h30"): BẮT BUỘC truyền tham số \`requestedTime\` vào tool \`getAvailableOrderSlots\` để hệ thống tự động đối chiếu và chọn khung giờ phù hợp nhất!
- Nếu khách muốn nhận sớm hoặc hệ thống kích hoạt ASAP: Xác nhận khung giờ "Giao ngay (ASAP 30-45 phút)". Luôn có khung giờ khả dụng cho khách.

4. TINH GỌN THÔNG TIN KHÁCH HÀNG:
- TẬN DỤNG HỌ TÊN VÀ SĐT ĐÃ CÓ trong hồ sơ khách hàng. TUYỆT ĐỐI KHÔNG hỏi lại tên hay SĐT nếu tài khoản đã có sẵn!
- Ngay khi đã đủ: Món trong giỏ + Chi nhánh + Địa chỉ giao hàng + Khung giờ: BẮT BUỘC GỌI NGAY \`previewOrder\` để hiện bảng xem trước và tổng tiền từ máy chủ.
- CHỈ KHI KHÁCH NÓI XÁC NHẬN ĐỒNG Ý thì mới gọi \`placeOrder\` để tạo đơn hàng chính thức.

5. ĐẶT BÀN NHÀ HÀNG (RESERVATION):
- Sử dụng luôn chi nhánh hiện tại nếu khách không yêu cầu đổi.
- Kiểm tra khung giờ còn chỗ: BẮT BUỘC gọi \`getReservationSlots\` với chi nhánh, ngày và số khách.
- Khi đủ thông tin: BẮT BUỘC gọi \`previewReservation\` để hiện bảng tóm tắt và hỏi xác nhận từ khách.
- CHỈ KHI KHÁCH NÓI XÁC NHẬN ĐỒNG Ý thì mới gọi \`createReservation\` để tạo đặt bàn thật sự.

[QUY TẮC BẤT DI BẤT DỊCH]:
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
        const classification = this.classifyGeminiError(error);
        const keyIndex = this.currentKeyIndex;

        if (classification.invalidKey) {
          this.disabledKeyIndexes.add(keyIndex);
          this.keyCooldownUntil.delete(keyIndex);
          this.logger.warn(`Bỏ qua API key ở vị trí ${keyIndex} do provider từ chối key`);
        } else if (classification.status === 429) {
          this.keyCooldownUntil.set(keyIndex, Date.now() + 60_000);
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
    const rawHistory = messages.filter((message) => ['USER', 'AI', 'TOOL'].includes(message.senderType));
    const recentMessages = rawHistory.slice(-8);
    while (recentMessages.length > 0 && recentMessages[0].senderType !== 'USER') recentMessages.shift();

    const maxHistoryChars = 12_000;
    let historyChars = recentMessages.reduce(
      (total, message) => total + (message.content?.length || 0) + (message.actionPayload?.length || 0),
      0,
    );
    while (historyChars > maxHistoryChars && recentMessages.length > 1) {
      const removed = recentMessages.shift();
      historyChars -= (removed?.content?.length || 0) + (removed?.actionPayload?.length || 0);
      while (recentMessages.length > 0 && recentMessages[0].senderType !== 'USER') recentMessages.shift();
    }

    return recentMessages.flatMap((message) => {
      try {
        let role = 'user';
        if (message.senderType === 'AI') role = 'model';
        if (message.senderType === 'TOOL') role = 'function';
        let parts: Part[] = [];
        if (message.senderType === 'USER') {
          parts = [{ text: (message.content || '').slice(0, 4_000) }];
        } else if (message.senderType === 'AI') {
          parts = message.functionName && message.actionPayload
            ? [{ functionCall: { name: message.functionName, args: JSON.parse(message.actionPayload) } }]
            : [{ text: (message.content || '').slice(0, 4_000) }];
        } else {
          parts = [{ functionResponse: { name: message.functionName as string, response: message.actionPayload ? JSON.parse(message.actionPayload) : {} } }];
        }
        return [{ role, parts }];
      } catch {
        return [];
      }
    });
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
  ) {
    // 1. Garbage Collection (Delete messages older than 3 days)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    try {
      await this.prisma.chatMessage.deleteMany({
        where: { createdAt: { lt: threeDaysAgo } },
      });
    } catch (e) {
      console.error('GC error', e);
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
          const isBrandOrNick = /official|admin|user|tester|bot|shop|store|\d{3,}/i.test(rawName);
          const nameHint = (!isBrandOrNick && rawName.length > 1 && rawName.length < 25)
            ? `Tên khách: "${rawName}". Thỉnh thoảng có thể gọi tên một cách tự nhiên, KHÔNG lặp lại tên ở mọi câu nói.`
            : `Xưng "em", gọi khách là "quý khách", TUYỆT ĐỐI KHÔNG lặp lại nickname/username "${rawName}" trong câu trả lời.`;

          userContext = `THÔNG TIN KHÁCH HÀNG: Hạng thẻ: ${user.membershipTier?.name || 'Thành viên'}. ${nameHint} `;
        }
      } catch (e) {
        console.error('Error fetching user context:', e);
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
        session = await this.prisma.chatSession.findFirst({
          where: { userId: userId },
          orderBy: { createdAt: 'desc' },
          include: { messages: { orderBy: { createdAt: 'asc' } } },
        });

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
      }
    } else {
      const guestSession = await this.resolveGuestSession(sessionId, guestSessionToken, message);
      session = guestSession.session;
      guestSessionToken = guestSession.guestSessionToken;
    }

    // 4. Convert history for Gemini with Sliding Window
    const history = this.buildModelHistory(session.messages);

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

    while (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];

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
        await this.executeToolCall(call, userId, branchId, cartTotal, session.id);

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

      // Send result back to Gemini
      const retryRes = await this.sendMessageWithRetry(
        chat,
        [
          {
            functionResponse: {
              name: call.name,
              response: functionResult,
            },
          },
        ],
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

    // Trích xuất <<<SUGGESTIONS>>> tag nếu Gemini trả về
    let extractedSuggestions: any[] | null = null;
    const suggestionsMatch = textResponse.match(/<<<SUGGESTIONS>>>([\s\S]*?)(?:$|\n)/);
    if (suggestionsMatch && suggestionsMatch[1]) {
      try {
        const rawJson = suggestionsMatch[1].trim();
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
        console.warn('Failed to parse <<<SUGGESTIONS>>> from Gemini:', err);
      }
      textResponse = textResponse.replace(/<<<SUGGESTIONS>>>[\s\S]*?(?:$|\n)/g, '').trim();
    }

    // Hợp nhất gợi ý: Ưu tiên tool suggestions, rồi đến suggestions từ Gemini
    let finalSuggestions: any[] | null = lastSuggestedReplies || extractedSuggestions;

    // Smart Contextual Fallback: Nếu câu trả lời nhắc đến tên danh mục trong DB (ví dụ: Sushi & Maki, Sashimi Tươi Sống...)
    if (!finalSuggestions || finalSuggestions.length === 0) {
      try {
        const allCategories = await this.prisma.category.findMany({
          select: { id: true, name: true, slug: true },
          orderBy: { displayOrder: 'asc' },
        });

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
  ) {
    const res = await this.toolEngine.executeTool(call.name, call.args, userId, sessionId, branchId);
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

  async getSession(sessionId: string, userId: string) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    return session;
  }

  async deleteSession(sessionId: string, userId: string) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    });
    if (!session) throw new NotFoundException('Session not found');

    await this.prisma.chatSession.delete({ where: { id: session.id } });
    return { success: true };
  }
}
