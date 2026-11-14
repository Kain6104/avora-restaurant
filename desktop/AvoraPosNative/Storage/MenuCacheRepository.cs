using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using AvoraPosNative.Models;
using Microsoft.Data.Sqlite;
using Newtonsoft.Json;

namespace AvoraPosNative.Storage
{
    public static class MenuCacheRepository
    {
        public static async Task SaveMenuSnapshotAsync(string branchId, List<PosProduct> products, List<PosCategory> categories)
        {
            if (string.IsNullOrWhiteSpace(branchId)) return;

            LocalDatabase.Initialize();
            using var conn = new SqliteConnection(LocalDatabase.ConnectionString);
            await conn.OpenAsync();

            using var trans = conn.BeginTransaction();
            try
            {
                string now = DateTime.UtcNow.ToString("o");
                string version = $"{DateTime.UtcNow:yyyyMMddHHmmss}";

                // 1. Upsert Categories
                foreach (var cat in categories)
                {
                    using var cmdCat = conn.CreateCommand();
                    cmdCat.Transaction = trans;
                    cmdCat.CommandText = @"
                        INSERT INTO category_cache (id, branch_id, name, slug, product_count, json_data, updated_at)
                        VALUES (@id, @branchId, @name, @slug, @pCount, @json, @updated)
                        ON CONFLICT(id, branch_id) DO UPDATE SET
                            name = @name,
                            slug = @slug,
                            product_count = @pCount,
                            json_data = @json,
                            updated_at = @updated;
                    ";
                    cmdCat.Parameters.AddWithValue("@id", cat.Id);
                    cmdCat.Parameters.AddWithValue("@branchId", branchId);
                    cmdCat.Parameters.AddWithValue("@name", cat.Name);
                    cmdCat.Parameters.AddWithValue("@slug", cat.Slug ?? string.Empty);
                    cmdCat.Parameters.AddWithValue("@pCount", cat.ProductCount);
                    cmdCat.Parameters.AddWithValue("@json", JsonConvert.SerializeObject(cat));
                    cmdCat.Parameters.AddWithValue("@updated", now);
                    await cmdCat.ExecuteNonQueryAsync();
                }

                // 2. Upsert Products
                foreach (var prod in products)
                {
                    using var cmdProd = conn.CreateCommand();
                    cmdProd.Transaction = trans;
                    cmdProd.CommandText = @"
                        INSERT INTO product_cache (
                            id, branch_id, name, code, price, discounted_price, effective_price,
                            category_id, category_name, available, is_buffet_ticket, is_buffet_item,
                            json_data, updated_at
                        )
                        VALUES (
                            @id, @branchId, @name, @code, @price, @discPrice, @effPrice,
                            @catId, @catName, @avail, @isBufTick, @isBufItem,
                            @json, @updated
                        )
                        ON CONFLICT(id, branch_id) DO UPDATE SET
                            name = @name,
                            code = @code,
                            price = @price,
                            discounted_price = @discPrice,
                            effective_price = @effPrice,
                            category_id = @catId,
                            category_name = @catName,
                            available = @avail,
                            is_buffet_ticket = @isBufTick,
                            is_buffet_item = @isBufItem,
                            json_data = @json,
                            updated_at = @updated;
                    ";
                    cmdProd.Parameters.AddWithValue("@id", prod.Id);
                    cmdProd.Parameters.AddWithValue("@branchId", branchId);
                    cmdProd.Parameters.AddWithValue("@name", prod.Name);
                    cmdProd.Parameters.AddWithValue("@code", prod.Code ?? string.Empty);
                    cmdProd.Parameters.AddWithValue("@price", (double)prod.Price);
                    cmdProd.Parameters.AddWithValue("@discPrice", prod.DiscountedPrice.HasValue ? (double)prod.DiscountedPrice.Value : (object)DBNull.Value);
                    cmdProd.Parameters.AddWithValue("@effPrice", (double)prod.EffectivePrice);
                    cmdProd.Parameters.AddWithValue("@catId", prod.CategoryId ?? string.Empty);
                    cmdProd.Parameters.AddWithValue("@catName", prod.CategoryName ?? string.Empty);
                    cmdProd.Parameters.AddWithValue("@avail", prod.Available ? 1 : 0);
                    cmdProd.Parameters.AddWithValue("@isBufTick", prod.IsBuffetTicket ? 1 : 0);
                    cmdProd.Parameters.AddWithValue("@isBufItem", prod.IsBuffetItem ? 1 : 0);
                    cmdProd.Parameters.AddWithValue("@json", JsonConvert.SerializeObject(prod));
                    cmdProd.Parameters.AddWithValue("@updated", now);
                    await cmdProd.ExecuteNonQueryAsync();
                }

                // 3. Update Snapshot Metadata
                using var cmdMeta = conn.CreateCommand();
                cmdMeta.Transaction = trans;
                cmdMeta.CommandText = @"
                    INSERT INTO menu_snapshot_meta (branch_id, snapshot_version, product_count, category_count, synced_at, status)
                    VALUES (@branchId, @version, @pCount, @cCount, @now, 'ACTIVE')
                    ON CONFLICT(branch_id) DO UPDATE SET
                        snapshot_version = @version,
                        product_count = @pCount,
                        category_count = @cCount,
                        synced_at = @now,
                        status = 'ACTIVE';
                ";
                cmdMeta.Parameters.AddWithValue("@branchId", branchId);
                cmdMeta.Parameters.AddWithValue("@version", version);
                cmdMeta.Parameters.AddWithValue("@pCount", products.Count);
                cmdMeta.Parameters.AddWithValue("@cCount", categories.Count);
                cmdMeta.Parameters.AddWithValue("@now", now);
                await cmdMeta.ExecuteNonQueryAsync();

                trans.Commit();
                System.Diagnostics.Debug.WriteLine($"[MENU CACHE] Cached {products.Count} products & {categories.Count} categories for branch {branchId}");
            }
            catch (Exception ex)
            {
                trans.Rollback();
                System.Diagnostics.Debug.WriteLine($"[MENU CACHE] Error saving snapshot: {ex.Message}");
                throw;
            }
        }

