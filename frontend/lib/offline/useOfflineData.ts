import { useEffect, useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, LocalProduct, LocalCategory, LocalTable, LocalArea, LocalActiveOrder, LocalCustomer } from './db';
import { syncEngine, SyncStatus } from './syncEngine';

/**
 * Hook to track realtime sync and network status (ONLINE | SERVER_UNAVAILABLE | OFFLINE)
 */
export function useSyncStatus(): SyncStatus & {
  triggerSync: (forceFull?: boolean) => Promise<boolean>;
  processQueue: () => Promise<any>;
} {
  const [status, setStatus] = useState<SyncStatus>(() => syncEngine.getStatus());

  useEffect(() => {
    return syncEngine.subscribe(setStatus);
  }, []);

  return {
    ...status,
    triggerSync: (forceFull?: boolean) => syncEngine.triggerBackgroundSync(forceFull),
    processQueue: () => syncEngine.processOfflineQueue(),
  };
}

/**
 * Instant Load Products & Categories from IndexedDB with background Delta Sync
 */
export function useInstantProducts(branchId: string | null) {
  // Sync active branch to SyncEngine
  useEffect(() => {
    if (branchId && branchId !== 'ALL') {
      syncEngine.setActiveBranch(branchId);
    }
  }, [branchId]);

  // Live Query from Dexie: Instant 0ms load - filtered strictly by branchId
  const products = useLiveQuery<LocalProduct[]>(async () => {
    if (!branchId || branchId === 'ALL') return [];
    const list = await db.products.where('branchId').equals(branchId).toArray();
    const map = new Map<string, LocalProduct>();
    for (const p of list) {
      if (p && p.id) {
        map.set(p.id, p);
      }
    }
    return Array.from(map.values());
  }, [branchId]);

  const categories = useLiveQuery<LocalCategory[]>(async () => {
    if (!branchId || branchId === 'ALL') return [];
    const list = await db.categories.where('branchId').equals(branchId).sortBy('displayOrder');
    const map = new Map<string, LocalCategory>();
    for (const c of list) {
      if (c && c.id) {
        map.set(c.id, c);
      }
    }
    return Array.from(map.values());
  }, [branchId]);

  const isReady = products !== undefined && categories !== undefined;
  const hasLocalData = (products?.length || 0) > 0;

  return {
    products: products || [],
    categories: categories || [],
    isReady,
    hasLocalData,
    isLoading: !isReady && !hasLocalData,
  };
}

/**
 * Instant Load Tables & Areas from IndexedDB with background Delta Sync
 * Chống lỗi 23 bàn biến thành 69 bàn:
 * 1. Chỉ lấy bàn thuộc đúng branchId đang chọn.
 * 2. Deduplicate 100% bằng id duy nhất của từng bàn.
 * 3. Sắp xếp theo sortOrder và tableCode ổn định.
 */
export function useInstantTables(branchId: string | null) {
  useEffect(() => {
    if (branchId && branchId !== 'ALL') {
      syncEngine.setActiveBranch(branchId);
    }
  }, [branchId]);

  const tables = useLiveQuery<LocalTable[]>(async () => {
    if (!branchId || branchId === 'ALL') return [];
    const list = await db.posTables.where('branchId').equals(branchId).toArray();
    const map = new Map<string, LocalTable>();
    for (const t of list) {
      if (t && t.id) {
        map.set(t.id, t);
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      const orderA = a.sortOrder ?? 0;
      const orderB = b.sortOrder ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return (a.tableCode || '').localeCompare(b.tableCode || '');
    });
  }, [branchId]);

  const areas = useLiveQuery<LocalArea[]>(async () => {
    if (!branchId || branchId === 'ALL') return [];
    const list = await db.areas.where('branchId').equals(branchId).sortBy('sortOrder');
    const map = new Map<string, LocalArea>();
    for (const a of list) {
      if (a && a.id) {
        map.set(a.id, a);
      }
    }
    return Array.from(map.values());
  }, [branchId]);

  const isReady = tables !== undefined && areas !== undefined;
  const hasLocalData = (tables?.length || 0) > 0;

  return {
    tables: tables || [],
    areas: areas || [],
    isReady,
    hasLocalData,
    isLoading: !isReady && !hasLocalData,
  };
}

