using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.IO;
using AvoraPosNative.Models;

namespace AvoraPosNative.Printing
{
    public class DrawContext
    {
        public Graphics G { get; set; }
        public int Y { get; set; }

        public DrawContext(Graphics g, int y = 0)
        {
            G = g;
            Y = y;
        }
    }

    public class RasterReceiptBuilder
    {
        private readonly int _widthDots;
        private readonly List<Action<DrawContext>> _drawActions = new();
        private readonly Font _fontTitle = new("Segoe UI", 13f, FontStyle.Bold, GraphicsUnit.Point);
        private readonly Font _fontHeader = new("Segoe UI", 10.5f, FontStyle.Bold, GraphicsUnit.Point);
        private readonly Font _fontBody = new("Segoe UI", 9.5f, FontStyle.Regular, GraphicsUnit.Point);
        private readonly Font _fontBodyBold = new("Segoe UI", 9.5f, FontStyle.Bold, GraphicsUnit.Point);
        private readonly Font _fontSmall = new("Segoe UI", 8.5f, FontStyle.Regular, GraphicsUnit.Point);

        public RasterReceiptBuilder(int widthDots = 576)
        {
            _widthDots = widthDots > 0 ? widthDots : 576;
        }

        public RasterReceiptBuilder AddTitle(string text)
        {
            _drawActions.Add(ctx =>
            {
                var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Near };
                var size = ctx.G.MeasureString(text, _fontTitle, _widthDots, sf);
                ctx.G.DrawString(text, _fontTitle, Brushes.Black, new RectangleF(0, ctx.Y, _widthDots, size.Height), sf);
                ctx.Y += (int)Math.Ceiling(size.Height) + 4;
            });
            return this;
        }

