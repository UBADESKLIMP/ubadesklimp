import { useState, useMemo } from 'react';
import { useSalesStats } from '@/hooks/useSalesStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, subDays, startOfYear, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Package,
  CheckCircle,
  XCircle,
  Clock,
  CalendarIcon,
  ArrowUpRight,
  ArrowDownRight,
  GitCompare,
  X
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import AdminLoadingState from './admin/AdminLoadingState';
import AdminEmptyState from './admin/AdminEmptyState';

const AdminDashboard = () => {
  // Default to current month
  const defaultStartDate = useMemo(() => startOfMonth(new Date()), []);
  const defaultEndDate = useMemo(() => endOfMonth(new Date()), []);
  
  const [startDate, setStartDate] = useState<Date | undefined>(defaultStartDate);
  const [endDate, setEndDate] = useState<Date | undefined>(defaultEndDate);
  
  // Comparison mode states
  const [showComparison, setShowComparison] = useState(false);
  const [compareStartDate1, setCompareStartDate1] = useState<Date | undefined>();
  const [compareEndDate1, setCompareEndDate1] = useState<Date | undefined>();
  const [compareStartDate2, setCompareStartDate2] = useState<Date | undefined>();
  const [compareEndDate2, setCompareEndDate2] = useState<Date | undefined>();
  
  const { stats, loading } = useSalesStats(undefined, startDate, endDate);
  
  // Only fetch comparison stats when comparison mode is active and dates are selected
  const shouldFetchComparison = showComparison && compareStartDate1 && compareEndDate1 && compareStartDate2 && compareEndDate2;
  
  const { stats: period1Stats, loading: period1Loading } = useSalesStats(
    undefined, 
    shouldFetchComparison ? compareStartDate1 : undefined, 
    shouldFetchComparison ? compareEndDate1 : undefined
  );
  const { stats: period2Stats, loading: period2Loading } = useSalesStats(
    undefined, 
    shouldFetchComparison ? compareStartDate2 : undefined, 
    shouldFetchComparison ? compareEndDate2 : undefined
  );
  
  const calculatePercentChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };
  
  // Comparison calculations (only when both periods are selected)
  const revenueChange = shouldFetchComparison ? calculatePercentChange(period2Stats.totalRevenue, period1Stats.totalRevenue) : 0;
  const ordersChange = shouldFetchComparison ? calculatePercentChange(period2Stats.totalOrders, period1Stats.totalOrders) : 0;
  const productsSoldPeriod1 = period1Stats.productsSold.reduce((sum, p) => sum + p.totalQuantity, 0);
  const productsSoldPeriod2 = period2Stats.productsSold.reduce((sum, p) => sum + p.totalQuantity, 0);
  const productsChange = shouldFetchComparison ? calculatePercentChange(productsSoldPeriod2, productsSoldPeriod1) : 0;
  
  const formatPeriodLabel = (start: Date | undefined, end: Date | undefined) => {
    if (!start || !end) return '';
    return `${format(start, "dd/MM", { locale: ptBR })} - ${format(end, "dd/MM", { locale: ptBR })}`;
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const formatMonthLabel = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('pt-BR', { month: 'short' });
  };

  if (loading) {
    return <AdminLoadingState label="Carregando estatísticas..." rows={5} />;
  }

  return (
    <div className="space-y-6">
      {/* Date Filter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Filtrar por Período
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">De:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[180px] justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Até:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[180px] justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStartDate(subDays(new Date(), 7));
                  setEndDate(new Date());
                }}
              >
                Últimos 7 dias
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStartDate(subDays(new Date(), 30));
                  setEndDate(new Date());
                }}
              >
                Últimos 30 dias
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStartDate(defaultStartDate);
                  setEndDate(defaultEndDate);
                }}
              >
                Mês Atual
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStartDate(startOfYear(new Date()));
                  setEndDate(new Date());
                }}
              >
                Ano Atual
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Faturamento Total
            </CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatPrice(stats.totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Pedidos concluídos
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Pedidos
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats.totalOrders}
            </div>
            <div className="flex gap-2 mt-1">
              <Badge variant="outline" className="text-xs border-green-500/30 text-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                {stats.completedOrders}
              </Badge>
              <Badge variant="outline" className="text-xs border-yellow-500/30 text-yellow-600">
                <Clock className="h-3 w-3 mr-1" />
                {stats.pendingOrders}
              </Badge>
              <Badge variant="outline" className="text-xs border-red-500/30 text-red-600">
                <XCircle className="h-3 w-3 mr-1" />
                {stats.cancelledOrders}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Produtos Vendidos
            </CardTitle>
            <Package className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {stats.productsSold.reduce((sum, p) => sum + p.totalQuantity, 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.productsSold.length} produtos diferentes
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ticket Médio
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatPrice(stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Por pedido
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Comparison Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <GitCompare className="h-5 w-5 text-primary" />
              Comparar Períodos
            </CardTitle>
            {showComparison && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowComparison(false);
                  setCompareStartDate1(undefined);
                  setCompareEndDate1(undefined);
                  setCompareStartDate2(undefined);
                  setCompareEndDate2(undefined);
                }}
              >
                <X className="h-4 w-4 mr-1" />
                Fechar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!showComparison ? (
            <Button
              variant="outline"
              onClick={() => setShowComparison(true)}
              className="w-full"
            >
              <GitCompare className="h-4 w-4 mr-2" />
              Comparar dois períodos
            </Button>
          ) : (
            <div className="space-y-6">
              {/* Period Selectors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Period 1 */}
                <div className="p-4 rounded-lg border bg-muted/30">
                  <h4 className="font-medium mb-3 text-sm text-muted-foreground">Período 1 (Base)</h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "w-[130px] justify-start text-left font-normal",
                            !compareStartDate1 && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-3 w-3" />
                          {compareStartDate1 ? format(compareStartDate1, "dd/MM/yyyy", { locale: ptBR }) : "Início"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={compareStartDate1}
                          onSelect={setCompareStartDate1}
                          initialFocus
                          locale={ptBR}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <span className="text-muted-foreground">até</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "w-[130px] justify-start text-left font-normal",
                            !compareEndDate1 && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-3 w-3" />
                          {compareEndDate1 ? format(compareEndDate1, "dd/MM/yyyy", { locale: ptBR }) : "Fim"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={compareEndDate1}
                          onSelect={setCompareEndDate1}
                          initialFocus
                          locale={ptBR}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Period 2 */}
                <div className="p-4 rounded-lg border bg-primary/5 border-primary/20">
                  <h4 className="font-medium mb-3 text-sm text-primary">Período 2 (Comparar)</h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "w-[130px] justify-start text-left font-normal",
                            !compareStartDate2 && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-3 w-3" />
                          {compareStartDate2 ? format(compareStartDate2, "dd/MM/yyyy", { locale: ptBR }) : "Início"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={compareStartDate2}
                          onSelect={setCompareStartDate2}
                          initialFocus
                          locale={ptBR}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <span className="text-muted-foreground">até</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "w-[130px] justify-start text-left font-normal",
                            !compareEndDate2 && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-3 w-3" />
                          {compareEndDate2 ? format(compareEndDate2, "dd/MM/yyyy", { locale: ptBR }) : "Fim"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={compareEndDate2}
                          onSelect={setCompareEndDate2}
                          initialFocus
                          locale={ptBR}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              {/* Comparison Results */}
              {shouldFetchComparison && (
                <>
                  {(period1Loading || period2Loading) ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-center">
                        <div className="text-4xl mb-2 animate-pulse">📊</div>
                        <p className="text-sm text-muted-foreground">Carregando comparativo...</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Stats Comparison */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t">
                        {/* Revenue Comparison */}
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">Faturamento</p>
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="text-2xl font-bold">{formatPrice(period2Stats.totalRevenue)}</p>
                              <p className="text-xs text-muted-foreground">{formatPeriodLabel(compareStartDate2, compareEndDate2)}</p>
                            </div>
                            <div className={cn(
                              "flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium",
                              revenueChange >= 0 
                                ? "bg-green-500/10 text-green-600" 
                                : "bg-red-500/10 text-red-600"
                            )}>
                              {revenueChange >= 0 ? (
                                <ArrowUpRight className="h-4 w-4" />
                              ) : (
                                <ArrowDownRight className="h-4 w-4" />
                              )}
                              {Math.abs(revenueChange).toFixed(1)}%
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Período 1: {formatPrice(period1Stats.totalRevenue)}
                          </p>
                        </div>

                        {/* Orders Comparison */}
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">Pedidos</p>
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="text-2xl font-bold">{period2Stats.totalOrders}</p>
                              <p className="text-xs text-muted-foreground">{formatPeriodLabel(compareStartDate2, compareEndDate2)}</p>
                            </div>
                            <div className={cn(
                              "flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium",
                              ordersChange >= 0 
                                ? "bg-green-500/10 text-green-600" 
                                : "bg-red-500/10 text-red-600"
                            )}>
                              {ordersChange >= 0 ? (
                                <ArrowUpRight className="h-4 w-4" />
                              ) : (
                                <ArrowDownRight className="h-4 w-4" />
                              )}
                              {Math.abs(ordersChange).toFixed(1)}%
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Período 1: {period1Stats.totalOrders} pedidos
                          </p>
                        </div>

                        {/* Products Comparison */}
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">Produtos Vendidos</p>
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="text-2xl font-bold">{productsSoldPeriod2}</p>
                              <p className="text-xs text-muted-foreground">{formatPeriodLabel(compareStartDate2, compareEndDate2)}</p>
                            </div>
                            <div className={cn(
                              "flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium",
                              productsChange >= 0 
                                ? "bg-green-500/10 text-green-600" 
                                : "bg-red-500/10 text-red-600"
                            )}>
                              {productsChange >= 0 ? (
                                <ArrowUpRight className="h-4 w-4" />
                              ) : (
                                <ArrowDownRight className="h-4 w-4" />
                              )}
                              {Math.abs(productsChange).toFixed(1)}%
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Período 1: {productsSoldPeriod1} produtos
                          </p>
                        </div>
                      </div>

                      {/* Bar Chart */}
                      <div className="pt-4 border-t">
                        <h4 className="text-sm font-medium mb-4">Comparativo Visual</h4>
                        <div className="h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={[
                                {
                                  name: 'Faturamento (R$ mil)',
                                  'Período 1': period1Stats.totalRevenue / 1000,
                                  'Período 2': period2Stats.totalRevenue / 1000,
                                },
                                {
                                  name: 'Pedidos',
                                  'Período 1': period1Stats.totalOrders,
                                  'Período 2': period2Stats.totalOrders,
                                },
                                {
                                  name: 'Produtos',
                                  'Período 1': productsSoldPeriod1,
                                  'Período 2': productsSoldPeriod2,
                                },
                              ]}
                              layout="vertical"
                              margin={{ left: 20, right: 30 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis type="number" tick={{ fontSize: 12 }} />
                              <YAxis 
                                dataKey="name" 
                                type="category" 
                                tick={{ fontSize: 12 }} 
                                width={120}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'hsl(var(--background))',
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px'
                                }}
                                formatter={(value: number, name: string) => {
                                  if (name.includes('Faturamento')) {
                                    return [formatPrice(value * 1000), name];
                                  }
                                  return [value, name];
                                }}
                              />
                              <Bar 
                                dataKey="Período 1" 
                                fill="hsl(var(--muted-foreground))" 
                                radius={[0, 4, 4, 0]}
                                opacity={0.6}
                              />
                              <Bar 
                                dataKey="Período 2" 
                                fill="hsl(var(--primary))" 
                                radius={[0, 4, 4, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex justify-center gap-6 mt-4">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-muted-foreground opacity-60" />
                            <span className="text-sm text-muted-foreground">Período 1 ({formatPeriodLabel(compareStartDate1, compareEndDate1)})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-primary" />
                            <span className="text-sm text-muted-foreground">Período 2 ({formatPeriodLabel(compareStartDate2, compareEndDate2)})</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {showComparison && !shouldFetchComparison && (
                <div className="text-center py-8 text-muted-foreground border-t">
                  <GitCompare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Selecione as datas de início e fim de ambos os períodos para comparar</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Sales Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Vendas dos Últimos 30 Dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.salesByDay}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateLabel}
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tickFormatter={(value) => `R$${value}`}
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    formatter={(value: number) => [formatPrice(value), 'Faturamento']}
                    labelFormatter={(label) => `Data: ${formatDateLabel(label)}`}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Sales Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart className="h-5 w-5 text-primary" />
              Vendas por Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.salesByMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={formatMonthLabel}
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tickFormatter={(value) => `R$${value}`}
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    formatter={(value: number) => [formatPrice(value), 'Faturamento']}
                    labelFormatter={(label) => formatMonthLabel(label)}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar
                    dataKey="revenue"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Produtos Mais Vendidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.productsSold.length > 0 ? (
            <div className="space-y-4">
              {stats.productsSold.slice(0, 10).map((product, index) => (
                <div
                  key={product.productId}
                  className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                    {index + 1}
                  </div>
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-12 h-12 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                      <Package className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{product.name}</p>
                    <p className="text-sm text-muted-foreground">{product.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-primary">
                      {product.totalQuantity} vendas
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatPrice(product.totalRevenue)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <AdminEmptyState icon={Package} title="Nenhuma venda registrada ainda" tone="light" />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