        public static async Task<List<PosCategory>> GetCachedCategoriesAsync(string branchId)
        {
            var list = new List<PosCategory>();
            if (string.IsNullOrWhiteSpace(branchId)) return list;

            LocalDatabase.Initialize();
            using var conn = new SqliteConnection(LocalDatabase.ConnectionString);
            await conn.OpenAsync();

            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT json_data FROM category_cache WHERE branch_id = @branchId ORDER BY name ASC;";
            cmd.Parameters.AddWithValue("@branchId", branchId);

            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                string json = reader.GetString(0);
                var cat = JsonConvert.DeserializeObject<PosCategory>(json);
                if (cat != null) list.Add(cat);
            }

            return list;
        }

        public static async Task<List<PosProduct>> GetCachedProductsAsync(string branchId, string? categoryId = null, string? search = null)
        {
            var list = new List<PosProduct>();
            if (string.IsNullOrWhiteSpace(branchId)) return list;

            LocalDatabase.Initialize();
            using var conn = new SqliteConnection(LocalDatabase.ConnectionString);
            await conn.OpenAsync();

            using var cmd = conn.CreateCommand();
            string sql = "SELECT json_data FROM product_cache WHERE branch_id = @branchId";
            if (!string.IsNullOrEmpty(categoryId) && categoryId != "ALL")
            {
                sql += " AND category_id = @catId";
                cmd.Parameters.AddWithValue("@catId", categoryId);
            }
            sql += " ORDER BY name ASC;";
            cmd.CommandText = sql;
            cmd.Parameters.AddWithValue("@branchId", branchId);

            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                string json = reader.GetString(0);
                var prod = JsonConvert.DeserializeObject<PosProduct>(json);
                if (prod != null)
                {
                    if (!string.IsNullOrWhiteSpace(search))
                    {
                        string q = search.Trim().ToLowerInvariant();
                        bool matchName = (prod.Name ?? "").ToLowerInvariant().Contains(q);
                        bool matchCode = (prod.Code ?? "").ToLowerInvariant().Contains(q);
                        if (!matchName && !matchCode) continue;
                    }
                    list.Add(prod);
                }
            }

            return list;
        }

        public static async Task<MenuSnapshotInfo?> GetLastSnapshotInfoAsync(string branchId)
        {
            if (string.IsNullOrWhiteSpace(branchId)) return null;

            LocalDatabase.Initialize();
            using var conn = new SqliteConnection(LocalDatabase.ConnectionString);
            await conn.OpenAsync();

            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT branch_id, snapshot_version, product_count, category_count, synced_at, status FROM menu_snapshot_meta WHERE branch_id = @branchId LIMIT 1;";
            cmd.Parameters.AddWithValue("@branchId", branchId);

            using var reader = await cmd.ExecuteReaderAsync();
            if (await reader.ReadAsync())
            {
                return new MenuSnapshotInfo
                {
                    BranchId = reader.GetString(0),
                    SnapshotVersion = reader.GetString(1),
                    ProductCount = reader.GetInt32(2),
                    CategoryCount = reader.GetInt32(3),
                    SyncedAt = DateTime.Parse(reader.GetString(4)),
                    Status = reader.GetString(5)
                };
            }

            return null;
        }
    }
}

