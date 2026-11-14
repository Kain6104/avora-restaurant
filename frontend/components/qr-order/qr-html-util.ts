/**
 * Safe HTML sanitization and stripping helpers for QR Ordering product descriptions.
 */

const BLOCKED_TAG_BLOCK_REGEX = /<(script|style|iframe|object|embed|form|input|button|textarea|select|meta|link|base)\b[^>]*>[\s\S]*?<\/\1>/gi;
const BLOCKED_SELF_CLOSING_REGEX = /<(script|style|iframe|object|embed|form|input|button|textarea|select|meta|link|base)\b[^>]*\/?>/gi;
const EVENT_HANDLER_QUOTED_REGEX = /\son[a-z]+\s*=\s*(["'])[\s\S]*?\1/gi;
const EVENT_HANDLER_UNQUOTED_REGEX = /\son[a-z]+\s*=\s*[^\s>]+/gi;
const DANGEROUS_URI_REGEX = /(href|src|xlink:href)\s*=\s*(["'])\s*(javascript:|vbscript:|data:text\/html)[\s\S]*?\2/gi;

const HTML_ENTITY_MAP: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

/**
 * Sanitizes HTML strings for safe rendering in Product Detail descriptions.
 * Strips executable/dangerous tags, inline event handlers, and javascript: URIs.
 */
export function sanitizeProductHtml(rawHtml?: string | null): string {
  if (!rawHtml) return '';

  return rawHtml
    .replace(BLOCKED_TAG_BLOCK_REGEX, '')
    .replace(BLOCKED_SELF_CLOSING_REGEX, '')
    .replace(EVENT_HANDLER_QUOTED_REGEX, '')
    .replace(EVENT_HANDLER_UNQUOTED_REGEX, '')
    .replace(DANGEROUS_URI_REGEX, '$1="#"');
}

/**
 * Strips all HTML tags and collapses whitespace for single-line menu previews.
 */
export function stripHtmlTags(rawHtml?: string | null): string {
  if (!rawHtml) return '';

  const noScripts = sanitizeProductHtml(rawHtml);
  const plain = noScripts
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, '');

  return plain
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/gi, (match) => HTML_ENTITY_MAP[match.toLowerCase()] ?? match)
    .replace(/\s+/g, ' ')
    .trim();
}

