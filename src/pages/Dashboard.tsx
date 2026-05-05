import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Users, Package2, Receipt, AlertTriangle, Download } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import type { Tables } from "@/integrations/supabase/types";
import { getExpiryLabel, isExpiredDrug, isExpiringSoonDrug } from "@/lib/inventory";
import { exportToCSV } from "@/lib/csv-export";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  buildSalesCsvRows,
  enumerateDayKeys,
  formatClinicDate,
  formatClinicTime,
  getClinicDayKey,
  getClinicWeekStartKey,
  getCustomRangeLabel,
  getMonthLabel,
  getTimeZoneParts,
  getTransactionSaleDay,
  getTransactionSaleMonth,
  matchesSalesPeriod,
  type SalesPeriod,
} from "@/lib/reporting";

type AlertFilter = "all" | "expired" | "expiring" | "out" | "low";

const Dashboard = () => {
  const { user } = useAuth();
  const [drugs, setDrugs] = useState<Tables<"drugs">[]>([]);
  const [patients, setPatients] = useState<Tables<"patients">[]>([]);
  const [transactions, setTransactions] = useState<Tables<"transactions">[]>([]);
  const [loading, setLoading] = useState(true);
  const [salesPeriod, setSalesPeriod] = useState<SalesPeriod>("daily");
  const [alertFilter, setAlertFilter] = useState<AlertFilter>("all");
  const [now, setNow] = useState(() => new Date());
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [customStartDate, setCustomStartDate] = useState(() => {
    const start = new Date();
    start.setDate(start.getDate() - 6);
    return getClinicDayKey(start);
  });
  const [customEndDate, setCustomEndDate] = useState(() => getClinicDayKey(new Date()));

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [drugsRes, patientsRes, txRes] = await Promise.all([
        supabase.from("drugs").select("*").eq("user_id", user.id),
        supabase.from("patients").select("*").eq("user_id", user.id),
        supabase.from("transactions").select("*").eq("user_id", user.id),
      ]);
      setDrugs(drugsRes.data ?? []);
      setPatients(patientsRes.data ?? []);
      setTransactions(txRes.data ?? []);
      setLoading(false);
    };
    fetchData();
  }, [user]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  const getTransactionDate = (transaction: Tables<"transactions">) => new Date(transaction.date || transaction.created_at);
  const availableYears = Array.from(
    new Set([now.getFullYear(), ...transactions.map((transaction) => transaction.sale_year ?? getTransactionDate(transaction).getFullYear())])
  ).sort((a, b) => b - a);

  const filteredTransactions = transactions.filter((transaction) => {
    return matchesSalesPeriod(transaction, salesPeriod, now, selectedMonth + 1, selectedYear, customStartDate, customEndDate);
  });

  const totalSales = filteredTransactions.reduce((sum, t) => sum + Number(t.total_cost), 0);
  const estimatedCostOfGoodsSold = filteredTransactions.reduce((sum, t) => {
    return sum + (Number(t.unit_buying_price ?? 0) * t.quantity);
  }, 0);
  const profitMade = totalSales - estimatedCostOfGoodsSold;
  const totalPatients = patients.length;
  const totalBills = filteredTransactions.length;
  const totalItemsInStock = drugs.reduce((sum, d) => sum + d.stock_quantity, 0);
  const inventoryCostValue = drugs.reduce((sum, d) => sum + Number(d.buying_price) * d.stock_quantity, 0);
  const inventoryRetailValue = drugs.reduce((sum, d) => sum + Number(d.selling_price) * d.stock_quantity, 0);
  const estimatedInventoryMargin = inventoryRetailValue - inventoryCostValue;
  const lowStockDrugs = drugs.filter((d) => d.stock_quantity <= d.low_stock_threshold);
  const outOfStockDrugs = drugs.filter((d) => d.stock_quantity === 0);
  const expiredDrugs = drugs.filter((d) => isExpiredDrug(d) && d.stock_quantity > 0);
  const expiringSoonDrugs = drugs.filter((d) => isExpiringSoonDrug(d) && d.stock_quantity > 0);
  const sellableDrugs = drugs.filter((d) => d.stock_quantity > 0 && !isExpiredDrug(d));
  const totalInventoryLines = Math.max(drugs.length, 1);
  const visibleAlerts =
    alertFilter === "expired" ? expiredDrugs :
    alertFilter === "expiring" ? expiringSoonDrugs.filter((d) => !isExpiredDrug(d)) :
    alertFilter === "out" ? outOfStockDrugs :
    alertFilter === "low" ? lowStockDrugs.filter((d) => d.stock_quantity > 0) :
    [
      ...expiredDrugs,
      ...expiringSoonDrugs.filter((d) => !isExpiredDrug(d)),
      ...outOfStockDrugs,
      ...lowStockDrugs.filter((d) => d.stock_quantity > 0),
    ];
  const rangeLabel =
    salesPeriod === "daily" ? "Today" :
    salesPeriod === "weekly" ? "This Week" :
    salesPeriod === "monthly" ? `${getMonthLabel(selectedMonth + 1)} ${selectedYear}` :
    salesPeriod === "custom" ? getCustomRangeLabel(customStartDate, customEndDate) :
    `${selectedYear}`;
  const periodDescription =
    salesPeriod === "daily" ? `Resets automatically at 12:00 AM based on the current clinic day (${getClinicDayKey(now)}).` :
    salesPeriod === "weekly" ? "Shows sales from the start of the current week up to now." :
    salesPeriod === "monthly" ? "Shows sales for the exact selected month and year." :
    salesPeriod === "custom" ? "Shows sales between the selected start and end dates, inclusive." :
    "Shows sales for the exact selected year.";

  const getDrugById = (drugId: string | null) => drugs.find((drug) => drug.id === drugId);
  const getPatientById = (patientId: string | null) => patients.find((patient) => patient.id === patientId);
  const csvRows = buildSalesCsvRows(filteredTransactions, { getDrugById, getPatientById, periodLabel: rangeLabel });
  const customRangeInvalid = customStartDate > customEndDate;

  const trendChartConfig = {
    sales: {
      label: "Sales",
      color: "hsl(var(--primary))",
    },
    bills: {
      label: "Bills",
      color: "#f59e0b",
    },
  };

  const trendData =
    salesPeriod === "yearly"
      ? Array.from({ length: 12 }, (_, index) => {
          const monthNumber = index + 1;
          const monthTransactions = filteredTransactions.filter((transaction) => getTransactionSaleMonth(transaction) === monthNumber);
          return {
            key: `${selectedYear}-${monthNumber}`,
            label: getMonthLabel(monthNumber).slice(0, 3),
            sales: monthTransactions.reduce((sum, transaction) => sum + Number(transaction.total_cost), 0),
            bills: monthTransactions.length,
          };
        })
      : (salesPeriod === "daily"
          ? Array.from({ length: 24 }, (_, hour) => {
              const hourTransactions = filteredTransactions.filter((transaction) => {
                const saleDate = transaction.date || transaction.created_at;
                return getTimeZoneParts(saleDate).hour === hour;
              });
              return {
                key: `hour-${hour}`,
                label: `${String(hour).padStart(2, "0")}:00`,
                sales: hourTransactions.reduce((sum, transaction) => sum + Number(transaction.total_cost), 0),
                bills: hourTransactions.length,
              };
            })
          : (() => {
              const dayKeys =
                salesPeriod === "weekly"
                  ? enumerateDayKeys(getClinicWeekStartKey(now), getClinicDayKey(now))
                  : salesPeriod === "monthly"
                    ? enumerateDayKeys(
                        `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`,
                        `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(new Date(Date.UTC(selectedYear, selectedMonth + 1, 0)).getUTCDate()).padStart(2, "0")}`,
                      )
                    : enumerateDayKeys(customStartDate, customEndDate);

              return dayKeys.map((dayKey) => {
                const dayTransactions = filteredTransactions.filter((transaction) => getTransactionSaleDay(transaction) === dayKey);
                return {
                  key: dayKey,
                  label: dayKey.slice(8, 10),
                  sales: dayTransactions.reduce((sum, transaction) => sum + Number(transaction.total_cost), 0),
                  bills: dayTransactions.length,
                };
              });
            })());

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="animate-in fade-in-50 slide-in-from-top-2 duration-500 rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-amber-500/10 p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Quick view of sales, stock health, and profit trends for {rangeLabel.toLowerCase()}.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{periodDescription}</p>
              <div className="mt-3 inline-flex flex-col rounded-lg border bg-background/80 px-3 py-2 text-sm shadow-sm">
                <span className="font-medium">Current Date: {formatClinicDate(now)}</span>
                <span className="text-muted-foreground">Current Time: {formatClinicTime(now)}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                { label: "Daily", value: "daily" },
                { label: "Weekly", value: "weekly" },
                { label: "Monthly", value: "monthly" },
                { label: "Yearly", value: "yearly" },
                { label: "Custom", value: "custom" },
              ] as const).map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={salesPeriod === option.value ? "default" : "outline"}
                  className="flex-1 transition-transform duration-200 hover:-translate-y-0.5 sm:flex-none"
                  onClick={() => setSalesPeriod(option.value)}
                >
                  {option.label}
                </Button>
              ))}
              {(salesPeriod === "monthly" || salesPeriod === "yearly") && (
                <Select value={String(selectedYear)} onValueChange={(value) => setSelectedYear(Number(value))}>
                  <SelectTrigger className="w-full sm:w-[120px]">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {salesPeriod === "monthly" && (
                <Select value={String(selectedMonth)} onValueChange={(value) => setSelectedMonth(Number(value))}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, index) => (
                      getMonthLabel(index + 1)
                    )).map((month, index) => (
                      <SelectItem key={month} value={String(index)}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {salesPeriod === "custom" && (
                <>
                  <Input
                    type="date"
                    className="w-full sm:w-[160px]"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                  <Input
                    type="date"
                    className="w-full sm:w-[160px]"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full sm:w-auto"
                disabled={csvRows.length === 0 || customRangeInvalid}
                onClick={() => exportToCSV(
                  csvRows,
                  `sales-${rangeLabel.toLowerCase().replace(/\s+/g, "-")}`
                )}
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
          {salesPeriod === "custom" && customRangeInvalid && (
            <p className="mt-3 text-sm text-destructive">The custom report start date must be before or equal to the end date.</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="animate-in fade-in-50 slide-in-from-bottom-2 duration-500 transition-transform hover:-translate-y-1 hover:shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">KSh {totalSales.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Money from recorded bills in {rangeLabel.toLowerCase()}</p>
            </CardContent>
          </Card>
          <Card className="animate-in fade-in-50 slide-in-from-bottom-2 duration-500 delay-100 transition-transform hover:-translate-y-1 hover:shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Profit Made</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${profitMade >= 0 ? "text-green-600" : "text-red-600"}`}>
                KSh {profitMade.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Total sales minus the recorded buying cost of sold items</p>
            </CardContent>
          </Card>
          <Card className="animate-in fade-in-50 slide-in-from-bottom-2 duration-500 delay-200 transition-transform hover:-translate-y-1 hover:shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Bills Recorded</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalBills}</div>
              <p className="text-xs text-muted-foreground">Sale lines recorded in {rangeLabel.toLowerCase()}</p>
            </CardContent>
          </Card>
          <Card className="animate-in fade-in-50 slide-in-from-bottom-2 duration-500 delay-300 transition-transform hover:-translate-y-1 hover:shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Items In Stock</CardTitle>
              <Package2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalItemsInStock}</div>
              <p className="text-xs text-muted-foreground">Total units currently on hand</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          <Card className="animate-in fade-in-50 slide-in-from-bottom-2 duration-500 delay-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Patients</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalPatients}</div>
              <p className="text-xs text-muted-foreground">Registered patients in this clinic</p>
            </CardContent>
          </Card>
          <Card className="animate-in fade-in-50 slide-in-from-bottom-2 duration-500 delay-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Cost Of Items Sold</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">KSh {estimatedCostOfGoodsSold.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Recorded buying price at the time each sale was made</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
            <CardHeader>
              <CardTitle>Sales Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {customRangeInvalid ? (
                <div className="rounded-md border border-dashed px-3 py-10 text-center text-sm text-muted-foreground">
                  Fix the custom date range to view the trend chart.
                </div>
              ) : trendData.every((point) => point.sales === 0) ? (
                <div className="rounded-md border border-dashed px-3 py-10 text-center text-sm text-muted-foreground">
                  No sales data in this view yet.
                </div>
              ) : (
                <ChartContainer
                  config={trendChartConfig}
                  className="h-[320px] w-full"
                >
                  {salesPeriod === "yearly" ? (
                    <BarChart data={trendData}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} width={80} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="sales" radius={[8, 8, 0, 0]} fill="var(--color-sales)" />
                    </BarChart>
                  ) : (
                    <LineChart data={trendData}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} width={80} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey="sales" stroke="var(--color-sales)" strokeWidth={3} dot={{ fill: "var(--color-sales)" }} activeDot={{ r: 6 }} />
                    </LineChart>
                  )}
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card className="animate-in fade-in-50 slide-in-from-bottom-2 duration-500 delay-100">
            <CardHeader>
              <CardTitle>Custom Date-Range Report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                <div>
                  <p className="text-sm font-medium">From</p>
                  <Input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} />
                </div>
                <div>
                  <p className="text-sm font-medium">To</p>
                  <Input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} />
                </div>
              </div>
              <Button type="button" className="w-full" disabled={customRangeInvalid} onClick={() => setSalesPeriod("custom")}>
                View Custom Report
              </Button>
              <div className="rounded-xl border bg-accent/30 p-4 text-sm">
                <p className="font-medium">Current custom range</p>
                <p className="mt-1 text-muted-foreground">
                  {customRangeInvalid ? "Choose a valid start and end date." : getCustomRangeLabel(customStartDate, customEndDate)}
                </p>
                <p className="mt-3 text-muted-foreground">
                  Use `Export CSV` while `Custom` is selected to download this exact report.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Inventory Cost Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">KSh {inventoryCostValue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Buying price x stock left</p>
            </CardContent>
          </Card>
          <Card className="animate-in fade-in-50 slide-in-from-bottom-2 duration-500 delay-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Inventory Retail Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">KSh {inventoryRetailValue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Selling price x stock left</p>
            </CardContent>
          </Card>
          <Card className="animate-in fade-in-50 slide-in-from-bottom-2 duration-500 delay-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Estimated Margin In Stock</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${estimatedInventoryMargin >= 0 ? "text-green-600" : "text-red-600"}`}>
                KSh {estimatedInventoryMargin.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Retail value minus buying value of current stock</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="animate-in fade-in-50 slide-in-from-left-2 duration-500">
            <CardHeader>
              <CardTitle>How To Read These Numbers</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="rounded-md border p-3 transition-colors hover:bg-accent/40">
              <p className="font-medium">Profit made</p>
              <p className="text-sm text-muted-foreground">
                `Profit Made` is sales minus the recorded buying cost of sold items.
              </p>
            </div>
            <div className="rounded-md border p-3 transition-colors hover:bg-accent/40">
              <p className="font-medium">Historical pricing</p>
              <p className="text-sm text-muted-foreground">
                Each sale now keeps the buying and selling price from the moment it was recorded.
              </p>
            </div>
            <div className="rounded-md border p-3 transition-colors hover:bg-accent/40">
              <p className="font-medium">Inventory values</p>
              <p className="text-sm text-muted-foreground">
                `Inventory Cost Value` and `Inventory Retail Value` are based on stock still remaining, not past spending.
              </p>
            </div>
            <div className="rounded-md border p-3 transition-colors hover:bg-accent/40">
              <p className="font-medium">Stock health</p>
              <p className="text-sm text-muted-foreground">
                Out-of-stock, low-stock, expired, and soon-to-expire items are listed below for quick action.
              </p>
              </div>
            </CardContent>
          </Card>

          <Card className="animate-in fade-in-50 slide-in-from-right-2 duration-500">
            <CardHeader>
              <CardTitle>Inventory Health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span>Sellable</span>
                  <span>{sellableDrugs.length}/{totalInventoryLines}</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${(sellableDrugs.length / totalInventoryLines) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span>Expired</span>
                  <span>{expiredDrugs.length}/{totalInventoryLines}</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-destructive transition-all duration-700" style={{ width: `${(expiredDrugs.length / totalInventoryLines) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span>Expiring Soon</span>
                  <span>{expiringSoonDrugs.length}/{totalInventoryLines}</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-amber-500 transition-all duration-700" style={{ width: `${(expiringSoonDrugs.length / totalInventoryLines) * 100}%` }} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alerts */}
        {(lowStockDrugs.length > 0 || outOfStockDrugs.length > 0 || expiredDrugs.length > 0 || expiringSoonDrugs.length > 0) && (
          <Card className="animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
            <CardHeader>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Stock Alerts
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  {([
                    { label: "All", value: "all" },
                    { label: "Expired", value: "expired" },
                    { label: "Expiring", value: "expiring" },
                    { label: "Out", value: "out" },
                    { label: "Low", value: "low" },
                  ] as const).map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      size="sm"
                      variant={alertFilter === option.value ? "default" : "outline"}
                      className="flex-1 transition-transform duration-200 hover:-translate-y-0.5 sm:flex-none"
                      onClick={() => setAlertFilter(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {visibleAlerts.length === 0 ? (
                <div className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                  No alerts in this view.
                </div>
              ) : (
                visibleAlerts.map((drug) => (
                  <div key={`${alertFilter}-${drug.id}`} className="flex flex-col gap-2 rounded-md border px-3 py-2 transition-colors hover:bg-accent/40 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <span className="font-medium">{drug.name}</span>
                      <p className="text-xs text-muted-foreground">
                        Stock: {drug.stock_quantity} | Expiry: {drug.expiry_date ? formatClinicDate(drug.expiry_date) : "Not set"}
                      </p>
                    </div>
                    {isExpiredDrug(drug) ? (
                      <Badge variant="destructive">EXPIRED</Badge>
                    ) : outOfStockDrugs.some((item) => item.id === drug.id) ? (
                      <Badge variant="destructive">OUT OF STOCK</Badge>
                    ) : isExpiringSoonDrug(drug) ? (
                      <Badge className="bg-amber-500 text-amber-950">{getExpiryLabel(drug).toUpperCase()}</Badge>
                    ) : (
                      <Badge className="bg-yellow-500 text-yellow-950">LOW STOCK ({drug.stock_quantity} left)</Badge>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Sellable Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sellableDrugs.length}</div>
              <p className="text-xs text-muted-foreground">Inventory lines with stock and no expiry block</p>
            </CardContent>
          </Card>
          <Card className="animate-in fade-in-50 slide-in-from-bottom-2 duration-500 delay-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Expired Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{expiredDrugs.length}</div>
              <p className="text-xs text-muted-foreground">Inventory lines that should not be billed</p>
            </CardContent>
          </Card>
          <Card className="animate-in fade-in-50 slide-in-from-bottom-2 duration-500 delay-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{expiringSoonDrugs.length}</div>
              <p className="text-xs text-muted-foreground">Items expiring within 30 days</p>
            </CardContent>
          </Card>
        </div>

        <Card className="animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
          <CardHeader>
            <CardTitle>Recent Billing Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No billing activity yet. Start by adding inventory and recording a bill.</p>
            ) : (
              <div className="space-y-2">
                {filteredTransactions.slice(-5).reverse().map((t) => (
                  <div key={t.id} className="flex flex-col gap-2 rounded-md border px-3 py-2 transition-colors hover:border-primary/40 hover:bg-accent/30 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <span className="text-sm font-medium">Qty: {t.quantity}</span>
                      <p className="text-xs text-muted-foreground">{rangeLabel}</p>
                    </div>
                    <span className="font-medium">KSh {Number(t.total_cost).toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatClinicDate(t.date)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
