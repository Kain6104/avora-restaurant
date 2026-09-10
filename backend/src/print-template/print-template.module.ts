import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PrintTemplateController } from './print-template.controller';
import { PrintTemplateService } from './print-template.service';
import { PrintTemplateTagsService } from './print-template-tags.service';
import { PrintTemplateValidatorService } from './print-template-validator.service';
import { PrintTemplateSanitizerService } from './print-template-sanitizer.service';
import { PrintTemplateRendererService } from './print-template-renderer.service';

@Module({
  imports: [PrismaModule],
  controllers: [PrintTemplateController],
  providers: [
    PrintTemplateService,
    PrintTemplateTagsService,
    PrintTemplateValidatorService,
    PrintTemplateSanitizerService,
    PrintTemplateRendererService,
  ],
  exports: [PrintTemplateService, PrintTemplateRendererService],
})
export class PrintTemplateModule {}
