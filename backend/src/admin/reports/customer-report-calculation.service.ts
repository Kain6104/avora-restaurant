import { Injectable } from '@nestjs/common';

/* ==========================================================================
   CUSTOMER REPORT CALCULATION ENGINE (COMPLETED ORDERS ONLY - RETENTION & RFM)
   ========================================================================== */

export interface CustomerOrderHistoryItem {
  id: string;
  orderCode: string | null;
  userId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  subTotal: number;
  totalAmount: number;
  discountAmount: number;
  shippingDiscount: number;
  shippingFee: number;
  taxAmount: number;
  branchId: string;
  branchName?: string;
  orderSource: string;
  orderType: string;
  paymentMethod: string;
  voucherId: string | null;
  pointsUsed: number;
  pointsAwarded: number;
  deliveredAt: Date | string | null;
  createdAt: Date | string;
}

export interface CustomerProfileInput {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  memberCode: string | null;
  membershipTierId: string | null;
  membershipTierName?: string;
  createdAt: Date | string; // Registration date
  completedOrders: CustomerOrderHistoryItem[];
}

export interface CalculatedCustomerKPIs {
  totalRegisteredCustomers: number;
  totalCustomersWithCompletedOrders: number;
  newCustomersInPeriod: number; // Based on FIRST COMPLETED ORDER in period
  returningCustomersInPeriod: number; // Completed order before period AND in period
  activeCustomersCount: number; // Completed order within last 60 days
  atRiskCustomersCount: number; // 60 - 90 days without completed order
  churnedCustomersCount: number; // > 90 days without completed order
  totalCompletedOrders: number;
  totalCustomerGrossRevenue: number;
  totalCustomerDiscount: number;
  totalCustomerNetRevenue: number;
  averageCustomerSpend: number;
  averageOrderValue: number;
  averagePurchaseFrequency: number;
  repeatPurchaseRatePercent: number; // % customers with >= 2 completed orders
  averageDaysBetweenOrders: number;
  vipCustomersCount: number;
}

export interface CustomerFrequencyDistributionItem {
  bucket: '1 đơn' | '2 - 3 đơn' | '4 - 5 đơn' | '6 - 10 đơn' | '10+ đơn';
  customerCount: number;
  percentage: number;
  totalRevenue: number;
  aov: number;
}

export interface CustomerRFMSegmentItem {
  segment: 'VIP (Khách VIP)' | 'High Value (Giá trị cao)' | 'Frequent (Mua thường xuyên)' | 'New (Khách mới)' | 'At Risk (Nguy cơ rời bỏ)' | 'Churned (Đã rời bỏ)' | 'Occasional (Vãng lai)';
  customerCount: number;
  percentage: number;
  totalRevenue: number;
  averageAov: number;
  averageRecencyDays: number;
  description: string;
}

export interface CustomerCohortRetentionRow {
  cohortMonth: string; // YYYY-MM based on FIRST COMPLETED ORDER
  initialCustomersCount: number;
  m0: number; // 100%
  m1: number; // % returned in month 1
  m2: number; // % returned in month 2
  m3: number; // % returned in month 3
  m4: number; // % returned in month 4
  m5: number; // % returned in month 5
}

export interface CalculatedTopCustomerItem {
  customerId: string;
  fullName: string;
  phone: string;
  email: string;
  memberCode: string;
  membershipTier: string;
  analyticalSegment: string;
  firstCompletedOrderDate: string;
  lastCompletedOrderDate: string;
  completedOrdersCount: number;
  lifetimeGrossSpend: number;
  lifetimeDiscount: number;
  lifetimeNetSpend: number;
  aov: number;
  recencyDays: number;
  frequency: number;
  preferredBranch: string;
  preferredPaymentMethod: string;
}