/**
 * Instant Load Active Orders from IndexedDB
 */
export function useInstantActiveOrders(branchId: string | null) {
  const orders = useLiveQuery<LocalActiveOrder[]>(async () => {
    if (!branchId || branchId === 'ALL') return [];
    const list = await db.activeOrders.where('branchId').equals(branchId).toArray();
    const map = new Map<string, LocalActiveOrder>();
    for (const o of list) {
      if (o && o.id) {
        map.set(o.id, o);
      }
    }
    return Array.from(map.values());
  }, [branchId]);

  return {
    orders: orders || [],
    isReady: orders !== undefined,
  };
}

/**
 * Instant Live Query for single Table / Order detail from IndexedDB
 * Phản ứng 0ms ngay khi bất kỳ thao tác lưu cục bộ hoặc background sync nào diễn ra
 */
export function useInstantOrder(tableId: string | null, orderId: string | null) {
  const localOrder = useLiveQuery<LocalActiveOrder | null>(async () => {
    if (tableId) {
      return (await db.activeOrders.where('tableId').equals(tableId).first()) || null;
    }
    if (orderId) {
      return (await db.activeOrders.get(orderId)) || null;
    }
    return null;
  }, [tableId, orderId]);

  const localTable = useLiveQuery<LocalTable | null>(async () => {
    if (tableId) {
      return (await db.posTables.get(tableId)) || null;
    }
    return null;
  }, [tableId]);

  return {
    localOrder: localOrder ?? null,
    localTable: localTable ?? null,
    isReady: localOrder !== undefined,
  };
}

/**
 * Instant Customer Lookup with Offline Search & Background Remote Merge
 */
export function useInstantCustomerSearch(query: string, branchId?: string | null) {
  const normalizedQuery = (query || '').trim().toLowerCase();

  // 1. Instant local Dexie search
  const localCustomers = useLiveQuery<LocalCustomer[]>(async () => {
    if (!normalizedQuery || normalizedQuery.length < 2) return [];

    return db.customers
      .filter((c) => {
        const phoneMatch = c.phone?.toLowerCase().includes(normalizedQuery);
        const nameMatch = c.fullName?.toLowerCase().includes(normalizedQuery);
        const codeMatch = c.memberCode?.toLowerCase().includes(normalizedQuery);
        return Boolean(phoneMatch || nameMatch || codeMatch);
      })
      .limit(20)
      .toArray();
  }, [normalizedQuery]);

  const [remoteCustomers, setRemoteCustomers] = useState<LocalCustomer[]>([]);
  const [isSearchingRemote, setIsSearchingRemote] = useState(false);

  // 2. When online and query >= 3 chars, fetch from backend and cache into Dexie
  useEffect(() => {
    if (!normalizedQuery || normalizedQuery.length < 3 || !navigator.onLine) {
      setRemoteCustomers([]);
      return;
    }

    let isCancelled = false;
    const timer = setTimeout(async () => {
      setIsSearchingRemote(true);
      try {
        const branchParam = branchId ? `&branchId=${branchId}` : '';
        const res = await fetch(`/api/pos/customers/search?q=${encodeURIComponent(normalizedQuery)}${branchParam}`);
        if (res.ok && !isCancelled) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            const list: LocalCustomer[] = json.data.map((c: any) => ({
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

            setRemoteCustomers(list);

            // Upsert into Dexie for future offline search
            db.customers.bulkPut(list).catch((err) => console.debug('Cache customer failed:', err));
          }
        }
      } catch (err) {
        console.debug('Remote customer search error:', err);
      } finally {
        if (!isCancelled) setIsSearchingRemote(false);
      }
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [normalizedQuery, branchId]);

  // Combine and deduplicate
  const mergedCustomers = useMemo(() => {
    const map = new Map<string, LocalCustomer>();
    (localCustomers || []).forEach((c) => map.set(c.id, c));
    remoteCustomers.forEach((c) => map.set(c.id, c));
    return Array.from(map.values());
  }, [localCustomers, remoteCustomers]);

  return {
    customers: mergedCustomers,
    isLoading: isSearchingRemote && (localCustomers?.length || 0) === 0,
  };
}

