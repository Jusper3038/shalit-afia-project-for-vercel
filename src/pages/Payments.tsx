import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logAudit } from "@/lib/audit";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Phone, RefreshCw } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : "Failed to initiate M-Pesa payment";

const PaymentsPage = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Tables<"payments">[]>([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchPayments = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("payments")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setPayments(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchPayments();
  }, [user]);

  const handleMpesaPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const amt = parseFloat(amount);
    if (!phone || isNaN(amt) || amt <= 0) {
      toast.error("Enter a valid phone number and amount");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("mpesa-stk-push", {
        body: { phone, amount: amt, user_id: user.id },
      });
      if (error) throw error;
      if (data?.ResponseCode === "0") {
        toast.success("STK Push sent! Check your phone to complete payment.");
        await logAudit("M-Pesa STK Push", `KSh ${amt} to ${phone}`);
        setPhone("");
        setAmount("");
        // Refresh after a short delay to show pending payment
        setTimeout(fetchPayments, 2000);
      } else {
        toast.error(data?.errorMessage || data?.ResponseDescription || "M-Pesa request failed");
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "completed": return "text-green-600 bg-green-100";
      case "pending": return "text-yellow-700 bg-yellow-100";
      case "failed": return "text-red-600 bg-red-100";
      default: return "text-muted-foreground";
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Payments</h2>

        {/* M-Pesa STK Push Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              M-Pesa Payment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleMpesaPay} className="space-y-4">
              <div>
                <Label>Phone Number</Label>
                <Input
                  placeholder="e.g. 0712345678 or 254712345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Amount (KSh)</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="e.g. 500"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Sending STK Push..." : "Pay with M-Pesa"}
              </Button>
            </form>
            <p className="mt-3 text-xs text-muted-foreground">
              A prompt will appear on the customer's phone to authorize payment via M-Pesa.
            </p>
          </CardContent>
        </Card>

        {/* Payment History */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xl font-semibold">Payment History</h3>
          <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={fetchPayments}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
        <Card>
          <CardContent className="overflow-hidden p-0">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            ) : payments.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No payments recorded yet.</div>
            ) : (
              <Table className="min-w-[680px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{new Date(p.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">KSh {Number(p.amount).toLocaleString()}</TableCell>
                      <TableCell className="capitalize">{p.method}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(p.status)}`}>
                          {p.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.transaction_reference || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default PaymentsPage;