@Injectable()
export class CustomerReportCalculationService {
  /**
   * Tính toán KPI tổng quan khách hàng chuẩn Doanh nghiệp
   */
  calculateCustomerKPIs(
    customers: CustomerProfileInput[],
    periodStartDate: Date,
    periodEndDate: Date,
    churnThresholdDays: number = 90,
  ): CalculatedCustomerKPIs {
    const totalRegisteredCustomers = customers.length;
    let customersWithOrders = 0;
    let newCustomersInPeriod = 0;
    let returningCustomersInPeriod = 0;
    let activeCustomersCount = 0;
    let atRiskCustomersCount = 0;
    let churnedCustomersCount = 0;
    let vipCustomersCount = 0;

    let totalCompletedOrders = 0;
    let totalCustomerGrossRevenue = 0;
    let totalCustomerDiscount = 0;
    let totalCustomerNetRevenue = 0;

    let customersWithTwoOrMoreOrders = 0;
    const allIntervalDays: number[] = [];

    const nowTime = periodEndDate.getTime();

    for (const c of customers) {
      const orders = c.completedOrders || [];
      if (orders.length === 0) continue;

      customersWithOrders++;
      if (orders.length >= 2) customersWithTwoOrMoreOrders++;

      // Sort completed orders chronologically
      orders.sort(
        (a, b) =>
          new Date(a.deliveredAt || a.createdAt).getTime() -
          new Date(b.deliveredAt || b.createdAt).getTime(),
      );

      const firstOrderDate = new Date(orders[0].deliveredAt || orders[0].createdAt);
      const lastOrderDate = new Date(orders[orders.length - 1].deliveredAt || orders[orders.length - 1].createdAt);

      // Orders within the reporting period
      const periodOrders = orders.filter((o) => {
        const d = new Date(o.deliveredAt || o.createdAt);
        return d >= periodStartDate && d <= periodEndDate;
      });

      if (periodOrders.length > 0) {
        // ĐỊNH NGHĨA KHÁCH MỚI: First Completed Order nằm trong kỳ báo cáo
        if (firstOrderDate >= periodStartDate && firstOrderDate <= periodEndDate) {
          newCustomersInPeriod++;
        } else if (firstOrderDate < periodStartDate) {
          // ĐỊNH NGHĨA KHÁCH QUAY LẠI: Đã có đơn hoàn thành trước kỳ và có đơn trong kỳ
          returningCustomersInPeriod++;
        }

        for (const o of periodOrders) {
          totalCompletedOrders++;
          totalCustomerGrossRevenue += Math.round(o.subTotal || 0);
          totalCustomerDiscount += Math.round((o.discountAmount || 0) + (o.shippingDiscount || 0));
          totalCustomerNetRevenue += Math.round(Math.max(0, (o.totalAmount || 0) - (o.shippingFee || 0)));
        }
      }

      // Recency calculation
      const recencyDays = Math.max(0, Math.floor((nowTime - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24)));
      if (recencyDays <= 45) {
        activeCustomersCount++;
      } else if (recencyDays <= churnThresholdDays) {
        atRiskCustomersCount++;
      } else {
        churnedCustomersCount++;
      }

      if (
        c.membershipTierName?.toLowerCase().includes('platinum') ||
        c.membershipTierName?.toLowerCase().includes('gold') ||
        c.membershipTierName?.toLowerCase().includes('kim cương') ||
        c.membershipTierName?.toLowerCase().includes('vàng')
      ) {
        vipCustomersCount++;
      }

      // Interval days between consecutive orders
      for (let i = 0; i < orders.length - 1; i++) {
        const d1 = new Date(orders[i].deliveredAt || orders[i].createdAt).getTime();
        const d2 = new Date(orders[i + 1].deliveredAt || orders[i + 1].createdAt).getTime();
        allIntervalDays.push(Math.max(0, Math.floor((d2 - d1) / (1000 * 60 * 60 * 24))));
      }
    }

    const activeInPeriod = newCustomersInPeriod + returningCustomersInPeriod;
    const averageCustomerSpend =
      activeInPeriod > 0 ? Math.round(totalCustomerGrossRevenue / activeInPeriod) : 0;
    const averageOrderValue =
      totalCompletedOrders > 0 ? Math.round(totalCustomerGrossRevenue / totalCompletedOrders) : 0;
    const averagePurchaseFrequency =
      activeInPeriod > 0 ? Math.round((totalCompletedOrders / activeInPeriod) * 10) / 10 : 0;
    const repeatPurchaseRatePercent =
      customersWithOrders > 0
        ? Math.round((customersWithTwoOrMoreOrders / customersWithOrders) * 1000) / 10
        : 0;

    const avgDaysBetween =
      allIntervalDays.length > 0
        ? Math.round(allIntervalDays.reduce((a, b) => a + b, 0) / allIntervalDays.length)
        : 0;

    return {
      totalRegisteredCustomers,
      totalCustomersWithCompletedOrders: customersWithOrders,
      newCustomersInPeriod,
      returningCustomersInPeriod,
      activeCustomersCount,
      atRiskCustomersCount,
      churnedCustomersCount,
      totalCompletedOrders,
      totalCustomerGrossRevenue,
      totalCustomerDiscount,
      totalCustomerNetRevenue,
      averageCustomerSpend,
      averageOrderValue,
      averagePurchaseFrequency,
      repeatPurchaseRatePercent,
      averageDaysBetweenOrders: avgDaysBetween,
      vipCustomersCount,
    };
  }

