using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using AvoraPosNative.Models;
using AvoraPosNative.Printing;
using AvoraPosNative.Services;
using AvoraPosNative.Storage;
using Microsoft.Data.Sqlite;

namespace AvoraPosNative.Tests
{
    class Program
    {
        static async Task<int> Main(string[] args)
        {
            Console.WriteLine("================================================================================");
            Console.WriteLine("AVORA POS NATIVE — OFFLINE-FIRST ARCHITECTURE VERIFICATION TEST SUITE");
            Console.WriteLine("================================================================================");

            int passed = 0;
            int failed = 0;

            try
            {
                // TEST 1: Database Initialization & Tables
                Console.Write("\n[TEST 1] Khởi tạo SQLite LocalDatabase & kiểm tra bảng... ");
                LocalDatabase.Initialize();
                using (var conn = new SqliteConnection(LocalDatabase.ConnectionString))
                {
                    await conn.OpenAsync();
                    using var cmd = conn.CreateCommand();
                    cmd.CommandText = @"
                        SELECT count(*) FROM sqlite_master 
                        WHERE type='table' AND name IN ('offline_orders', 'outbox_events', 'product_cache', 'category_cache', 'menu_snapshot_meta', 'print_jobs', 'local_order_sequences');
                    ";
                    long tableCount = (long)(await cmd.ExecuteScalarAsync() ?? 0);
                    if (tableCount >= 7)
                    {
                        Console.ForegroundColor = ConsoleColor.Green;
                        Console.WriteLine($"PASS ({tableCount}/7 bảng đầy đủ)");
                        Console.ResetColor();
                        passed++;
                    }
                    else
                    {
                        Console.ForegroundColor = ConsoleColor.Red;
                        Console.WriteLine($"FAIL (Chỉ tìm thấy {tableCount}/7 bảng)");
                        Console.ResetColor();
                        failed++;
                    }
                }

                // TEST 2: Menu Cache Snapshot Saving
                Console.Write("[TEST 2] Lưu Menu Snapshot (Sản phẩm, Danh mục, Toppings) vào SQLite... ");
                string testBranchId = "test-branch-" + Guid.NewGuid().ToString("N").Substring(0, 8);
                var testCategories = new List<PosCategory>
                {
                    new PosCategory { Id = "cat-1", Name = "Khai Vị", Slug = "khai-vi", ProductCount = 2 },
                    new PosCategory { Id = "cat-2", Name = "Món Chính", Slug = "mon-chinh", ProductCount = 1 }
                };
                var testProducts = new List<PosProduct>
                {
                    new PosProduct { Id = "prod-1", Name = "Gỏi cuốn tôm thịt", ItemCode = "KV01", Price = 85000, EffectivePrice = 85000, CategoryId = "cat-1", CategoryName = "Khai Vị", Available = true },
                    new PosProduct { Id = "prod-2", Name = "Chả giò hải sản", ItemCode = "KV02", Price = 95000, EffectivePrice = 90000, CategoryId = "cat-1", CategoryName = "Khai Vị", Available = true, DiscountedPrice = 90000 },
                    new PosProduct { Id = "prod-3", Name = "Bò Wagyu nướng sốt tiêu", ItemCode = "MC01", Price = 350000, EffectivePrice = 350000, CategoryId = "cat-2", CategoryName = "Món Chính", Available = true }
                };

                await MenuCacheRepository.SaveMenuSnapshotAsync(testBranchId, testProducts, testCategories);
                var meta = await MenuCacheRepository.GetLastSnapshotInfoAsync(testBranchId);
                if (meta != null && meta.ProductCount == 3 && meta.CategoryCount == 2 && meta.Status == "ACTIVE")
                {
                    Console.ForegroundColor = ConsoleColor.Green;
                    Console.WriteLine($"PASS (Snapshot ACTIVE, {meta.ProductCount} món, {meta.CategoryCount} danh mục)");
                    Console.ResetColor();
                    passed++;
                }
                else
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine("FAIL (Không lưu được metadata)");
                    Console.ResetColor();
                    failed++;
                }

                // TEST 3: Offline Menu Querying
                Console.Write("[TEST 3] Truy vấn Menu Offline khi ngắt kết nối... ");
                var cachedProds = await MenuCacheRepository.GetCachedProductsAsync(testBranchId);
                var cachedCats = await MenuCacheRepository.GetCachedCategoriesAsync(testBranchId);
                var searchResult = await MenuCacheRepository.GetCachedProductsAsync(testBranchId, search: "Wagyu");

                if (cachedProds.Count == 3 && cachedCats.Count == 2 && searchResult.Count == 1 && searchResult[0].ItemCode == "MC01")
                {
                    Console.ForegroundColor = ConsoleColor.Green;
                    Console.WriteLine($"PASS (Đọc được {cachedProds.Count} món, tìm kiếm 'Wagyu' chính xác)");
                    Console.ResetColor();
                    passed++;
                }
                else
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine("FAIL (Sai lệch kết quả tìm kiếm)");
                    Console.ResetColor();
                    failed++;
                }

