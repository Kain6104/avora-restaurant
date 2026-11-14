process.env.TZ = 'Asia/Ho_Chi_Minh';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

(BigInt.prototype as any).toJSON = function () {
  const intVal = Number(this);
  return Number.isSafeInteger(intVal) ? intVal : this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/api/uploads/',
  });
  app.use(cookieParser());
  app.enableCors({ 
    origin: true, 
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization, ngrok-skip-browser-warning, x-idempotency-key'
  });
  await app.listen(process.env.PORT ?? 4001);
}
// NestJS server bootstrap entry point
bootstrap();
