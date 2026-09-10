using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.IO;
using AvoraPos.Models;

namespace AvoraPos.NativePrint
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
        private readonly List<Action<DrawContext>> _drawActions = new List<Action<DrawContext>>();
        private readonly Font _fontTitle = new Font("Segoe UI", 13f, FontStyle.Bold, GraphicsUnit.Point);
        private readonly Font _fontHeader = new Font("Segoe UI", 10.5f, FontStyle.Bold, GraphicsUnit.Point);
        private readonly Font _fontBody = new Font("Segoe UI", 9.5f, FontStyle.Regular, GraphicsUnit.Point);
        private readonly Font _fontBodyBold = new Font("Segoe UI", 9.5f, FontStyle.Bold, GraphicsUnit.Point);
        private readonly Font _fontSmall = new Font("Segoe UI", 8.5f, FontStyle.Regular, GraphicsUnit.Point);

        public RasterReceiptBuilder(int widthDots)
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

        public RasterReceiptBuilder AddItemRow(string name, int qty, decimal price, decimal total, string? note = null, List<string>? options = null)
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
                ctx.Y += (int)Math.Ceiling(sizeLeft.Height) + 1;

                string qtyDetail = $"   {qty} x {price:N0}đ";
                var sizeQty = ctx.G.MeasureString(qtyDetail, _fontSmall, _widthDots, sfLeft);
                ctx.G.DrawString(qtyDetail, _fontSmall, Brushes.Black, new RectangleF(0, ctx.Y, _widthDots, sizeQty.Height), sfLeft);
                ctx.Y += (int)Math.Ceiling(sizeQty.Height) + 1;

                if (options != null && options.Count > 0)
                {
                    foreach (var opt in options)
                    {
                        string optStr = $"     + {opt}";
                        var sizeOpt = ctx.G.MeasureString(optStr, _fontSmall, _widthDots, sfLeft);
                        ctx.G.DrawString(optStr, _fontSmall, Brushes.Black, new RectangleF(0, ctx.Y, _widthDots, sizeOpt.Height), sfLeft);
                        ctx.Y += (int)Math.Ceiling(sizeOpt.Height) + 1;
                    }
                }

                if (!string.IsNullOrWhiteSpace(note))
                {
                    string noteStr = $"     * Ghi chú: {note}";
                    var sizeNote = ctx.G.MeasureString(noteStr, _fontSmall, _widthDots, sfLeft);
                    ctx.G.DrawString(noteStr, _fontSmall, Brushes.Black, new RectangleF(0, ctx.Y, _widthDots, sizeNote.Height), sfLeft);
                    ctx.Y += (int)Math.Ceiling(sizeNote.Height) + 1;
                }

                ctx.Y += 2;
            });
            return this;
        }

        public RasterReceiptBuilder AddDivider(char fillChar = '-')
        {
            _drawActions.Add(ctx =>
            {
                using var pen = new Pen(Color.Black, 1.2f);
                pen.DashStyle = fillChar == '=' ? DashStyle.Solid : DashStyle.Dash;
                ctx.G.DrawLine(pen, 0, ctx.Y + 2, _widthDots, ctx.Y + 2);
                ctx.Y += 6;
            });
            return this;
        }

        public RasterReceiptBuilder AddSpace(int pixels = 8)
        {
            _drawActions.Add(ctx =>
            {
                ctx.Y += pixels;
            });
            return this;
        }

        public Bitmap RenderToBitmap()
        {
            // Pass 1: Measure total height
            int estimatedHeight = 50;
            using (var tempBmp = new Bitmap(_widthDots, 100))
            using (var g = Graphics.FromImage(tempBmp))
            {
                g.TextRenderingHint = TextRenderingHint.SingleBitPerPixelGridFit;
                var ctx = new DrawContext(g, 0);
                foreach (var action in _drawActions)
                {
                    action(ctx);
                }
                estimatedHeight = Math.Max(50, ctx.Y + 16);
            }

            // Pass 2: Render crisp black text on white canvas
            var finalBmp = new Bitmap(_widthDots, estimatedHeight, PixelFormat.Format32bppArgb);
            using (var g = Graphics.FromImage(finalBmp))
            {
                g.Clear(Color.White);
                g.SmoothingMode = SmoothingMode.None;
                g.InterpolationMode = InterpolationMode.NearestNeighbor;
                g.PixelOffsetMode = PixelOffsetMode.None;
                g.TextRenderingHint = TextRenderingHint.SingleBitPerPixelGridFit;

                var ctx = new DrawContext(g, 4);
                foreach (var action in _drawActions)
                {
                    action(ctx);
                }
            }

            return finalBmp;
        }

        public byte[] ToEscPosRasterBytes(PrinterProfile profile)
        {
            using var bmp = RenderToBitmap();
            return RasterTextEngine.BitmapToEscPosRaster(bmp, profile);
        }
    }

    public static class RasterTextEngine
    {
        public static byte[] BitmapToEscPosRaster(Bitmap bitmap, PrinterProfile profile)
        {
            int width = bitmap.Width;
            int height = bitmap.Height;

            int widthBytes = (width + 7) / 8;

            using var ms = new MemoryStream();

            // ESC @ - Initialize printer
            ms.WriteByte(0x1B);
            ms.WriteByte(0x40);

            // GS v 0 0 - Raster bit image command
            ms.WriteByte(0x1D);
            ms.WriteByte(0x76);
            ms.WriteByte(0x30);
            ms.WriteByte(0x00);

            int xL = widthBytes % 256;
            int xH = widthBytes / 256;
            int yL = height % 256;
            int yH = height / 256;

            ms.WriteByte((byte)xL);
            ms.WriteByte((byte)xH);
            ms.WriteByte((byte)yL);
            ms.WriteByte((byte)yH);

            for (int y = 0; y < height; y++)
            {
                for (int xByte = 0; xByte < widthBytes; xByte++)
                {
                    byte b = 0;
                    for (int bit = 0; bit < 8; bit++)
                    {
                        int x = xByte * 8 + bit;
                        if (x < width)
                        {
                            Color pixel = bitmap.GetPixel(x, y);
                            int lum = (int)(0.299 * pixel.R + 0.587 * pixel.G + 0.114 * pixel.B);
                            if (lum < 185 && pixel.A > 50)
                            {
                                b |= (byte)(0x80 >> bit);
                            }
                        }
                    }
                    ms.WriteByte(b);
                }
            }

            // Line feeds
            ms.WriteByte(0x1B);
            ms.WriteByte(0x64);
            ms.WriteByte(0x03);

            // Auto-cut if supported
            if (profile.SupportsCut)
            {
                ms.WriteByte(0x1D);
                ms.WriteByte(0x56);
                ms.WriteByte(0x42);
                ms.WriteByte(0x00);
            }

            // Cash drawer pulse if requested
            if (profile.SupportsDrawer)
            {
                byte pinByte = (byte)(profile.DrawerPin == 5 ? 1 : 0);
                byte t1 = (byte)Math.Clamp(profile.PulseOn / 2, 1, 255);
                byte t2 = (byte)Math.Clamp(profile.PulseOff / 2, 1, 255);
                ms.WriteByte(0x1B);
                ms.WriteByte(0x70);
                ms.WriteByte(pinByte);
                ms.WriteByte(t1);
                ms.WriteByte(t2);
            }

            return ms.ToArray();
        }

        public static RasterReceiptBuilder CreateReceiptBuilder(ReceiptPrintPayload p, PrinterProfile profile)
        {
            var builder = new RasterReceiptBuilder(profile.PrintableWidthDots);

            builder.AddTitle(p.RestaurantName);
            if (!string.IsNullOrWhiteSpace(p.BranchName)) builder.AddCenterText(p.BranchName, isBold: true);
            if (!string.IsNullOrWhiteSpace(p.BranchAddress)) builder.AddCenterText(p.BranchAddress, isSmall: true);
            if (!string.IsNullOrWhiteSpace(p.BranchPhone)) builder.AddCenterText($"Hotline: {p.BranchPhone}", isSmall: true);

            builder.AddSpace(4);
            builder.AddTitle(p.IsProForma ? "PHIẾU TẠM TÍNH" : "HÓA ĐƠN THANH TOÁN");
            builder.AddDivider('=');

            builder.AddLeftRight("Mã đơn:", p.OrderCode, isBold: true);
            if (!string.IsNullOrWhiteSpace(p.TableName)) builder.AddLeftRight("Bàn ăn:", p.TableName, isBold: true);
            builder.AddLeftRight("Thời gian:", p.OrderTime.ToString("dd/MM/yyyy HH:mm"));
            if (!string.IsNullOrWhiteSpace(p.CashierName)) builder.AddLeftRight("Thu ngân:", p.CashierName);
            if (!string.IsNullOrWhiteSpace(p.CustomerName)) builder.AddLeftRight("Khách hàng:", p.CustomerName);
            if (!string.IsNullOrWhiteSpace(p.CustomerPhone)) builder.AddLeftRight("SĐT:", p.CustomerPhone);
            if (p.GuestCount > 0) builder.AddLeftRight("Số khách:", p.GuestCount.ToString());

            builder.AddDivider('-');
            builder.AddLeftRight("Tên món / Đơn giá", "Thành tiền", isBold: true);
            builder.AddDivider('-');

            foreach (var item in p.Items)
            {
                builder.AddItemRow(item.Name, item.Quantity, item.UnitPrice, item.TotalPrice, item.Note, item.Options);
            }

            builder.AddDivider('-');

            builder.AddLeftRight("Tiền hàng:", $"{p.SubTotal:N0}đ");
            if (p.ItemDiscountTotal > 0) builder.AddLeftRight("Giảm giá món:", $"-{p.ItemDiscountTotal:N0}đ");
            if (p.OrderDiscountAmount > 0)
            {
                string label = string.IsNullOrWhiteSpace(p.VoucherCode) ? "Giảm giá đơn:" : $"Voucher ({p.VoucherCode}):";
                builder.AddLeftRight(label, $"-{p.OrderDiscountAmount:N0}đ");
            }
            if (p.PointsDiscountAmount > 0) builder.AddLeftRight("Đổi điểm tích lũy:", $"-{p.PointsDiscountAmount:N0}đ");
            if (p.ServiceChargeTotal > 0) builder.AddLeftRight("Phí dịch vụ:", $"{p.ServiceChargeTotal:N0}đ");
            if (p.TaxAmount > 0) builder.AddLeftRight("Thuế VAT:", $"{p.TaxAmount:N0}đ");
            if (p.ShippingFee > 0) builder.AddLeftRight("Phí giao hàng:", $"{p.ShippingFee:N0}đ");

            builder.AddDivider('=');
            builder.AddLeftRight("TỔNG CỘNG:", $"{p.TotalAmount:N0}đ", isBold: true);

            if (!p.IsProForma)
            {
                builder.AddLeftRight("Phương thức:", p.PaymentMethod switch
                {
                    "CASH" => "Tiền mặt",
                    "BANK_TRANSFER" => "Chuyển khoản QR",
                    "CARD" => "Thẻ ngân hàng",
                    _ => p.PaymentMethod
                });

                if (p.PaymentMethod == "CASH")
                {
                    builder.AddLeftRight("Tiền khách đưa:", $"{p.AmountReceived:N0}đ");
                    builder.AddLeftRight("Tiền thừa trả lại:", $"{p.ChangeAmount:N0}đ", isBold: true);
                }

                if (p.PointsEarned.HasValue && p.PointsEarned.Value > 0)
                {
                    builder.AddLeftRight("Điểm tích lũy mới:", $"+{p.PointsEarned.Value} điểm");
                }
                if (p.MemberPointsBalance.HasValue)
                {
                    builder.AddLeftRight("Số dư điểm:", $"{p.MemberPointsBalance.Value} điểm");
                }
            }

            if (p.IsInvoiceRequested)
            {
                builder.AddDivider('-');
                builder.AddCenterText("THÔNG TIN XUẤT HÓA ĐƠN GTGT", isBold: true);
                if (!string.IsNullOrWhiteSpace(p.InvoiceTaxCode)) builder.AddLeftRight("MST:", p.InvoiceTaxCode);
                if (!string.IsNullOrWhiteSpace(p.InvoiceCompanyName)) builder.AddCenterText(p.InvoiceCompanyName, isBold: false, isSmall: true);
                if (!string.IsNullOrWhiteSpace(p.InvoiceAddress)) builder.AddCenterText(p.InvoiceAddress, isSmall: true);
                if (!string.IsNullOrWhiteSpace(p.InvoiceEmail)) builder.AddLeftRight("Email:", p.InvoiceEmail, false);
            }

            builder.AddSpace(6);
            if (!string.IsNullOrWhiteSpace(p.FooterNote)) builder.AddCenterText(p.FooterNote, isSmall: true);
            builder.AddCenterText("Wifi: AVORA Guest | Pass: 88888888", isSmall: true);
            builder.AddSpace(8);

            return builder;
        }

        public static byte[] BuildReceiptRasterBytes(ReceiptPrintPayload p, PrinterProfile profile)
        {
            var builder = CreateReceiptBuilder(p, profile);
            return builder.ToEscPosRasterBytes(profile);
        }

        public static RasterReceiptBuilder CreateKitchenTicketBuilder(KitchenPrintPayload p, PrinterProfile profile)
        {
            var builder = new RasterReceiptBuilder(profile.PrintableWidthDots);

            string title = p.IsCancelTicket ? "PHIẾU HỦY MÓN BẾP" : $"PHIẾU BẾP - {p.StationName.ToUpperInvariant()}";
            builder.AddTitle(title);
            builder.AddDivider('=');

            builder.AddLeftRight("Bàn ăn:", p.TableName, isBold: true);
            builder.AddLeftRight("Mã đơn:", p.OrderCode, isBold: true);
            builder.AddLeftRight("Thời gian:", p.SentTime.ToString("HH:mm:ss dd/MM"));
            if (!string.IsNullOrWhiteSpace(p.CashierOrWaiterName)) builder.AddLeftRight("Nhân viên:", p.CashierOrWaiterName);
            if (p.IsCancelTicket && !string.IsNullOrWhiteSpace(p.GeneralCancelReason))
            {
                builder.AddDivider('-');
                builder.AddCenterText($"LÝ DO HỦY: {p.GeneralCancelReason}", isBold: true);
            }

            builder.AddDivider('-');
            builder.AddLeftRight("Tên món", "Số lượng", isBold: true);
            builder.AddDivider('-');

            foreach (var it in p.Items)
            {
                string qtyStr = it.IsCancelled ? $"HỦY {it.Quantity}" : $"x {it.Quantity}";
                builder.AddLeftRight(it.Name, qtyStr, isBold: true);

                if (it.Options != null && it.Options.Count > 0)
                {
                    foreach (var opt in it.Options)
                    {
                        builder.AddCenterText($"   + {opt}", isSmall: true);
                    }
                }

                if (!string.IsNullOrWhiteSpace(it.Note))
                {
                    builder.AddCenterText($"   * {it.Note}", isBold: true, isSmall: true);
                }

                if (it.IsCancelled && !string.IsNullOrWhiteSpace(it.CancelReason))
                {
                    builder.AddCenterText($"   ! Lý do hủy: {it.CancelReason}", isBold: true, isSmall: true);
                }

                builder.AddSpace(3);
            }

            builder.AddDivider('=');
            builder.AddSpace(8);

            return builder;
        }

        public static byte[] BuildKitchenTicketRasterBytes(KitchenPrintPayload p, PrinterProfile profile)
        {
            var builder = CreateKitchenTicketBuilder(p, profile);
            return builder.ToEscPosRasterBytes(profile);
        }
    }
}
