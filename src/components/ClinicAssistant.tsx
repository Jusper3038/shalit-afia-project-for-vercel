import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Bot, Loader2, Send, Sparkles, TrendingUp } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { getClinicDayKey, getClinicWeekStartKey, getMonthLabel, getTransactionSaleDay, getTransactionSaleMonth, getTransactionSaleYear } from "@/lib/reporting";
import { getDaysUntilExpiry, isExpiredDrug, isExpiringSoonDrug } from "@/lib/inventory";

type Message = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

type AssistantData = {
  drugs: Tables<"drugs">[];
  patients: Tables<"patients">[];
  payments: Tables<"payments">[];
  transactions: Tables<"transactions">[];
};

const quickPrompts = [
  "Give me today's report",
  "What can improve revenue?",
  "Show low-stock and expiry risks",
  "Which items sold best this month?",
];

const formatCurrency = (value: number) => `KSh ${value.toLocaleString()}`;

const ClinicAssistant = () => {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "I can summarize daily operations, highlight stock risks, and suggest revenue improvements. Ask for today's report, best-selling items, profit, payments, or growth ideas.",
    },
  ]);
  const [data, setData] = useState<AssistantData>({
    drugs: [],
    patients: [],
    payments: [],
    transactions: [],
  });

  useEffect(() => {
    if (!open || !user) return;

    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      const [drugsRes, patientsRes, paymentsRes, transactionsRes] = await Promise.all([
        supabase.from("drugs").select("*").eq("user_id", user.id),
        supabase.from("patients").select("*").eq("user_id", user.id),
        supabase.from("payments").select("*").eq("user_id", user.id),
        supabase.from("transactions").select("*").eq("user_id", user.id),
      ]);

      if (cancelled) return;

      setData({
        drugs: drugsRes.data ?? [],
        patients: patientsRes.data ?? [],
        payments: paymentsRes.data ?? [],
        transactions: transactionsRes.data ?? [],
      });
      setLoading(false);
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [open, user]);

  const analytics = useMemo(() => {
    const now = new Date();
    const todayKey = getClinicDayKey(now);
    const weekStartKey = getClinicWeekStartKey(now);
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const todayTransactions = data.transactions.filter((transaction) => getTransactionSaleDay(transaction) === todayKey);
    const weekTransactions = data.transactions.filter((transaction) => transaction.sale_week_start === weekStartKey);
    const monthTransactions = data.transactions.filter(
      (transaction) => getTransactionSaleMonth(transaction) === currentMonth && getTransactionSaleYear(transaction) === currentYear,
    );

    const totalSales = (transactions: Tables<"transactions">[]) =>
      transactions.reduce((sum, transaction) => sum + Number(transaction.total_cost), 0);

    const totalProfit = (transactions: Tables<"transactions">[]) =>
      transactions.reduce((sum, transaction) => sum + (Number(transaction.total_cost) - Number(transaction.unit_buying_price ?? 0) * transaction.quantity), 0);

    const byDrug = monthTransactions.reduce<Record<string, { quantity: number; sales: number }>>((acc, transaction) => {
      const drug = data.drugs.find((item) => item.id === transaction.drug_id);
      const key = drug?.name || "Unknown Item";
      if (!acc[key]) acc[key] = { quantity: 0, sales: 0 };
      acc[key].quantity += transaction.quantity;
      acc[key].sales += Number(transaction.total_cost);
      return acc;
    }, {});

    const topSellingItems = Object.entries(byDrug)
      .sort((a, b) => b[1].sales - a[1].sales)
      .slice(0, 3);

    const lowStockItems = data.drugs.filter((drug) => drug.stock_quantity > 0 && drug.stock_quantity <= drug.low_stock_threshold);
    const outOfStockItems = data.drugs.filter((drug) => drug.stock_quantity === 0);
    const expiringItems = data.drugs.filter((drug) => isExpiringSoonDrug(drug) && !isExpiredDrug(drug));
    const expiredItems = data.drugs.filter((drug) => isExpiredDrug(drug));
    const completedPayments = data.payments.filter((payment) => payment.status === "completed");
    const todayPayments = completedPayments.filter((payment) => getClinicDayKey(payment.created_at) === todayKey);

    return {
      todayKey,
      todayTransactions,
      weekTransactions,
      monthTransactions,
      todaySales: totalSales(todayTransactions),
      weekSales: totalSales(weekTransactions),
      monthSales: totalSales(monthTransactions),
      todayProfit: totalProfit(todayTransactions),
      weekProfit: totalProfit(weekTransactions),
      monthProfit: totalProfit(monthTransactions),
      lowStockItems,
      outOfStockItems,
      expiringItems,
      expiredItems,
      topSellingItems,
      todayPayments: todayPayments.reduce((sum, payment) => sum + Number(payment.amount), 0),
      totalPatients: data.patients.length,
      currentMonthLabel: `${getMonthLabel(currentMonth)} ${currentYear}`,
    };
  }, [data]);

  const buildTodayReport = () => {
    return [
      `Today's report for ${profile?.clinic_name || "your clinic"}:`,
      `Sales: ${formatCurrency(analytics.todaySales)} from ${analytics.todayTransactions.length} bill lines.`,
      `Profit: ${formatCurrency(analytics.todayProfit)}.`,
      `Completed payments today: ${formatCurrency(analytics.todayPayments)}.`,
      `Patients in the system: ${analytics.totalPatients}.`,
      analytics.topSellingItems.length > 0
        ? `Top item this month so far: ${analytics.topSellingItems[0][0]} with ${formatCurrency(analytics.topSellingItems[0][1].sales)} in sales.`
        : "No strong top-selling item yet this month.",
    ].join(" ");
  };

  const buildStockRiskReport = () => {
    const lowStock = analytics.lowStockItems.slice(0, 3).map((drug) => `${drug.name} (${drug.stock_quantity} left)`);
    const expiring = analytics.expiringItems
      .slice(0, 3)
      .map((drug) => `${drug.name} (${getDaysUntilExpiry(drug.expiry_date)} days left)`);

    return [
      `Stock risk summary: ${analytics.outOfStockItems.length} out of stock, ${analytics.lowStockItems.length} low-stock, ${analytics.expiringItems.length} expiring soon, and ${analytics.expiredItems.length} expired item(s).`,
      lowStock.length > 0 ? `Low stock to act on first: ${lowStock.join(", ")}.` : "No active low-stock warnings right now.",
      expiring.length > 0 ? `Items nearing expiry: ${expiring.join(", ")}.` : "No items are close to expiry right now.",
    ].join(" ");
  };

  const buildTopItemsReport = () => {
    if (analytics.topSellingItems.length === 0) {
      return `There are no sales recorded yet for ${analytics.currentMonthLabel}.`;
    }

    return [
      `Top-selling items for ${analytics.currentMonthLabel}:`,
      ...analytics.topSellingItems.map(
        ([name, stats], index) => `${index + 1}. ${name} sold ${stats.quantity} unit(s) and generated ${formatCurrency(stats.sales)}.`,
      ),
    ].join(" ");
  };

  const buildImprovementAdvice = () => {
    const advice: string[] = [];

    if (analytics.outOfStockItems.length > 0) {
      advice.push(`Restock ${analytics.outOfStockItems[0].name} immediately because stockouts can directly block sales.`);
    }

    if (analytics.lowStockItems.length > 0) {
      advice.push(`Plan a reorder for ${analytics.lowStockItems[0].name} before it reaches zero; it is already below threshold.`);
    }

    if (analytics.topSellingItems.length > 0) {
      advice.push(`Keep ${analytics.topSellingItems[0][0]} highly visible and always available because it is your strongest seller right now.`);
    }

    if (analytics.expiringItems.length > 0) {
      advice.push(`Move expiring stock faster with pricing, bundling, or staff reminders so value is not lost to expiry.`);
    }

    if (analytics.todaySales < analytics.weekSales / Math.max(1, 7)) {
      advice.push("Today's sales are below this week's average pace, so review whether stock, staffing, or patient flow slowed down.");
    }

    if (advice.length === 0) {
      advice.push("Keep recording sales consistently so I can give stronger revenue recommendations from your real operating patterns.");
    }

    return `Best revenue improvement ideas: ${advice.join(" ")}`;
  };

  const buildProfitReport = () => {
    return [
      `Profit snapshot: today ${formatCurrency(analytics.todayProfit)}, this week ${formatCurrency(analytics.weekProfit)}, and this month ${formatCurrency(analytics.monthProfit)}.`,
      `Sales snapshot: today ${formatCurrency(analytics.todaySales)}, this week ${formatCurrency(analytics.weekSales)}, and this month ${formatCurrency(analytics.monthSales)}.`,
    ].join(" ");
  };

  const buildPaymentsReport = () => {
    const completedPayments = data.payments.filter((payment) => payment.status === "completed");
    const pendingPayments = data.payments.filter((payment) => payment.status === "pending");

    return [
      `Payments summary: ${completedPayments.length} completed payment(s) worth ${formatCurrency(completedPayments.reduce((sum, payment) => sum + Number(payment.amount), 0))}.`,
      `${pendingPayments.length} payment(s) are still pending.`,
      `Completed payments today total ${formatCurrency(analytics.todayPayments)}.`,
    ].join(" ");
  };

  const answerPrompt = (prompt: string) => {
    const normalized = prompt.toLowerCase();

    if (normalized.includes("today") || normalized.includes("daily report") || normalized.includes("today's report")) {
      return buildTodayReport();
    }

    if (normalized.includes("low stock") || normalized.includes("expiry") || normalized.includes("expired") || normalized.includes("stock risk")) {
      return buildStockRiskReport();
    }

    if (normalized.includes("top") || normalized.includes("best") || normalized.includes("sold best") || normalized.includes("best-selling")) {
      return buildTopItemsReport();
    }

    if (normalized.includes("profit") || normalized.includes("revenue") || normalized.includes("sales")) {
      return buildProfitReport();
    }

    if (normalized.includes("payment")) {
      return buildPaymentsReport();
    }

    if (normalized.includes("improve") || normalized.includes("increase") || normalized.includes("growth") || normalized.includes("recommend")) {
      return buildImprovementAdvice();
    }

    if (normalized.includes("summary") || normalized.includes("report")) {
      return `${buildTodayReport()} ${buildStockRiskReport()} ${buildImprovementAdvice()}`;
    }

    return "I can help with today's report, profit, payments, top-selling items, stock risks, and ways to improve revenue. Try asking: 'Give me today's report' or 'What can improve revenue?'";
  };

  const handlePrompt = (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed,
    };

    const assistantMessage: Message = {
      id: `assistant-${Date.now() + 1}`,
      role: "assistant",
      text: answerPrompt(trimmed),
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput("");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handlePrompt(input);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          size="icon"
          className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg"
        >
          <Bot className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-xl">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary/15 p-3 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <SheetTitle>Clinic Assistant</SheetTitle>
              <SheetDescription>
                Live operational insights for sales, stock, profit, and growth opportunities.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="outline">{profile?.clinic_name || "Clinic"}</Badge>
          <Badge variant="outline">{analytics.currentMonthLabel}</Badge>
          <Badge variant="outline" className="gap-1">
            <TrendingUp className="h-3.5 w-3.5" />
            Revenue Assistant
          </Badge>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {quickPrompts.map((prompt) => (
            <Button key={prompt} type="button" variant="outline" size="sm" onClick={() => handlePrompt(prompt)}>
              {prompt}
            </Button>
          ))}
        </div>

        <div className="mt-4 min-h-0 flex-1 rounded-2xl border bg-muted/20">
          <ScrollArea className="h-full p-4">
            <div className="space-y-3">
              {loading ? (
                <div className="flex items-center gap-2 rounded-xl border bg-background px-4 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading clinic data for analysis...
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                      message.role === "assistant"
                        ? "border bg-background text-foreground"
                        : "ml-auto bg-primary text-primary-foreground"
                    }`}
                  >
                    {message.text}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about sales, stock, profit, or revenue ideas..."
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default ClinicAssistant;
