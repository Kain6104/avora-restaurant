import { db, OfflineCommand, LocalProduct, LocalCategory, LocalTable, LocalArea, LocalActiveOrder, LocalCustomer } from './db';
import { mutate } from 'swr';

export type NetworkState = 'ONLINE' | 'SERVER_UNAVAILABLE' | 'OFFLINE';

export interface SyncStatus {
  networkState: NetworkState;
  lastSyncAt: string | null;
  isSyncing: boolean;
  pendingCount: number;
  lastError?: string | null;
}

type SyncListener = (status: SyncStatus) => void;

class SyncEngine {
  private networkState: NetworkState = 'ONLINE';
  private lastSyncAt: string | null = null;
  private isSyncing = false;
  private pendingCount = 0;
  private lastError: string | null = null;
  private listeners = new Set<SyncListener>();
  private activeBranchId: string | null = null;
  private healthCheckTimer: any = null;
  private queueProcessingTimer: any = null;
  private isProcessingQueue = false;

  constructor() {
    if (typeof window !== 'undefined') {
      // Initialize network status
      this.networkState = navigator.onLine ? 'ONLINE' : 'OFFLINE';

      // Load last sync time from IndexedDB
      db.syncMetadata.get('last_global_sync').then((meta) => {
        if (meta) {
          this.lastSyncAt = meta.lastSyncAt;
          this.notify();
        }
      });

      // Update pending count
      this.updatePendingCount();

      // Window online / offline events
      window.addEventListener('online', () => {
        console.log('[SyncEngine] Network online detected');
        this.checkServerHealth().then(() => {
          this.triggerBackgroundSync();
          this.processOfflineQueue();
        });
      });

      window.addEventListener('offline', () => {
        console.log('[SyncEngine] Network offline detected');
        this.setNetworkState('OFFLINE');
      });

      // Tab visibility change (background -> foreground sync)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          console.log('[SyncEngine] Tab foregrounded, triggering sync');
          this.triggerBackgroundSync();
          this.processOfflineQueue();
        }
      });

      // Periodic health check & sync every 45s
      this.healthCheckTimer = setInterval(() => {
        if (navigator.onLine) {
          this.checkServerHealth();
        }
      }, 45000);

      // Periodic offline queue retry every 15s if pending commands exist
      this.queueProcessingTimer = setInterval(() => {
        if (this.networkState === 'ONLINE' && this.pendingCount > 0) {
          this.processOfflineQueue();
        }
      }, 15000);
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  public getStatus(): SyncStatus {
    return {
      networkState: this.networkState,
      lastSyncAt: this.lastSyncAt,
      isSyncing: this.isSyncing,
      pendingCount: this.pendingCount,
      lastError: this.lastError,
    };
  }

  public setActiveBranch(branchId: string | null) {
    if (branchId && branchId !== this.activeBranchId) {
      this.activeBranchId = branchId;
      this.triggerBackgroundSync();
    }
  }

  public setNetworkState(state: NetworkState) {
    if (this.networkState !== state) {
      this.networkState = state;
      this.notify();
    }
  }

  private notify() {
    const status = this.getStatus();
    this.listeners.forEach((l) => {
      try {
        l(status);
      } catch (err) {
        console.error('Error notifying sync listener:', err);
      }
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('avora_sync_status_changed', { detail: status }));
    }
  }

  public async updatePendingCount(): Promise<number> {
    try {
      const count = await db.offlineCommands.where('syncState').equals('PENDING').count();
      this.pendingCount = count;
      this.notify();
      return count;
    } catch {
      return 0;
    }
  }

  /**
   * Health ping to distinguish between OFFLINE and SERVER_UNAVAILABLE
   */
  public async checkServerHealth(): Promise<boolean> {
    if (typeof window === 'undefined') return true;

    if (!navigator.onLine) {
      this.setNetworkState('OFFLINE');
      return false;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch('/api/pos/init?ping=1', {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        this.setNetworkState('ONLINE');
        this.lastError = null;
        return true;
      } else {
        this.setNetworkState('SERVER_UNAVAILABLE');
        this.lastError = `Server responded with ${res.status}`;
        return false;
      }
    } catch (err: any) {
      if (!navigator.onLine) {
        this.setNetworkState('OFFLINE');
      } else {
        this.setNetworkState('SERVER_UNAVAILABLE');
        this.lastError = err?.message || 'Server unreachable';
      }
      return false;
    }
  }

  /**
   * Smart Background Synchronization using Delta API
   */
  public async performDeltaSync(branchId?: string, forceFull: boolean = false): Promise<boolean> {
    if (branchId) {
      this.activeBranchId = branchId;
    }
    return this.triggerBackgroundSync(forceFull);
  }

  public async triggerBackgroundSync(forceFull: boolean = false): Promise<boolean> {
    if (typeof window === 'undefined' || this.isSyncing) return false;
    if (!navigator.onLine) {
      this.setNetworkState('OFFLINE');
      return false;
    }

    const branchId = this.activeBranchId || localStorage.getItem('avora_waiter_selected_branch') || localStorage.getItem('avora_admin_selected_branch');
    if (!branchId || branchId === 'ALL') {
      return false;
    }

    this.isSyncing = true;
    this.notify();

    try {
      const metaKey = `delta_${branchId}`;
      const lastMeta = forceFull ? null : await db.syncMetadata.get(metaKey);
      const sinceParam = lastMeta?.serverTimestamp ? `&since=${encodeURIComponent(lastMeta.serverTimestamp)}` : '';

      const res = await fetch(`/api/pos/sync/delta?branchId=${branchId}${sinceParam}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        if (res.status >= 500 || res.status === 404) {
          this.setNetworkState('SERVER_UNAVAILABLE');
        }
        return false;
      }

      const json = await res.json();
      if (!json.success || !json.data) {
        return false;
      }

      const syncData = json.data;
      const serverTime = syncData.serverTime || new Date().toISOString();

      await db.transaction('rw', [db.products, db.categories, db.posTables, db.areas, db.activeOrders, db.syncMetadata], async () => {
        // 1. Process Categories
        if (syncData.isDelta && syncData.changedCategories) {
          for (const cat of syncData.changedCategories) {
            await db.categories.put({
              id: cat.id,
              branchId,
              name: cat.name,
              slug: cat.slug,
              displayOrder: cat.displayOrder,
              productCount: cat.productCount,
              updatedAt: cat.updatedAt,
            });
          }
        } else if (syncData.categories) {
          const catList: LocalCategory[] = syncData.categories.map((cat: any) => ({
            id: cat.id,
            branchId,
            name: cat.name,
            slug: cat.slug,
            displayOrder: cat.displayOrder,
            productCount: cat.productCount,
            updatedAt: cat.updatedAt,
          }));
          await db.categories.bulkPut(catList);
        }

        // 2. Process Products
        if (syncData.isDelta && syncData.changedProducts) {
          for (const prod of syncData.changedProducts) {
            await db.products.put({
              ...prod,
              branchId,
            });
          }

          // Handle product deletions: remove local products not in activeProductIds
          if (Array.isArray(syncData.activeProductIds)) {
            const activeSet = new Set<string>(syncData.activeProductIds);
            const localProducts = await db.products.toArray();
            const toDelete = localProducts.filter((p) => !activeSet.has(p.id)).map((p) => p.id);
            if (toDelete.length > 0) {
              await db.products.bulkDelete(toDelete);
            }
          }
        } else if (syncData.products) {
          const prodList: LocalProduct[] = syncData.products.map((prod: any) => ({
            ...prod,
            branchId,
          }));
          await db.products.bulkPut(prodList);
        }

        // 3. Process Tables & Areas with Delta Reconciliation for branchId
        if (syncData.tables && Array.isArray(syncData.tables)) {
          const incomingTableIds = new Set<string>(syncData.tables.map((t: any) => t.id));
          
          // Xóa các bàn thuộc chi nhánh này nếu máy chủ đã xóa (đảm bảo số bàn luôn khớp với thực tế)
          const existingBranchTables = await db.posTables.where('branchId').equals(branchId).toArray();
          const existingTableMap = new Map<string, LocalTable>();
          for (const et of existingBranchTables) {
            existingTableMap.set(et.id, et);
          }
          const staleTableIds = existingBranchTables.filter(t => !incomingTableIds.has(t.id)).map(t => t.id);
          if (staleTableIds.length > 0) {
            await db.posTables.bulkDelete(staleTableIds);
          }

          const tableList: LocalTable[] = syncData.tables.map((t: any) => {
            const existingTable = existingTableMap.get(t.id);
            const hasSessionField = 'activeSession' in t;
            const hasOrderField = 'currentOrder' in t;
            const hasVisualField = 'visualStatus' in t;

            return {
              id: t.id,
              branchId,
              tableCode: t.tableCode,
              name: t.name,
              areaId: t.areaId || null,
              capacity: t.capacity || 4,
              status: t.status,
              isActive: t.isActive !== false,
              sortOrder: t.sortOrder,
              activeSession: hasSessionField ? (t.activeSession || null) : (existingTable?.activeSession ?? null),
              currentOrder: hasOrderField ? (t.currentOrder || null) : (existingTable?.currentOrder ?? null),
              visualStatus: hasVisualField ? (t.visualStatus || 'EMPTY') : (existingTable?.visualStatus ?? 'EMPTY'),
              updatedAt: t.updatedAt,
            };
          });
          await db.posTables.bulkPut(tableList);
        }

        if (syncData.areas && Array.isArray(syncData.areas)) {
          const incomingAreaIds = new Set<string>(syncData.areas.map((a: any) => a.id));
          
          // Xóa khu vực không còn tồn tại trên máy chủ của chi nhánh này
          const existingBranchAreas = await db.areas.where('branchId').equals(branchId).toArray();
          const staleAreaIds = existingBranchAreas.filter(a => !incomingAreaIds.has(a.id)).map(a => a.id);
          if (staleAreaIds.length > 0) {
            await db.areas.bulkDelete(staleAreaIds);
          }

          const areaList: LocalArea[] = syncData.areas.map((a: any) => ({
            id: a.id,
            branchId,
            name: a.name,
            sortOrder: a.sortOrder || 0,
          }));
          await db.areas.bulkPut(areaList);
        }

        // 4. Process Active Orders with Reconciliation
        if (syncData.activeOrders && Array.isArray(syncData.activeOrders)) {
          const incomingOrderIds = new Set<string>(syncData.activeOrders.map((o: any) => o.id));
          
          // Xóa đơn đã hoàn thành/thanh toán trên server (trừ đơn nháp tạo offline hoặc đơn chờ đồng bộ)
          const currentOrders = await db.activeOrders.where('branchId').equals(branchId).toArray();
          const toDeleteOrders = currentOrders
            .filter(o => !incomingOrderIds.has(o.id) && !o.id.startsWith('offline_') && o.status !== 'DRAFT')
            .map(o => o.id);
          if (toDeleteOrders.length > 0) {
            await db.activeOrders.bulkDelete(toDeleteOrders);
          }

          const existingMap = new Map<string, LocalActiveOrder>();
          for (const co of currentOrders) {
            existingMap.set(co.id, co);
          }

          const orderList: LocalActiveOrder[] = syncData.activeOrders.map((o: any) => {
            const existing = existingMap.get(o.id);
            let mergedItems = o.orderItems || [];
            if (existing && Array.isArray(existing.orderItems)) {
              const pendingItems = existing.orderItems.filter((it: any) =>
                typeof it.id === 'string' && (it.id.startsWith('opt_') || it.id.startsWith('offline_'))
              );
              if (pendingItems.length > 0) {
                const serverItemIds = new Set(mergedItems.map((it: any) => it.id));
                const missingPending = pendingItems.filter((it: any) => !serverItemIds.has(it.id));
                mergedItems = [...mergedItems, ...missingPending];
              }
            }
            return {
              id: o.id,
              branchId,
              tableId: o.tableId,
              orderCode: o.orderCode,
              temporaryOrderCode: o.temporaryOrderCode || null,
              guestCount: o.guestCount || 2,
              totalAmount: o.totalAmount || 0,
              subTotal: o.subTotal || 0,
              status: o.status,
              paymentStatus: o.paymentStatus,
              kitchenStatus: o.kitchenStatus || 'PENDING',
              cashierId: o.cashierId || null,
              orderItems: mergedItems,
              user: o.user || null,
              updatedAt: o.updatedAt,
            };
          });
          await db.activeOrders.bulkPut(orderList);
        }

        // 5. Update Metadata
        await db.syncMetadata.put({
          key: metaKey,
          branchId,
          lastSyncAt: new Date().toISOString(),
          serverTimestamp: serverTime,
        });

        await db.syncMetadata.put({
          key: 'last_global_sync',
          lastSyncAt: new Date().toISOString(),
          serverTimestamp: serverTime,
        });
      });

      this.lastSyncAt = new Date().toISOString();
      this.setNetworkState('ONLINE');

      // Sync customer cache in background
      this.syncCustomers();

      // Revalidate SWR cache safely WITHOUT wiping cached data to undefined
      mutate(
        (key) => typeof key === 'string' && key.startsWith('/api/pos/'),
        (current: unknown) => current,
        { revalidate: true }
      );

      // Dispatch event to app
      window.dispatchEvent(new CustomEvent('avora_data_synced', { detail: { branchId, timestamp: this.lastSyncAt } }));

      return true;
    } catch (err: any) {
      console.warn('[SyncEngine] Background sync failed:', err);
      if (!navigator.onLine) {
        this.setNetworkState('OFFLINE');
      } else {
        this.setNetworkState('SERVER_UNAVAILABLE');
      }
      return false;
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }

  /**
   * Background Customer Cache Synchronization
   */
  public async syncCustomers(): Promise<void> {
    if (!navigator.onLine) return;
    try {
      const meta = await db.syncMetadata.get('customers_meta');
      const sinceParam = meta?.serverTimestamp ? `?since=${encodeURIComponent(meta.serverTimestamp)}` : '';
      const res = await fetch(`/api/pos/customers/sync${sinceParam}`, {
        method: 'GET',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data?.customers)) {
          const list: LocalCustomer[] = json.data.customers.map((c: any) => ({
            id: c.id,
            fullName: c.fullName,
            phone: c.phone,
            email: c.email,
            memberCode: c.memberCode,
            points: c.points || 0,
            currentPoints: c.currentPoints || 0,
            membershipTier: c.membershipTier,
            totalSpending: c.totalSpending || 0,
            updatedAt: c.updatedAt,
          }));
          await db.customers.bulkPut(list);
          await db.syncMetadata.put({
            key: 'customers_meta',
            lastSyncAt: new Date().toISOString(),
            serverTimestamp: json.data.serverTime,
            count: list.length,
          });
        }
      }
    } catch (e) {
      console.debug('[SyncEngine] Customer sync skipped:', e);
    }
  }

  /**
   * Offline Command Queue Execution with Exponential Backoff and Idempotency
   */
  public async processOfflineQueue(): Promise<{ processed: number; succeeded: number; failed: number }> {
    if (this.isProcessingQueue || typeof window === 'undefined') {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    if (!navigator.onLine) {
      this.setNetworkState('OFFLINE');
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    this.isProcessingQueue = true;
    let succeeded = 0;
    let failed = 0;

    try {
      const pendingCommands = await db.offlineCommands
        .where('syncState')
        .equals('PENDING')
        .sortBy('id');

      if (pendingCommands.length === 0) {
        this.updatePendingCount();
        return { processed: 0, succeeded: 0, failed: 0 };
      }

      for (const cmd of pendingCommands) {
        // Mark as SYNCING
        await db.offlineCommands.update(cmd.id!, { syncState: 'SYNCING', updatedAt: new Date().toISOString() });

        try {
          let success = false;

          if (cmd.commandType === 'SEND_ITEMS' && cmd.tableId) {
            const res = await fetch(`/api/pos/tables/${cmd.tableId}/send-items`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...cmd.payload,
                idempotencyKey: cmd.idempotencyKey,
              }),
            });

            if (res.ok) {
              const resJson = await res.json();
              if (resJson.success) {
                await db.offlineCommands.update(cmd.id!, {
                  syncState: 'COMPLETED',
                  updatedAt: new Date().toISOString(),
                });
                success = true;
                succeeded++;
              } else {
                throw new Error(resJson.message || 'Lỗi gửi món');
              }
            } else if (res.status === 409) {
              // Version Conflict
              await db.offlineCommands.update(cmd.id!, {
                syncState: 'CONFLICT',
                errorReason: 'Xung đột dữ liệu phiên bàn (409 Conflict)',
                updatedAt: new Date().toISOString(),
              });
              failed++;
            } else if (res.status >= 500) {
              // Server error: keep pending for backoff retry
              throw new Error(`Server error ${res.status}`);
            } else {
              // 4xx bad request: mark failed
              const errorBody = await res.text().catch(() => '');
              await db.offlineCommands.update(cmd.id!, {
                syncState: 'FAILED',
                errorReason: errorBody || `HTTP ${res.status}`,
                updatedAt: new Date().toISOString(),
              });
              failed++;
            }
          }

          if (success) {
            // Trigger table refresh
            this.triggerBackgroundSync();
          }
        } catch (err: any) {
          console.warn(`[SyncEngine] Error executing offline command #${cmd.id}:`, err);
          const nextRetry = (cmd.retryCount || 0) + 1;
          await db.offlineCommands.update(cmd.id!, {
            syncState: 'PENDING',
            retryCount: nextRetry,
            errorReason: err.message,
            updatedAt: new Date().toISOString(),
          });
          failed++;
        }
      }

      await this.updatePendingCount();
      return { processed: pendingCommands.length, succeeded, failed };
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Enqueue a new offline command
   */
  public async enqueueCommand(
    commandType: string,
    branchId: string,
    payload: any,
    options?: { tableId?: string; orderId?: string }
  ): Promise<OfflineCommand> {
    const idempotencyKey = `cmd_${commandType.toLowerCase()}_${crypto.randomUUID()}`;
    const newCommand: OfflineCommand = {
      idempotencyKey,
      commandType,
      branchId,
      tableId: options?.tableId,
      orderId: options?.orderId,
      payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncState: 'PENDING',
      retryCount: 0,
    };

    const id = await db.offlineCommands.add(newCommand);
    newCommand.id = id;

    await this.updatePendingCount();

    // If online, attempt to process immediately
    if (this.networkState === 'ONLINE') {
      this.processOfflineQueue();
    }

    return newCommand;
  }
}

export const syncEngine = new SyncEngine();