  /**
   * Phân bổ tần suất mua hàng (Purchase Frequency Distribution)
   */
  calculateFrequencyDistribution(
    customers: CustomerProfileInput[],
  ): CustomerFrequencyDistributionItem[] {
    const buckets: Record<
      CustomerFrequencyDistributionItem['bucket'],
      { count: number; rev: number; orders: number }
    > = {
      '1 đơn': { count: 0, rev: 0, orders: 0 },
      '2 - 3 đơn': { count: 0, rev: 0, orders: 0 },
      '4 - 5 đơn': { count: 0, rev: 0, orders: 0 },
      '6 - 10 đơn': { count: 0, rev: 0, orders: 0 },
      '10+ đơn': { count: 0, rev: 0, orders: 0 },
    };

    let totalActiveCustomers = 0;

    for (const c of customers) {
      const orders = c.completedOrders || [];
      const orderCount = orders.length;
      if (orderCount === 0) continue;

      totalActiveCustomers++;
      let customerRev = 0;
      for (const o of orders) {
        customerRev += Math.round(o.subTotal || 0);
      }

      let bucketKey: CustomerFrequencyDistributionItem['bucket'] = '1 đơn';
      if (orderCount === 1) bucketKey = '1 đơn';
      else if (orderCount <= 3) bucketKey = '2 - 3 đơn';
      else if (orderCount <= 5) bucketKey = '4 - 5 đơn';
      else if (orderCount <= 10) bucketKey = '6 - 10 đơn';
      else bucketKey = '10+ đơn';

      buckets[bucketKey].count++;
      buckets[bucketKey].rev += customerRev;
      buckets[bucketKey].orders += orderCount;
    }

    const results: CustomerFrequencyDistributionItem[] = [];
    for (const [key, val] of Object.entries(buckets) as [
      CustomerFrequencyDistributionItem['bucket'],
      { count: number; rev: number; orders: number },
    ][]) {
      const pct =
        totalActiveCustomers > 0 ? Math.round((val.count / totalActiveCustomers) * 1000) / 10 : 0;
      const aov = val.orders > 0 ? Math.round(val.rev / val.orders) : 0;
      results.push({
        bucket: key,
        customerCount: val.count,
        percentage: pct,
        totalRevenue: val.rev,
        aov,
      });
    }

    return results;
  }

