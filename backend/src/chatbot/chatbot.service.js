"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ChatbotService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatbotService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const generative_ai_1 = require("@google/generative-ai");
let ChatbotService = ChatbotService_1 = class ChatbotService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(ChatbotService_1.name);
        this.genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
        const searchMenuDeclaration = {
            name: 'searchMenu',
            description: 'Tìm món ăn trong thực đơn dựa trên ngân sách (budget), chế độ ăn (dietary), hoặc dị ứng (allergens).',
            parameters: {
                type: generative_ai_1.SchemaType.OBJECT,
                properties: {
                    query: { type: generative_ai_1.SchemaType.STRING, description: 'Từ khóa món ăn (VD: sushi, phở...)' },
                    budget: { type: generative_ai_1.SchemaType.NUMBER, description: 'Ngân sách tối đa cho món ăn' },
                    dietary: { type: generative_ai_1.SchemaType.STRING, description: 'Chế độ ăn (VD: chay, vegan, keto, v.v.)' },
                    allergens: { type: generative_ai_1.SchemaType.ARRAY, items: { type: generative_ai_1.SchemaType.STRING }, description: 'Danh sách các chất gây dị ứng' },
                }
            }
        };
        const addToCartDeclaration = {
            name: 'addToCart',
            description: 'Thêm một món ăn vào giỏ hàng.',
            parameters: {
                type: generative_ai_1.SchemaType.OBJECT,
                properties: {
                    productId: { type: generative_ai_1.SchemaType.STRING, description: 'ID của món ăn' },
                    quantity: { type: generative_ai_1.SchemaType.NUMBER, description: 'Số lượng muốn thêm' },
                },
                required: ['productId', 'quantity'],
            }
        };
        const checkOrderDeclaration = {
            name: 'checkOrder',
            description: 'Kiểm tra trạng thái đơn hàng.',
            parameters: {
                type: generative_ai_1.SchemaType.OBJECT,
                properties: {
                    orderCode: { type: generative_ai_1.SchemaType.STRING, description: 'Mã đơn hàng cần kiểm tra' },
                },
                required: ['orderCode'],
            }
        };
        this.model = this.genAI.getGenerativeModel({
            model: 'gemini-3.5-flash',
            systemInstruction: 'Bạn là nhân viên tư vấn của nhà hàng Avora. Trả lời ngắn gọn, thân thiện dưới 50 chữ. Nếu khách hỏi món, hãy gọi hàm searchMenu bằng từ khóa. Sau khi có ID món ăn từ searchMenu, mới gọi addToCart nếu khách yêu cầu. KHÔNG ĐƯỢC trả lời trống, luôn phải có văn bản phản hồi khách.',
            tools: [{
                    functionDeclarations: [searchMenuDeclaration, addToCartDeclaration, checkOrderDeclaration],
                }],
        });
    }
    async chat(userId, sessionId, message) {
        // 1. Load Session
        let session = null;
        if (sessionId) {
            session = await this.prisma.chatSession.findUnique({
                where: { id: sessionId },
                include: { messages: { orderBy: { createdAt: 'asc' } } }
            });
        }
        if (!session) {
            const newSession = await this.prisma.chatSession.create({
                data: {
                    userId: userId || null,
                    title: message.substring(0, 50),
                }
            });
            session = Object.assign(Object.assign({}, newSession), { messages: [] });
        }
        // Convert history for Gemini
        const history = session.messages
            .filter((m) => ['USER', 'AI', 'TOOL'].includes(m.senderType))
            .map((m) => {
            let role = 'user';
            if (m.senderType === 'AI')
                role = 'model';
            if (m.senderType === 'TOOL')
                role = 'function';
            let parts = [];
            if (m.senderType === 'USER') {
                parts = [{ text: m.content }];
            }
            else if (m.senderType === 'AI') {
                if (m.functionName && m.actionPayload) {
                    parts = [{ functionCall: { name: m.functionName, args: JSON.parse(m.actionPayload) } }];
                }
                else {
                    parts = [{ text: m.content || '' }];
                }
            }
            else if (m.senderType === 'TOOL') {
                parts = [{ functionResponse: { name: m.functionName, response: m.actionPayload ? JSON.parse(m.actionPayload) : {} } }];
            }
            return { role, parts };
        });
        // 2. Save User Message
        await this.prisma.chatMessage.create({
            data: {
                sessionId: session.id,
                senderType: 'USER',
                content: message,
            }
        });
        // 3. Call Gemini
        const chat = this.model.startChat({
            history,
        });
        // 4. Function Calling Loop
        let result = await chat.sendMessage([{ text: message }]);
        let lastActionType = null;
        let lastActionPayload = null;
        let functionCalls = typeof result.response.functionCalls === 'function'
            ? result.response.functionCalls()
            : result.response.functionCalls;
        while (functionCalls && functionCalls.length > 0) {
            const call = functionCalls[0];
            // Save AI function call
            await this.prisma.chatMessage.create({
                data: {
                    sessionId: session.id,
                    senderType: 'AI',
                    content: '',
                    functionName: call.name,
                    actionPayload: JSON.stringify(call.args),
                }
            });
            // Run backend function
            let functionResult = {};
            if (call.name === 'searchMenu') {
                const args = call.args;
                functionResult = await this.executeSearchMenu(args.query, args.budget, args.dietary, args.allergens);
            }
            else if (call.name === 'addToCart') {
                functionResult = { success: true, message: 'Added to cart successfully' };
                lastActionType = 'ADD_TO_CART';
                lastActionPayload = JSON.stringify(call.args);
            }
            else if (call.name === 'checkOrder') {
                functionResult = { status: 'PENDING', total: 100 };
            }
            // Save tool response
            await this.prisma.chatMessage.create({
                data: {
                    sessionId: session.id,
                    senderType: 'TOOL',
                    content: '',
                    functionName: call.name,
                    actionPayload: JSON.stringify(functionResult),
                }
            });
            // Send result back to Gemini
            result = await chat.sendMessage([{
                    functionResponse: {
                        name: call.name,
                        response: functionResult,
                    }
                }]);
            functionCalls = typeof result.response.functionCalls === 'function'
                ? result.response.functionCalls()
                : result.response.functionCalls;
        }
        // 5. Final Message and Rich UI
        let textResponse = '';
        try {
            textResponse = result.response.text();
        }
        catch (e) {
            console.error('Error getting text response:', e);
        }
        if (!textResponse) {
            if (lastActionType) {
                textResponse = 'Tôi đã chuẩn bị món bạn yêu cầu bên dưới nhé:';
            }
            else {
                textResponse = 'Xin lỗi, tôi chưa hiểu rõ yêu cầu của bạn. Bạn có thể nói rõ hơn được không?';
            }
        }
        const finalMessage = await this.prisma.chatMessage.create({
            data: {
                sessionId: session.id,
                senderType: 'AI',
                content: textResponse,
                actionType: lastActionType,
                actionPayload: lastActionPayload,
            }
        });
        return finalMessage;
    }
    async executeSearchMenu(query, budget, dietary, allergens) {
        try {
            let whereClause = { available: true };
            if (query) {
                whereClause.OR = [
                    { name: { contains: query } },
                    { description: { contains: query } }
                ];
            }
            if (budget) {
                whereClause.price = { lte: budget };
            }
            const products = await this.prisma.product.findMany({
                where: whereClause,
                select: { id: true, name: true, price: true },
                take: 5
            });
            return {
                results: products.length > 0 ? products : [{ message: 'Không tìm thấy món ăn phù hợp với yêu cầu.' }]
            };
        }
        catch (e) {
            return { error: 'Lỗi khi tìm kiếm món ăn' };
        }
    }
    async getSession(sessionId) {
        const session = await this.prisma.chatSession.findUnique({
            where: { id: sessionId },
            include: { messages: { orderBy: { createdAt: 'asc' } } }
        });
        if (!session) {
            throw new common_1.NotFoundException('Session not found');
        }
        return session;
    }
};
exports.ChatbotService = ChatbotService;
exports.ChatbotService = ChatbotService = ChatbotService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ChatbotService);
