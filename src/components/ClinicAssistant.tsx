import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Bot, Loader2, PackageCheck, Send, Sparkles, TrendingUp } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { getClinicDayKey, getClinicWeekStartKey, getMonthLabel, getTransactionSaleDay, getTransactionSaleMonth, getTransactionSaleYear } from "@/lib/reporting";
import { getDaysUntilExpiry, isExpiredDrug, isExpiringSoonDrug } from "@/lib/inventory";

const OLLAMA_MODEL = import.meta.env.VITE_OLLAMA_MODEL || "llama3.1:8b";

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
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "I can summarize daily operations, highlight stock risks, and suggest revenue improvements. Ask for today's report, best-selling items, profit, payments, or growth ideas. When Ollama is available, I'll use a smarter model for richer answers.",
    },
  ]);
  const [data, setData] = useState<AssistantData>({
    drugs: [],
    patients: [],
    payments: [],
    transactions: [],
  });
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, open]);

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

  const buildClinicSnapshot = () =>
    [
      `Clinic: ${profile?.clinic_name || "your clinic"}`,
      `Today sales: ${formatCurrency(analytics.todaySales)}`,
      `Today profit: ${formatCurrency(analytics.todayProfit)}`,
      `This week sales: ${formatCurrency(analytics.weekSales)}`,
      `This month sales: ${formatCurrency(analytics.monthSales)}`,
      `Completed payments today: ${formatCurrency(analytics.todayPayments)}`,
      `Total patients: ${analytics.totalPatients}`,
      `Low stock items: ${analytics.lowStockItems.length}`,
      `Out of stock items: ${analytics.outOfStockItems.length}`,
      `Expiring soon items: ${analytics.expiringItems.length}`,
      `Expired items: ${analytics.expiredItems.length}`,
      analytics.topSellingItems.length > 0
        ? `Top seller this month: ${analytics.topSellingItems[0][0]}`
        : "Top seller this month: none yet",
    ].join("\n");

  const buildSystemPrompt = () =>
    [
      "You are a helpful clinic operations assistant for Shalit Afia.",
      "Your job is to help the owner understand sales, stock, patients, payments, profit, and growth opportunities.",
      "Be concise, practical, and friendly.",
      "Use the clinic snapshot and recent conversation for context.",
      "If a user asks for analysis, give actionable advice, not generic AI filler.",
      "If the data does not support a claim, say so plainly.",
      "Prefer short paragraphs or bullets.",
    ].join(" ");

  const callOllama = async (prompt: string, history: Message[]) => {
    const recentMessages = history
      .slice(-6)
      .map((message) => ({
        role: message.role,
        content: message.text,
      }));

    const response = await fetch("/api/ollama", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        snapshot: buildClinicSnapshot(),
        prompt,
        messages: recentMessages,
      }),
    });

    if (!response.ok) {
      throw new Error(`Assistant request failed with status ${response.status}`);
    }

    const data = (await response.json()) as { reply?: string };
    const content = data.reply?.trim();

    if (!content) {
      throw new Error("Assistant returned an empty response.");
    }

    return content;
  };

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
    const nextMessages = [
      ...messages,
      userMessage,
    ];

    const assistantMessage: Message = {
      id: `assistant-${Date.now() + 1}`,
      role: "assistant",
      text: "Thinking with Ollama...",
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput("");

    const runAssistant = async () => {
      setSending(true);
      try {
        const reply = await callOllama(trimmed, nextMessages);
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessage.id ? { ...message, text: reply } : message,
          ),
        );
      } catch {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessage.id ? { ...message, text: answerPrompt(trimmed) } : message,
          ),
        );
      } finally {
        setSending(false);
      }
    };

    void runAssistant();
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
          className="fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full border border-white/25 bg-primary shadow-xl shadow-primary/25 transition-transform hover:-translate-y-1 hover:shadow-2xl sm:bottom-6 sm:right-6"
          aria-label="Open clinic assistant"
        >
          <Bot className="h-6 w-6" />
          <span className="absolute -right-0.5 -top-0.5 h-4 w-4 rounded-full border-2 border-background bg-emerald-500" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <div className="border-b bg-card px-4 py-4 sm:px-5">
          <SheetHeader className="text-left">
            <div className="flex items-start gap-3 pr-8">
              <div className="rounded-lg bg-primary p-2.5 text-primary-foreground shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle className="text-base sm:text-lg">Clinic Assistant</SheetTitle>
                  <Badge className="h-6 rounded-md bg-emerald-500/15 px-2 text-emerald-700 hover:bg-emerald-500/15">
                    Live
                  </Badge>
                </div>
                <SheetDescription className="mt-1">
                  Sales, stock, profit, payments, and growth answers from your clinic data.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-lg border bg-background px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                Today
              </div>
              <p className="mt-1 truncate text-sm font-semibold">{formatCurrency(analytics.todaySales)}</p>
            </div>
            <div className="rounded-lg border bg-background px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <PackageCheck className="h-3.5 w-3.5 text-emerald-600" />
                Stock
              </div>
              <p className="mt-1 truncate text-sm font-semibold">{data.drugs.length} items</p>
            </div>
            <div className="rounded-lg border bg-background px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                Alerts
              </div>
              <p className="mt-1 truncate text-sm font-semibold">
                {analytics.lowStockItems.length + analytics.outOfStockItems.length + analytics.expiringItems.length}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-md">{profile?.clinic_name || "Clinic"}</Badge>
            <Badge variant="outline" className="rounded-md">{analytics.currentMonthLabel}</Badge>
            <Badge variant="outline" className="rounded-md">{OLLAMA_MODEL}</Badge>
          </div>
        </div>

        <div className="border-b bg-background px-4 py-3 sm:px-5">
          <div className="flex gap-2 overflow-x-auto pb-1">
          {quickPrompts.map((prompt) => (
            <Button
              key={prompt}
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 rounded-full bg-card text-xs"
              onClick={() => handlePrompt(prompt)}
            >
              {prompt}
            </Button>
          ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 bg-muted/25">
          <ScrollArea className="h-full">
            <div className="space-y-4 px-4 py-5 sm:px-5">
              {loading ? (
                <div className="flex items-center gap-2 rounded-lg border bg-background px-4 py-3 text-sm text-muted-foreground shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading clinic data for analysis...
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {message.role === "assistant" && (
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-card text-primary shadow-sm">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                    <div
                      className={`max-w-[86%] rounded-lg px-4 py-3 text-sm leading-6 shadow-sm sm:max-w-[82%] ${
                        message.role === "assistant"
                          ? "border bg-card text-foreground"
                          : "bg-primary text-primary-foreground"
                      }`}
                    >
                      <p className="whitespace-pre-line">{message.text}</p>
                    </div>
                  </div>
                ))
              )}
              {sending && !loading && (
                <div className="flex items-center gap-2 pl-10 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Assistant is preparing an answer
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>

        <form onSubmit={handleSubmit} className="border-t bg-card p-3 sm:p-4">
          <div className="flex items-end gap-2 rounded-lg border bg-background p-2 shadow-sm">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handlePrompt(input);
                }
              }}
              placeholder="Ask about sales, stock, profit, or revenue ideas..."
              disabled={loading || sending}
              className="max-h-28 min-h-10 resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              rows={1}
            />
            <Button type="submit" size="icon" className="h-10 w-10 shrink-0 rounded-lg" disabled={loading || sending || !input.trim()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default ClinicAssistant;