  /**
   * Phân khúc khách hàng RFM (Recency, Frequency, Monetary)
   */
  calculateRFMSegments(
    customers: CustomerProfileInput[],
    referenceDate: Date,
  ): CustomerRFMSegmentItem[] {
    const segments: Record<
      CustomerRFMSegmentItem['segment'],
      { count: number; rev: number; orders: number; recencySum: number; desc: string }
    > = {
      'VIP (Khách VIP)': {
        count: 0,
        rev: 0,
        orders: 0,
        recencySum: 0,
        desc: 'Top chi tiêu cao nhất, mua gần đây và gắn bó lâu dài',
      },
      'High Value (Giá trị cao)': {
        count: 0,
        rev: 0,
        orders: 0,
        recencySum: 0,
        desc: 'Giá trị đơn hàng (AOV) trung bình vượt trội',
      },
      'Frequent (Mua thường xuyên)': {
        count: 0,
        rev: 0,
        orders: 0,
        recencySum: 0,
        desc: 'Đặt món liên tục với tần suất cao (>= 4 đơn)',
      },
      'New (Khách mới)': {
        count: 0,
        rev: 0,
        orders: 0,
        recencySum: 0,
        desc: 'Mới phát sinh đơn hoàn thành đầu tiên gần đây',
      },
      'At Risk (Nguy cơ rời bỏ)': {
        count: 0,
        rev: 0,
        orders: 0,
        recencySum: 0,
        desc: 'Đã từng mua nhiều lần nhưng không quay lại sau 60 - 90 ngày',
      },
      'Churned (Đã rời bỏ)': {
        count: 0,
        rev: 0,
        orders: 0,
        recencySum: 0,
        desc: 'Không phát sinh bất kỳ đơn hàng nào trong hơn 90 ngày',
      },
      'Occasional (Vãng lai)': {
        count: 0,
        rev: 0,
        orders: 0,
        recencySum: 0,
        desc: 'Khách chỉ mua 1 - 2 đơn rải rác',
      },
    };

    let totalCustomers = 0;
    const nowTime = referenceDate.getTime();

    for (const c of customers) {
      const orders = c.completedOrders || [];
      if (orders.length === 0) continue;

      totalCustomers++;
      orders.sort(
        (a, b) =>
          new Date(b.deliveredAt || b.createdAt).getTime() -
          new Date(a.deliveredAt || a.createdAt).getTime(),
      );

      const lastOrderTime = new Date(orders[0].deliveredAt || orders[0].createdAt).getTime();
      const recencyDays = Math.max(0, Math.floor((nowTime - lastOrderTime) / (1000 * 60 * 60 * 24)));
      const frequency = orders.length;

      let spend = 0;
      for (const o of orders) spend += Math.round(o.subTotal || 0);

      const aov = Math.round(spend / frequency);

      let segKey: CustomerRFMSegmentItem['segment'] = 'Occasional (Vãng lai)';

      if (
        (spend >= 3000000 && recencyDays <= 45 && frequency >= 4) ||
        c.membershipTierName?.toLowerCase().includes('kim cương') ||
        c.membershipTierName?.toLowerCase().includes('platinum')
      ) {
        segKey = 'VIP (Khách VIP)';
      } else if (recencyDays > 90) {
        segKey = 'Churned (Đã rời bỏ)';
      } else if (recencyDays > 60 && frequency >= 2) {
        segKey = 'At Risk (Nguy cơ rời bỏ)';
      } else if (frequency >= 4 && recencyDays <= 45) {
        segKey = 'Frequent (Mua thường xuyên)';
      } else if (aov >= 600000 && recencyDays <= 60) {
        segKey = 'High Value (Giá trị cao)';
      } else if (frequency === 1 && recencyDays <= 30) {
        segKey = 'New (Khách mới)';
      }

      segments[segKey].count++;
      segments[segKey].rev += spend;
      segments[segKey].orders += frequency;
      segments[segKey].recencySum += recencyDays;
    }

    const results: CustomerRFMSegmentItem[] = [];
    for (const [key, val] of Object.entries(segments) as [
      CustomerRFMSegmentItem['segment'],
      { count: number; rev: number; orders: number; recencySum: number; desc: string },
    ][]) {
      const pct = totalCustomers > 0 ? Math.round((val.count / totalCustomers) * 1000) / 10 : 0;
      const aov = val.orders > 0 ? Math.round(val.rev / val.orders) : 0;
      const avgRec = val.count > 0 ? Math.round(val.recencySum / val.count) : 0;
      results.push({
        segment: key,
        customerCount: val.count,
        percentage: pct,
        totalRevenue: val.rev,
        averageAov: aov,
        averageRecencyDays: avgRec,
        description: val.desc,
      });
    }

    return results;
  }

  /**
   * Ma trận giữ chân khách hàng (Cohort Retention Matrix)
   * Cohort xác định dựa trên tháng của FIRST COMPLETED ORDER
   */
  calculateCohortRetention(customers: CustomerProfileInput[]): CustomerCohortRetentionRow[] {
    // Map of cohortMonth (YYYY-MM) -> Set of customerIds
    const cohortMembers = new Map<string, Set<string>>();
    // Customer monthly activity: customerId -> Set of active months (YYYY-MM)
    const customerActiveMonths = new Map<string, Set<string>>();

    for (const c of customers) {
      const orders = c.completedOrders || [];
      if (orders.length === 0) continue;

      orders.sort(
        (a, b) =>
          new Date(a.deliveredAt || a.createdAt).getTime() -
          new Date(b.deliveredAt || b.createdAt).getTime(),
      );

      const firstDate = new Date(orders[0].deliveredAt || orders[0].createdAt);
      const cohortMonth = `${firstDate.getFullYear()}-${String(firstDate.getMonth() + 1).padStart(2, '0')}`;

      if (!cohortMembers.has(cohortMonth)) {
        cohortMembers.set(cohortMonth, new Set());
      }
      cohortMembers.get(cohortMonth)!.add(c.id);

      if (!customerActiveMonths.has(c.id)) {
        customerActiveMonths.set(c.id, new Set());
      }
      for (const o of orders) {
        const od = new Date(o.deliveredAt || o.createdAt);
        const mKey = `${od.getFullYear()}-${String(od.getMonth() + 1).padStart(2, '0')}`;
        customerActiveMonths.get(c.id)!.add(mKey);
      }
    }

    const cohortKeys = Array.from(cohortMembers.keys()).sort().slice(-6); // Lấy tối đa 6 cohort gần nhất
    const rows: CustomerCohortRetentionRow[] = [];

    for (const cMonth of cohortKeys) {
      const members = cohortMembers.get(cMonth)!;
      const initialCount = members.size;
      if (initialCount === 0) continue;

      const [yearStr, monthStr] = cMonth.split('-');
      const cYear = parseInt(yearStr, 10);
      const cMonthIdx = parseInt(monthStr, 10) - 1;

      // Helper to compute retention for Month N
      const computeMonthRetention = (offset: number): number => {
        const targetDate = new Date(cYear, cMonthIdx + offset, 1);
        const now = new Date();
        if (targetDate > now) return 0; // Chưa đến thời điểm tháng offset

        const targetKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
        let activeCount = 0;
        for (const custId of members) {
          if (customerActiveMonths.get(custId)?.has(targetKey)) {
            activeCount++;
          }
        }
        return Math.round((activeCount / initialCount) * 1000) / 10;
      };

      rows.push({
        cohortMonth: `Tháng ${cMonth}`,
        initialCustomersCount: initialCount,
        m0: 100,
        m1: computeMonthRetention(1),
        m2: computeMonthRetention(2),
        m3: computeMonthRetention(3),
        m4: computeMonthRetention(4),
        m5: computeMonthRetention(5),
      });
    }

    return rows;
  }

