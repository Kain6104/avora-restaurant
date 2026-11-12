import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ChatbotService } from './chatbot.service';
import { MenuGroundingService, GroundedMenuContext } from './menu-grounding.service';
import { ALL_CHATBOT_TOOL_DECLARATIONS } from './chatbot-tool-declarations';
import { PrismaService } from '../prisma/prisma.service';
import WebSocket from 'ws';

const allowedVoiceOrigins = (
  process.env.CHATBOT_WS_ALLOWED_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:4000'
).split(',').map((origin) => origin.trim()).filter(Boolean);

interface VoiceClientContent {
  turns?: Array<{ role: 'user'; parts: Array<{ text: string }> }>;
  turnComplete?: boolean;
}

interface VoiceContext {
  userId?: string;
  sessionId: string;
  guestSessionToken?: string;
  userContext: string;
  cartTotal: number;
  cartSummary: string;
  branchId: string;
  isExecutingTool?: boolean;
  audioGeneration: number;
  lastUserQuery?: string;
  lastGroundTruth?: GroundedMenuContext;
}

@WebSocketGateway({ namespace: '/voice-chat', cors: { origin: allowedVoiceOrigins, credentials: true } })
@Injectable()
export class ChatbotGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatbotGateway.name);
  private geminiConnections: Map<string, WebSocket> = new Map();
  private userContexts: Map<string, VoiceContext> = new Map();

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatbotService: ChatbotService,
    private readonly prisma: PrismaService,
    private readonly menuGroundingService: MenuGroundingService,
  ) {}

  /**
   * Xác thực thực đơn và chống bịa món cho Voice Chatbot (Đồng bộ 100% nguyên tắc với Text Chatbot)
   */
  public async verifyAndGroundVoiceTurn(
    userQuery: string,
    rawAiResponse: string,
    branchId?: string,
  ) {
    const analysis = this.menuGroundingService.analyzeUserQuery(userQuery || '');
    const groundTruth = await this.menuGroundingService.getGroundTruthMenuContext(analysis, branchId);
    const enforcement = await this.menuGroundingService.verifyAndEnforceGrounding(
      rawAiResponse,
      groundTruth,
      branchId,
    );
    const verifiedText =
      typeof this.chatbotService?.sanitizeAndVerifyLinks === 'function'
        ? await this.chatbotService.sanitizeAndVerifyLinks(enforcement.verifiedText)
        : enforcement.verifiedText;
    return {
      analysis,
      groundTruth,
      verifiedText,
      verifiedProducts: enforcement.verifiedProducts,
      wasHallucinationPrevented: enforcement.wasHallucinationPrevented,
    };
  }

  async handleConnection(client: Socket) {
    try {
      let token = client.handshake.auth?.token || client.handshake.query?.token;

      // Trích xuất token từ cookies nếu client gửi qua cookie
      if (!token && client.handshake.headers.cookie) {
        const cookies = client.handshake.headers.cookie.split(';');
        const tokenCookie = cookies.find((c) => c.trim().startsWith('token='));
        if (tokenCookie) {
          const cookieVal = tokenCookie.substring(tokenCookie.indexOf('=') + 1).trim();
          token = decodeURIComponent(cookieVal);
        }
      }

      let userId: string | undefined = undefined;
      let userContext = '';

      if (token && token !== 'guest' && token !== 'null') {
        try {
          const payload = this.jwtService.verify(token);
          userId = payload.sub || payload.id;
          const userRecord = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { membershipTier: true },
          });
          const rawName = (userRecord?.fullName || '').trim();
          const isBrandOrNick = /official|admin|user|tester|bot|shop|store|\d{3,}/i.test(rawName);
          const nameHint = (!isBrandOrNick && rawName.length > 1 && rawName.length < 25)
            ? `Tên khách: "${rawName}". Thỉnh thoảng có thể gọi tên tự nhiên.`
            : `Xưng "em", gọi khách là "quý khách", TUYỆT ĐỐI KHÔNG lặp lại username/nickname "${rawName}".`;
          userContext = `THÔNG TIN KHÁCH HÀNG: Hạng thẻ: ${userRecord?.membershipTier?.name || 'Thành viên'}. ${nameHint}`;
          this.logger.log(`Authenticated voice session: userId=${userId}`);
        } catch (e: any) {
          this.logger.warn(`Invalid/expired JWT for connection ${client.id}: ${e.message}`);
          client.emit('error', 'auth_failed');
          client.disconnect(true);
          return;
        }
      }

      // Quy tắc bảo mật & phân quyền: Voice AI chỉ dành cho thành viên đã đăng nhập
      if (!userId) {
        this.logger.warn(`Voice connection rejected for client ${client.id}: Voice is restricted to logged-in members.`);
        client.emit('voice_error', {
          code: 'AUTH_REQUIRED',
          message: 'Tính năng Voice AI chỉ dành cho thành viên đã đăng nhập.',
          retryable: false,
        });
        client.disconnect(true);
        return;
      }

      const sessionIdQuery = client.handshake.query?.sessionId as string | undefined;
      const guestSessionToken = client.handshake.query?.guestSessionToken as string | undefined;
      const voiceSession = await this.chatbotService.resolveVoiceSession(
        userId,
        sessionIdQuery,
        guestSessionToken,
      );
      let persistedContext: { currentBranchId?: string; cart?: Array<{ productName?: string; name?: string; priceAtSale: number; quantity: number }> } = {};
      if (voiceSession.contextData) {
        try {
          persistedContext = JSON.parse(voiceSession.contextData);
        } catch {
          this.logger.warn(`Invalid voice context for session ${voiceSession.sessionId}`);
        }
      }

      const cartSummaryStr = client.handshake.query?.cartSummary as string;
      let cartSummary = cartSummaryStr ? decodeURIComponent(cartSummaryStr) : '';
      const cartTotalStr = client.handshake.query?.cartTotal as string;
      let cartTotal = cartTotalStr ? parseFloat(cartTotalStr) : cartSummary && !cartSummary.includes('trống') ? 1 : 0;

      // Hydrate cart from persisted session context if client query had no cart summary
      if ((!cartSummary || cartSummary.includes('trống')) && Array.isArray(persistedContext.cart) && persistedContext.cart.length > 0) {
        cartSummary = persistedContext.cart
          .map((item) => `${item.quantity}x ${item.productName || item.name || 'Món'}`)
          .join(', ');
        cartTotal = persistedContext.cart.reduce((sum, item) => sum + Number(item.priceAtSale || 0) * Number(item.quantity || 1), 0);
      }

      if (cartSummary || cartTotal > 0) {
        userContext += ` [THÔNG TIN GIỎ HÀNG: ${cartSummary || 'Có món trong giỏ'}, Tổng tiền: ${cartTotal.toLocaleString('vi-VN')}đ, cartTotal = ${cartTotal}]`;
      } else {
        userContext += ` [THÔNG TIN GIỎ HÀNG: Giỏ hàng trống, cartTotal = 0]`;
      }

      // Hydrate recent conversation memory from database so Voice AI remembers text chat context
      try {
        const recentDbMessages = await this.prisma.chatMessage.findMany({
          where: {
            sessionId: voiceSession.sessionId,
            senderType: { in: ['USER', 'AI'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 6,
          select: { senderType: true, content: true },
        });
        const validRecent = recentDbMessages
          .reverse()
          .filter((m) => m.content && m.content.trim().length > 0);
        if (validRecent.length > 0) {
          const memorySnippet = validRecent
            .map((m) => `${m.senderType === 'USER' ? 'Khách' : 'AI'}: ${m.content.trim().slice(0, 220)}`)
            .join(' | ');
          userContext += ` [NGỮ CẢNH HỘI THOẠI GẦN ĐÂY]: ${memorySnippet}`;
        }
      } catch (err) {
        this.logger.warn(`Failed to hydrate voice session messages: ${err}`);
      }

      let branchId = persistedContext.currentBranchId || (client.handshake.query?.branchId as string) || '';
      if (!branchId) {
        try {
          const defaultBranch = await this.prisma.branch.findFirst({
            where: { onlineOrderingEnabled: true },
            orderBy: { createdAt: 'asc' },
          });
          if (defaultBranch) branchId = defaultBranch.id;
        } catch {}
      }
      if (branchId) {
        try {
          const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
          if (branch) {
            const branchAddr = [branch.street, branch.ward, branch.district, branch.province].filter(Boolean).join(', ');
            userContext += ` [CHI NHÁNH HIỆN TẠI]: Khách hàng đã chọn chi nhánh "${branch.name}" (Địa chỉ: ${branchAddr || 'Avora'}). Hãy sử dụng luôn chi nhánh này làm mặc định, chỉ nhắc lại nhẹ nhàng để xác nhận, TUYỆT ĐỐI KHÔNG bắt chọn lại!`;
          }
        } catch {}
      }

      this.userContexts.set(client.id, {
        userId,
        sessionId: voiceSession.sessionId,
        guestSessionToken: voiceSession.guestSessionToken,
        userContext,
        cartTotal,
        cartSummary,
        branchId,
        audioGeneration: 0,
      });
      client.emit('system', {
        type: 'voice_session',
        sessionId: voiceSession.sessionId,
        guestSessionToken: voiceSession.guestSessionToken,
      });

      client.on('update_cart_context', (data: { cartSummary?: string; cartTotal?: number; branchId?: string; cartItems?: any[] }) => {
        const ctx = this.userContexts.get(client.id);
        if (ctx) {
          if (typeof data.cartTotal === 'number' && Number.isFinite(data.cartTotal)) ctx.cartTotal = data.cartTotal;
          if (typeof data.cartSummary === 'string' && data.cartSummary.length <= 1000) ctx.cartSummary = data.cartSummary;
          if (typeof data.branchId === 'string' && data.branchId.length <= 100) ctx.branchId = data.branchId;
          if (Array.isArray(data.cartItems)) (ctx as any).cartItems = data.cartItems;
        }
      });

      const { key: apiKey, index: apiKeyIndex } = this.chatbotService.getActiveApiKey();
      if (!apiKey) {
        client.emit('error', 'Server missing Gemini API Key');
        client.disconnect();
        return;
      }

      const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
      const ws = new WebSocket(url);

      ws.on('open', () => {
        this.logger.log(`Connected to Gemini Live API for client ${client.id}`);
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

        const setupMessage = {
          setup: {
            model: 'models/gemini-3.1-flash-live-preview',
            systemInstruction: {
              parts: [
                {
                  text: `Bạn là Trợ lý Giọng nói AI (Voice AI Assistant) chuyên nghiệp, ấm áp, tận tâm của hệ thống nhà hàng Avora Restaurant.
Bạn giao tiếp qua điện thoại/giọng nói trực tiếp với khách hàng.
Giọng điệu: Ngắn gọn, tự nhiên như nhân viên nhà hàng đang trò chuyện với khách, lịch sự, hiếu khách, dễ nghe. ${userContext}

[THỜI GIAN THỰC TẾ HIỆN TẠI (VIỆT NAM GMT+7)]:
- Thời gian hiện tại: ${formattedNowVN}.
- Ngày hôm nay: ${todayStr}.
- Ngày mai: ${tomorrowStr}.
- Luôn sử dụng đúng ngày hiện tại hoặc ngày mai khi gọi các công cụ giao hàng, đặt bàn!

[QUY TẮC CHỐNG BỊA MÓN (ZERO HALLUCINATION)]:
- BẮT BUỘC gọi tool searchMenu khi khách hỏi gợi ý món, bán chạy hay thực đơn. TUYỆT ĐỐI KHÔNG tự bịa tên món ăn không có trong thực đơn của nhà hàng!

[QUY TẮC CHECKOUT & ĐẶT MÓN TỐI ƯU]:
0. CHỌN MÓN & TÙY CHỌN (OPTIONS):
- Khi khách nói "cho tôi món đó", "lấy món này", "món vừa gợi ý": Gọi ngay \`addToCart\` với tên món vừa nhắc tới.
- Khi thêm món vào giỏ: Cứ gọi \`addToCart\` với tên món, máy chủ sẽ tự động chọn tùy chọn mặc định (Regular size, 100% đường đá) nếu khách không nói rõ; nếu khách nêu tùy chọn, truyền vào \`optionNames\`.

1. CHI NHÁNH & TÌM CHI NHÁNH GẦN NHẤT:
- Khi khách hỏi tìm chi nhánh gần nhất ("tìm chi nhánh gần nhất", "chi nhánh nào gần tôi", "các chi nhánh của quán"): Nếu chưa có GPS, gọi \`findNearestBranch\` để hệ thống gửi thẻ xin vị trí GPS kèm bản đồ và đếm ngược 7 giây vào khung chat.
- Khi nhận được tọa độ GPS từ hệ thống (Vị trí của khách hàng là vĩ độ X, kinh độ Y): Nếu khách tìm chi nhánh, gọi \`findNearestBranch\`; nếu khách đặt giao hàng, gọi \`validateDeliveryAddress\`.
- Sử dụng luôn chi nhánh hiện tại của khách đã có trong ngữ cảnh. Không bắt chọn lại!

1B. HỎI THÔNG TIN CHUNG, TIỆN ÍCH NHÀ HÀNG & KHẢ NĂNG CỦA TRỢ LÝ AI:
- Khi khách hỏi: "bạn có thể làm được gì", giờ mở cửa, chỗ đậu xe ô tô, phòng VIP, ghế trẻ em, tổ chức sinh nhật, xuất hóa đơn đỏ VAT, tích điểm thành viên:
  + TUYỆT ĐỐI KHÔNG GỌI \`searchMenu\` và KHÔNG ĐƯỢC trả lời "Hiện tại AVORA chưa có món... trong thực đơn"!
  + Gọi \`getRestaurantInfo\` với \`topic\` tương ứng và trả lời ngắn gọn, lịch sự.

2. HÌNH THỨC PHỤC VỤ (GIAO HÀNG HOẶC TỰ ĐẾN LẤY):
- NẾU KHÁCH NÓI "tự đến lấy", "mang về", "qua quán lấy", "takeaway", "lấy tại quán": BẮT BUỘC gọi \`previewOrder\` với \`fulfillmentType: 'TAKEAWAY'\`. Phí ship TỰ ĐỘNG = 0đ, TUYỆT ĐỐI KHÔNG bắt khách chia sẻ vị trí hay hỏi địa chỉ nhận hàng!
- NẾU KHÁCH GIAO HÀNG (DELIVERY) mà chưa có địa chỉ: Hướng dẫn khách bấm nút "📍 Chia sẻ vị trí của tôi" trên khung chat.
- Khi nhận được tin nhắn vị trí từ hệ thống (Vị trí của khách hàng là vĩ độ X, kinh độ Y), BẮT BUỘC gọi ngay \`validateDeliveryAddress\` để máy chủ tự động quy đổi địa chỉ và tính phí giao hàng chính xác!

3. KHUNG GIỜ NHẬN ĐƠN (SLOTS):
- BẮT BUỘC gọi \`getAvailableOrderSlots\`. Máy chủ sẽ tự động tính toán chi nhánh và khung giờ khả dụng cho ngày hôm nay hoặc ngày mai. Luôn có khung giờ khả dụng, TUYỆT ĐỐI KHÔNG báo lỗi khung giờ!
- Nếu khách nói giờ cụ thể (VD: "11h45", "12h trưa", "7h tối"), truyền \`requestedTime\` vào tool để hệ thống tự chọn slot gần nhất. Luôn hỗ trợ "Giao ngay (ASAP 30-45 phút)".

4. TINH GỌN THÔNG TIN:
- Tận dụng họ tên và SĐT có sẵn trong hồ sơ, không hỏi lại.
- Khi đã đủ thông tin, BẮT BUỘC gọi \`previewOrder\` để đọc tổng thanh toán chuẩn từ máy chủ.
- CHỈ KHI KHÁCH XÁC NHẬN ĐỒNG Ý ĐẶT thì mới gọi \`placeOrder\` để tạo đơn hàng.

5. ĐẶT BÀN NHÀ HÀNG (TABLE RESERVATION):
- BẮT BUỘC gọi \`getReservationSlots\` với chi nhánh, ngày và số khách để kiểm tra slot khả dụng.
- Khi đủ thông tin: BẮT BUỘC gọi \`previewReservation\` để hệ thống tóm tắt thông tin đặt bàn.
- CHỈ KHI KHÁCH NÓI ĐỒNG Ý / XÁC NHẬN thì mới gọi \`createReservation\` để tạo đơn đặt bàn chính thức.

[QUY TẮC BẤT DI BẤT DỊCH]:
- Xưng "em", gọi khách là "quý khách". TUYỆT ĐỐI KHÔNG lặp lại tên/username của khách gây phiền toái.
- NGUYÊN TẮC BẮT BUỘC SỐ 1 - KHÔNG BAO GIỜ BỊA THỰC ĐƠN: TUYỆT ĐỐI KHÔNG khẳng định một món có bán nếu không tìm thấy trong kết quả gọi searchMenu. Nếu khách hỏi món không có trong thực đơn, BẮT BUỘC phản hồi lịch sự từ chối: "Hiện tại AVORA chưa có món này trong thực đơn. Bạn có thể cho mình biết bạn thích món có nguyên liệu hoặc hương vị nào để mình gợi ý những món đang có tại nhà hàng nhé."
- KHI ĐẶT ĐƠN THANH TOÁN CHUYỂN KHOẢN SEPAY: Nhắc khách hoàn tất quét mã QR SePay, và ngay khi thanh toán thành công bếp sẽ bắt đầu chế biến nóng sốt và giao tận nơi (không nói bếp đang nấu sẵn khi chưa thanh toán).
- TUYỆT ĐỐI KHÔNG tự bịa giá tiền, mã voucher, món ăn hay số bàn.
- Trả lời ngắn gọn, súc tích (1-2 câu ngắn), thích hợp cho đàm thoại giọng nói.
- TUYỆT ĐỐI KHÔNG đọc JSON, tên hàm, mã code hoặc thông báo kỹ thuật ra giọng nói.
- Nếu khách chào tạm biệt hoặc xin dừng cuộc gọi, gọi hàm \`stopVoice\`.
- Nếu khách giận dữ hoặc yêu cầu gặp người thật, gọi hàm \`handoffToHuman\`.`,
                },
              ],
            },
            tools: [{ functionDeclarations: ALL_CHATBOT_TOOL_DECLARATIONS }],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: 'Aoede',
                  },
                },
              },
            },
          },
        };
        ws.send(JSON.stringify(setupMessage));
        client.emit('system', { type: 'ready' });
      });

      ws.on('message', async (data: any) => {
        try {
          const msg = JSON.parse(data.toString());

          if (msg.error) {
            this.logger.error(`Gemini Error: ${JSON.stringify(msg)}`);
          }

          // Xử lý ngắt lời (Barge-in): Khi Gemini Live phát hiện người dùng nói đè
          if (msg.serverContent?.interrupted) {
            this.logger.log(`[Gemini] User interrupted/barge-in for client ${client.id}`);
            const context = this.userContexts.get(client.id);
            if (context) context.audioGeneration += 1;
            client.emit('barge_in', { generation: context?.audioGeneration || 0 });
          }

          if (msg.serverContent) {
            const context = this.userContexts.get(client.id);

            // Kiểm tra real-time input audio transcription từ Gemini Live (lời nói người dùng)
            const inTrans = msg.serverContent.inputAudioTranscription?.text || msg.serverContent.inputTranscription?.text;
            if (inTrans) {
              client.emit('transcript', { role: 'user', text: inTrans });
              if (context) {
                (context as any).currentUserTurnText = ((context as any).currentUserTurnText || '') + inTrans;
              }
            }

            // Kiểm tra real-time output audio transcription từ Gemini Live
            const outTrans = msg.serverContent.outputAudioTranscription?.text || msg.serverContent.outputTranscription?.text;
            if (outTrans) {
              // Flush user spoken transcript to DB before AI turn starts
              if (context && (context as any).currentUserTurnText && (context as any).currentUserTurnText.trim() && context.sessionId) {
                const userSpoken = (context as any).currentUserTurnText.trim();
                (context as any).lastUserQuery = userSpoken;
                (context as any).currentUserTurnText = '';
                this.prisma.chatMessage
                  .create({
                    data: {
                      sessionId: context.sessionId,
                      senderType: 'USER',
                      content: userSpoken,
                    },
                  })
                  .catch((err) => this.logger.error('Failed to save User spoken text to database:', err));
              }

              client.emit('transcript', { role: 'model', text: outTrans });
              if (context) {
                (context as any).currentAiTurnText = ((context as any).currentAiTurnText || '') + outTrans;
              }
            }

            const modelTurn = msg.serverContent.modelTurn;
            if (modelTurn && modelTurn.parts) {
              for (const part of modelTurn.parts) {
                if (part.text) {
                  const textData = part.text;
                  client.emit('transcript', { role: 'model', text: textData });
                  if (context) {
                    (context as any).currentAiTurnText = ((context as any).currentAiTurnText || '') + textData;
                  }
                }
                if (part.inlineData && part.inlineData.mimeType.startsWith('audio/')) {
                  const audioData = part.inlineData.data;
                  client.emit('audio_output', {
                    data: audioData,
                    generation: context?.audioGeneration || 0,
                  });
                }
              }
            }
            if (msg.serverContent.turnComplete) {
              if (context && (context as any).currentUserTurnText && (context as any).currentUserTurnText.trim() && context.sessionId) {
                const userSpoken = (context as any).currentUserTurnText.trim();
                (context as any).lastUserQuery = userSpoken;
                (context as any).currentUserTurnText = '';
                try {
                  await this.prisma.chatMessage.create({
                    data: {
                      sessionId: context.sessionId,
                      senderType: 'USER',
                      content: userSpoken,
                    },
                  });
                } catch (saveErr) {
                  this.logger.error('Failed to save User spoken text to database:', saveErr);
                }
              }

              if (context && (context as any).currentAiTurnText && (context as any).currentAiTurnText.trim() && context.sessionId) {
                const turnText = (context as any).currentAiTurnText.trim();
                (context as any).currentAiTurnText = '';
                const lastUserQuery = (context as any).lastUserQuery || '';
                const verified = await this.verifyAndGroundVoiceTurn(
                  lastUserQuery,
                  turnText,
                  context.branchId,
                );
                if (verified.wasHallucinationPrevented) {
                  client.emit('transcript_verified', {
                    role: 'model',
                    text: verified.verifiedText,
                    wasHallucinationPrevented: true,
                  });
                  client.emit('rich_action', {
                    content: verified.verifiedText,
                    actionType: verified.verifiedProducts.length > 0 ? 'SHOW_PRODUCT' : null,
                    actionPayload:
                      verified.verifiedProducts.length > 0
                        ? JSON.stringify({
                            products: verified.verifiedProducts.slice(0, 4).map((p) => ({
                              id: p.id,
                              name: p.name,
                              slug: p.slug,
                              price: p.flashSalePrice || p.price,
                              originalPrice: p.price,
                              category: p.categoryName,
                            })),
                          })
                        : null,
                    suggestedReplies: ['Xem thực đơn chi tiết', 'Gợi ý món bán chạy nhất'],
                  });
                }
                try {
                  await this.prisma.chatMessage.create({
                    data: {
                      sessionId: context.sessionId,
                      senderType: 'AI',
                      content: verified.verifiedText,
                    },
                  });
                } catch (saveErr) {
                  this.logger.error('Failed to save AI spoken text to database:', saveErr);
                }
              }

              if (context?.isExecutingTool) {
                this.logger.log(`Gemini turn complete for ${client.id} ignored because tool is executing`);
              } else {
                this.logger.log(`Gemini turn complete for ${client.id}`);
                client.emit('turn_complete');
              }
            }
          }

          // Xử lý Tool Calling thời gian thực từ Gemini Live
          if (msg.toolCall && msg.toolCall.functionCalls) {
            const context = this.userContexts.get(client.id);
            if (context) {
              context.isExecutingTool = true;
              if ((context as any).currentUserTurnText && (context as any).currentUserTurnText.trim() && context.sessionId) {
                const userSpoken = (context as any).currentUserTurnText.trim();
                (context as any).lastUserQuery = userSpoken;
                (context as any).currentUserTurnText = '';
                this.prisma.chatMessage
                  .create({
                    data: {
                      sessionId: context.sessionId,
                      senderType: 'USER',
                      content: userSpoken,
                    },
                  })
                  .catch((err) => this.logger.error('Failed to save User spoken text before tool call:', err));
              }
            }
            const functionResponses: any[] = [];

            for (const functionCall of msg.toolCall.functionCalls) {
              this.logger.log(`[Voice] Received function call: ${functionCall.name}`);
              client.emit('tool_call', { name: functionCall.name, args: functionCall.args });

              // Gọi qua ChatbotService (được uỷ quyền trực tiếp tới ChatbotToolEngineService)
              const result = await this.chatbotService.executeToolCall(
                functionCall,
                context?.userId,
                context?.branchId,
                context?.cartTotal,
                context?.sessionId,
                (context as any)?.cartItems,
              );

              // Gửi rich action về UI để cập nhật màn hình
              if (result.lastActionType || result.content || result.suggestedReplies) {
                client.emit('rich_action', {
                  content: result.content || null,
                  actionType: result.lastActionType || null,
                  actionPayload: result.lastActionPayload || null,
                  suggestedReplies: result.suggestedReplies || null,
                });

                // Lưu lại hành động của AI vào Database để không bao giờ mất lịch sử chốt đơn
                if (context?.sessionId) {
                  try {
                    await this.prisma.chatMessage.create({
                      data: {
                        sessionId: context.sessionId,
                        senderType: 'AI',
                        content: result.content || (result.lastActionType === 'ORDER_PREVIEW' ? 'Bản xem trước đơn hàng' : result.lastActionType === 'SHOW_ORDER_SUCCESS' ? 'Xác nhận đặt hàng thành công' : ''),
                        actionType: (result.lastActionType as any) || null,
                        actionPayload: result.lastActionPayload || null,
                      },
                    });
                  } catch (saveErr) {
                    this.logger.error('Failed to save AI tool action to database:', saveErr);
                  }
                }
              }

              functionResponses.push({
                id: functionCall.id,
                name: functionCall.name,
                response: { result: result.functionResult },
              });
            }

            // Gửi kết quả tool về lại Gemini Live
            const toolResponseMsg = {
              toolResponse: {
                functionResponses: functionResponses,
              },
            };
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(toolResponseMsg));

            setTimeout(() => {
              if (context) context.isExecutingTool = false;
            }, 1000);
          }
        } catch (err) {
          this.logger.error('Error processing Gemini message', err);
        }
      });

      ws.on('close', (code, reason) => {
        const reasonStr = reason.toString();
        this.logger.log(`Gemini Live disconnected for client ${client.id} - Code: ${code}, Reason: ${reasonStr}`);
        if (code !== 1000) {
          this.chatbotService.reportApiKeyError(apiKeyIndex, { status: code === 1008 ? 429 : 503, message: reasonStr });
        }
        client.emit('voice_error', {
          code: 'UPSTREAM_CLOSED',
          message: `Gemini closed (Code: ${code})`,
          retryable: code !== 1000,
        });
        if (client.connected) client.disconnect(true);
      });

      ws.on('error', (err) => {
        this.logger.error(`Gemini WS Error for ${client.id}:`, err);
        this.chatbotService.reportApiKeyError(apiKeyIndex, err);
      });

      this.geminiConnections.set(client.id, ws);
    } catch (err: any) {
      this.logger.error('Error handling connection', err);
      client.emit('error', 'Connection failed');
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const ws = this.geminiConnections.get(client.id);
    if (ws) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close();
      this.geminiConnections.delete(client.id);
    }
    this.userContexts.delete(client.id);
  }

  private getOpenUpstream(client: Socket): WebSocket | null {
    const upstream = this.geminiConnections.get(client.id);
    return upstream?.readyState === WebSocket.OPEN ? upstream : null;
  }

  private validateClientContent(body: unknown): VoiceClientContent {
    if (!body || typeof body !== 'object') throw new Error('Invalid client content payload');
    const input = body as Record<string, unknown>;
    const turnComplete = input.turnComplete;
    if (turnComplete !== undefined && typeof turnComplete !== 'boolean') {
      throw new Error('turnComplete must be boolean');
    }

    const rawTurns = input.turns;
    if (rawTurns === undefined) return { turnComplete: turnComplete as boolean | undefined };
    if (!Array.isArray(rawTurns) || rawTurns.length > 1) throw new Error('Invalid turns payload');

    const turns = rawTurns.map((rawTurn) => {
      if (!rawTurn || typeof rawTurn !== 'object') throw new Error('Invalid turn');
      const turn = rawTurn as Record<string, unknown>;
      if (turn.role !== 'user' || !Array.isArray(turn.parts) || turn.parts.length === 0) {
        throw new Error('Only user text turns are allowed');
      }
      const parts = turn.parts.map((rawPart) => {
        if (!rawPart || typeof rawPart !== 'object') throw new Error('Invalid turn part');
        const text = (rawPart as Record<string, unknown>).text;
        if (typeof text !== 'string' || text.length === 0 || text.length > 2000) {
          throw new Error('Voice text is invalid or too long');
        }
        return { text };
      });
      return { role: 'user' as const, parts };
    });

    return { turns, turnComplete: turnComplete as boolean | undefined };
  }

  @SubscribeMessage('client_content')
  async handleClientContent(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const context = this.userContexts.get(client.id);
    const upstream = this.getOpenUpstream(client);
    if (!context || !upstream) {
      client.emit('client_content_ack', { accepted: false, code: 'VOICE_NOT_READY', retryable: true });
      return;
    }

    try {
      const content = this.validateClientContent(body);
      const text = content.turns?.flatMap((turn) => turn.parts.map((part) => part.text)).join(' ');
      if (text) {
        (context as any).lastUserQuery = text;
        const persistedContent = /vÄ© Ä‘á»™|kinh Ä‘á»™|latitude|longitude/i.test(text)
          ? '[Voice location shared]'
          : text;
        await this.prisma.chatMessage.create({
          data: { sessionId: context.sessionId, senderType: 'USER', content: persistedContent },
        });

        // Pre-ground text turns sent in Voice mode with MenuGroundingService
        try {
          const queryAnalysis = this.menuGroundingService.analyzeUserQuery(text);
          const groundTruth = await this.menuGroundingService.getGroundTruthMenuContext(
            queryAnalysis,
            context.branchId,
          );
          const groundingBlock = this.menuGroundingService.buildGroundingInstruction(groundTruth);
          if (groundingBlock && content.turns && content.turns[0]?.parts?.[0]) {
            content.turns[0].parts[0].text = `${text}${groundingBlock}`;
          }
        } catch (groundErr) {
          this.logger.warn(`Failed to pre-ground voice client_content: ${groundErr}`);
        }
      }
      upstream.send(JSON.stringify({ clientContent: content }));
      client.emit('client_content_ack', { accepted: true, sessionId: context.sessionId });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Invalid client content';
      client.emit('client_content_ack', { accepted: false, code: 'INVALID_CLIENT_CONTENT', message, retryable: false });
    }
  }

  @SubscribeMessage('audio_input')
  handleAudioInput(@ConnectedSocket() client: Socket, @MessageBody() base64Audio: unknown) {
    const ws = this.getOpenUpstream(client);
    if (typeof base64Audio === 'string' && base64Audio.length <= 64_000 && ws) {
      const msg = {
        realtimeInput: {
          audio: {
            mimeType: 'audio/pcm;rate=16000',
            data: base64Audio,
          },
        },
      };
      ws.send(JSON.stringify(msg));
    }
  }

  @SubscribeMessage('stop_audio')
  handleStopAudio(@ConnectedSocket() client: Socket) {
    const ws = this.getOpenUpstream(client);
    const context = this.userContexts.get(client.id);
    if (!ws || !context) return;

    context.audioGeneration += 1;
    ws.send(JSON.stringify({ clientContent: { turns: [], turnComplete: true } }));
    client.emit('barge_in', { generation: context.audioGeneration });
  }
}
