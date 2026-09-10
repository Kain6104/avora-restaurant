import { Injectable } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';

@Injectable()
export class PrintTemplateSanitizerService {
  sanitize(dirtyHtml: string): string {
    if (!dirtyHtml || typeof dirtyHtml !== 'string') {
      return '';
    }

    const clean = sanitizeHtml(dirtyHtml, {
      allowedTags: [
        'div',
        'span',
        'p',
        'br',
        'hr',
        'table',
        'thead',
        'tbody',
        'tfoot',
        'tr',
        'td',
        'th',
        'b',
        'strong',
        'i',
        'em',
        'u',
        's',
        'img',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'center',
        'small',
        'pre',
        'code',
      ],
      allowedAttributes: {
        '*': ['style', 'class', 'id', 'align', 'valign', 'width', 'height'],
        td: ['colspan', 'rowspan', 'width', 'height'],
        th: ['colspan', 'rowspan', 'width', 'height'],
        table: ['border', 'cellpadding', 'cellspacing', 'width'],
        img: ['src', 'alt', 'width', 'height', 'style'],
      },
      allowedStyles: {
        '*': {
          'font-size': [/^\d+(?:\.\d+)?(?:px|pt|em|rem|%)$/],
          'font-weight': [/^(?:normal|bold|bolder|lighter|\d{3})$/],
          'font-family': [/.*/],
          'font-style': [/^(?:normal|italic|oblique)$/],
          'text-align': [/^(?:left|right|center|justify)$/],
          'text-transform': [/^(?:none|capitalize|uppercase|lowercase)$/],
          'border': [/.*/],
          'border-top': [/.*/],
          'border-bottom': [/.*/],
          'border-left': [/.*/],
          'border-right': [/.*/],
          'border-width': [/.*/],
          'border-style': [/.*/],
          'border-color': [/.*/],
          'border-collapse': [/^(?:collapse|separate)$/],
          width: [/^\d+(?:\.\d+)?(?:px|pt|%|mm|cm|in)$/],
          height: [/^\d+(?:\.\d+)?(?:px|pt|%|mm|cm|in)$/],
          'min-width': [/^\d+(?:\.\d+)?(?:px|pt|%|mm|cm|in)$/],
          'max-width': [/^\d+(?:\.\d+)?(?:px|pt|%|mm|cm|in)$/],
          padding: [/.*/],
          'padding-top': [/.*/],
          'padding-bottom': [/.*/],
          'padding-left': [/.*/],
          'padding-right': [/.*/],
          margin: [/.*/],
          'margin-top': [/.*/],
          'margin-bottom': [/.*/],
          'margin-left': [/.*/],
          'margin-right': [/.*/],
          'line-height': [/.*/],
          'letter-spacing': [/.*/],
          display: [/^(?:block|inline|inline-block|flex|table|table-row|table-cell)$/],
          'vertical-align': [/^(?:baseline|top|middle|bottom|sub|super)$/],
          color: [/.*/],
          background: [/.*/],
          'background-color': [/.*/],
          'box-sizing': [/^(?:border-box|content-box)$/],
          'justify-content': [/.*/],
          'align-items': [/.*/],
          'word-break': [/.*/],
          'white-space': [/.*/],
          overflow: [/.*/],
          gap: [/.*/],
        },
      },
      allowedSchemes: ['data', 'http', 'https'],
      disallowedTagsMode: 'discard',
    });

    return clean;
  }
}
