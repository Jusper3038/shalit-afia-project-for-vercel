import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  MapPin,
  Menu,
  Minus,
  PackageCheck,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Star,
  Truck,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type Product = {
  id: string;
  productId?: string;
  name: string;
  category: string;
  price: number;
  compareAt?: number;
  description: string;
  image: string;
  badge?: string;
  stock: number;
};

type CartItem = Product & {
  quantity: number;
};

type CheckoutStep = "review" | "details" | "confirm";

type StoreProduct = Tables<"ecommerce_products">;
type StoreCategory = Tables<"ecommerce_product_categories">;

const sampleProducts: Product[] = [
  {
    id: "paracetamol-500",
    name: "Paracetamol 500mg",
    category: "Pain Relief",
    price: 120,
    compareAt: 150,
    description: "Reliable fever and mild pain relief for everyday care.",
    image: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=900&q=80",
    badge: "Popular",
    stock: 42,
  },
  {
    id: "vitamin-c",
    name: "Vitamin C Tablets",
    category: "Vitamins",
    price: 650,
    description: "Daily immune support tablets for adults and families.",
    image: "https://images.unsplash.com/photo-1576602976047-174e57a47881?auto=format&fit=crop&w=900&q=80",
    badge: "In stock",
    stock: 28,
  },
  {
    id: "first-aid-kit",
    name: "Family First Aid Kit",
    category: "First Aid",
    price: 1850,
    compareAt: 2200,
    description: "A compact emergency kit for home, car, or workplace use.",
    image: "https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=900&q=80",
    badge: "Save",
    stock: 11,
  },
  {
    id: "digital-thermometer",
    name: "Digital Thermometer",
    category: "Wellness",
    price: 950,
    description: "Fast temperature readings with a clear digital display.",
    image: "https://images.unsplash.com/photo-1584362917165-526a968579e8?auto=format&fit=crop&w=900&q=80",
    stock: 19,
  },
  {
    id: "antiseptic-solution",
    name: "Antiseptic Solution",
    category: "First Aid",
    price: 320,
    description: "For cleaning minor cuts, scrapes, and first-aid surfaces.",
    image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=900&q=80",
    stock: 34,
  },
  {
    id: "multivitamin-syrup",
    name: "Multivitamin Syrup",
    category: "Vitamins",
    price: 780,
    description: "Nutritional support syrup for growing children.",
    image: "https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?auto=format&fit=crop&w=900&q=80",
    badge: "Family",
    stock: 16,
  },
];

const formatCurrency = (value: number) => `KSh ${value.toLocaleString()}`;
const DEFAULT_STORE_SLUG = "shalit-afia";
const FREE_DELIVERY_THRESHOLD = 3000;
const deliveryZones = [
  { id: "near", label: "Near pharmacy", distance: "0-3 km", distanceKm: 3 },
  { id: "mid", label: "Nearby estate", distance: "3-7 km", distanceKm: 7 },
  { id: "far", label: "Across town", distance: "7-12 km", distanceKm: 12 },
] as const;

