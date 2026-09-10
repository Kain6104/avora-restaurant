'use client';

import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Minus,
  Table as TableIcon,
  Plus,
  Trash2,
  Code2,
  Eye,
  Undo2,
  Redo2,
  Sparkles,
  Rows,
  Columns,
} from 'lucide-react';

export interface TemplateEditorRef {
  insertTagAtCursor: (tagText: string) => void;
  getContent: () => string;
  setContent: (content: string) => void;
}

interface TemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  syntaxErrors?: string[];
  syntaxWarnings?: string[];
}

export const TemplateEditor = forwardRef<TemplateEditorRef, TemplateEditorProps>(
  ({ value, onChange, syntaxErrors = [], syntaxWarnings = [] }, ref) => {
    const [isSourceMode, setIsSourceMode] = useState(false);
    const editorRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const lastSelectionRef = useRef<Range | null>(null);

    // Đồng bộ nội dung vào contentEditable khi không ở SourceMode và editor không có focus
    useEffect(() => {
      if (!isSourceMode && editorRef.current) {
        if (editorRef.current.innerHTML !== value) {
          editorRef.current.innerHTML = value;
        }
      }
    }, [value, isSourceMode]);

    // Lưu lại vị trí con trỏ chuột trong visual editor
    const saveSelection = () => {
      if (typeof window === 'undefined') return;
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        // Kiểm tra xem range có thuộc editorRef không
        if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
          lastSelectionRef.current = range.cloneRange();
        }
      }
    };

    const restoreSelection = () => {
      if (typeof window === 'undefined') return;
      const sel = window.getSelection();
      if (sel && lastSelectionRef.current) {
        sel.removeAllRanges();
        sel.addRange(lastSelectionRef.current);
      }
    };

    // Hàm chèn tag tại con trỏ (dùng cho cả Visual và Source)
    const insertTagAtCursor = (tagText: string) => {
      if (isSourceMode) {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const before = textarea.value.substring(0, start);
        const after = textarea.value.substring(end);
        const newValue = before + tagText + after;
        onChange(newValue);
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + tagText.length, start + tagText.length);
        }, 0);
      } else {
        const editor = editorRef.current;
        if (!editor) return;

        editor.focus();
        restoreSelection();

        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          const textNode = document.createTextNode(tagText);
          range.insertNode(textNode);

          // Di chuyển con trỏ ra sau text vừa chèn
          range.setStartAfter(textNode);
          range.setEndAfter(textNode);
          sel.removeAllRanges();
          sel.addRange(range);
          lastSelectionRef.current = range.cloneRange();
        } else {
          // Fallback chèn vào cuối nếu chưa có focus
          editor.innerHTML += tagText;
        }

        onChange(editor.innerHTML);
      }
    };

    useImperativeHandle(ref, () => ({
      insertTagAtCursor,
      getContent: () => value,
      setContent: (newContent: string) => {
        onChange(newContent);
        if (editorRef.current) {
          editorRef.current.innerHTML = newContent;
        }
      },
    }));

    const handleVisualInput = () => {
      if (editorRef.current) {
        saveSelection();
        onChange(editorRef.current.innerHTML);
      }
    };

    // Các lệnh định dạng WYSIWYG
    const executeCommand = (command: string, arg: string | undefined = undefined) => {
      if (isSourceMode) return;
      if (editorRef.current) {
        editorRef.current.focus();
        restoreSelection();
        document.execCommand(command, false, arg);
        saveSelection();
        onChange(editorRef.current.innerHTML);
      }
    };

    // Chèn đường kẻ ngang
    const insertDivider = (style: 'solid' | 'dashed' | 'dotted') => {
      const hrHtml = `<div style="border-top: 1px ${style} #000; margin: 6px 0;"></div>`;
      insertRawHtml(hrHtml);
    };

    // Chèn bảng mẫu
    const insertTable = (cols: number, rows: number) => {
      let tableHtml = `<table style="width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 12px;">\n<thead>\n<tr style="border-bottom: 1px solid #000;">\n`;
      for (let c = 1; c <= cols; c++) {
        tableHtml += `  <th style="padding: 4px; text-align: ${c === 1 ? 'left' : 'right'}; font-weight: bold;">Cột ${c}</th>\n`;
      }
      tableHtml += `</tr>\n</thead>\n<tbody>\n`;
      for (let r = 1; r <= rows; r++) {
        tableHtml += `<tr style="border-bottom: 1px dotted #ccc;">\n`;
        for (let c = 1; c <= cols; c++) {
          tableHtml += `  <td style="padding: 4px; text-align: ${c === 1 ? 'left' : 'right'};">Nội dung ${r}.${c}</td>\n`;
        }
        tableHtml += `</tr>\n`;
      }
      tableHtml += `</tbody>\n</table>`;
      insertRawHtml(tableHtml);
    };

    // Thêm hàng vào bảng đang chọn
    const addTableRow = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const node = sel.anchorNode;
      const tr = node instanceof Element ? node.closest('tr') : node?.parentElement?.closest('tr');
      if (tr && tr.parentElement) {
        const colCount = tr.children.length;
        const newTr = document.createElement('tr');
        newTr.style.borderBottom = '1px dotted #ccc';
        for (let i = 0; i < colCount; i++) {
          const td = document.createElement('td');
          td.style.padding = '4px';
          td.style.textAlign = i === 0 ? 'left' : 'right';
          td.innerText = '-';
          newTr.appendChild(td);
        }
        tr.parentElement.insertBefore(newTr, tr.nextSibling);
        handleVisualInput();
      }
    };

    // Xóa hàng bảng đang chọn
    const deleteTableRow = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const node = sel.anchorNode;
      const tr = node instanceof Element ? node.closest('tr') : node?.parentElement?.closest('tr');
      if (tr) {
        tr.remove();
        handleVisualInput();
      }
    };

    // Xóa toàn bộ bảng
    const deleteTable = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const node = sel.anchorNode;
      const table = node instanceof Element ? node.closest('table') : node?.parentElement?.closest('table');
      if (table) {
        table.remove();
        handleVisualInput();
      }
    };

    const insertRawHtml = (html: string) => {
      if (isSourceMode) {
        insertTagAtCursor(html);
      } else {
        editorRef.current?.focus();
        restoreSelection();
        document.execCommand('insertHTML', false, html);
        saveSelection();
        if (editorRef.current) {
          onChange(editorRef.current.innerHTML);
        }
      }
    };

    // Khối mẫu có sẵn
    const insertBlock = (blockType: string) => {
      switch (blockType) {
        case 'items':
          insertRawHtml(`{{#items}}
<tr style="border-bottom: 1px dotted #ccc;">
  <td style="text-align: left; padding: 4px 0;">
    <div style="font-weight: bold;">[Ten_Mon_An]</div>
    <div style="font-size: 10px; color: #555;">[Tuy_Chon_Mon]</div>
  </td>
  <td style="text-align: right; padding: 4px 0;">[So_Luong]</td>
  <td style="text-align: right; padding: 4px 0;">[Don_Gia]</td>
  <td style="text-align: right; padding: 4px 0; font-weight: bold;">[Thanh_Tien]</td>
</tr>
{{/items}}`);
          break;
        case 'voucher':
          insertRawHtml(`{{#if discountVoucher}}
<tr>
  <td style="text-align: left; padding: 2px 0;">Voucher giảm giá ([Ma_Voucher_Giam_Gia]):</td>
  <td style="text-align: right; padding: 2px 0;">-[Tien_Giam_Voucher]</td>
</tr>
{{/if}}
{{#if shippingVoucher}}
<tr>
  <td style="text-align: left; padding: 2px 0;">Freeship ([Ma_Voucher_Freeship]):</td>
  <td style="text-align: right; padding: 2px 0;">-[Tien_Giam_Freeship]</td>
</tr>
{{/if}}`);
          break;
        case 'shipping':
          insertRawHtml(`<tr>
  <td style="text-align: left; padding: 2px 0;">Phí giao hàng:</td>
  <td style="text-align: right; padding: 2px 0;">[Phi_Giao_Hang]</td>
</tr>`);
          break;
        case 'vat':
          insertRawHtml(`{{#if vatInvoice}}
<div style="border-top: 1px dotted #ccc; margin-top: 6px; padding-top: 4px; font-size: 11px; text-align: left;">
  Xuất HĐ VAT: <b>[Ten_Cong_Ty]</b><br/>
  MST: [Ma_So_Thue] | Email: [Email_Hoa_Don]
</div>
{{/if}}`);
          break;
        case 'cash':
          insertRawHtml(`{{#if cashPayment}}
<tr>
  <td style="text-align: left; padding: 2px 0;">Tiền khách đưa:</td>
  <td style="text-align: right; padding: 2px 0;">[Tien_Khach_Tra]</td>
</tr>
<tr>
  <td style="text-align: left; padding: 2px 0;">Tiền thối lại:</td>
  <td style="text-align: right; padding: 2px 0; font-weight: bold;">[Tien_Thoi]</td>
</tr>
{{/if}}`);
          break;
        case 'qr':
          insertRawHtml(`{{#if qrPayment}}
<div style="text-align: center; margin: 8px 0;">
  [Ma_QR_Thanh_Toan]
  <div style="font-size: 11px; margin-top: 3px;">[Ngan_Hang] - STK: [So_Tai_Khoan]</div>
</div>
{{/if}}`);
          break;
      }
    };

    return (
      <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Toolbar chính */}
        <div className="p-2 border-b border-slate-200 bg-slate-50/80 flex flex-wrap items-center gap-1.5 text-slate-700 select-none">
          {/* Undo / Redo */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => executeCommand('undo')}
              title="Hoàn tác (Undo)"
              className="p-1.5 hover:bg-slate-100 rounded text-slate-600 transition-colors"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => executeCommand('redo')}
              title="Làm lại (Redo)"
              className="p-1.5 hover:bg-slate-100 rounded text-slate-600 transition-colors"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-slate-300 mx-0.5" />

          {/* Cỡ chữ */}
          <select
            onChange={(e) => executeCommand('fontSize', e.target.value)}
            defaultValue="3"
            title="Cỡ chữ"
            className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 font-medium text-slate-700 outline-none shadow-2xs focus:border-red-500"
          >
            <option value="1">Nhỏ (11px)</option>
            <option value="2">Vừa (13px)</option>
            <option value="3">Chuẩn (15px)</option>
            <option value="4">Lớn (18px)</option>
            <option value="5">Rất lớn (22px)</option>
          </select>

          <div className="h-4 w-px bg-slate-300 mx-0.5" />

          {/* Định dạng văn bản */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => executeCommand('bold')}
              title="In đậm (Bold)"
              className="p-1.5 hover:bg-slate-100 rounded text-slate-700 font-bold transition-colors"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => executeCommand('italic')}
              title="In nghiêng (Italic)"
              className="p-1.5 hover:bg-slate-100 rounded text-slate-700 transition-colors"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => executeCommand('underline')}
              title="Gạch chân (Underline)"
              className="p-1.5 hover:bg-slate-100 rounded text-slate-700 transition-colors"
            >
              <Underline className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-slate-300 mx-0.5" />

          {/* Căn lề */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => executeCommand('justifyLeft')}
              title="Căn trái"
              className="p-1.5 hover:bg-slate-100 rounded text-slate-700 transition-colors"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => executeCommand('justifyCenter')}
              title="Căn giữa"
              className="p-1.5 hover:bg-slate-100 rounded text-slate-700 transition-colors"
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => executeCommand('justifyRight')}
              title="Căn phải"
              className="p-1.5 hover:bg-slate-100 rounded text-slate-700 transition-colors"
            >
              <AlignRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => executeCommand('justifyFull')}
              title="Căn đều"
              className="p-1.5 hover:bg-slate-100 rounded text-slate-700 transition-colors"
            >
              <AlignJustify className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-slate-300 mx-0.5" />

          {/* Đường kẻ */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => insertDivider('solid')}
              title="Kẻ nét liền"
              className="px-2 py-1 text-xs font-semibold hover:bg-slate-100 rounded text-slate-700 transition-colors"
            >
              <Minus className="w-3.5 h-3.5 inline mr-1" />
              Liền
            </button>
            <button
              type="button"
              onClick={() => insertDivider('dashed')}
              title="Kẻ nét đứt"
              className="px-2 py-1 text-xs font-semibold hover:bg-slate-100 rounded text-slate-700 transition-colors"
            >
              Đứt
            </button>
            <button
              type="button"
              onClick={() => insertDivider('dotted')}
              title="Kẻ nét chấm"
              className="px-2 py-1 text-xs font-semibold hover:bg-slate-100 rounded text-slate-700 transition-colors"
            >
              Chấm
            </button>
          </div>

          <div className="h-4 w-px bg-slate-300 mx-0.5" />

          {/* Bảng */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => insertTable(4, 2)}
              title="Chèn bảng 4 cột"
              className="px-2 py-1 text-xs font-semibold hover:bg-slate-100 rounded text-slate-700 transition-colors flex items-center gap-1"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Bảng</span>
            </button>
            <button
              type="button"
              onClick={addTableRow}
              title="Thêm hàng vào bảng hiện tại"
              className="p-1 hover:bg-slate-100 rounded text-slate-600 transition-colors"
            >
              <Rows className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={deleteTableRow}
              title="Xóa hàng bảng hiện tại"
              className="p-1 hover:bg-slate-100 rounded text-red-600 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>

          {/* Toggle Chế độ Mã nguồn HTML */}
          <div className="ml-auto flex items-center">
            <button
              type="button"
              onClick={() => setIsSourceMode(!isSourceMode)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs ${
                isSourceMode
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {isSourceMode ? (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>Trực quan (Visual)</span>
                </>
              ) : (
                <>
                  <Code2 className="w-3.5 h-3.5 text-red-600" />
                  <span>Mã nguồn HTML</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Thanh phím tắt chèn khối nhanh (Quick Block Inserters) */}
        <div className="px-3 py-1.5 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-600 font-bold flex items-center gap-1 text-[11px] uppercase tracking-wider mr-1">
            <Sparkles className="w-3 h-3 text-red-500" />
            Chèn nhanh:
          </span>
          <button
            type="button"
            onClick={() => insertBlock('items')}
            className="px-2 py-0.5 bg-white border border-slate-200 rounded-md font-medium text-slate-700 hover:border-red-400 hover:text-red-600 transition-colors"
          >
            + Vòng lặp món ({'{'}{'{'}#items{'}'}{'}'})
          </button>
          <button
            type="button"
            onClick={() => insertBlock('voucher')}
            className="px-2 py-0.5 bg-white border border-slate-200 rounded-md font-medium text-slate-700 hover:border-red-400 hover:text-red-600 transition-colors"
          >
            + Khối Voucher
          </button>
          <button
            type="button"
            onClick={() => insertBlock('shipping')}
            className="px-2 py-0.5 bg-white border border-slate-200 rounded-md font-medium text-slate-700 hover:border-red-400 hover:text-red-600 transition-colors"
          >
            + Khối Giao hàng
          </button>
          <button
            type="button"
            onClick={() => insertBlock('cash')}
            className="px-2 py-0.5 bg-white border border-slate-200 rounded-md font-medium text-slate-700 hover:border-red-400 hover:text-red-600 transition-colors"
          >
            + Khối Tiền mặt
          </button>
          <button
            type="button"
            onClick={() => insertBlock('qr')}
            className="px-2 py-0.5 bg-white border border-slate-200 rounded-md font-medium text-slate-700 hover:border-red-400 hover:text-red-600 transition-colors"
          >
            + Khối QR Ngân hàng
          </button>
          <button
            type="button"
            onClick={() => insertBlock('vat')}
            className="px-2 py-0.5 bg-white border border-slate-200 rounded-md font-medium text-slate-700 hover:border-red-400 hover:text-red-600 transition-colors"
          >
            + Khối Hóa đơn VAT
          </button>
        </div>

        {/* Thông báo lỗi cú pháp nếu có */}
        {syntaxErrors.length > 0 && (
          <div className="bg-red-50 border-b border-red-200 p-2.5 text-xs text-red-700 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <span>Lỗi cú pháp cần sửa trước khi lưu:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px]">
              {syntaxErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {syntaxWarnings.length > 0 && (
          <div className="bg-amber-50 border-b border-amber-200 p-2 text-xs text-amber-800 space-y-0.5">
            <div className="font-semibold text-[11px]">Cảnh báo mẫu in:</div>
            <ul className="list-disc list-inside text-[11px]">
              {syntaxWarnings.map((warn, i) => (
                <li key={i}>{warn}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Vùng soạn thảo chính */}
        <div className="flex-1 p-4 overflow-y-auto bg-slate-100/60 min-h-[460px]">
          {isSourceMode ? (
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-full h-full min-h-[450px] p-4 font-mono text-xs text-slate-800 bg-white border border-slate-300 rounded-xl shadow-inner focus:border-red-500 focus:outline-none leading-relaxed resize-none"
              placeholder="Nhập mã nguồn HTML và các thẻ [Tag_Name]..."
              spellCheck={false}
            />
          ) : (
            <div className="max-w-[420px] mx-auto bg-white border border-slate-300 rounded-xl shadow-sm p-5 min-h-[450px]">
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleVisualInput}
                onKeyUp={saveSelection}
                onMouseUp={saveSelection}
                className="outline-none min-h-[420px] text-slate-900 leading-normal"
                style={{
                  fontFamily: 'Arial, sans-serif',
                  fontSize: '13px',
                }}
              />
            </div>
          )}
        </div>

        {/* Footer hướng dẫn */}
        <div className="px-3.5 py-2 border-t border-slate-200 bg-white text-[11px] text-slate-500 flex items-center justify-between">
          <span>
            Bấm nút <b>Chèn</b> ở bảng bên phải để đưa thẻ dữ liệu vào đúng vị trí con trỏ chuột.
          </span>
          <span className="font-mono text-[10px] text-slate-400">
            {value.length} ký tự
          </span>
        </div>
      </div>
    );
  },
);

TemplateEditor.displayName = 'TemplateEditor';