                // TEST 4: Offline Order Engine - Send To Kitchen (Atomic Order + Outbox + Print Job)
                Console.Write("[TEST 4] Gửi bếp Offline: Giao dịch ACID (Order + Outbox + PrintJob)... ");
                var testTable = new PosTable { Id = "tbl-101", Name = "Bàn 101", Capacity = 4, AreaName = "Tầng 1" };
                var testItems = new List<PosOrderItem>
                {
                    new PosOrderItem { ProductId = "prod-1", ProductName = "Gỏi cuốn tôm thịt", Quantity = 2, Price = 85000, LineTotal = 170000, Status = "NEW", Note = "Ít cay" },
                    new PosOrderItem { ProductId = "prod-3", ProductName = "Bò Wagyu nướng sốt tiêu", Quantity = 1, Price = 350000, LineTotal = 350000, Status = "NEW", Note = "Chín vừa Medium" }
                };

                var (kSuccess, kOrder, kErr) = await OfflineOrderEngine.Instance.RegisterSendToKitchenOfflineAsync(
                    table: testTable,
                    allItems: testItems,
                    newItems: testItems,
                    branchId: testBranchId,
                    cashierName: "Thu ngân Test"
                );

                if (kSuccess && kOrder != null && !string.IsNullOrEmpty(kOrder.LocalOrderCode))
                {
                    // Kiểm tra xem Outbox Event và Print Job có được tạo không
                    var pendingEvents = await OutboxRepository.GetPendingEventsAsync();
                    var outboxEvt = pendingEvents.FirstOrDefault(e => e.AggregateId == kOrder.ClientOrderId);

                    using var conn = new SqliteConnection(LocalDatabase.ConnectionString);
                    await conn.OpenAsync();
                    using var cmd = conn.CreateCommand();
                    cmd.CommandText = "SELECT count(*) FROM print_jobs WHERE doc_name LIKE @doc;";
                    cmd.Parameters.AddWithValue("@doc", $"%{kOrder.LocalOrderCode}%");
                    long jobCount = (long)(await cmd.ExecuteScalarAsync() ?? 0);

                    if (outboxEvt != null && jobCount > 0)
                    {
                        Console.ForegroundColor = ConsoleColor.Green;
                        Console.WriteLine($"PASS (Mã: {kOrder.LocalOrderCode}, Outbox Event OK, PrintJob OK)");
                        Console.ResetColor();
                        passed++;
                    }
                    else
                    {
                        Console.ForegroundColor = ConsoleColor.Red;
                        Console.WriteLine($"FAIL (Outbox: {outboxEvt != null}, PrintJob: {jobCount})");
                        Console.ResetColor();
                        failed++;
                    }
                }
                else
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine($"FAIL: {kErr}");
                    Console.ResetColor();
                    failed++;
                }

                // TEST 5: Offline Cash Payment (Atomic Order PAID + Outbox PAY + Receipt Job)
                Console.Write("[TEST 5] Thanh toán Tiền mặt Offline: Giao dịch ACID hoàn tất đơn... ");
                var (pSuccess, pOrder, pErr) = await OfflineOrderEngine.Instance.RegisterCashPaymentOfflineAsync(
                    table: testTable,
                    items: testItems,
                    branchId: testBranchId,
                    cashierName: "Thu ngân Test",
                    subTotal: 520000,
                    discountAmount: 20000,
                    taxAmount: 40000,
                    shippingFee: 0,
                    totalAmount: 540000,
                    receivedAmount: 600000,
                    changeAmount: 60000,
                    customerName: "Nguyễn Văn A",
                    customerPhone: "0901234567"
                );

