import { Injectable, BadRequestException } from '@nestjs/common';
import { PrintTemplateType } from '@prisma/client';
import { PrintTemplateTagsService } from './print-template-tags.service';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

@Injectable()
export class PrintTemplateValidatorService {
  constructor(private tagsService: PrintTemplateTagsService) {}

  validate(
    content: string,
    type?: PrintTemplateType | string,
    paperSize?: string | null,
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!content || typeof content !== 'string') {
      return {
        isValid: false,
        errors: ['Nội dung mẫu in không được để trống'],
        warnings: [],
      };
    }

    // 1. Kiểm tra cặp thẻ lặp {{#items}} ... {{/items}}
    const openItemsMatches = content.match(/\{\{#items\}\}/g) || [];
    const closeItemsMatches = content.match(/\{\{\/items\}\}/g) || [];

    if (openItemsMatches.length !== closeItemsMatches.length) {
      errors.push(
        `Số lượng thẻ mở vòng lặp {{#items}} (${openItemsMatches.length}) không khớp với thẻ đóng {{/items}} (${closeItemsMatches.length}).`,
      );
    }

    if (openItemsMatches.length > 1) {
      warnings.push('Phát hiện nhiều hơn 1 vòng lặp {{#items}} trong cùng một mẫu in.');
    }

    // 2. Kiểm tra các cặp thẻ điều kiện {{#if condition}} ... {{/if}}
    const ifOpenRegex = /\{\{#if\s+([a-zA-Z0-9_]+)\}\}/g;
    const ifCloseRegex = /\{\{\/if\}\}/g;

    const ifOpenMatches: { condition: string; index: number }[] = [];
    let match: RegExpExecArray | null;
    while ((match = ifOpenRegex.exec(content)) !== null) {
      ifOpenMatches.push({ condition: match[1], index: match.index });
    }

    const ifCloseCount = (content.match(ifCloseRegex) || []).length;
    if (ifOpenMatches.length !== ifCloseCount) {
      errors.push(
        `Số lượng thẻ mở điều kiện {{#if ...}} (${ifOpenMatches.length}) không khớp với thẻ đóng {{/if}} (${ifCloseCount}).`,
      );
    }

    // 3. Kiểm tra tính hợp lệ của condition name
    const allowedConditions = this.tagsService.getAllowedConditions();
    for (const openMatch of ifOpenMatches) {
      if (!allowedConditions.includes(openMatch.condition)) {
        errors.push(
          `Điều kiện "{{#if ${openMatch.condition}}}" không hợp lệ. Các điều kiện được hỗ trợ: ${allowedConditions.join(', ')}.`,
        );
      }
    }

    // 4. Kiểm tra lồng nhau hợp lệ của block (Stack check)
    const blockTokenRegex = /\{\{#items\}\}|\{\{\/items\}\}|\{\{#if\s+([a-zA-Z0-9_]+)\}\}|\{\{\/if\}\}/g;
    const stack: { type: 'items' | 'if'; name?: string }[] = [];

    while ((match = blockTokenRegex.exec(content)) !== null) {
      const token = match[0];
      if (token === '{{#items}}') {
        stack.push({ type: 'items' });
      } else if (token.startsWith('{{#if')) {
        const condName = match[1];
        stack.push({ type: 'if', name: condName });
      } else if (token === '{{/items}}') {
        if (stack.length === 0) {
          errors.push('Thẻ đóng {{/items}} xuất hiện khi chưa có thẻ mở tương ứng.');
        } else {
          const top = stack.pop();
          if (top?.type !== 'items') {
            errors.push(
              `Thẻ đóng {{/items}} không đúng thứ tự (đang mong đợi đóng block "${top?.name ? '{{#if ' + top.name + '}}' : top?.type}").`,
            );
          }
        }
      } else if (token === '{{/if}}') {
        if (stack.length === 0) {
          errors.push('Thẻ đóng {{/if}} xuất hiện khi chưa có thẻ mở tương ứng.');
        } else {
          const top = stack.pop();
          if (top?.type !== 'if') {
            errors.push('Thẻ đóng {{/if}} không đúng thứ tự (đang nằm bên trong block {{#items}} chưa đóng).');
          }
        }
      }
    }

    if (stack.length > 0) {
      const unclosed = stack.map((s) => (s.type === 'if' ? `{{#if ${s.name}}}` : '{{#items}}')).join(', ');
      errors.push(`Các khối sau chưa được đóng lại: ${unclosed}.`);
    }

    // 5. Kiểm tra các thẻ dữ liệu [Tag_Name]
    const tagRegex = /\[([A-Za-z0-9_%]+)\]/g;
    const allTagsInContent: string[] = [];
    while ((match = tagRegex.exec(content)) !== null) {
      allTagsInContent.push(match[0]);
    }

    // Trích xuất nội dung bên trong {{#items}}...{{/items}}
    const itemLoopRegex = /\{\{#items\}\}([\s\S]*?)\{\{\/items\}\}/g;
    let contentOutsideItems = content;
    let loopMatch: RegExpExecArray | null;
    while ((loopMatch = itemLoopRegex.exec(content)) !== null) {
      contentOutsideItems = contentOutsideItems.replace(loopMatch[0], '');
    }

    for (const tag of allTagsInContent) {
      if (!this.tagsService.isValidTag(tag)) {
        warnings.push(`Thẻ dữ liệu ${tag} không nằm trong danh mục thẻ chuẩn của AVORA.`);
        continue;
      }

      // Kiểm tra thẻ món ăn xuất hiện ngoài loop
      if (this.tagsService.isItemScopedTag(tag)) {
        // Đối với mẫu in tem nhãn món ăn (ITEM_LABEL), mỗi con tem đại diện cho 1 món ăn đơn lẻ,
        // do đó các thẻ món ăn như [Ten_Mon_An], [Tuy_Chon_Mon], [Ghi_Chu_Mon], [Don_Gia]...
        // hoàn toàn được phép đặt trực tiếp ngoài vòng lặp {{#items}}!
        if (
          type === PrintTemplateType.ITEM_LABEL ||
          type === 'ITEM_LABEL' ||
          paperSize === '50x30mm' ||
          paperSize === '30x50mm' ||
          paperSize === '50x70mm' ||
          content.includes('50x30mm') ||
          content.includes('30x50mm') ||
          content.includes('50x70mm')
        ) {
          continue;
        }

        if (contentOutsideItems.includes(tag)) {
          errors.push(
            `Thẻ món ăn ${tag} bắt buộc phải đặt bên trong vòng lặp {{#items}}...{{/items}}. Không được đặt ở ngoài.`,
          );
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  assertValid(
    content: string,
    type?: PrintTemplateType | string,
    paperSize?: string | null,
  ): void {
    const result = this.validate(content, type, paperSize);
    if (!result.isValid) {
      throw new BadRequestException({
        message: 'Mẫu in không hợp lệ do lỗi cú pháp.',
        errors: result.errors,
        warnings: result.warnings,
      });
    }
  }
}