  /**
   * Tính toán danh sách Top Khách hàng chi tiêu
   */
  calculateTopCustomers(
    customers: CustomerProfileInput[],
    referenceDate: Date,
  ): CalculatedTopCustomerItem[] {
    const list: CalculatedTopCustomerItem[] = [];
    const nowTime = referenceDate.getTime();

    for (const c of customers) {
      const orders = c.completedOrders || [];
      if (orders.length === 0) continue;

      orders.sort(
        (a, b) =>
          new Date(b.deliveredAt || b.createdAt).getTime() -
          new Date(a.deliveredAt || a.createdAt).getTime(),
      );

      const lastDate = new Date(orders[0].deliveredAt || orders[0].createdAt);
      const firstDate = new Date(orders[orders.length - 1].deliveredAt || orders[orders.length - 1].createdAt);
      const recencyDays = Math.max(0, Math.floor((nowTime - lastDate.getTime()) / (1000 * 60 * 60 * 24)));
      const freq = orders.length;

      let gross = 0;
      let disc = 0;
      let net = 0;
      const branchCount = new Map<string, number>();
      const paymentCount = new Map<string, number>();

      for (const o of orders) {
        gross += Math.round(o.subTotal || 0);
        disc += Math.round((o.discountAmount || 0) + (o.shippingDiscount || 0));
        net += Math.round(Math.max(0, (o.totalAmount || 0) - (o.shippingFee || 0)));

        const bName = o.branchName || 'Chi nhánh';
        branchCount.set(bName, (branchCount.get(bName) || 0) + 1);

        const pm = o.paymentMethod || 'COD';
        paymentCount.set(pm, (paymentCount.get(pm) || 0) + 1);
      }

      let favBranch = 'Không xác định';
      let maxB = -1;
      for (const [b, count] of branchCount.entries()) {
        if (count > maxB) {
          maxB = count;
          favBranch = b;
        }
      }

      let favPayment = 'COD';
      let maxP = -1;
      for (const [p, count] of paymentCount.entries()) {
        if (count > maxP) {
          maxP = count;
          favPayment = p;
        }
      }

      const aov = freq > 0 ? Math.round(gross / freq) : 0;

      // Analytical segment label
      let seg = 'Vãng lai';
      if (gross >= 3000000 && recencyDays <= 45 && freq >= 4) seg = 'VIP';
      else if (freq >= 4 && recencyDays <= 45) seg = 'Mua thường xuyên';
      else if (aov >= 600000) seg = 'Giá trị cao';
      else if (recencyDays > 90) seg = 'Đã rời bỏ';
      else if (recencyDays > 60) seg = 'Nguy cơ rời bỏ';
      else if (freq === 1 && recencyDays <= 30) seg = 'Khách mới';

      list.push({
        customerId: c.id,
        fullName: c.fullName || 'Khách hàng',
        phone: c.phone || '—',
        email: c.email || '—',
        memberCode: c.memberCode || c.id.slice(0, 8).toUpperCase(),
        membershipTier: c.membershipTierName || 'Standard',
        analyticalSegment: seg,
        firstCompletedOrderDate: firstDate.toISOString(),
        lastCompletedOrderDate: lastDate.toISOString(),
        completedOrdersCount: freq,
        lifetimeGrossSpend: gross,
        lifetimeDiscount: disc,
        lifetimeNetSpend: net,
        aov,
        recencyDays,
        frequency: freq,
        preferredBranch: favBranch,
        preferredPaymentMethod: favPayment,
      });
    }

    return list.sort((a, b) => b.lifetimeGrossSpend - a.lifetimeGrossSpend);
  }
}
