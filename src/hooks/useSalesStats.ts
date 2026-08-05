import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { type OrderRow, type OrderItem, parseOrderItems } from '@/types/order';

type Order = Pick<OrderRow, 'id' | 'total_amount' | 'status' | 'created_at'> & {
  items: OrderItem[];
};

interface ProductSales {
  productId: string;
  name: string;
  category: string;
  image_url?: string;
  totalQuantity: number;
  totalRevenue: number;
}

interface SalesStats {
  totalRevenue: number;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  productsSold: ProductSales[];
  salesByDay: { date: string; revenue: number; orders: number }[];
  salesByMonth: { month: string; revenue: number; orders: number }[];
}

const parsePrice = (price: number | string): number => {
  if (typeof price === 'number') return price;
  const cleaned = price.replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

export const useSalesStats = (categoryFilter?: string, startDate?: Date, endDate?: Date) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      let query = supabase
        .from('orders')
        .select('id, items, total_amount, status, created_at')
        .order('created_at', { ascending: false });

      // Apply date filters if provided
      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      if (endDate) {
        // Set end date to end of day
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endOfDay.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching orders:', error);
        setLoading(false);
        return;
      }

      const parsedOrders = (data || []).map((order) => ({
        ...order,
        items: parseOrderItems(order.items, order.id),
      }));

      setOrders(parsedOrders);
      setLoading(false);
    };

    fetchOrders();
  }, [startDate, endDate]);

  const stats = useMemo<SalesStats>(() => {
    // Filter orders that are not cancelled for revenue calculations
    const validOrders = orders.filter((o) => o.status !== 'cancelled');
    const completedOrders = orders.filter((o) => o.status === 'completed' || o.status === 'delivered');
    const cancelledOrders = orders.filter((o) => o.status === 'cancelled');
    const pendingOrders = orders.filter((o) => o.status === 'pending' || o.status === 'processing');

    // Calculate total revenue
    const totalRevenue = validOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);

    // Calculate products sold with optional category filter
    const productSalesMap = new Map<string, ProductSales>();

    validOrders.forEach((order) => {
      order.items.forEach((item) => {
        // Apply category filter if specified
        if (categoryFilter && item.category.toLowerCase() !== categoryFilter.toLowerCase()) {
          return;
        }

        // productId pode faltar (itens antigos de carrinho identificavam o
        // produto só pelo nome) — cai pro id do próprio item do pedido nesse caso.
        const productKey = item.productId ?? item.id;
        const existing = productSalesMap.get(productKey);
        const itemPrice = parsePrice(item.price);
        const itemRevenue = itemPrice * item.quantity;

        if (existing) {
          existing.totalQuantity += item.quantity;
          existing.totalRevenue += itemRevenue;
        } else {
          productSalesMap.set(productKey, {
            productId: productKey,
            name: item.name,
            category: item.category,
            image_url: item.image_url,
            totalQuantity: item.quantity,
            totalRevenue: itemRevenue
          });
        }
      });
    });

    const productsSold = Array.from(productSalesMap.values()).sort(
      (a, b) => b.totalQuantity - a.totalQuantity
    );

    // Sales by day (last 30 days)
    const salesByDayMap = new Map<string, { revenue: number; orders: number }>();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    validOrders
      .filter((o) => new Date(o.created_at) >= thirtyDaysAgo)
      .forEach((order) => {
        const date = new Date(order.created_at).toISOString().split('T')[0];
        const existing = salesByDayMap.get(date) || { revenue: 0, orders: 0 };
        existing.revenue += order.total_amount || 0;
        existing.orders += 1;
        salesByDayMap.set(date, existing);
      });

    // Fill in missing days
    const salesByDay: { date: string; revenue: number; orders: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const data = salesByDayMap.get(dateStr) || { revenue: 0, orders: 0 };
      salesByDay.push({ date: dateStr, ...data });
    }

    // Sales by month (last 12 months)
    const salesByMonthMap = new Map<string, { revenue: number; orders: number }>();
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    validOrders
      .filter((o) => new Date(o.created_at) >= twelveMonthsAgo)
      .forEach((order) => {
        const date = new Date(order.created_at);
        const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const existing = salesByMonthMap.get(month) || { revenue: 0, orders: 0 };
        existing.revenue += order.total_amount || 0;
        existing.orders += 1;
        salesByMonthMap.set(month, existing);
      });

    // Fill in missing months
    const salesByMonth: { month: string; revenue: number; orders: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const data = salesByMonthMap.get(month) || { revenue: 0, orders: 0 };
      salesByMonth.push({ month, ...data });
    }

    // Calculate category-specific revenue if filter is applied
    let filteredRevenue = totalRevenue;
    if (categoryFilter) {
      filteredRevenue = 0;
      validOrders.forEach((order) => {
        order.items.forEach((item) => {
          if (item.category.toLowerCase() === categoryFilter.toLowerCase()) {
            filteredRevenue += parsePrice(item.price) * item.quantity;
          }
        });
      });
    }

    return {
      totalRevenue: categoryFilter ? filteredRevenue : totalRevenue,
      totalOrders: orders.length,
      completedOrders: completedOrders.length,
      cancelledOrders: cancelledOrders.length,
      pendingOrders: pendingOrders.length,
      productsSold,
      salesByDay,
      salesByMonth
    };
  }, [orders, categoryFilter]);

  return { stats, loading, orders };
};
