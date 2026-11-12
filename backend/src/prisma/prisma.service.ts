import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { invalidateChatbotCaches } from '../chatbot/chatbot-cache.registry';

const CHATBOT_WATCHED_MODELS = new Set([
  'Product',
  'Category',
  'Branch',
  'OptionGroup',
  'OptionItem',
  'FlashSale',
  'FlashSaleItem',
  'Voucher',
]);

const WRITE_ACTIONS = new Set([
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
]);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super();
    if (typeof (this as any).$use === 'function') {
      (this as any).$use(async (params: any, next: (p: any) => Promise<any>) => {
        const result = await next(params);
        if (
          params?.model &&
          CHATBOT_WATCHED_MODELS.has(params.model) &&
          WRITE_ACTIONS.has(params.action)
        ) {
          const scope =
            params.model === 'Branch'
              ? 'BRANCH'
              : params.model === 'Category'
                ? 'CATEGORY'
                : 'MENU';
          invalidateChatbotCaches(scope);
        }
        return result;
      });
    }
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
