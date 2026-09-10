/**
 * AVORA Restaurant ESC/POS Binary Command Encoder
 * Produces industry-standard ESC/POS byte buffers for thermal receipt & kitchen ticket printers.
 */

export function removeVietnameseDiacritics(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

export interface TicketItem {
  name: string;
  quantity: number;
  delta?: number;
  note?: string;
  options?: string;
}

export interface KitchenTicketData {
  branchName: string;
  stationName: string;
  orderCode: string;
  tableName?: string;
  orderTypeStr?: string;
  orderNote?: string;
  eventType: 'NEW_ITEM' | 'ADD_QUANTITY' | 'CANCEL_ITEM' | 'RETURN_ITEM' | 'REPRINT' | 'ITEM_LABEL' | string;
  items: TicketItem[];
  reprintReason?: string;
  sentAt: Date;
  paperWidth?: '80mm' | '58mm';
}

export class EscPosEncoder {
  private buffer: number[] = [];

  constructor() {
    this.init();
  }

  init(): this {
    // ESC @: Initialize printer
    this.buffer.push(0x1b, 0x40);
    return this;
  }

  align(alignment: 'left' | 'center' | 'right'): this {
    // ESC a n (0=left, 1=center, 2=right)
    const code = alignment === 'center' ? 1 : alignment === 'right' ? 2 : 0;
    this.buffer.push(0x1b, 0x61, code);
    return this;
  }

  bold(enabled: boolean = true): this {
    // ESC E n
    this.buffer.push(0x1b, 0x45, enabled ? 1 : 0);
    return this;
  }

  size(widthMultiplier: 1 | 2 | 3 | 4 = 1, heightMultiplier: 1 | 2 | 3 | 4 = 1): this {
    // GS ! n: Character size
    const n = ((widthMultiplier - 1) << 4) | (heightMultiplier - 1);
    this.buffer.push(0x1d, 0x21, n);
    return this;
  }

  text(text: string, stripDiacritics: boolean = true): this {
    const clean = stripDiacritics ? removeVietnameseDiacritics(text) : text;
    for (let i = 0; i < clean.length; i++) {
      this.buffer.push(clean.charCodeAt(i) & 0xff);
    }
    return this;
  }

  line(text: string = '', stripDiacritics: boolean = true): this {
    if (text) {
      this.text(text, stripDiacritics);
    }
    this.buffer.push(0x0a); // LF
    return this;
  }

  feed(lines: number = 1): this {
    // ESC d n
    this.buffer.push(0x1b, 0x64, lines);
    return this;
  }

  separator(char: string = '-', width: number = 32): this {
    this.line(char.repeat(width));
    return this;
  }

  cut(partial: boolean = false): this {
    // GS V m n (66 = partial cut with feed)
    this.feed(3);
    this.buffer.push(0x1d, 0x56, partial ? 66 : 65, 0);
    return this;
  }

  beep(): this {
    // ESC B n t (Sound buzzer: 2 beeps)
    this.buffer.push(0x1b, 0x42, 2, 2);
    return this;
  }

  kickDrawer(pin: 0 | 1 = 0): this {
    // ESC p m t1 t2 (Pulse to cash drawer solenoid: pin 0 or 1, 50ms ON, 500ms OFF)
    this.buffer.push(0x1b, 0x70, pin, 0x19, 0xfa);
    return this;
  }

  toBuffer(): Buffer {
    return Buffer.from(this.buffer);
  }

  toBase64(): string {
    return this.toBuffer().toString('base64');
  }

  /**
   * Encodes a standard AVORA Kitchen Ticket to ESC/POS bytes
   */
  static generateKitchenTicket(data: KitchenTicketData): Buffer {
    const encoder = new EscPosEncoder();
    const is80mm = data.paperWidth !== '58mm';
    const colWidth = is80mm ? 42 : 32;

    // Header
    encoder.align('center');
    encoder.bold(true).size(2, 2);
    encoder.line(data.stationName.toUpperCase());
    encoder.size(1, 1).bold(false);
    encoder.line(`Chi nhanh: ${data.branchName}`);

    // Event badge
    encoder.feed(1);
    encoder.bold(true);
    if (data.eventType === 'NEW_ITEM') {
      encoder.line('*** PHIEU BEP / GOI MON ***');
    } else if (data.eventType === 'ADD_QUANTITY') {
      encoder.size(2, 2).line('*** GOI THEM (ADD) ***').size(1, 1);
    } else if (data.eventType === 'CANCEL_ITEM') {
      encoder.size(2, 2).line('*** HUY MON (CANCEL) ***').size(1, 1);
    } else if (data.eventType === 'REPRINT') {
      encoder.size(2, 2).line('*** IN LAI (REPRINT) ***').size(1, 1);
    }
    encoder.bold(false);

    // Meta Info
    encoder.separator('=', colWidth);
    encoder.align('left');
    encoder.line(`Don hang: ${data.orderCode}`);
    if (data.tableName) {
      encoder.bold(true).size(1, 2).line(`Ban: ${data.tableName}`).size(1, 1).bold(false);
    }
    if (data.orderTypeStr) {
      encoder.line(`Loai don: ${data.orderTypeStr}`);
    }
    encoder.line(`Gio: ${new Date(data.sentAt).toLocaleTimeString('vi-VN')} ${new Date(data.sentAt).toLocaleDateString('vi-VN')}`);
    if (data.reprintReason) {
      encoder.bold(true).line(`Ly do in lai: ${data.reprintReason}`).bold(false);
    }
    if (data.orderNote) {
      encoder.line(`Ghi chu don: ${data.orderNote}`);
    }

    // Items list
    encoder.separator('-', colWidth);
    encoder.bold(true);
    encoder.line(is80mm ? 'Ten mon                                  SL' : 'Ten mon                      SL');
    encoder.bold(false);
    encoder.separator('-', colWidth);

    for (const item of data.items) {
      const qtyStr = item.delta !== undefined && data.eventType === 'ADD_QUANTITY'
        ? `+${item.delta}`
        : `${item.quantity}`;

      encoder.bold(true).size(1, 2);
      const name = removeVietnameseDiacritics(item.name);
      // Fit name and right-align quantity
      const maxNameLen = colWidth - qtyStr.length - 2;
      const truncatedName = name.length > maxNameLen ? name.substring(0, maxNameLen) : name;
      const padding = ' '.repeat(Math.max(1, colWidth - truncatedName.length - qtyStr.length));
      encoder.line(`${truncatedName}${padding}${qtyStr}`);
      encoder.size(1, 1).bold(false);

      if (item.options) {
        encoder.line(`   [Tuy chon]: ${item.options}`);
      }
      if (item.note) {
        encoder.bold(true).line(`   * Ghi chu: ${item.note}`).bold(false);
      }
    }

    encoder.separator('=', colWidth);
    encoder.align('center');
    encoder.line('AVORA RESTAURANT - BEP & BAR');
    encoder.feed(1);
    encoder.cut();

    return encoder.toBuffer();
  }
}