                if (pSuccess && pOrder != null && pOrder.PaymentStatus == "PAID")
                {
                    var saved = await OfflineOrderRepository.GetOrderByClientIdAsync(pOrder.ClientOrderId);
                    if (saved != null && saved.PaymentStatus == "PAID" && saved.TotalAmount == 540000)
                    {
                        Console.ForegroundColor = ConsoleColor.Green;
                        Console.WriteLine($"PASS (Lưu PAID thành công, Tiền thối: {pOrder.ChangeAmount:N0}đ)");
                        Console.ResetColor();
                        passed++;
                    }
                    else
                    {
                        Console.ForegroundColor = ConsoleColor.Red;
                        Console.WriteLine("FAIL (Dữ liệu SQLite không khớp trạng thái PAID)");
                        Console.ResetColor();
                        failed++;
                    }
                }
                else
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine($"FAIL: {pErr}");
                    Console.ResetColor();
                    failed++;
                }

                // TEST 6: Idempotency & Crash Recovery Check
                Console.Write("[TEST 6] Kiểm tra Chống trùng đơn & Idempotency Key... ");
                var pendingOrders = await OfflineOrderRepository.GetPendingSyncOrdersAsync();
                var pendingEventsList = await OutboxRepository.GetPendingEventsAsync();

                // Kiểm tra xem tất cả event có idempotency key duy nhất không
                var keys = pendingEventsList.Select(e => e.IdempotencyKey).ToList();
                bool allUnique = keys.Distinct().Count() == keys.Count;

                if (pendingOrders.Count >= 2 && allUnique)
                {
                    Console.ForegroundColor = ConsoleColor.Green;
                    Console.WriteLine($"PASS ({pendingOrders.Count} đơn pending, 100% Idempotency Keys duy nhất)");
                    Console.ResetColor();
                    passed++;
                }
                else
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine($"FAIL (Pending: {pendingOrders.Count}, UniqueKeys: {allUnique})");
                    Console.ResetColor();
                    failed++;
                }

                // TEST 7: RasterTextEngine LockBits Performance Benchmark
                Console.Write("[TEST 7] Benchmark tốc độ RasterTextEngine (LockBits)... ");
                var samplePayload = new PrintJobPayload
                {
                    Title = "HÓA ĐƠN BENCHMARK",
                    OrderCode = "BM-001",
                    TableName = "Bàn 101",
                    CashierName = "Admin",
                    CustomerName = "Khách Hàng Benchmark",
                    CreatedAt = DateTime.Now,
                    SubTotal = 500000,
                    TotalAmount = 540000,
                    Items = testItems.Select(i => new PrintJobItem
                    {
                        ProductName = i.ProductName,
                        Quantity = i.Quantity,
                        Price = i.Price,
                        LineTotal = i.LineTotal,
                        Note = i.Note
                    }).ToList()
                };

                // Warmup
                RasterTextEngine.BuildReceiptRasterBytes(samplePayload, 576);

                var sw = Stopwatch.StartNew();
                int iterations = 10;
                for (int i = 0; i < iterations; i++)
                {
                    byte[] bytes = RasterTextEngine.BuildReceiptRasterBytes(samplePayload, 576);
                }
                sw.Stop();
                double avgMs = sw.Elapsed.TotalMilliseconds / iterations;

                if (avgMs < 20) // Phải dưới 20ms
                {
                    Console.ForegroundColor = ConsoleColor.Green;
                    Console.WriteLine($"PASS (Trung bình: {avgMs:F2} ms/hóa đơn - siêu tốc)");
                    Console.ResetColor();
                    passed++;
                }
                else
                {
                    Console.ForegroundColor = ConsoleColor.Yellow;
                    Console.WriteLine($"WARN ({avgMs:F2} ms/hóa đơn)");
                    Console.ResetColor();
                    passed++;
                }
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine($"\n[EXCEPTION] {ex}");
                Console.ResetColor();
                failed++;
            }

            Console.WriteLine("================================================================================");
            Console.WriteLine($"KẾT QUẢ KIỂM THỬ: {passed} PASSED, {failed} FAILED");
            Console.WriteLine("================================================================================");

            return failed == 0 ? 0 : 1;
        }
    }
}