const StorefrontPage = () => {
  const { isAppReleased } = useAuth();
  const { storeSlug } = useParams();
  const [activeCategory, setActiveCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>("review");
  const [store, setStore] = useState<Tables<"ecommerce_stores"> | null>(null);
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([]);
  const [storeCategories, setStoreCategories] = useState<StoreCategory[]>([]);
  const [storeLoading, setStoreLoading] = useState(true);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<"pickup" | "delivery">("pickup");
  const [deliveryZoneId, setDeliveryZoneId] = useState<(typeof deliveryZones)[number]["id"]>("near");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [submittingOrder, setSubmittingOrder] = useState(false);

  const activeStoreSlug = storeSlug || DEFAULT_STORE_SLUG;
  const storeName = store?.store_name || (storeSlug ? storeSlug.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ") : "Shalit Afia Pharmacy");
  const publicProducts = useMemo(() => {
    if (storeProducts.length === 0) return sampleProducts;

    return storeProducts.map((product) => {
      const category = storeCategories.find((item) => item.id === product.category_id);
      const prescriptionRequired =
        typeof product.metadata === "object" &&
        product.metadata !== null &&
        !Array.isArray(product.metadata) &&
        product.metadata.prescription_required === true;

      return {
        id: product.id,
        productId: product.id,
        name: product.name,
        category: category?.name || "General",
        price: Number(product.price),
        compareAt: product.compare_at_price ? Number(product.compare_at_price) : undefined,
        description: product.description || "Available from this pharmacy.",
        image: product.image_url || "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=900&q=80",
        badge: prescriptionRequired ? "Prescription" : product.stock_quantity <= 5 ? "Low stock" : undefined,
        stock: product.stock_quantity,
      };
    });
  }, [storeCategories, storeProducts]);
  const categories = useMemo(() => {
    return ["All", ...Array.from(new Set(publicProducts.map((product) => product.category)))];
  }, [publicProducts]);
  const filteredProducts = useMemo(() => {
    return publicProducts.filter((product) => {
      const matchesCategory = activeCategory === "All" || product.category === activeCategory;
      const normalizedQuery = query.trim().toLowerCase();
      const matchesQuery =
        !normalizedQuery ||
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.description.toLowerCase().includes(normalizedQuery) ||
        product.category.toLowerCase().includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, publicProducts, query]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const selectedDeliveryZone = deliveryZones.find((zone) => zone.id === deliveryZoneId) ?? deliveryZones[0];
  const calculatedDeliveryFee = Math.max(150, 100 + selectedDeliveryZone.distanceKm * 35);
  const deliveryFee =
    deliveryMethod === "pickup" || subtotal === 0 || subtotal >= FREE_DELIVERY_THRESHOLD
      ? 0
      : calculatedDeliveryFee;
  const total = subtotal + deliveryFee;
  const checkoutInvalid =
    cart.length === 0 ||
    !store ||
    !customerName.trim() ||
    !customerPhone.trim() ||
    (deliveryMethod === "delivery" && !deliveryAddress.trim());

  useEffect(() => {
    const loadStore = async () => {
      setStoreLoading(true);
      const { data, error } = await supabase.rpc("resolve_ecommerce_store_by_slug", {
        p_slug: activeStoreSlug,
      });

      if (error) {
        console.error(error);
        setStore(null);
      } else {
        const nextStore = data?.[0] ?? null;
        setStore(nextStore);

        if (nextStore) {
          const [productsRes, categoriesRes] = await Promise.all([
            supabase
              .from("ecommerce_products")
              .select("*")
              .eq("store_id", nextStore.id)
              .eq("is_active", true)
              .gt("stock_quantity", 0)
              .order("created_at", { ascending: false }),
            supabase
              .from("ecommerce_product_categories")
              .select("*")
              .eq("store_id", nextStore.id)
              .eq("is_active", true)
              .order("sort_order", { ascending: true }),
          ]);

          setStoreProducts(productsRes.data ?? []);
          setStoreCategories(categoriesRes.data ?? []);
        } else {
          setStoreProducts([]);
          setStoreCategories([]);
        }
      }

      setStoreLoading(false);
    };

    void loadStore();
  }, [activeStoreSlug]);

  const addToCart = (product: Product) => {
    setCart((items) => {
      const existing = items.find((item) => item.id === product.id);
      if (existing) {
        return items.map((item) => item.id === product.id ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) } : item);
      }

      return [...items, { ...product, quantity: 1 }];
    });
    setCartOpen(true);
  };

  const updateQuantity = (productId: string, nextQuantity: number) => {
    setCart((items) => {
      if (nextQuantity <= 0) return items.filter((item) => item.id !== productId);
      return items.map((item) => item.id === productId ? { ...item, quantity: Math.min(nextQuantity, item.stock) } : item);
    });
  };

  const submitOrder = async () => {
    if (checkoutInvalid || !store) return;

    setSubmittingOrder(true);
    const customerId = crypto.randomUUID();
    const orderId = crypto.randomUUID();
    const orderNumber = `ORD-${Date.now().toString().slice(-8)}`;

    const { error: customerError } = await supabase.from("ecommerce_customers").insert({
      id: customerId,
      store_id: store.id,
      name: customerName.trim(),
      phone: customerPhone.trim(),
      email: customerEmail.trim().toLowerCase(),
    });

    if (customerError) {
      setSubmittingOrder(false);
      toast.error(customerError.message);
      return;
    }

    const { error: orderError } = await supabase.from("ecommerce_orders").insert({
      id: orderId,
      store_id: store.id,
      customer_id: customerId,
      order_number: orderNumber,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      customer_email: customerEmail.trim().toLowerCase(),
      delivery_method: deliveryMethod,
      delivery_address: deliveryMethod === "delivery" ? deliveryAddress.trim() : "",
      payment_method: "cash",
      subtotal,
      delivery_fee: deliveryFee,
      total_amount: total,
      notes: orderNotes.trim(),
    });

    if (orderError) {
      setSubmittingOrder(false);
      toast.error(orderError.message);
      return;
    }

    const { error: itemsError } = await supabase.from("ecommerce_order_items").insert(
      cart.map((item) => ({
        order_id: orderId,
        product_id: item.productId ?? null,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.quantity * item.price,
      })),
    );

    setSubmittingOrder(false);

    if (itemsError) {
      toast.error(itemsError.message);
      return;
    }

    toast.success(`Order ${orderNumber} received. The pharmacy will contact you shortly.`);
    setCart([]);
    setCheckoutStep("review");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setDeliveryMethod("pickup");
    setDeliveryZoneId("near");
    setDeliveryAddress("");
    setOrderNotes("");
    setCartOpen(false);
  };

  if (!isAppReleased("storefront")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-lg border bg-background p-6 text-center shadow-sm">
          <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-bold">Storefront is not live yet</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This shop is being prepared and will be available once it is released.
          </p>
          <Button asChild className="mt-5">
            <Link to="/">Go Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link to="/shop" className="min-w-0 flex-1">
              <span className="block truncate text-base font-bold tracking-wide">SHALIT AFIA</span>
              <span className="block truncate text-xs text-muted-foreground">{storeName}</span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm font-medium text-muted-foreground md:flex">
            <a href="#products" className="hover:text-foreground">Products</a>
            <a href="#services" className="hover:text-foreground">Services</a>
            <a href="#contact" className="hover:text-foreground">Contact</a>
          </nav>
          <Button asChild variant="outline" className="hidden sm:inline-flex">
            <Link to="/login">Owner login</Link>
          </Button>
          <Sheet open={cartOpen} onOpenChange={setCartOpen}>
            <SheetTrigger asChild>
              <Button type="button" className="relative" size="icon" aria-label="Open cart">
                <ShoppingBag className="h-4 w-4" />
                {cartCount > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-xs font-bold text-amber-950">
                    {cartCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="flex w-full flex-col sm:max-w-xl">
              <SheetHeader>
                <SheetTitle>Your order</SheetTitle>
                <SheetDescription>Step by step checkout for the pharmacy.</SheetDescription>
              </SheetHeader>
              <div className="grid grid-cols-3 gap-2 pt-3">
                {([
                  { key: "review", label: "1. Review" },
                  { key: "details", label: "2. Details" },
                  { key: "confirm", label: "3. Confirm" },
                ] as const).map((step) => (
                  <button
                    key={step.key}
                    type="button"
                    className={`min-h-10 rounded-md border px-2 text-xs font-semibold transition-colors ${
                      checkoutStep === step.key
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground"
                    }`}
                    onClick={() => {
                      if (cart.length === 0) return;
                      if (step.key === "details" || step.key === "confirm") {
                        setCheckoutStep(step.key);
                      } else {
                        setCheckoutStep("review");
                      }
                    }}
                  >
                    {step.label}
                  </button>
                ))}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto py-4">
                {cart.length === 0 ? (
                  <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Your cart is empty.
                  </div>
                ) : checkoutStep === "review" ? (
                  <div className="space-y-3">
                    <div className="rounded-md border bg-muted/30 p-3">
                      <p className="font-semibold">Review your items</p>
                      <p className="mt-1 text-sm text-muted-foreground">Confirm the product names, quantities, and prices before adding your details.</p>
                    </div>
                    {cart.map((item) => (
                      <div key={item.id} className="grid grid-cols-[92px_1fr] gap-3 rounded-md border p-3">
                        <img src={item.image} alt={item.name} className="h-24 w-full rounded-md object-cover" />
                        <div className="min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold leading-tight">{item.name}</p>
                              <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-primary">{item.category}</p>
                              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                              <p className="mt-2 text-sm font-medium">{formatCurrency(item.price)} each</p>
                            </div>
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.id, 0)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                            <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                            <span className="ml-auto text-sm font-semibold">{formatCurrency(item.quantity * item.price)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : checkoutStep === "details" ? (
                  <div className="space-y-3 rounded-md border p-3">
                    <div>
                      <p className="font-semibold">Customer details</p>
                      <p className="mt-1 text-sm text-muted-foreground">Tell the pharmacy who to contact and how you want to receive the order.</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="checkout-name">Customer name</Label>
                        <Input id="checkout-name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Full name" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="checkout-phone">Phone number</Label>
                        <Input id="checkout-phone" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="+254..." />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="checkout-email">Email</Label>
                        <Input id="checkout-email" type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} placeholder="Optional" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button type="button" variant={deliveryMethod === "pickup" ? "default" : "outline"} onClick={() => setDeliveryMethod("pickup")}>
                        Pickup
                      </Button>
                      <Button type="button" variant={deliveryMethod === "delivery" ? "default" : "outline"} onClick={() => setDeliveryMethod("delivery")}>
                        Delivery
                      </Button>
                    </div>
                    {deliveryMethod === "delivery" && (
                      <div className="grid gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="delivery-zone">Delivery distance</Label>
                          <Select value={deliveryZoneId} onValueChange={(value) => setDeliveryZoneId(value as typeof deliveryZoneId)}>
                            <SelectTrigger id="delivery-zone">
                              <SelectValue placeholder="Choose delivery area" />
                            </SelectTrigger>
                            <SelectContent>
                              {deliveryZones.map((zone) => (
                                <SelectItem key={zone.id} value={zone.id}>
                                  {zone.label} ({zone.distance})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Delivery fee: max KSh 150 minimum, or KSh 100 + KSh 35/km. Free above {formatCurrency(FREE_DELIVERY_THRESHOLD)}.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="checkout-address">Delivery address</Label>
                          <Textarea id="checkout-address" value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} placeholder="Estate, building, street, or landmark" />
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="checkout-notes">Notes</Label>
                      <Textarea id="checkout-notes" value={orderNotes} onChange={(event) => setOrderNotes(event.target.value)} placeholder="Optional instructions" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-md border bg-muted/30 p-3">
                      <p className="font-semibold">Confirm and send</p>
                      <p className="mt-1 text-sm text-muted-foreground">Check the order one last time before sending it to the pharmacy.</p>
                    </div>
                    <div className="space-y-2">
                      {cart.map((item) => (
                        <div key={item.id} className="flex items-start justify-between gap-3 rounded-md border p-3 text-sm">
                          <div>
                            <p className="font-medium">{item.quantity} x {item.name}</p>
                            <p className="text-muted-foreground">{formatCurrency(item.price)} each</p>
                          </div>
                          <p className="font-semibold">{formatCurrency(item.quantity * item.price)}</p>
                        </div>
                      ))}
                    </div>
                    <div className="grid gap-3 rounded-md border p-3 text-sm sm:grid-cols-2">
                      <div>
                        <p className="font-medium">Customer</p>
                        <p className="mt-1 text-muted-foreground">{customerName || "Name missing"}</p>
                        <p className="text-muted-foreground">{customerPhone || "Phone missing"}</p>
                        {customerEmail && <p className="text-muted-foreground">{customerEmail}</p>}
                      </div>
                      <div>
                        <p className="font-medium">Fulfilment</p>
                        <p className="mt-1 capitalize text-muted-foreground">{deliveryMethod}</p>
                        {deliveryMethod === "delivery" && (
                          <>
                            <p className="text-muted-foreground">{selectedDeliveryZone.label} ({selectedDeliveryZone.distance})</p>
                            <p className="text-muted-foreground">{deliveryAddress || "Address missing"}</p>
                          </>
                        )}
                        {orderNotes && <p className="mt-1 text-muted-foreground">Note: {orderNotes}</p>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-3 border-t pt-4">
                {!storeLoading && !store && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    The default shop is not published yet. Open Ecommerce as the clinic owner to create it before receiving orders.
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Delivery {deliveryMethod === "delivery" ? `(${selectedDeliveryZone.distance})` : ""}
                  </span>
                  <span className="font-medium">{formatCurrency(deliveryFee)}</span>
                </div>
                {deliveryMethod === "delivery" && subtotal > 0 && subtotal < FREE_DELIVERY_THRESHOLD && (
                  <p className="text-xs text-muted-foreground">
                    Calculated from KSh 100 base + KSh 35/km, minimum KSh 150.
                  </p>
                )}
                {deliveryMethod === "delivery" && subtotal >= FREE_DELIVERY_THRESHOLD && (
                  <p className="text-xs font-medium text-emerald-700">Free delivery applied.</p>
                )}
                <Separator />
                <div className="flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={checkoutStep === "review"}
                    onClick={() => setCheckoutStep(checkoutStep === "confirm" ? "details" : "review")}
                  >
                    Back
                  </Button>
                  {checkoutStep === "review" && (
                    <Button type="button" disabled={cart.length === 0} onClick={() => setCheckoutStep("details")}>
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                  {checkoutStep === "details" && (
                    <Button
                      type="button"
                      disabled={!customerName.trim() || !customerPhone.trim() || (deliveryMethod === "delivery" && !deliveryAddress.trim())}
                      onClick={() => setCheckoutStep("confirm")}
                    >
                      Review order
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                  {checkoutStep === "confirm" && (
                    <Button type="button" disabled={checkoutInvalid || submittingOrder} onClick={submitOrder}>
                      {submittingOrder ? "Sending..." : "Send order"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <Button type="button" variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main>
        <section className="border-b bg-white">
          <div className="mx-auto grid min-h-[560px] w-full max-w-7xl items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-12">
            <div className="max-w-2xl">
              <Badge className="mb-4 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                Licensed pharmacy delivery template
              </Badge>
              <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                {storeName}
              </h1>
              <p className="mt-5 text-base leading-7 text-muted-foreground sm:text-lg">
                Order trusted medicines, vitamins, and first-aid essentials from a pharmacy storefront
                connected to the clinic&apos;s ecommerce admin.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <a href="#products">
                    Shop products
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a href="#contact">Contact pharmacy</a>
                </Button>
              </div>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  { icon: ShieldCheck, label: storeProducts.length > 0 ? "Live stock" : "Sample stock" },
                  { icon: Truck, label: "Same-day delivery" },
                  { icon: Clock3, label: "Open 8am - 9pm" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2 rounded-md border bg-slate-50 px-3 py-2 text-sm font-medium">
                    <item.icon className="h-4 w-4 text-primary" />
                    {item.label}
                  </div>
                ))}
              </div>
            </div>
            <div className="relative overflow-hidden rounded-lg border bg-slate-100">
              <img
                src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1400&q=80"
                alt="Pharmacy consultation counter"
                className="h-[360px] w-full object-cover sm:h-[480px]"
              />
              <div className="absolute bottom-4 left-4 right-4 grid gap-3 rounded-md bg-white/95 p-4 shadow-lg sm:grid-cols-3">
                <div>
                  <p className="text-2xl font-bold">{publicProducts.length}</p>
                  <p className="text-xs text-muted-foreground">Ready products</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">45 min</p>
                  <p className="text-xs text-muted-foreground">Avg. dispatch</p>
                </div>
                <div>
                  <p className="flex items-center gap-1 text-2xl font-bold">
                    4.9 <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  </p>
                  <p className="text-xs text-muted-foreground">Customer rating</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="services" className="border-b bg-slate-50 py-6">
          <div className="mx-auto grid w-full max-w-7xl gap-3 px-4 sm:px-6 md:grid-cols-3">
            {[
              { icon: PackageCheck, title: "Stock-aware products", text: "Each product can later sync with pharmacy inventory." },
              { icon: Phone, title: "Order confirmation", text: "Customers can be called or messaged before dispatch." },
              { icon: MapPin, title: "Pickup or delivery", text: "The template supports both collection and local delivery." },
            ].map((item) => (
              <Card key={item.title}>
                <CardContent className="flex gap-3 p-4">
                  <div className="rounded-md bg-primary/10 p-2 text-primary">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="products" className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Shop essentials</h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Browse available items from this store. Products added in the ecommerce admin appear here automatically.
              </p>
            </div>
            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Search medicines and supplies" />
            </div>
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
            {categories.map((category) => (
              <Button
                key={category}
                type="button"
                variant={activeCategory === category ? "default" : "outline"}
                className="shrink-0"
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => (
              <Card key={product.id} className="overflow-hidden">
                <div className="relative aspect-[4/3] bg-slate-100">
                  <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                  {product.badge && <Badge className="absolute left-3 top-3">{product.badge}</Badge>}
                </div>
                <CardContent className="space-y-4 p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{product.category}</p>
                    <h3 className="mt-1 text-lg font-semibold">{product.name}</h3>
                    <p className="mt-1 min-h-10 text-sm text-muted-foreground">{product.description}</p>
                  </div>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xl font-bold">{formatCurrency(product.price)}</p>
                      {product.compareAt && <p className="text-sm text-muted-foreground line-through">{formatCurrency(product.compareAt)}</p>}
                    </div>
                    <p className="flex items-center gap-1 text-xs text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {product.stock} left
                    </p>
                  </div>
                  <Button type="button" className="w-full" onClick={() => addToCart(product)}>
                    Add to cart
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="mt-6 rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              No products match this search.
            </div>
          )}
        </section>

        <section id="contact" className="border-t bg-white">
          <div className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:py-10">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Need help choosing?</h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Customers can contact the pharmacy before checkout. Later this area can use each store owner&apos;s phone, WhatsApp, and opening hours.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button asChild variant="outline" className="justify-start">
                <a href={`tel:${store?.contact_phone || "+254700000000"}`}>
                  <Phone className="mr-2 h-4 w-4" />
                  {store?.contact_phone || "+254 700 000 000"}
                </a>
              </Button>
              <Button asChild className="justify-start">
                <a href="#products">
                  <ShoppingBag className="mr-2 h-4 w-4" />
                  Continue shopping
                </a>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default StorefrontPage;
