import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleGenerativeAI, FunctionDeclaration, SchemaType, Part } from '@google/generative-ai';
import { ChatActionType } from '@prisma/client';

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private genAI: GoogleGenerativeAI;
  private apiKeys: string[] = [];
  private currentKeyIndex = 0;

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
  constructor(private readonly prisma: PrismaService) {
    const envKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
    this.apiKeys = envKeys.split(',').map(k => k.trim()).filter(k => k);
    this.genAI = new GoogleGenerativeAI(this.apiKeys[this.currentKeyIndex] || '');

    this.searchMenuDeclaration = {
      name: 'searchMenu',
      description: 'Tìm món ăn trong thực đơn dựa trên ngân sách (budget), chế độ ăn (dietary), hoặc dị ứng (allergens).',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          query: { type: SchemaType.STRING, description: 'Từ khóa món ăn (VD: sushi, phở...)' },
          budget: { type: SchemaType.NUMBER, description: 'Ngân sách tối đa cho món ăn' },
          dietary: { type: SchemaType.STRING, description: 'Chế độ ăn (VD: chay, vegan, keto, v.v.)' },
          allergens: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: 'Danh sách các chất gây dị ứng' },
        }
      }
    };

    this.addToCartDeclaration = {
      name: 'addToCart',
      description: 'Thêm MỘT món ăn vào giỏ hàng.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          productId: { type: SchemaType.STRING, description: 'ID của món ăn (nếu biết)' },
          productName: { type: SchemaType.STRING, description: 'Tên món ăn (nếu không biết ID)' },
          quantity: { type: SchemaType.NUMBER, description: 'Số lượng muốn thêm (mặc định: 1)' },
        },
      }
    };

    this.addAllToCartDeclaration = {
      name: 'addAllToCart',
      description: 'Thêm NHIỀU món ăn cùng lúc vào giỏ hàng (khi khách nói "thêm tất cả", "thêm các món đó").',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          productIds: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: 'Danh sách ID của các món ăn cần thêm' },
        },
        required: ['productIds'],
      }
    };

    this.checkOrderDeclaration = {
      name: 'checkOrder',
      description: 'Kiểm tra trạng thái đơn hàng. Nếu khách không cung cấp mã đơn hàng, không truyền tham số orderCode.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          orderCode: { type: SchemaType.STRING, description: 'Mã đơn hàng cần kiểm tra' },
        },
      }
    };

    this.checkVoucherDeclaration = {
      name: 'checkVoucher',
      description: 'Kiểm tra mã giảm giá (voucher) hoặc tìm các khuyến mãi hiện có.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          voucherCode: { type: SchemaType.STRING, description: 'Mã voucher khách hàng nhập vào (nếu có)' }
        }
      }
    };

    this.checkRankUpgradeDeclaration = {
      name: 'checkRankUpgrade',
      description: 'Kiểm tra hạng thành viên hiện tại của khách và điều kiện để thăng hạng (cần thêm bao nhiêu chi tiêu).',
      parameters: { type: SchemaType.OBJECT, properties: {} }
    };

    this.navigateDeclaration = {
      name: 'navigate',
      description: 'Chuyển hướng màn hình của người dùng đến trang Giỏ hàng hoặc Chi tiết đơn hàng. TUYỆT ĐỐI KHÔNG dùng để đi đến trang Thanh toán.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          destination: { type: SchemaType.STRING, description: 'Đích đến: CART, hoặc ORDER_DETAILS' },
          orderCode: { type: SchemaType.STRING, description: 'Mã đơn hàng (bắt buộc nếu destination là ORDER_DETAILS)' }
        },
        required: ['destination']
      }
    };

    this.requestLocationDeclaration = {
      name: 'requestLocation',
      description: 'Yêu cầu khách hàng chia sẻ vị trí GPS để tìm chi nhánh gần nhất. GỌI HÀM NÀY ĐẦU TIÊN KHI KHÁCH HỎI TÌM CHI NHÁNH GẦN NHẤT.',
      parameters: { type: SchemaType.OBJECT, properties: {} }
    };

    this.findNearestBranchDeclaration = {
      name: 'findNearestBranch',
      description: 'Tìm chi nhánh gần vị trí khách hàng nhất. Khi có googleMapsUrl trả về, TUYỆT ĐỐI KHÔNG ghi URL đó ra văn bản trả lời mà BẮT BUỘC gọi tiếp hàm sendMapLink để gửi link.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          latitude: { type: SchemaType.NUMBER, description: 'Vĩ độ của khách hàng' },
          longitude: { type: SchemaType.NUMBER, description: 'Kinh độ của khách hàng' }
        },
        required: ['latitude', 'longitude']
      }
    };

    this.getUserAddressDeclaration = {
      name: 'getUserAddress',
      description: 'Kiểm tra xem khách hàng đã có địa chỉ giao hàng mặc định trong hệ thống chưa. GỌI HÀM NÀY ĐẦU TIÊN KHI KHÁCH YÊU CẦU CHỐT ĐƠN.',
      parameters: { type: SchemaType.OBJECT, properties: {} }
    };

    this.stopVoiceDeclaration = {
      name: 'stopVoice',
      description: 'Call this when the user says thank you, goodbye, or explicitly asks you to stop/turn off voice mode.'
    };

    this.sendMapLinkDeclaration = {
      name: 'sendMapLink',
      description: 'Dùng để gửi link bản đồ Google Maps cho khách. BẮT BUỘC gọi hàm này KHI BẠN CẦN CHỈ ĐƯỜNG HOẶC GỬI VỊ TRÍ. Tuyệt đối KHÔNG viết URL hoặc tạo link Markdown trong đoạn hội thoại.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          url: { type: SchemaType.STRING, description: 'Đường dẫn Google Maps' }
        },
        required: ['url']
      }
    };

    this.getAddressFromLocationDeclaration = {
      name: 'getAddressFromLocation',
      description: 'Lấy thông tin địa chỉ từ tọa độ GPS.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          latitude: { type: SchemaType.NUMBER, description: 'Vĩ độ' },
          longitude: { type: SchemaType.NUMBER, description: 'Kinh độ' }
        },
        required: ['latitude', 'longitude']
      }
    };

    this.saveAddressDeclaration = {
      name: 'saveAddress',
      description: 'Lưu thông tin địa chỉ giao hàng vào hệ thống sau khi khách hàng đã cung cấp đủ thông tin. Nếu khách muốn sửa lại thông tin địa chỉ (do khách vừa đọc sai và sửa lại), HÃY TRUYỀN THÊM addressId của địa chỉ đó.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          addressId: { type: SchemaType.STRING, description: 'ID của địa chỉ nếu muốn cập nhật (Tùy chọn)' },
          recipientName: { type: SchemaType.STRING, description: 'Tên người nhận' },
          phone: { type: SchemaType.STRING, description: 'Số điện thoại (10 số)' },
          province: { type: SchemaType.STRING, description: 'Tỉnh/Thành phố' },
          district: { type: SchemaType.STRING, description: 'Quận/Huyện' },
          ward: { type: SchemaType.STRING, description: 'Phường/Xã' },
          streetDetail: { type: SchemaType.STRING, description: 'Số nhà, đường' },
          latitude: { type: SchemaType.NUMBER, description: 'Vĩ độ (nếu có)' },
          longitude: { type: SchemaType.NUMBER, description: 'Kinh độ (nếu có)' }
        },
        required: ['recipientName', 'phone', 'province', 'district', 'ward', 'streetDetail']
      }
    };

    this.autoSuggestVoucherDeclaration = {
      name: 'autoSuggestVoucher',
      description: 'Gợi ý voucher tốt nhất cho đơn hàng. BẮT BUỘC gọi hàm này sau khi khách hàng đã chốt địa chỉ.',
      parameters: { type: SchemaType.OBJECT, properties: {} }
    };

    this.triggerOrderPreviewDeclaration = {
      name: 'triggerOrderPreview',
      description: 'Kích hoạt màn hình xem trước đơn hàng. BẮT BUỘC gọi hàm này sau khi đã chốt địa chỉ VÀ khách đã xác nhận voucher (hoặc không dùng voucher).',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          addressId: { type: SchemaType.STRING, description: 'ID của địa chỉ giao hàng' },
          voucherCode: { type: SchemaType.STRING, description: 'Mã voucher (nếu có)' }
        },
        required: ['addressId']
      }
    };

    this.triggerPlaceOrderDeclaration = {
      name: 'triggerPlaceOrder',
      description: 'Kích hoạt tạo đơn hàng thật sự. BẮT BUỘC gọi hàm này CHỈ SAU KHI khách hàng đã xem ORDER_PREVIEW và đồng ý (xác nhận) đặt hàng.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {},
      }
    };

    this.triggerVoucherOverlayDeclaration = {
      name: 'triggerVoucherOverlay',
      description: 'Khi bạn giới thiệu một mã giảm giá hoặc Flash Sale, gọi hàm này để tung voucher ra giữa màn hình Live của khách.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          voucherCode: { type: SchemaType.STRING, description: 'Mã voucher (ví dụ: FREESHIP, GIAM20K)' }
        },
        required: ['voucherCode']
      }
    };

    this.handoffToHumanDeclaration = {
      name: 'handoffToHuman',
      description: 'Gọi hàm này khi bạn không thể hiểu yêu cầu, khách hàng phàn nàn tức giận, hoặc khách hàng chủ động yêu cầu gặp nhân viên thật.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          reason: { type: SchemaType.STRING, description: 'Lý do chuyển cho nhân viên thật' }
        },
        required: ['reason']
      }
    };
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
      systemInstruction: `Bạn là Host Livestream và Waiter AI chuyên nghiệp của nhà hàng Avora. Bạn đang tương tác trực tiếp với khách hàng qua luồng Live Commerce (có giọng nói/hiển thị màn hình).
Giọng điệu: Ngắn gọn, tự nhiên như người thật đang livestream, thân thiện, cuốn hút. Tính cách: ${personality || 'Thân thiện'}. ${userContext || ''}

[CHỨC NĂNG TƯƠNG TÁC]
- Nếu giới thiệu voucher giảm giá, gọi hàm \`triggerVoucherOverlay\` để tung voucher ra giữa màn hình.
- NẾU KHÁCH TỨC GIẬN, chê đắt phàn nàn gay gắt, HOẶC yêu cầu nói chuyện với người thật, BẮT BUỘC gọi hàm \`handoffToHuman\` ngay lập tức và xin lỗi nhẹ nhàng.

[QUY TẮC CƠ BẢN]
Nếu khách hỏi món, BẮT BUỘC gọi hàm searchMenu. Sau khi có kết quả từ searchMenu, BẮT BUỘC phải viết rõ tên món và giá tiền dưới dạng danh sách (dùng Markdown) trực tiếp trong tin nhắn để khách chọn. Nếu khách hỏi món bán chạy nhất hoặc món ngon, tìm bằng từ khóa "bestseller".
Tuyệt đối không tự bịa mã giảm giá, không tự bịa món ăn, không tự bịa chi nhánh. KHÔNG BAO GIỜ tự tính giá tiền, voucher hay phí ship.
Bạn CÓ ĐẦY ĐỦ CHỨC NĂNG thêm/xóa/giảm món vào giỏ hàng! Khách yêu cầu thì tự động dùng tool addToCart, updateCartItem. Báo khách biết đã cập nhật thành công.

[QUY TRÌNH CHỐT ĐƠN] (KHI KHÁCH NÓI "CHỐT ĐƠN", "THANH TOÁN")
1. BẮT BUỘC gọi getUserAddress. Nếu có, hỏi khách muốn dùng không. Không đồng ý thì qua bước 2.
2. Không có địa chỉ: gọi requestLocation. Có GPS -> gọi getAddressFromLocation. Thiếu thông tin thì hỏi khách (SĐT phải 10 số, không tự bịa số 0). Đọc lại thông tin -> khách "OK" -> gọi saveAddress.
3. Có addressId, BẮT BUỘC gọi triggerOrderPreview. Chỉ trả lời "Em đang tạo bản xem trước ạ...".
4. Khách xác nhận đồng ý -> BẮT BUỘC gọi triggerPlaceOrder.

TUYỆT ĐỐI QUAN TRỌNG: Chỉ dùng tool, không tự trả lời bằng văn bản dài dòng. Nếu dùng tool, câu trả lời bằng văn bản phải cực ngắn (dưới 20 chữ) như đang dẫn chương trình live. TUYỆT ĐỐI KHÔNG ghi bất kỳ đường link, URL hay thẻ Markdown chứa link nào ra văn bản trả lời, VÌ HỆ THỐNG GIỌNG NÓI SẼ ĐỌC LÊN RẤT DÀI (ví dụ: tuyệt đối không ghi "https://..."). Khi cần gửi bản đồ, BẮT BUỘC dùng tool \`sendMapLink\` và chỉ trả lời bằng chữ: "Dạ em gửi vị trí vào khung chat cho mình rồi ạ".`,
      tools: [{
        functionDeclarations: [
          this.searchMenuDeclaration,
          this.addToCartDeclaration,
          this.addAllToCartDeclaration,
          this.updateCartItemDeclaration,
          this.checkOrderDeclaration,
          this.checkVoucherDeclaration,
          this.checkRankUpgradeDeclaration,
          this.navigateDeclaration,
          this.requestLocationDeclaration,
          this.findNearestBranchDeclaration,
          this.getUserAddressDeclaration,
          this.getAddressFromLocationDeclaration,
          this.saveAddressDeclaration,
          this.autoSuggestVoucherDeclaration,
          this.triggerOrderPreviewDeclaration,
          this.triggerPlaceOrderDeclaration,
          this.stopVoiceDeclaration,
          this.triggerVoucherOverlayDeclaration,
          this.handoffToHumanDeclaration,
          this.sendMapLinkDeclaration
        ],
      }],
    });
  }

  private async sendMessageWithRetry(chat: any, payload: any[], history: any[], personality?: string, userContext?: string) {
    let result;
    let retries = this.apiKeys.length; // Try all keys
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

  async chat(userId: string | undefined, sessionId: string | undefined, message: string, branchId?: string, clientHistory?: any[], personality?: string, cartTotal?: number, cartSummary?: string) {
    // 1. Garbage Collection (Delete messages older than 2 days)
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    try {
      await this.prisma.chatMessage.deleteMany({
        where: { createdAt: { lt: twoDaysAgo } }
      });
    } catch (e) {
      console.error('GC error', e);
    }

    // 2. Fetch User Profile
    let userContext = cartSummary ? `[THÔNG TIN GIỎ HÀNG: ${cartSummary}] ` : '';
    if (userId) {
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          include: { membershipTier: true, _count: { select: { orders: true } } }
        });
        if (user) {
          userContext = `THÔNG TIN KHÁCH HÀNG: Tên: ${user.fullName || 'Khách'}, Hạng thẻ: ${user.membershipTier?.name || 'Mới'}, Số đơn đã đặt: ${user._count.orders}. Xưng hô thân mật bằng tên của khách nếu phù hợp.`;
        }
      } catch (e) {
        console.error('Error fetching user context:', e);
      }
    }

    // 3. Load Session (Only if logged in)
    let session: any = null;
    let autoLoadedSession = false;

    if (userId) {
      if (sessionId) {
        session = await this.prisma.chatSession.findUnique({
          where: { id: sessionId },
          include: { messages: { orderBy: { createdAt: 'asc' } } }
        });
      }

      if (!session) {
        // Auto-load most recent session for this user
        session = await this.prisma.chatSession.findFirst({
          where: { userId: userId },
          orderBy: { createdAt: 'desc' },
          include: { messages: { orderBy: { createdAt: 'asc' } } }
        });

        if (session) {
          autoLoadedSession = true;
        } else {
          const newSession = await this.prisma.chatSession.create({
            data: {
              userId: userId,
              title: message.substring(0, 50),
            }
          });
          session = { ...newSession, messages: [] };
        }
      }
    } else {
      // Guest: in-memory session only
      session = { id: sessionId || 'guest-session', messages: clientHistory || [] };
    }

    // 4. Convert history for Gemini with Sliding Window
    const rawHistory = session.messages.filter((m: any) => ['USER', 'AI', 'TOOL'].includes(m.senderType));

    // SLIDING WINDOW: Keep last ~6 messages to save tokens. Ensure it starts with a USER message.
    let startIndex = Math.max(0, rawHistory.length - 6);
    while (startIndex < rawHistory.length && rawHistory[startIndex].senderType !== 'USER') {
      startIndex++;
    }
    const recentMessages = rawHistory.slice(startIndex);

    const history = recentMessages
      .map((m: any) => {
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
          parts = [{ functionResponse: { name: m.functionName as string, response: m.actionPayload ? JSON.parse(m.actionPayload) : {} } }];
        }

        return { role, parts };
      });

    // 3. Save User Message
    const userMessage = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      senderType: 'USER',
      content: message,
      createdAt: new Date().toISOString()
    };

    if (userId) {
      await this.prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          senderType: 'USER',
          content: message,
        }
      });
    }
    session.messages.push(userMessage);

    // 5. Start Gemini Chat
    let currentModel = this.getModel(personality, userContext);
    let chat = currentModel.startChat({ history });

    let result;
    try {
      const retryRes = await this.sendMessageWithRetry(chat, [{ text: message }], history, personality, userContext);
      result = retryRes.result;
      chat = retryRes.newChat;
    } catch (error: any) {
      // If the very first message fails completely, we delete the user message we just saved so the state isn't broken
      if (userId) {
        await this.prisma.chatMessage.delete({ where: { id: userMessage.id } }).catch(() => { });
      }
      throw error;
    }

    let lastActionType: ChatActionType | null = null;
    let lastActionPayload: string | null = null;

    let functionCalls = typeof result.response.functionCalls === 'function'
      ? result.response.functionCalls()
      : result.response.functionCalls;


    while (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];

      // Save AI function call
      const toolCallMessage = {
        id: crypto.randomUUID(),
        sessionId: session.id,
        senderType: 'AI',
        functionName: call.name,
        actionPayload: JSON.stringify(call.args),
        createdAt: new Date().toISOString()
      };

      if (userId) {
        await this.prisma.chatMessage.create({
          data: {
            sessionId: session.id,
            senderType: 'AI',
            content: '',
            functionName: call.name,
            actionPayload: JSON.stringify(call.args),
          }
        });
      }
      session.messages.push(toolCallMessage);

      // Execute backend function
      const { functionResult, lastActionType: type, lastActionPayload: payload } = await this.executeToolCall(call, userId, branchId, cartTotal);
      if (type) lastActionType = type;
      if (payload) lastActionPayload = payload;

      // Save tool response
      const toolResponseMessage = {
        id: crypto.randomUUID(),
        sessionId: session.id,
        senderType: 'TOOL',
        functionName: call.name,
        actionPayload: JSON.stringify(functionResult),
        createdAt: new Date().toISOString()
      };

      if (userId) {
        await this.prisma.chatMessage.create({
          data: {
            sessionId: session.id,
            senderType: 'TOOL',
            content: '',
            functionName: call.name,
            actionPayload: JSON.stringify(functionResult),
          }
        });
      }
      session.messages.push(toolResponseMessage);

      // Send result back to Gemini
      try {
        const retryRes = await this.sendMessageWithRetry(chat, [{
          functionResponse: {
            name: call.name,
            response: functionResult,
          }
        }], history, personality, userContext);
        result = retryRes.result;
        chat = retryRes.newChat;
      } catch (error: any) {
        // If it fails here, we throw and let the frontend show the error
        throw error;
      }

      functionCalls = typeof result.response.functionCalls === 'function'
        ? result.response.functionCalls()
        : result.response.functionCalls;
    }

    // 5. Final Message and Rich UI
    let textResponse = '';
    try {
      textResponse = result.response.text();
    } catch (e) {
      console.error('Error getting text response:', e);
    }

    // Fallback if AI gets stuck
    if (!textResponse) {
      if (lastActionType) {
        textResponse = 'Tôi đã chuẩn bị kết quả bên dưới cho bạn nhé:';
      } else {
        textResponse = 'Xin lỗi, tôi chưa hiểu rõ yêu cầu của bạn. Bạn có thể nói rõ hơn được không?';
      }
    }

    const finalMessage: any = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      senderType: 'AI',
      content: textResponse,
      actionType: lastActionType,
      actionPayload: lastActionPayload,
      createdAt: new Date().toISOString()
    };

    if (userId) {
      const savedMessage = await this.prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          senderType: 'AI',
          content: textResponse,
          actionType: lastActionType,
          actionPayload: lastActionPayload,
        }
      });
      finalMessage.id = savedMessage.id;
      finalMessage.createdAt = savedMessage.createdAt;
    }
    session.messages.push(finalMessage);

    return {
      ...finalMessage,
      sessionMessages: (!userId || autoLoadedSession) ? session.messages : undefined
    };
  }

  public async executeToolCall(call: any, userId?: string, branchId?: string, cartTotal?: number) {
    let functionResult: any = {};
    let lastActionType: ChatActionType | null = null;
    let lastActionPayload: string | null = null;
    let content: string | null = null;
    let suggestedReplies: string[] | null = null;

    if (call.name === 'searchMenu') {
      const args = call.args as any;
      functionResult = await this.executeSearchMenu(args.query, args.budget, args.dietary, args.allergens, branchId);
      lastActionType = 'SHOW_PRODUCT';
      lastActionPayload = JSON.stringify({
        isSuggestion: functionResult.suggestChangeBranch || false,
        suggestedBranches: functionResult.suggestedBranches || [],
        products: functionResult.results
      });
    } else if (call.name === 'addToCart') {
      const args = call.args as any;
      let productId = args.productId;
      if (!productId && args.productName) {
        const product = await this.prisma.product.findFirst({
          where: { name: { contains: args.productName } }
        });
        if (product) productId = product.id;
      }

      if (!productId) {
        functionResult = { error: 'Không tìm thấy món ăn này. Vui lòng kiểm tra lại tên món.' };
      } else {
        if (!args.quantity) args.quantity = 1;
        functionResult = { success: true, message: 'Added to cart successfully' };
        lastActionType = 'ADD_TO_CART';
        lastActionPayload = JSON.stringify({ productId, quantity: args.quantity });
      }
    } else if (call.name === 'updateCartItem') {
      const args = call.args as any;
      functionResult = { success: true, message: `Đã cập nhật giỏ hàng: ${args.productName} -> số lượng: ${args.quantity}` };
      lastActionType = 'UPDATE_CART' as any;
      lastActionPayload = JSON.stringify({ productName: args.productName, quantity: args.quantity });
    } else if (call.name === 'addAllToCart') {
      const args = call.args as any;
      functionResult = { success: true, message: 'Added all to cart successfully' };
      lastActionType = 'ADD_ALL_TO_CART';
      lastActionPayload = JSON.stringify({ products: (args.productIds || []).map(id => ({ id })) });
    } else if (call.name === 'checkOrder') {
      const args = call.args as any;
      if (args.orderCode) {
        const order = await this.prisma.order.findFirst({
          where: { orderCode: args.orderCode },
          select: { status: true, totalAmount: true }
        });
        functionResult = order ? { status: order.status, total: order.totalAmount } : { error: 'Không tìm thấy đơn hàng' };
      } else if (userId) {
        const order = await this.prisma.order.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          select: { orderCode: true, status: true, totalAmount: true }
        });
        functionResult = order ? { orderCode: order.orderCode, status: order.status, total: order.totalAmount } : { error: 'Bạn chưa có đơn hàng nào' };
      } else {
        functionResult = { error: 'Vui lòng cung cấp mã đơn hàng' };
      }
    } else if (call.name === 'checkVoucher') {
      const args = call.args as any;
      functionResult = await this.executeCheckVoucher(args.voucherCode, userId, cartTotal);
      lastActionType = 'SHOW_VOUCHERS';
      lastActionPayload = JSON.stringify(functionResult);
    } else if (call.name === 'checkRankUpgrade') {
      functionResult = await this.executeCheckRankUpgrade(userId);
    } else if (call.name === 'navigate') {
      const args = call.args as any;
      functionResult = { success: true, message: 'Đã ra lệnh chuyển hướng.' };
      lastActionType = 'NAVIGATE';
      lastActionPayload = JSON.stringify({ destination: args.destination, orderCode: args.orderCode });
    } else if (call.name === 'requestLocation') {
      functionResult = { success: true, message: 'Đã gửi yêu cầu vị trí.' };
      lastActionType = 'REQUEST_LOCATION';
    } else if (call.name === 'findNearestBranch') {
      const args = call.args as any;
      functionResult = await this.executeFindNearestBranch(args.latitude, args.longitude);
    } else if (call.name === 'getUserAddress') {
      if (!userId) {
        functionResult = { hasAddress: false, message: 'Vui lòng đăng nhập để kiểm tra địa chỉ.' };
      } else {
        const address = await this.prisma.address.findFirst({
          where: { userId, isDefault: true }
        });
        if (address) {
          functionResult = {
            hasAddress: true,
            addressId: address.id,
            recipientName: address.recipientName,
            phone: address.phone,
            province: address.province,
            district: address.district,
            ward: address.ward,
            streetDetail: address.streetDetail
          };
          content = `THÔNG TIN ĐỊA CHỈ:\nNgười nhận: ${address.recipientName} - SĐT: ${address.phone}\nĐịa chỉ: ${address.streetDetail}, ${address.ward}, ${address.district}, ${address.province}\n\nBạn có muốn dùng địa chỉ này không?`;
          suggestedReplies = ["Ok", "Không"];
        } else {
          functionResult = { hasAddress: false };
        }
      }
    } else if (call.name === 'getAddressFromLocation') {
      const args = call.args as any;
      functionResult = await this.executeGetAddressFromLocation(args.latitude, args.longitude);
      if (!functionResult.error) {
        content = `GỢI Ý ĐỊA CHỈ:\nĐịa chỉ: ${functionResult.streetDetail}, ${functionResult.ward}, ${functionResult.district}, ${functionResult.province}`;
      }
    } else if (call.name === 'saveAddress') {
      const args = call.args as any;
      if (!userId) {
        functionResult = { error: 'Vui lòng đăng nhập để lưu địa chỉ.' };
      } else {
        let addressId = args.addressId;
        if (addressId) {
          await this.prisma.address.update({
            where: { id: addressId },
            data: {
              recipientName: args.recipientName,
              phone: args.phone,
              province: args.province,
              district: args.district,
              ward: args.ward,
              streetDetail: args.streetDetail,
              latitude: args.latitude,
              longitude: args.longitude,
            }
          });
        } else {
          const newAddress = await this.prisma.address.create({
            data: {
              userId,
              recipientName: args.recipientName,
              phone: args.phone,
              province: args.province,
              district: args.district,
              ward: args.ward,
              streetDetail: args.streetDetail,
              latitude: args.latitude,
              longitude: args.longitude,
              isDefault: false
            }
          });
          addressId = newAddress.id;
        }
        functionResult = { success: true, addressId: addressId };
        content = `ĐÃ LƯU ĐỊA CHỈ THÀNH CÔNG!\nNgười nhận: ${args.recipientName} - SĐT: ${args.phone}\nĐịa chỉ: ${args.streetDetail}, ${args.ward}, ${args.district}, ${args.province}`;
      }
    } else if (call.name === 'autoSuggestVoucher') {
      functionResult = { success: true };
      lastActionType = 'SUGGEST_VOUCHER' as any;
      content = "Đã gọi autoSuggestVoucher.";
    } else if (call.name === 'triggerOrderPreview') {
      const args = call.args as any;
      if (!cartTotal || cartTotal === 0) {
        functionResult = { error: 'Thất bại: Giỏ hàng đang trống. KHÔNG ĐƯỢC báo là đã tạo bản xem trước. Hãy xin lỗi khách và mời khách chọn thêm món vào giỏ hàng.' };
      } else {
        functionResult = { success: true, message: 'Đã kích hoạt xem trước đơn hàng.' };
        lastActionType = 'ORDER_PREVIEW';
        lastActionPayload = JSON.stringify({ addressId: args.addressId, voucherCode: args.voucherCode });
      }
    } else if (call.name === 'triggerPlaceOrder') {
      functionResult = { success: true, message: 'Đã kích hoạt tạo đơn hàng.' };
      lastActionType = 'PLACE_ORDER';
      lastActionPayload = JSON.stringify({ idempotencyKey: crypto.randomUUID() });
    } else if (call.name === 'stopVoice') {
      functionResult = { success: true };
      lastActionType = 'STOP_VOICE' as any;

    } else if (call.name === 'sendMapLink') {
      const args = call.args as any;
      functionResult = { success: true };
      lastActionType = 'SHOW_MAP_LINK' as any;
      lastActionPayload = args.url;
    }

    return { functionResult, lastActionType, lastActionPayload, content, suggestedReplies };
  }

  async deleteSession(sessionId: string) {
    try {
      await this.prisma.chatMessage.deleteMany({
        where: { sessionId }
      });
      await this.prisma.chatSession.delete({
        where: { id: sessionId }
      });
      return { success: true };
    } catch (e) {
      console.error('Delete session error', e);
      return { success: false };
    }
  }

  public async executeGetAddressFromLocation(lat: number, lng: number) {
    if (!lat || !lng) return { error: 'Thiếu thông tin toạ độ' };
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=vi`, {
        headers: { 'User-Agent': 'AvoraChatbot/1.0' }
      });
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();

      const address = data.address || {};
      const province = address.city || address.state || address.province || '';
      const district = address.suburb || address.county || address.district || '';
      const ward = address.quarter || address.neighbourhood || address.village || address.ward || '';
      const streetDetail = [address.house_number, address.road].filter(Boolean).join(' ') || address.residential || '';

      return {
        province,
        district,
        ward,
        streetDetail,
        latitude: lat,
        longitude: lng,
        rawAddress: data.display_name
      };
    } catch (e) {
      console.error('Lỗi khi lấy địa chỉ từ toạ độ:', e);
      return { error: 'Lấy địa chỉ thất bại. Vui lòng hỏi khách hàng cung cấp chi tiết địa chỉ (Tỉnh, Quận, Phường, Đường).' };
    }
  }

  public async executeFindNearestBranch(lat: number, lng: number) {
    if (!lat || !lng) return { error: 'Thiếu thông tin toạ độ' };
    const branches = await this.prisma.branch.findMany({
      where: { latitude: { not: null }, longitude: { not: null } }
    });

    if (branches.length === 0) return { error: 'Không tìm thấy chi nhánh nào có tọa độ trong hệ thống.' };
    const branchesWithDistance = branches.map(b => {
      const distance = this.calculateDistance(lat, lng, b.latitude!, b.longitude!);
      return { ...b, distance };
    });

    branchesWithDistance.sort((a, b) => a.distance - b.distance);

    // Lấy tối đa 3 chi nhánh gần nhất
    const topBranches = branchesWithDistance.slice(0, 3);
    const speedKmH = 30; // Giả sử tốc độ đi nội thành 30km/h

    const results = topBranches.map(nearest => {
      const timeMinutes = Math.ceil((nearest.distance / speedKmH) * 60);
      return {
        branchName: nearest.name,
        address: `${nearest.street || ''}, ${nearest.ward || ''}, ${nearest.district || ''}, ${nearest.province || ''}`.replace(/^, | ,|, $/g, '').replace(/, ,/g, ','),
        openTime: nearest.openTime,
        closeTime: nearest.closeTime,
        phone: nearest.phone,
        distanceKm: nearest.distance.toFixed(2),
        estimatedTimeMinutes: timeMinutes,
        googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${nearest.latitude},${nearest.longitude}`
      };
    });

    return { branches: results };
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of the earth in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
  }

  private deg2rad(deg: number) {
    return deg * (Math.PI / 180);
  }

  public async executeSearchMenu(query?: string, budget?: number, dietary?: string, allergens?: any[], branchId?: string) {
    try {
      let whereClause: any = { available: true };

      if (branchId) {
        whereClause.branches = {
          some: { id: branchId }
        };
      }

      const q = query?.toLowerCase().replace(/[\s-]/g, '');
      if (q && (q === 'bestseller' || q === 'bánchạy' || q === 'banchay' || q === 'hot' || q === 'nổibật' || q === 'noibat')) {
        // Skip name matching to return generic items
      } else if (query) {
        whereClause.OR = [
          { name: { contains: query } },
          { description: { contains: query } }
        ];
      }

      if (budget) {
        whereClause.price = { lte: budget };
      }

      let products = await this.prisma.product.findMany({
        where: whereClause,
        select: { id: true, name: true, price: true, imageUrl: true },
        take: 6
      });

      if (products.length === 0 && branchId) {
        // Try searching other branches
        const otherBranchClause = { ...whereClause };
        delete otherBranchClause.branches;

        const otherProducts = await this.prisma.product.findMany({
          where: otherBranchClause,
          select: {
            id: true, name: true, price: true, imageUrl: true,
            branches: { select: { id: true, name: true } }
          },
          take: 6
        });

        if (otherProducts.length > 0) {
          const suggestedBranches = otherProducts.flatMap(p => p.branches);
          const uniqueBranches = Array.from(new Map(suggestedBranches.map(b => [b.id, b])).values()).filter(b => b);

          return {
            suggestChangeBranch: true,
            suggestedBranches: uniqueBranches,
            results: otherProducts
          };
        }
      }

      return {
        results: products.length > 0 ? products : [{ message: 'Không tìm thấy món ăn phù hợp với yêu cầu.' }]
      };
    } catch (e) {
      return { error: 'Lỗi khi tìm kiếm món ăn' };
    }
  }

  async getSession(sessionId: string) {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: 'asc' } } }
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    return session;
  }

  public async executeCheckVoucher(code?: string, userId?: string, cartTotal?: number) {
    try {
      const now = new Date();
      let whereClause: any = {};

      if (code) {
        whereClause.code = code;
      } else {
        whereClause.isPublic = true;
      }

      const vouchers = await this.prisma.voucher.findMany({
        where: whereClause,
        include: { membershipTiers: true }
      });

      if (vouchers.length === 0) {
        if (code) return { vouchers: [], error: 'Mã không tồn tại hoặc đã hết hạn.' };
        return { vouchers: [], message: 'Hiện tại Avora chưa có khuyến mãi nào.' };
      }

      let user: any = null;
      if (userId) {
        user = await this.prisma.user.findUnique({ where: { id: userId }, include: { membershipTier: true } });
      }

      const results = await Promise.all(vouchers.map(async (v) => {
        let reasonCode: string | null = null;
        let reasonMessage: string | null = null;

        // Check active / date
        if (!v.isActive) {
          reasonCode = 'INACTIVE';
          reasonMessage = 'Voucher đã bị vô hiệu hóa.';
        } else if (v.startDate > now) {
          reasonCode = 'NOT_STARTED';
          reasonMessage = `Voucher bắt đầu từ ${v.startDate.toLocaleDateString('vi-VN')}.`;
        } else if (v.endDate < now) {
          reasonCode = 'EXPIRED';
          reasonMessage = 'Voucher đã hết hạn.';
        }
        // Check overall usage limit
        else if (v.usageLimit && v.usedCount >= v.usageLimit) {
          reasonCode = 'OUT_OF_USAGE';
          reasonMessage = 'Voucher đã hết lượt sử dụng.';
        }

        // Check membership tier
        else if (v.membershipTiers && v.membershipTiers.length > 0) {
          if (!user) {
            reasonCode = 'LOGIN_REQUIRED';
            reasonMessage = 'Vui lòng đăng nhập để kiểm tra hạng thành viên.';
          } else if (!v.membershipTiers.some((t: any) => t.id === user.membershipTier?.id)) {
            reasonCode = 'TIER_NOT_MET';
            reasonMessage = `Không áp dụng cho hạng thành viên của bạn.`;
          }
        }

        // Check per-user limit
        else if (user && v.usageLimitPerUser) {
          const usedByThisUser = await this.prisma.order.count({
            where: { userId: user.id, voucherId: v.id, status: { not: 'CANCELLED' } }
          });
          if (usedByThisUser >= v.usageLimitPerUser) {
            reasonCode = 'USER_LIMIT_REACHED';
            reasonMessage = 'Bạn đã hết lượt sử dụng mã này.';
          }
        }

        // Check min order value against cart (if cartTotal provided)
        else if (cartTotal !== undefined && v.minOrderValue > cartTotal) {
          reasonCode = 'MIN_ORDER_NOT_MET';
          reasonMessage = `Cần mua thêm ${(v.minOrderValue - cartTotal).toLocaleString('vi-VN')}đ để áp dụng mã này.`;
        }

        return {
          code: v.code,
          title: v.title,
          discountType: v.discountType,
          discountValue: v.discountValue,
          maxDiscount: v.maxDiscount,
          minOrderValue: v.minOrderValue,
          endDate: v.endDate,
          membershipTier: v.membershipTiers && v.membershipTiers.length > 0 ? v.membershipTiers.map((t: any) => t.name).join(', ') : null,
          reasonCode,
          reasonMessage
        };
      }));

      return { vouchers: results };
    } catch (e) {
      console.error("Lỗi kiểm tra voucher:", e);
      return { vouchers: [], error: 'Đã xảy ra lỗi khi tải khuyến mãi.' };
    }
  }

  public async executeCheckRankUpgrade(userId?: string) {
    try {
      if (!userId) {
        return { error: 'Vui lòng đăng nhập để xem thông tin hạng thành viên.' };
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { membershipTier: true }
      });

      if (!user) return { error: 'Không tìm thấy thông tin người dùng.' };

      const allTiers = await this.prisma.membershipTier.findMany({
        orderBy: { minSpending: 'asc' },
        where: { isActive: true }
      });

      const currentTier = user.membershipTier;
      const currentSpending = user.totalSpending;

      const nextTier = allTiers.find(t => t.minSpending > currentSpending);

      return {
        currentTier: currentTier ? currentTier.name : 'Chưa có hạng',
        currentSpending,
        currentPoints: user.currentPoints,
        nextTier: nextTier ? nextTier.name : 'Đã đạt hạng cao nhất',
        spendingNeededForNextTier: nextTier ? nextTier.minSpending - currentSpending : 0
      };
    } catch (e) {
      console.error('Lỗi khi kiểm tra hạng thành viên:', e);
      return { error: 'Đã xảy ra lỗi khi kiểm tra hạng thành viên.' };
    }
  }
}
