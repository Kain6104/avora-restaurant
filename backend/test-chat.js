"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./src/app.module");
const chatbot_service_1 = require("./src/chatbot/chatbot.service");
async function run() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const service = app.get(chatbot_service_1.ChatbotService);
    try {
        const res = await service.chat(undefined, '24230560-9c19-40cf-9f54-a0c1f0774368', 'Hello');
        console.log(res);
    }
    catch (e) {
        console.error('ERROR:', e);
    }
    await app.close();
}
run();
