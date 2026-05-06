import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, HeartPulse, Loader2, MessageCircle, PackageCheck, Send, Sparkles, TrendingUp } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { getClinicDayKey, getClinicWeekStartKey, getMonthLabel, getTransactionSaleDay, getTransactionSaleMonth, getTransactionSaleYear } from "@/lib/reporting";
import { getDaysUntilExpiry, isExpiredDrug, isExpiringSoonDrug } from "@/lib/inventory";

const OLLAMA_MODEL = import.meta.env.VITE_OLLAMA_MODEL || "llama3.1:8b";
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || "gemini-2.5-flash";

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

  const buildRecentMessages = (history: Message[]) =>
    history
      .slice(-6)
      .map((message) => ({
        role: message.role,
        content: message.text,
      }));

  const callGemini = async (prompt: string, history: Message[]) => {
    const response = await fetch("/api/gemini", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GEMINI_MODEL,
        snapshot: buildClinicSnapshot(),
        prompt,
        messages: buildRecentMessages(history),
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini request failed with status ${response.status}`);
    }

    const data = (await response.json()) as { reply?: string };
    const content = data.reply?.trim();

    if (!content) {
      throw new Error("Gemini returned an empty response.");
    }

    return content;
  };

  const callOllama = async (prompt: string, history: Message[]) => {
    const response = await fetch("/api/ollama", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        snapshot: buildClinicSnapshot(),
        prompt,
        messages: buildRecentMessages(history),
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

    if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(normalized.trim())) {
      return `Hello. I am here with ${profile?.clinic_name || "your clinic"}'s operating picture. You can ask me for today's report, stock risks, payments, profit, or revenue ideas.`;
    }

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
      text: "Checking your clinic data...",
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput("");

    const runAssistant = async () => {
      setSending(true);
      try {
        const reply = await callGemini(trimmed, nextMessages);
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessage.id ? { ...message, text: reply } : message,
          ),
        );
      } catch {
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
        }
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
          className="fixed bottom-5 right-5 z-40 h-16 w-16 rounded-2xl border border-cyan-200/40 bg-gradient-to-br from-cyan-400 to-primary text-primary-foreground shadow-2xl shadow-primary/30 transition-transform hover:-translate-y-1 hover:scale-105 sm:bottom-6 sm:right-6"
          aria-label="Open clinic assistant"
        >
          <MessageCircle className="h-7 w-7" />
          <span className="absolute -right-1 -top-1 h-5 w-5 rounded-full border-2 border-background bg-emerald-500 shadow-sm" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full max-w-full flex-col gap-0 overflow-hidden border-l-0 bg-slate-50 p-0 sm:max-w-xl">
        <div className="relative overflow-hidden border-b bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-4 py-5 text-white sm:px-5">
          <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-cyan-400/20 blur-3xl" />
          <SheetHeader className="text-left">
            <div className="relative flex items-start gap-3 pr-8">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-cyan-200 shadow-lg backdrop-blur">
                <HeartPulse className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle className="text-base text-white sm:text-lg">Shalit Care Copilot</SheetTitle>
                  <Badge className="h-6 rounded-full border border-emerald-300/30 bg-emerald-400/15 px-2 text-emerald-100 hover:bg-emerald-400/15">
                    Live
                  </Badge>
                </div>
                <SheetDescription className="mt-1 text-white/70">
                  Calm answers for sales, stock, payments, profit, and next best actions.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="relative mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-3 backdrop-blur">
              <div className="flex items-center gap-1.5 text-xs text-white/60">
                <TrendingUp className="h-3.5 w-3.5 text-cyan-200" />
                Today
              </div>
              <p className="mt-1 truncate text-sm font-semibold text-white">{formatCurrency(analytics.todaySales)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-3 backdrop-blur">
              <div className="flex items-center gap-1.5 text-xs text-white/60">
                <PackageCheck className="h-3.5 w-3.5 text-emerald-200" />
                Stock
              </div>
              <p className="mt-1 truncate text-sm font-semibold text-white">{data.drugs.length} items</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-3 backdrop-blur">
              <div className="flex items-center gap-1.5 text-xs text-white/60">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-200" />
                Alerts
              </div>
              <p className="mt-1 truncate text-sm font-semibold text-white">
                {analytics.lowStockItems.length + analytics.outOfStockItems.length + analytics.expiringItems.length}
              </p>
            </div>
          </div>

          <div className="relative mt-3 flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-full border-white/15 bg-white/10 text-white">{profile?.clinic_name || "Clinic"}</Badge>
            <Badge variant="outline" className="rounded-full border-white/15 bg-white/10 text-white">{analytics.currentMonthLabel}</Badge>
            <Badge variant="outline" className="rounded-full border-white/15 bg-white/10 text-white">{GEMINI_MODEL}</Badge>
          </div>
        </div>

        <div className="border-b bg-white px-4 py-3 sm:px-5">
          <div className="flex gap-2 overflow-x-auto pb-1">
          {quickPrompts.map((prompt) => (
            <Button
              key={prompt}
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 rounded-full border-slate-200 bg-slate-50 text-xs text-slate-700 hover:border-cyan-200 hover:bg-cyan-50 hover:text-slate-950"
              onClick={() => handlePrompt(prompt)}
            >
              {prompt}
            </Button>
          ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_32%),#f8fafc]">
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
                      <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-cyan-100 bg-white text-cyan-700 shadow-sm">
                        <Sparkles className="h-4 w-4" />
                      </div>
                    )}
                    <div
                      className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm sm:max-w-[82%] ${
                        message.role === "assistant"
                          ? "rounded-tl-md border border-slate-200 bg-white text-slate-800"
                          : "rounded-tr-md bg-gradient-to-br from-primary to-cyan-600 text-primary-foreground"
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

        <form onSubmit={handleSubmit} className="border-t bg-white p-3 sm:p-4">
          <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-sm focus-within:border-cyan-300 focus-within:ring-4 focus-within:ring-cyan-100">
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
            <Button type="submit" size="icon" className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-primary to-cyan-600" disabled={loading || sending || !input.trim()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default ClinicAssistant;
