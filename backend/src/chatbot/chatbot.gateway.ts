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
import WebSocket from 'ws';

@WebSocketGateway({ namespace: '/voice-chat', cors: { origin: true, credentials: true } })
@Injectable()
export class ChatbotGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatbotGateway.name);
  private geminiConnections: Map<string, WebSocket> = new Map();
  private userContexts: Map<string, any> = new Map();

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatbotService: ChatbotService,
  ) { }

  async handleConnection(client: Socket) {
    try {
      let token = client.handshake.auth?.token || client.handshake.query?.token;
      
      // Attempt to extract token from cookies if not provided directly
      if (!token && client.handshake.headers.cookie) {
        const cookies = client.handshake.headers.cookie.split(';');
        const tokenCookie = cookies.find(c => c.trim().startsWith('token='));
        if (tokenCookie) {
          const cookieVal = tokenCookie.substring(tokenCookie.indexOf('=') + 1).trim();
          token = decodeURIComponent(cookieVal);
        }
      }

      let userId: string | undefined = undefined;
      let userContext = '';

      this.logger.log(`[VoiceAuth] client.handshake.headers.cookie: ${client.handshake.headers.cookie}`);
      this.logger.log(`[VoiceAuth] Extracted token: ${token}`);

      if (token && token !== 'guest' && token !== 'null') {
        try {
          const payload = this.jwtService.verify(token, { secret: 'AVORA_SECRET_2026' });
          userId = payload.sub;
          userContext = `THÔNG TIN KHÁCH HÀNG: UserID: ${userId}`;
          this.logger.log(`Authenticated voice session: userId=${userId}`);
        } catch (e) {
          this.logger.warn(`Invalid/expired JWT for connection ${client.id}: ${e.message}`);
          require('fs').writeFileSync('jwt-error.log', `Error: ${e.message}\nStack: ${e.stack}\nToken: ${token}\nCookie: ${client.handshake.headers.cookie}\n`);
          client.emit('error', 'auth_failed');
          client.disconnect(true);
          return;
        }
      } else {
        this.logger.log(`Guest voice session for connection ${client.id}`);
      }

      const cartSummaryStr = client.handshake.query?.cartSummary as string;
      const cartSummary = cartSummaryStr ? decodeURIComponent(cartSummaryStr) : '';
      if (cartSummary) {
         userContext += ` [THÔNG TIN GIỎ HÀNG: ${cartSummary}]`;
      }

      this.userContexts.set(client.id, { userId, userContext });

      const envKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
      const apiKey = envKeys.split(',')[0]?.trim();
      if (!apiKey) {
        client.emit('error', 'Server missing Gemini API Key');
        client.disconnect();
        return;
      }

      const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
      const ws = new WebSocket(url);

      ws.on('open', () => {
        this.logger.log(`Connected to Gemini Live API for client ${client.id}`);
        // Send setup message
        const setupMessage = {
          setup: {
            model: 'models/gemini-3.1-flash-live-preview',
            systemInstruction: {
              parts: [{
                text: `Bạn là nhân viên tư vấn của nhà hàng Avora qua điện thoại. Trả lời ngắn gọn, thân thiện. TUYỆT ĐỐI KHÔNG BỊA MÓN ĂN. Gợi ý đúng món có trong menu. ${userContext}
Nếu khách hỏi món, gọi hàm searchMenu. Nếu hỏi khuyến mãi, gọi checkVoucher.
Nếu khách yêu cầu thêm món vào giỏ, nếu chưa biết ID thì hãy truyền productName để gọi addToCart. KHÔNG BAO GIỜ từ chối.
QUAN TRỌNG VỀ ĐIỀU HƯỚNG: Chỉ sử dụng hàm navigate nếu khách hàng yêu cầu mở xem Lịch sử Đơn Hàng (ORDER_DETAILS) hoặc mở Giỏ Hàng (CART).
Nếu khách hỏi về hạng thành viên, gọi checkRankUpgrade.
Nếu khách hỏi tìm chi nhánh gần nhất, hoặc các chi nhánh lân cận, TUYỆT ĐỐI KHÔNG TỰ BỊA CHI NHÁNH. Đầu tiên BẮT BUỘC GỌI HÀM requestLocation (công cụ/tool) để xin vị trí, VÀ PHẢI KÈM THEO CÂU NÓI: "Anh/chị vui lòng bấm vào nút chia sẻ vị trí trong đoạn chat để em có thể tìm chi nhánh gần nhất nhé!". Khi đã có vị trí (vĩ độ, kinh độ), BẮT BUỘC gọi hàm findNearestBranch để kiểm tra và tư vấn chi tiết các chi nhánh gần đó.
QUY TRÌNH CHỐT ĐƠN HÀNG (KHI KHÁCH NÓI "CHỐT ĐƠN", "THANH TOÁN", "MUA HÀNG"):
ĐẦU TIÊN BẮT BUỘC kiểm tra trạng thái giỏ hàng (trong thông tin context). Nếu giỏ hàng trống (cartTotal = 0), TUYỆT ĐỐI KHÔNG thực hiện các bước tiếp theo, hãy thông báo khách giỏ hàng trống và tư vấn món ăn.
1. BẮT BUỘC gọi getUserAddress. Nếu có địa chỉ, đọc lại và hỏi khách có muốn dùng không. Chỉ khi khách đồng ý dùng địa chỉ đó thì mới tiếp tục bước 3. Nếu không, chuyển sang bước 2.
2. Nếu không có địa chỉ (hoặc khách muốn dùng địa chỉ mới), BẮT BUỘC GỌI HÀM requestLocation (công cụ/tool). Nhận được GPS, gọi getAddressFromLocation. Hỏi khách cung cấp (nếu thiếu): Tên, SĐT, số nhà/chi tiết. Đọc lại và gọi saveAddress.
3. Khi đã có addressId, BẮT BUỘC gọi autoSuggestVoucher để hệ thống tự tìm mã giảm giá. (TUYỆT ĐỐI KHÔNG GỌI triggerOrderPreview NẾU CHƯA GỌI autoSuggestVoucher VÀ CHƯA HỎI Ý KIẾN KHÁCH VỀ VOUCHER). Đợi khách xác nhận dùng voucher đó, nhập mã khác, hoặc không dùng.
4. BẮT BUỘC gọi triggerOrderPreview (truyền voucherCode nếu khách chốt dùng).
5. Sau đó, màn hình sẽ hiện CHI TIẾT ĐƠN HÀNG, bạn đợi khách xác nhận. Nếu khách "Xác nhận đặt", BẮT BUỘC gọi triggerPlaceOrder.
Nếu khách cảm ơn, chào tạm biệt hoặc yêu cầu tắt chat voice, BẮT BUỘC gọi hàm stopVoice.`
              }]
            },
            tools: [{
              functionDeclarations: [
                this.chatbotService.searchMenuDeclaration,
                this.chatbotService.addToCartDeclaration,
                this.chatbotService.addAllToCartDeclaration,
                this.chatbotService.checkOrderDeclaration,
                this.chatbotService.checkVoucherDeclaration,
                this.chatbotService.checkRankUpgradeDeclaration,
                this.chatbotService.navigateDeclaration,
                this.chatbotService.requestLocationDeclaration,
                this.chatbotService.findNearestBranchDeclaration,
                this.chatbotService.getUserAddressDeclaration,
                this.chatbotService.getAddressFromLocationDeclaration,
                this.chatbotService.saveAddressDeclaration,
                this.chatbotService.autoSuggestVoucherDeclaration,
                this.chatbotService.triggerOrderPreviewDeclaration,
                this.chatbotService.triggerPlaceOrderDeclaration,
                this.chatbotService.stopVoiceDeclaration
              ]
            }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: "Aoede" // Use a friendly voice
                  }
                }
              }
            }
          }
        };
        ws.send(JSON.stringify(setupMessage));
        client.emit('system', { type: 'ready' });
      });

      ws.on('message', async (data: any) => {
        try {
          const msg = JSON.parse(data.toString());
          // Debugging log for any errors or messages returned by Gemini
          if (msg.error) {
            this.logger.error(`Gemini Error: ${JSON.stringify(msg)}`);
          } else if (!msg.serverContent) {
            this.logger.log(`Received non-serverContent from Gemini: ${JSON.stringify(msg)}`);
          } else {
            this.logger.log(`Received serverContent from Gemini: has parts = ${!!msg.serverContent.modelTurn?.parts}`);
          }
          
          if (msg.serverContent) {
            const modelTurn = msg.serverContent.modelTurn;
            if (modelTurn && modelTurn.parts) {
              for (const part of modelTurn.parts) {
                // Send Audio to Client
                if (part.inlineData && part.inlineData.mimeType.startsWith('audio/')) {
                  const audioData = part.inlineData.data;
                  this.logger.log(`[Gemini] Received audio chunk: ${audioData.length} bytes`);
                  this.logger.log(`[VoiceWS] Sending audio_output: ${audioData.length} bytes`);
                  client.emit('audio_output', audioData);
                }
              }
            }
            if (msg.serverContent.turnComplete) {
              const context = this.userContexts.get(client.id);
              if (context?.isExecutingTool) {
                this.logger.log(`Gemini turn complete for ${client.id} ignored because tool is executing`);
              } else {
                this.logger.log(`Gemini turn complete for ${client.id}`);
                client.emit('turn_complete');
              }
            }
          }

          // Handle top-level toolCall (Gemini Live API format)
          if (msg.toolCall && msg.toolCall.functionCalls) {
            const context = this.userContexts.get(client.id);
            if (context) context.isExecutingTool = true;
            const functionResponses: any[] = [];

            for (const functionCall of msg.toolCall.functionCalls) {
              this.logger.log(`Received function call: ${functionCall.name}`);
              client.emit('tool_call', { name: functionCall.name }); // Let UI know we are thinking

              const result = await this.chatbotService.executeToolCall(functionCall, context?.userId);

              // Send rich UI action to client
              if (result.lastActionType || result.content) {
                client.emit('rich_action', {
                  content: result.content || null,
                  actionType: result.lastActionType || null,
                  actionPayload: result.lastActionPayload || null,
                  suggestedReplies: result.suggestedReplies || null
                });
              }

              functionResponses.push({
                id: functionCall.id,
                name: functionCall.name,
                response: { result: result.functionResult }
              });
            }

            // Send response back to Gemini
            const toolResponseMsg = {
              toolResponse: {
                functionResponses: functionResponses
              }
            };
            ws.send(JSON.stringify(toolResponseMsg));
            // Wait 1 second before clearing the flag to ensure any lingering turnComplete from the request is dropped
            setTimeout(() => {
               if (context) context.isExecutingTool = false;
            }, 1000);
          }
        } catch (err) {
          this.logger.error('Error processing Gemini message', err);
        }
      });

      ws.on('close', (code, reason) => {
        this.logger.log(`Gemini Live disconnected for client ${client.id} - Code: ${code}, Reason: ${reason.toString()}`);
        client.emit('error', `Gemini closed: ${reason.toString()} (Code: ${code})`);
        client.disconnect();
      });

      ws.on('error', (err) => {
        this.logger.error(`Gemini WS Error for ${client.id}:`, err);
      });

      this.geminiConnections.set(client.id, ws);
      this.logger.log(`Client connected: ${client.id}`);
    } catch (err) {
      this.logger.error('Gateway Connection Error:', err);
      client.emit('error', 'Gateway Connection Error');
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const ws = this.geminiConnections.get(client.id);
    if (ws) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      this.geminiConnections.delete(client.id);
    }
    this.userContexts.delete(client.id);
  }

  @SubscribeMessage('audio_input')
  handleAudioInput(@ConnectedSocket() client: Socket, @MessageBody() base64Audio: string) {
    if (!this.userContexts.get(`audio_log_${client.id}`)) {
      this.userContexts.set(`audio_log_${client.id}`, true);
    }
    
    // As requested:
    this.logger.log(`[VoiceWS] Received audio_input: ${base64Audio.length} bytes`);

    const ws = this.geminiConnections.get(client.id);
    if (ws && ws.readyState === WebSocket.OPEN) {
      const msg = {
        realtimeInput: {
          audio: {
            mimeType: 'audio/pcm;rate=16000',
            data: base64Audio
          }
        }
      };
      
      this.logger.log(`[Gemini] Sending audio chunk: ${base64Audio.length} bytes`);
      ws.send(JSON.stringify(msg));
    }
  }

  @SubscribeMessage('client_content')
  handleClientContent(@ConnectedSocket() client: Socket, @MessageBody() content: any) {
    this.logger.log(`Client ${client.id} sent client_content: ${JSON.stringify(content)}`);
    const ws = this.geminiConnections.get(client.id);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ clientContent: content }));
    }
  }
}
