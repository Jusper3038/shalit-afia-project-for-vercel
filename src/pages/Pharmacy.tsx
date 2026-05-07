import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock3, PackageCheck, ReceiptText } from "lucide-react";

const didYouKnowItems = [
  {
    icon: PackageCheck,
    title: "Stock value changes every time medicine is billed",
    detail: "Inventory retail value is strongest when low-stock and expired items are checked before each sale period.",
  },
  {
    icon: AlertTriangle,
    title: "Expired medicine should stay out of billing",
    detail: "Keeping expiry dates current protects patients and keeps your reports from counting unsellable stock.",
  },
  {
    icon: ReceiptText,
    title: "Receipts are part of the patient story",
    detail: "Linking bills to patients makes repeat visits easier to understand and gives clearer clinic records.",
  },
  {
    icon: Clock3,
    title: "Daily review keeps the counter calm",
    detail: "A short end-of-day look at sales, stock movement, and patient activity can prevent surprises tomorrow.",
  },
];

const PharmacyPage = () => (
  <AppLayout>
    <div className="space-y-6">
      <div>
        <Badge variant="secondary">Pharmacy</Badge>
        <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Did you know?</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Small pharmacy habits can make billing, stock control, and patient records easier to trust.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {didYouKnowItems.map((item) => (
          <Card key={item.title}>
            <CardHeader className="flex flex-row items-start gap-3 space-y-0">
              <div className="rounded-md bg-primary/10 p-2 text-primary">
                <item.icon className="h-5 w-5" />
              </div>
              <CardTitle className="text-base leading-snug">{item.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{item.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  </AppLayout>
);

export default PharmacyPage;
