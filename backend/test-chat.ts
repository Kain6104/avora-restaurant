import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { ChatbotService } from './src/chatbot/chatbot.service';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(ChatbotService);
  try {
    const res = await service.chat(undefined, '24230560-9c19-40cf-9f54-a0c1f0774368', 'Hello');
    console.log(res);
  } catch (e) {
    console.error('ERROR:', e);
  }
  await app.close();
}
run();