        public RasterReceiptBuilder AddCenterText(string text, bool isBold = false, bool isSmall = false)
        {
            _drawActions.Add(ctx =>
            {
                var font = isSmall ? _fontSmall : (isBold ? _fontBodyBold : _fontBody);
                var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Near };
                var size = ctx.G.MeasureString(text, font, _widthDots, sf);
                ctx.G.DrawString(text, font, Brushes.Black, new RectangleF(0, ctx.Y, _widthDots, size.Height), sf);
                ctx.Y += (int)Math.Ceiling(size.Height) + 2;
            });
            return this;
        }

        public RasterReceiptBuilder AddLeftRight(string left, string right, bool isBold = false)
        {
            _drawActions.Add(ctx =>
            {
                var font = isBold ? _fontBodyBold : _fontBody;
                var sfLeft = new StringFormat { Alignment = StringAlignment.Near, LineAlignment = StringAlignment.Near };
                var sfRight = new StringFormat { Alignment = StringAlignment.Far, LineAlignment = StringAlignment.Near };

                float rightWidth = ctx.G.MeasureString(right, font).Width + 8;
                float leftWidth = Math.Max(10, _widthDots - rightWidth);

                var sizeLeft = ctx.G.MeasureString(left, font, (int)leftWidth, sfLeft);
                var sizeRight = ctx.G.MeasureString(right, font, (int)rightWidth, sfRight);

                ctx.G.DrawString(left, font, Brushes.Black, new RectangleF(0, ctx.Y, leftWidth, sizeLeft.Height), sfLeft);
                ctx.G.DrawString(right, font, Brushes.Black, new RectangleF(_widthDots - rightWidth, ctx.Y, rightWidth, sizeRight.Height), sfRight);

                ctx.Y += (int)Math.Max(Math.Ceiling(sizeLeft.Height), Math.Ceiling(sizeRight.Height)) + 2;
            });
            return this;
        }

        public RasterReceiptBuilder AddItemRow(string name, int qty, decimal price, decimal total, string? note = null, string? options = null)
        {
            _drawActions.Add(ctx =>
            {
                string totalStr = total == 0 ? "Miễn phí" : $"{total:N0}đ";
                var sfLeft = new StringFormat { Alignment = StringAlignment.Near, LineAlignment = StringAlignment.Near };
                var sfRight = new StringFormat { Alignment = StringAlignment.Far, LineAlignment = StringAlignment.Near };

                float rightWidth = ctx.G.MeasureString(totalStr, _fontBodyBold).Width + 6;
                float leftWidth = Math.Max(10, _widthDots - rightWidth);

                string titleLine = $"{name}";
                var sizeLeft = ctx.G.MeasureString(titleLine, _fontBodyBold, (int)leftWidth, sfLeft);
                ctx.G.DrawString(titleLine, _fontBodyBold, Brushes.Black, new RectangleF(0, ctx.Y, leftWidth, sizeLeft.Height), sfLeft);
                ctx.G.DrawString(totalStr, _fontBodyBold, Brushes.Black, new RectangleF(_widthDots - rightWidth, ctx.Y, rightWidth, sizeLeft.Height), sfRight);

                ctx.Y += (int)Math.Ceiling(sizeLeft.Height);

                string subLine = $"  {qty} x {price:N0}đ";
                ctx.G.DrawString(subLine, _fontSmall, Brushes.Black, new PointF(0, ctx.Y));
                ctx.Y += 15;

                if (!string.IsNullOrWhiteSpace(options))
                {
                    ctx.G.DrawString($"  + {options}", _fontSmall, Brushes.Black, new PointF(10, ctx.Y));
                    ctx.Y += 14;
                }

                if (!string.IsNullOrWhiteSpace(note))
                {
                    ctx.G.DrawString($"  * {note}", _fontSmall, Brushes.Black, new PointF(10, ctx.Y));
                    ctx.Y += 14;
                }

                ctx.Y += 3;
            });
            return this;
        }

        public RasterReceiptBuilder AddDivider(char ch = '-')
        {
            _drawActions.Add(ctx =>
            {
                using var pen = new Pen(Color.Black, 1f);
                if (ch == '=') pen.Width = 2f;
                ctx.G.DrawLine(pen, 0, ctx.Y + 4, _widthDots, ctx.Y + 4);
                ctx.Y += 10;
            });
            return this;
        }

        public RasterReceiptBuilder AddSpace(int pixels = 10)
        {
            _drawActions.Add(ctx => { ctx.Y += pixels; });
            return this;
        }

        public byte[] ToEscPosRasterBytes(bool cut = true, bool drawer = false)
        {
            // Measure total height required
            int measuredHeight = 0;
            using (var dummyBmp = new Bitmap(1, 1))
            using (var dummyG = Graphics.FromImage(dummyBmp))
            {
                dummyG.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
                var dummyCtx = new DrawContext(dummyG, 0);
                foreach (var action in _drawActions)
                {
                    action(dummyCtx);
                }
                measuredHeight = Math.Max(50, dummyCtx.Y + 16);
            }

            int widthBytes = (_widthDots + 7) / 8;
            int paddedWidthDots = widthBytes * 8;

            using var bmp = new Bitmap(paddedWidthDots, measuredHeight, PixelFormat.Format32bppArgb);
            using (var g = Graphics.FromImage(bmp))
            {
                g.Clear(Color.White);
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;

                var ctx = new DrawContext(g, 0);
                foreach (var action in _drawActions)
                {
                    action(ctx);
                }
            }

            // Convert to ESC/POS GS v 0 0 xL xH yL yH d1...dk
            using var ms = new MemoryStream();
            ms.Write(EscPosEngine.Initialize, 0, EscPosEngine.Initialize.Length);

            if (drawer)
            {
                ms.Write(EscPosEngine.OpenDrawer, 0, EscPosEngine.OpenDrawer.Length);
            }

            byte xL = (byte)(widthBytes % 256);
            byte xH = (byte)(widthBytes / 256);
            byte yL = (byte)(measuredHeight % 256);
            byte yH = (byte)(measuredHeight / 256);

            byte[] header = new byte[] { 0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH };
            ms.Write(header, 0, header.Length);

            for (int y = 0; y < measuredHeight; y++)
            {
                for (int xb = 0; xb < widthBytes; xb++)
                {
                    byte b = 0;
                    for (int bit = 0; bit < 8; bit++)
                    {
                        int x = xb * 8 + bit;
                        if (x < paddedWidthDots)
                        {
                            Color c = bmp.GetPixel(x, y);
                            // Threshold: black dot if brightness < 150
                            if (c.R < 150 && c.G < 150 && c.B < 150)
                            {
                                b |= (byte)(0x80 >> bit);
                            }
                        }
                    }
                    ms.WriteByte(b);
                }
            }

            // Feed 3 lines
            ms.Write(new byte[] { 0x1B, 0x64, 0x03 }, 0, 3);

            if (cut)
            {
                ms.Write(EscPosEngine.CutPaper, 0, EscPosEngine.CutPaper.Length);
            }

            return ms.ToArray();
        }

        public static byte[] BuildReceiptRasterBytes(PrintJobPayload payload, int widthDots = 576)
        {
            var builder = new RasterReceiptBuilder(widthDots);

            builder.AddTitle("AVORA RESTAURANT");
            if (!string.IsNullOrWhiteSpace(payload.BranchName)) builder.AddCenterText(payload.BranchName, isBold: true);
            if (!string.IsNullOrWhiteSpace(payload.BranchAddress)) builder.AddCenterText(payload.BranchAddress, isSmall: true);
            if (!string.IsNullOrWhiteSpace(payload.BranchPhone)) builder.AddCenterText($"Hotline: {payload.BranchPhone}", isSmall: true);
            builder.AddSpace(4);

            builder.AddTitle(payload.Title);
            builder.AddDivider('=');

            if (!string.IsNullOrWhiteSpace(payload.OrderCode)) builder.AddLeftRight("Mã hóa đơn:", payload.OrderCode, isBold: true);
            if (!string.IsNullOrWhiteSpace(payload.TableName)) builder.AddLeftRight("Khu vực / Bàn:", payload.TableName, isBold: true);
            builder.AddLeftRight("Thời gian:", payload.CreatedAt.ToString("dd/MM/yyyy HH:mm:ss"));
            if (!string.IsNullOrWhiteSpace(payload.CashierName)) builder.AddLeftRight("Thu ngân:", payload.CashierName);
            if (!string.IsNullOrWhiteSpace(payload.CustomerName)) builder.AddLeftRight("Khách hàng:", payload.CustomerName);

            builder.AddDivider('-');
            builder.AddLeftRight("Tên món / Đơn giá", "Thành tiền", isBold: true);
            builder.AddDivider('-');

            foreach (var item in payload.Items)
            {
                builder.AddItemRow(item.ProductName, item.Quantity, item.Price, item.LineTotal, item.Note, item.OptionsText);
            }

            builder.AddDivider('-');
            builder.AddLeftRight("Tiền hàng:", $"{payload.SubTotal:N0}đ");
            if (payload.DiscountAmount > 0) builder.AddLeftRight("Giảm giá:", $"-{payload.DiscountAmount:N0}đ");
            if (payload.TaxAmount > 0) builder.AddLeftRight("Thuế VAT:", $"{payload.TaxAmount:N0}đ");
            if (payload.ShippingFee > 0) builder.AddLeftRight("Phí giao hàng:", $"{payload.ShippingFee:N0}đ");

            builder.AddDivider('=');
            builder.AddLeftRight("TỔNG CỘNG:", $"{payload.TotalAmount:N0}đ", isBold: true);

            if (!string.IsNullOrWhiteSpace(payload.PaymentMethod))
            {
                builder.AddLeftRight("Hình thức:", payload.PaymentMethod switch
                {
                    "CASH" => "Tiền mặt",
                    "BANK_TRANSFER" => "Chuyển khoản QR",
                    "CARD" => "Thẻ ngân hàng",
                    _ => payload.PaymentMethod
                });

                if (payload.PaymentMethod == "CASH" && payload.ReceivedAmount > 0)
                {
                    builder.AddLeftRight("Tiền khách đưa:", $"{payload.ReceivedAmount:N0}đ");
                    builder.AddLeftRight("Tiền thối lại:", $"{payload.ChangeAmount:N0}đ", isBold: true);
                }
            }

            builder.AddSpace(6);
            if (!string.IsNullOrWhiteSpace(payload.FooterNote)) builder.AddCenterText(payload.FooterNote, isSmall: true);
            builder.AddCenterText("Cảm ơn quý khách và hẹn gặp lại!", isSmall: true);
            builder.AddCenterText("Wifi: AVORA Guest | Pass: 88888888", isSmall: true);
            builder.AddSpace(8);

            return builder.ToEscPosRasterBytes(payload.CutPaper, payload.OpenCashDrawer);
        }

        public static byte[] BuildKitchenTicketRasterBytes(string tableName, string orderCode, List<PrintJobItem> items, string? cashier = null, int widthDots = 576)
        {
            var builder = new RasterReceiptBuilder(widthDots);

            builder.AddTitle("PHIẾU BẾP / PHA CHẾ");
            builder.AddDivider('=');

            builder.AddLeftRight("Bàn ăn:", tableName, isBold: true);
            builder.AddLeftRight("Mã đơn:", orderCode, isBold: true);
            builder.AddLeftRight("Thời gian:", DateTime.Now.ToString("HH:mm:ss dd/MM"));
            if (!string.IsNullOrWhiteSpace(cashier)) builder.AddLeftRight("Nhân viên:", cashier);

            builder.AddDivider('-');
            builder.AddLeftRight("Tên món", "Số lượng", isBold: true);
            builder.AddDivider('-');

            foreach (var it in items)
            {
                builder.AddLeftRight(it.ProductName, $"x {it.Quantity}", isBold: true);
                if (!string.IsNullOrWhiteSpace(it.OptionsText))
                {
                    builder.AddCenterText($"   + {it.OptionsText}", isSmall: true);
                }
                if (!string.IsNullOrWhiteSpace(it.Note))
                {
                    builder.AddCenterText($"   * {it.Note}", isBold: true, isSmall: true);
                }
                builder.AddSpace(3);
            }

            builder.AddDivider('=');
            builder.AddSpace(8);

            return builder.ToEscPosRasterBytes(cut: true, drawer: false);
        }
    }

    public static class RasterTextEngine
    {
        public static byte[] BuildReceiptRasterBytes(PrintJobPayload payload, int widthDots = 576)
            => RasterReceiptBuilder.BuildReceiptRasterBytes(payload, widthDots);

        public static byte[] BuildKitchenTicketRasterBytes(string tableName, string orderCode, List<PrintJobItem> items, string? cashier = null, int widthDots = 576)
            => RasterReceiptBuilder.BuildKitchenTicketRasterBytes(tableName, orderCode, items, cashier, widthDots);
    }
}
