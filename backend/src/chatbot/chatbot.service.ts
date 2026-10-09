import { Injectable, Logger, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationService } from '../reservation/reservation.service';
import { GoogleGenerativeAI, FunctionDeclaration, Part } from '@google/generative-ai';
import { ChatActionType } from '@prisma/client';
import { ChatbotToolEngineService } from './chatbot-tool-engine.service';
import { ALL_CHATBOT_TOOL_DECLARATIONS } from './chatbot-tool-declarations';
import * as crypto from 'crypto';

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private genAI: GoogleGenerativeAI;
  private apiKeys: string[] = [];
  private currentKeyIndex = 0;

  // Giữ lại các thuộc tính declaration cũ để tương thích ngược nếu có module khác đọc
  public searchMenuDeclaration: FunctionDeclaration;
  public addToCartDeclaration: FunctionDeclaration;
  public addAllToCartDeclaration: FunctionDeclaration;
  public updateCartItemDeclaration: FunctionDeclaration;
  public checkOrderDeclaration: FunctionDeclaration;
  public checkVoucherDeclaration: FunctionDeclaration;
  public checkRankUpgradeDeclaration: FunctionDeclaration;
  public navigateDeclaration: FunctionDeclaration;
  public requestLocationDeclaration: FunctionDeclaration;
  public findNearestBranchDeclaration: FunctionDeclaration;
  public getUserAddressDeclaration: FunctionDeclaration;
  public getAddressFromLocationDeclaration: FunctionDeclaration;
  public saveAddressDeclaration: FunctionDeclaration;
  public triggerOrderPreviewDeclaration: FunctionDeclaration;
  public triggerPlaceOrderDeclaration: FunctionDeclaration;
  public stopVoiceDeclaration: FunctionDeclaration;
  public autoSuggestVoucherDeclaration: FunctionDeclaration;
  public pinProductToLiveDeclaration: FunctionDeclaration;
  public triggerVoucherOverlayDeclaration: FunctionDeclaration;
  public handoffToHumanDeclaration: FunctionDeclaration;
  public sendMapLinkDeclaration: FunctionDeclaration;
  public listReservationBranchesDeclaration: FunctionDeclaration;
  public getReservationSlotsDeclaration: FunctionDeclaration;
  public requestReservationConfirmationDeclaration: FunctionDeclaration;
  public createReservationDeclaration: FunctionDeclaration;
  public cancelReservationDeclaration: FunctionDeclaration;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ReservationService))
    private readonly reservationService: ReservationService,
    private readonly toolEngine: ChatbotToolEngineService,
  ) {
    const envKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
    this.apiKeys = envKeys.split(',').map((k) => k.trim()).filter((k) => k);
    this.genAI = new GoogleGenerativeAI(this.apiKeys[this.currentKeyIndex] || '');

    // Gán các tool declaration từ bảng chuẩn hóa
    const findDecl = (name: string) => ALL_CHATBOT_TOOL_DECLARATIONS.find((d) => d.name === name) || ({} as any);
    this.searchMenuDeclaration = findDecl('searchMenu');
    this.addToCartDeclaration = findDecl('addToCart');
    this.updateCartItemDeclaration = findDecl('updateCartItem');
    this.checkOrderDeclaration = findDecl('checkOrder');
    this.checkVoucherDeclaration = findDecl('findApplicableVouchers');
    this.checkRankUpgradeDeclaration = findDecl('getMembershipStatus');
    this.findNearestBranchDeclaration = findDecl('findNearestBranch');
    this.getUserAddressDeclaration = findDecl('getUserAddresses');
    this.saveAddressDeclaration = findDecl('saveAddress');
    this.triggerOrderPreviewDeclaration = findDecl('previewOrder');
    this.triggerPlaceOrderDeclaration = findDecl('placeOrder');
    this.stopVoiceDeclaration = findDecl('stopVoice');
    this.handoffToHumanDeclaration = findDecl('handoffToHuman');
    this.listReservationBranchesDeclaration = findDecl('listBranches');
    this.getReservationSlotsDeclaration = findDecl('getReservationSlots');
    this.requestReservationConfirmationDeclaration = findDecl('previewReservation');
    this.createReservationDeclaration = findDecl('createReservation');
    this.cancelReservationDeclaration = findDecl('cancelReservation');
    this.addAllToCartDeclaration = findDecl('addToCart');
    this.navigateDeclaration = findDecl('checkOrder');
    this.requestLocationDeclaration = findDecl('findNearestBranch');
    this.getAddressFromLocationDeclaration = findDecl('validateDeliveryAddress');
    this.autoSuggestVoucherDeclaration = findDecl('findApplicableVouchers');
    this.triggerVoucherOverlayDeclaration = findDecl('findApplicableVouchers');
    this.sendMapLinkDeclaration = findDecl('findNearestBranch');
    this.pinProductToLiveDeclaration = findDecl('getProductDetail');
  }

  private rotateKey() {
    if (this.apiKeys.length <= 1) return;
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    this.logger.warn(`Đã chuyển sang API Key dự phòng ở vị trí ${this.currentKeyIndex}`);
    this.genAI = new GoogleGenerativeAI(this.apiKeys[this.currentKeyIndex]);
  }

  private getModel(personality?: string, userContext?: string) {
    return this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: `Bạn là Trợ lý AI Thông minh (AI Restaurant Assistant) cao cấp của hệ thống nhà hàng Avora Restaurant.
Bạn đang tương tác trực tiếp với khách hàng để hỗ trợ thực đơn, đặt bàn và đặt món - thanh toán.
Giọng điệu: Thân thiện, lịch thiệp, chu đáo, tự nhiên, chuyên nghiệp và hiếu khách. ${personality ? `Tính cách: ${personality}.` : ''} ${userContext || ''}

[QUY TẮC CHECKOUT & ĐẶT MÓN TỐI ƯU NHẤT]:
1. CHI NHÁNH HIỆN TẠI:
- Nếu trong ngữ cảnh đã có thông tin chi nhánh hiện tại của khách, SỬ DỤNG LUÔN chi nhánh đó làm mặc định.
- Chỉ cần nhắc lại nhẹ nhàng để xác nhận (ví dụ: "Đơn này giao từ chi nhánh [Tên] đúng không ạ?"), TUYỆT ĐỐI KHÔNG bắt khách chọn lại chi nhánh từ đầu!

2. ĐỊA CHỈ & VỊ TRÍ GIAO HÀNG (DELIVERY):
- Nếu khách chọn Giao hàng (DELIVERY) mà chưa có địa chỉ: BẮT BUỘC gọi \`getUserAddresses\` (hoặc hướng dẫn bấm nút "📍 Chia sẻ vị trí hiện tại").
- Khi nhận được tin nhắn tọa độ GPS từ hệ thống dạng: "[HỆ THỐNG: Vị trí của khách hàng là vĩ độ X, kinh độ Y]", BẮT BUỘC gọi ngay \`validateDeliveryAddress\` với latitude và longitude đó để máy chủ tự động quy đổi thành địa chỉ thực tế và tính phí giao hàng chính xác!
- Không bắt khách gõ tay lại địa chỉ nếu đã có tọa độ GPS.

3. KHUNG GIỜ GIAO HÀNG (OPERATING SLOTS):
- BẮT BUỘC gọi \`getAvailableOrderSlots\`.
- Nếu khách nói giờ cụ thể (ví dụ: "11h45", "12h trưa", "tầm 7 giờ tối", "18h30"): BẮT BUỘC truyền tham số \`requestedTime\` vào tool \`getAvailableOrderSlots\` để hệ thống tự động đối chiếu và chọn khung giờ phù hợp nhất!
- Nếu khách muốn nhận càng sớm càng tốt: Khung giờ là "Giao ngay (ASAP)".

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
    let retries = this.apiKeys.length;
    let currentChat = chat;

    while (retries > 0) {
      try {
        result = await currentChat.sendMessage(payload);
        return { result, newChat: currentChat };
      } catch (e: any) {
        retries--;
        this.logger.error(`Lỗi gọi Gemini: ${e.message}. Còn ${retries} lần thử lại.`);

        if (retries === 0) {
          throw new Error('Hệ thống AI đang bảo trì hoặc quá tải. Vui lòng thử lại sau ít phút nhé!');
        }

        this.rotateKey();
        const currentModel = this.getModel(personality, userContext);
        currentChat = currentModel.startChat({ history });
      }
    }
    throw new Error('Hệ thống AI đang bảo trì hoặc quá tải. Vui lòng thử lại sau ít phút nhé!');
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
          include: { membershipTier: true, _count: { select: { orders: true, reservations: true } } },
        });
        if (user) {
          userContext = `THÔNG TIN KHÁCH HÀNG: Tên: ${user.fullName || 'Khách'}, SĐT: ${user.phone || 'Chưa có'}, Hạng thẻ: ${user.membershipTier?.name || 'Thành viên'}, Điểm: ${user.currentPoints}. Đơn hàng đã đặt: ${user._count.orders}. Đặt bàn đã đặt: ${user._count.reservations}. Xưng hô thân mật bằng tên của khách. `;
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
        session = await this.prisma.chatSession.findUnique({
          where: { id: sessionId },
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
      session = { id: sessionId || 'guest-session', messages: clientHistory || [] };
    }

    // 4. Convert history for Gemini with Sliding Window
    const rawHistory = session.messages.filter((m: any) => ['USER', 'AI', 'TOOL'].includes(m.senderType));
    let startIndex = Math.max(0, rawHistory.length - 8);
    while (startIndex < rawHistory.length && rawHistory[startIndex].senderType !== 'USER') {
      startIndex++;
    }
    const recentMessages = rawHistory.slice(startIndex);

    const history = recentMessages.map((m: any) => {
      let role = 'user';
      if (m.senderType === 'AI') role = 'model';
      if (m.senderType === 'TOOL') role = 'function';

      let parts: Part[] = [];
      if (m.senderType === 'USER') {
        parts = [{ text: m.content }];
      } else if (m.senderType === 'AI') {
        if (m.functionName && m.actionPayload) {
          parts = [{ functionCall: { name: m.functionName, args: JSON.parse(m.actionPayload) } }];
        } else {
          parts = [{ text: m.content || '' }];
        }
      } else if (m.senderType === 'TOOL') {
        parts = [
          {
            functionResponse: {
              name: m.functionName as string,
              response: m.actionPayload ? JSON.parse(m.actionPayload) : {},
            },
          },
        ];
      }

      return { role, parts };
    });

    // 5. Save User Message
    const userMessage = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      senderType: 'USER',
      content: message,
      createdAt: new Date().toISOString(),
    };

    if (userId && session.id !== 'guest-session') {
      await this.prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          senderType: 'USER',
          content: message,
        },
      });
    }
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
      if (userId && session.id !== 'guest-session') {
        await this.prisma.chatMessage.delete({ where: { id: userMessage.id } }).catch(() => {});
      }
      throw error;
    }

    let lastActionType: any = null;
    let lastActionPayload: string | null = null;
    let lastContent: string | null = null;
    let lastSuggestedReplies: string[] | null = null;

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

      if (userId && session.id !== 'guest-session') {
        await this.prisma.chatMessage.create({
          data: {
            sessionId: session.id,
            senderType: 'AI',
            content: '',
            functionName: call.name,
            actionPayload: JSON.stringify(call.args),
          },
        });
      }
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

      if (userId && session.id !== 'guest-session') {
        await this.prisma.chatMessage.create({
          data: {
            sessionId: session.id,
            senderType: 'TOOL',
            content: '',
            functionName: call.name,
            actionPayload: JSON.stringify(functionResult),
          },
        });
      }
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

    // 7. Final Message
    let textResponse = '';
    try {
      textResponse = result.response.text();
    } catch (e) {
      console.error('Error getting text response:', e);
    }

    if (!textResponse) {
      textResponse = lastContent || (lastActionType ? 'Dạ em đã chuẩn bị thông tin bên dưới cho bạn nhé:' : 'Xin lỗi, tôi chưa hiểu rõ yêu cầu của bạn. Bạn có thể nói rõ hơn được không?');
    }

    const finalMessage: any = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      senderType: 'AI',
      content: textResponse,
      actionType: lastActionType,
      actionPayload: lastActionPayload,
      suggestedReplies: lastSuggestedReplies,
      createdAt: new Date().toISOString(),
    };

    if (userId && session.id !== 'guest-session') {
      const savedMessage = await this.prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          senderType: 'AI',
          content: textResponse,
          actionType: lastActionType,
          actionPayload: lastActionPayload,
        },
      });
      finalMessage.id = savedMessage.id;
      finalMessage.createdAt = savedMessage.createdAt;
    }

    return {
      sessionId: session.id,
      messages: [finalMessage],
      actionType: lastActionType,
      actionPayload: lastActionPayload,
      suggestedReplies: lastSuggestedReplies,
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

  async getSession(sessionId: string) {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    return session;
  }

  async deleteSession(sessionId: string) {
    try {
      await this.prisma.chatMessage.deleteMany({ where: { sessionId } });
      await this.prisma.chatSession.delete({ where: { id: sessionId } });
      return { success: true };
    } catch (e) {
      console.error('Delete session error', e);
      return { success: false };
    }
  }
}
