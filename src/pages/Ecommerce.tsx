import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatClinicDate, formatClinicTime } from "@/lib/reporting";
import {
  AlertTriangle,
  ExternalLink,
  PackagePlus,
  ReceiptText,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShoppingBag,
  Store,
} from "lucide-react";
import { toast } from "sonner";

type StoreOrder = Tables<"ecommerce_orders">;
type StoreOrderItem = Tables<"ecommerce_order_items">;
type StoreProduct = Tables<"ecommerce_products">;
type StoreCategory = Tables<"ecommerce_product_categories">;

const DEFAULT_STORE_SLUG = "shalit-afia";
const DEFAULT_STORE_NAME = "Shalit Afia Pharmacy";

const statusOptions = [
  { value: "new", label: "New" },
  { value: "accepted", label: "Accepted" },
  { value: "preparing", label: "Preparing" },
  { value: "ready", label: "Ready" },
  { value: "out_for_delivery", label: "Out for Delivery" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const formatCurrency = (value: number) => `KSh ${Number(value).toLocaleString()}`;

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const EcommercePage = () => {
  const { clinicOwnerId, profile } = useAuth();
  const [store, setStore] = useState<Tables<"ecommerce_stores"> | null>(null);
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [orderItems, setOrderItems] = useState<StoreOrderItem[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [inventoryDrugs, setInventoryDrugs] = useState<Tables<"drugs">[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingStore, setCreatingStore] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [orderFilter, setOrderFilter] = useState("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [savingStore, setSavingStore] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);

  const [storeForm, setStoreForm] = useState({
    store_name: "",
    slug: DEFAULT_STORE_SLUG,
    status: "published",
    contact_phone: "",
    whatsapp_number: "",
    email: "",
    location: "",
  });

  const [categoryName, setCategoryName] = useState("");
  const [productForm, setProductForm] = useState({
    name: "",
    category_id: "none",
    description: "",
    image_url: "",
    price: "",
    compare_at_price: "",
    stock_quantity: "",
    inventory_drug_id: "none",
    is_active: true,
    prescription_required: false,
  });

  const groupedItems = useMemo(() => {
    return orderItems.reduce<Record<string, StoreOrderItem[]>>((groups, item) => {
      groups[item.order_id] = [...(groups[item.order_id] ?? []), item];
      return groups;
    }, {});
  }, [orderItems]);

  const visibleOrders = useMemo(() => {
    const normalizedSearch = orderSearch.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesStatus = orderFilter === "all" || order.status === orderFilter;
      const matchesSearch =
        !normalizedSearch ||
        order.order_number.toLowerCase().includes(normalizedSearch) ||
        order.customer_name.toLowerCase().includes(normalizedSearch) ||
        order.customer_phone.toLowerCase().includes(normalizedSearch);
      return matchesStatus && matchesSearch;
    });
  }, [orders, orderFilter, orderSearch]);

  const stats = useMemo(() => {
    const actionOrders = orders.filter((order) => ["new", "accepted", "preparing", "ready"].includes(order.status));
    return {
      totalOrders: orders.length,
      openOrders: actionOrders.length,
      newOrders: orders.filter((order) => order.status === "new").length,
      totalRevenue: orders
        .filter((order) => order.status !== "cancelled")
        .reduce((sum, order) => sum + Number(order.total_amount), 0),
      liveProducts: products.filter((product) => product.is_active).length,
      lowStockProducts: products.filter((product) => product.is_active && product.stock_quantity <= 5).length,
    };
  }, [orders, products]);

  const loadStoreData = async () => {
    setLoading(true);

    const { data: storeData, error: storeError } = await supabase
      .from("ecommerce_stores")
      .select("*")
      .eq("slug", DEFAULT_STORE_SLUG)
      .maybeSingle();

    if (storeError) {
      toast.error(storeError.message);
      setLoading(false);
      return;
    }

    setStore(storeData);
    if (storeData) {
      setStoreForm({
        store_name: storeData.store_name,
        slug: storeData.slug,
        status: storeData.status,
        contact_phone: storeData.contact_phone,
        whatsapp_number: storeData.whatsapp_number,
        email: storeData.email,
        location: storeData.location,
      });
    }

    if (!storeData) {
      setOrders([]);
      setOrderItems([]);
      setProducts([]);
      setCategories([]);
      setLoading(false);
      return;
    }

    const [ordersRes, productsRes, categoriesRes, drugsRes] = await Promise.all([
      supabase.from("ecommerce_orders").select("*").eq("store_id", storeData.id).order("created_at", { ascending: false }),
      supabase.from("ecommerce_products").select("*").eq("store_id", storeData.id).order("created_at", { ascending: false }),
      supabase.from("ecommerce_product_categories").select("*").eq("store_id", storeData.id).order("sort_order", { ascending: true }),
      supabase.from("drugs").select("*").eq("user_id", storeData.owner_user_id).order("name", { ascending: true }),
    ]);

    if (ordersRes.error || productsRes.error || categoriesRes.error || drugsRes.error) {
      toast.error(ordersRes.error?.message || productsRes.error?.message || categoriesRes.error?.message || drugsRes.error?.message || "Could not load ecommerce data.");
      setLoading(false);
      return;
    }

    setOrders(ordersRes.data ?? []);
    setProducts(productsRes.data ?? []);
    setCategories(categoriesRes.data ?? []);
    setInventoryDrugs(drugsRes.data ?? []);

    const orderIds = (ordersRes.data ?? []).map((order) => order.id);
    if (orderIds.length === 0) {
      setOrderItems([]);
      setLoading(false);
      return;
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from("ecommerce_order_items")
      .select("*")
      .in("order_id", orderIds);

    if (itemsError) {
      toast.error(itemsError.message);
      setLoading(false);
      return;
    }

    setOrderItems(itemsData ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void loadStoreData();
  }, []);

  const createDefaultStore = async () => {
    if (!clinicOwnerId) {
      toast.error("Clinic owner profile is still loading.");
      return;
    }

    setCreatingStore(true);
    const { data, error } = await supabase
      .from("ecommerce_stores")
      .insert({
        owner_user_id: clinicOwnerId,
        slug: DEFAULT_STORE_SLUG,
        store_name: profile?.clinic_name?.trim() || DEFAULT_STORE_NAME,
        status: "published",
        contact_phone: profile?.phone_number ?? "",
        whatsapp_number: profile?.phone_number ?? "",
        email: profile?.email ?? "",
        location: "",
      })
      .select("*")
      .single();
    setCreatingStore(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setStore(data);
    toast.success("Default ecommerce shop is live.");
    void loadStoreData();
  };

  const saveStoreSettings = async (event: FormEvent) => {
    event.preventDefault();
    if (!store) return;

    const nextSlug = slugify(storeForm.slug || DEFAULT_STORE_SLUG);
    if (!nextSlug) {
      toast.error("Enter a valid store slug.");
      return;
    }

    setSavingStore(true);
    const { data, error } = await supabase
      .from("ecommerce_stores")
      .update({
        ...storeForm,
        slug: nextSlug,
        store_name: storeForm.store_name.trim() || DEFAULT_STORE_NAME,
      })
      .eq("id", store.id)
      .select("*")
      .single();
    setSavingStore(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setStore(data);
    toast.success("Store settings saved.");
  };

  const createCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!store || !categoryName.trim()) return;

    const slug = slugify(categoryName);
    if (!slug) {
      toast.error("Enter a valid category name.");
      return;
    }

    setSavingCategory(true);
    const { error } = await supabase.from("ecommerce_product_categories").insert({
      store_id: store.id,
      name: categoryName.trim(),
      slug,
      sort_order: categories.length + 1,
    });
    setSavingCategory(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setCategoryName("");
    toast.success("Category added.");
    void loadStoreData();
  };

  const createProduct = async (event: FormEvent) => {
    event.preventDefault();
    if (!store || !productForm.name.trim()) return;

    const price = Number(productForm.price);
    const stock = Number(productForm.stock_quantity);
    const compareAt = productForm.compare_at_price ? Number(productForm.compare_at_price) : null;

    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(stock) || stock < 0) {
      toast.error("Enter a valid product price and stock quantity.");
      return;
    }

    setSavingProduct(true);
    const { error } = await supabase.from("ecommerce_products").insert({
      store_id: store.id,
      category_id: productForm.category_id === "none" ? null : productForm.category_id,
      inventory_drug_id: productForm.inventory_drug_id === "none" ? null : productForm.inventory_drug_id,
      name: productForm.name.trim(),
      slug: `${slugify(productForm.name)}-${Date.now().toString().slice(-4)}`,
      description: productForm.description.trim(),
      image_url: productForm.image_url.trim() || null,
      price,
      compare_at_price: compareAt,
      stock_quantity: stock,
      is_active: productForm.is_active,
      metadata: {
        prescription_required: productForm.prescription_required,
      },
    });
    setSavingProduct(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setProductForm({
      name: "",
      category_id: "none",
      description: "",
      image_url: "",
      price: "",
      compare_at_price: "",
      stock_quantity: "",
      inventory_drug_id: "none",
      is_active: true,
      prescription_required: false,
    });
    toast.success("Product added to storefront.");
    void loadStoreData();
  };

  const toggleProductVisibility = async (product: StoreProduct) => {
    const { error } = await supabase
      .from("ecommerce_products")
      .update({ is_active: !product.is_active })
      .eq("id", product.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    setProducts((current) => current.map((item) => item.id === product.id ? { ...item, is_active: !item.is_active } : item));
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    setUpdatingOrderId(orderId);

    if (status === "completed") {
      const { data, error } = await supabase.rpc("complete_ecommerce_order", {
        p_order_id: orderId,
      });
      setUpdatingOrderId(null);

      if (error) {
        toast.error(error.message);
        return;
      }

      if (data) {
        setOrders((current) => current.map((order) => order.id === orderId ? data : order));
      }
      toast.success("Order completed, stock deducted, and dashboard sales updated.");
      void loadStoreData();
      return;
    }

    const { error } = await supabase
      .from("ecommerce_orders")
      .update({ status })
      .eq("id", orderId);
    setUpdatingOrderId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    setOrders((current) => current.map((order) => order.id === orderId ? { ...order, status } : order));
    toast.success("Order status updated.");
  };

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-7xl space-y-5 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge variant="secondary" className="mb-3">Default ecommerce shop</Badge>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Ecommerce Admin</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Manage the public shop, product catalogue, incoming orders, and fulfilment workflow.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={loadStoreData} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button asChild>
              <Link to="/shop">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Shop
              </Link>
            </Button>
          </div>
        </div>

        {!store && !loading && (
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Create the default shop
              </CardTitle>
              <CardDescription>
                The public checkout needs a published shop record before customers can send orders.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button type="button" onClick={createDefaultStore} disabled={creatingStore}>
                <ShoppingBag className="mr-2 h-4 w-4" />
                {creatingStore ? "Creating shop..." : "Create Default Shop"}
              </Button>
            </CardContent>
          </Card>
        )}

        {store && (
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Shop Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold capitalize">{store.status}</div>
                <p className="text-xs text-muted-foreground">/{store.slug}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Open Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.openOrders}</div>
                <p className="text-xs text-muted-foreground">{stats.newOrders} new</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalOrders}</div>
                <p className="text-xs text-muted-foreground">All statuses</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
                <p className="text-xs text-muted-foreground">Excluding cancelled orders</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Live Products</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.liveProducts}</div>
                <p className="text-xs text-muted-foreground">{products.length} total products</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Stock Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.lowStockProducts}</div>
                <p className="text-xs text-muted-foreground">5 or fewer units</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="orders" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 lg:w-[520px]">
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="settings">Store Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ReceiptText className="h-5 w-5" />
                  Incoming Orders
                </CardTitle>
                <CardDescription>
                  Search, filter, and move customer orders through the fulfilment workflow.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_220px]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={orderSearch}
                      onChange={(event) => setOrderSearch(event.target.value)}
                      className="pl-9"
                      placeholder="Search order number, customer, or phone"
                    />
                  </div>
                  <Select value={orderFilter} onValueChange={setOrderFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      {statusOptions.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {loading ? (
                  <div className="flex h-32 items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                  </div>
                ) : !store ? (
                  <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Create the default shop first, then orders will appear here.
                  </div>
                ) : visibleOrders.length === 0 ? (
                  <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                    No orders match this view.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {visibleOrders.map((order) => (
                      <div key={order.id} className="rounded-md border p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold">{order.order_number}</p>
                              <Badge variant={order.status === "new" ? "default" : "secondary"} className="capitalize">
                                {order.status.replace(/_/g, " ")}
                              </Badge>
                              <Badge variant={order.payment_status === "paid" ? "default" : "outline"} className="capitalize">
                                {order.payment_status}
                              </Badge>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {formatClinicDate(order.created_at)} at {formatClinicTime(order.created_at)}
                            </p>
                          </div>
                          <div className="w-full lg:w-56">
                            <Select value={order.status} onValueChange={(value) => updateOrderStatus(order.id, value)} disabled={updatingOrderId === order.id}>
                              <SelectTrigger>
                                <SelectValue placeholder="Status" />
                              </SelectTrigger>
                              <SelectContent>
                                {statusOptions.map((status) => (
                                  <SelectItem key={status.value} value={status.value}>
                                    {status.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <Separator className="my-4" />

                        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_0.8fr]">
                          <div className="text-sm">
                            <p className="font-medium">Customer</p>
                            <p className="mt-1 text-muted-foreground">{order.customer_name}</p>
                            <p className="text-muted-foreground">{order.customer_phone}</p>
                            {order.customer_email && <p className="text-muted-foreground">{order.customer_email}</p>}
                          </div>
                          <div className="text-sm">
                            <p className="font-medium">Fulfilment</p>
                            <p className="mt-1 capitalize text-muted-foreground">{order.delivery_method}</p>
                            {order.delivery_address && <p className="text-muted-foreground">{order.delivery_address}</p>}
                            {order.notes && <p className="mt-1 text-muted-foreground">Note: {order.notes}</p>}
                          </div>
                          <div className="text-sm">
                            <p className="font-medium">Payment</p>
                            <p className="mt-1 capitalize text-muted-foreground">{order.payment_method} | {order.payment_status}</p>
                            <p className="mt-2 text-lg font-bold">{formatCurrency(order.total_amount)}</p>
                          </div>
                        </div>

                        <div className="mt-4 rounded-md bg-muted/40 p-3">
                          <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                            <PackagePlus className="h-4 w-4" />
                            Items
                          </p>
                          <div className="space-y-2">
                            {(groupedItems[order.id] ?? []).map((item) => (
                              <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                                <span>{item.quantity} x {item.product_name}</span>
                                <span className="font-medium">{formatCurrency(item.total_price)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products">
            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Add Product</CardTitle>
                  <CardDescription>Create products that appear on the public storefront.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={createProduct} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="product-name">Product name</Label>
                      <Input id="product-name" value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="product-price">Price</Label>
                        <Input id="product-price" type="number" min="0" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="product-stock">Stock</Label>
                        <Input id="product-stock" type="number" min="0" value={productForm.stock_quantity} onChange={(event) => setProductForm({ ...productForm, stock_quantity: event.target.value })} />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={productForm.category_id} onValueChange={(value) => setProductForm({ ...productForm, category_id: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No category</SelectItem>
                            {categories.map((category) => (
                              <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="compare-price">Compare-at price</Label>
                        <Input id="compare-price" type="number" min="0" value={productForm.compare_at_price} onChange={(event) => setProductForm({ ...productForm, compare_at_price: event.target.value })} placeholder="Optional" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Link pharmacy stock</Label>
                      <Select value={productForm.inventory_drug_id} onValueChange={(value) => setProductForm({ ...productForm, inventory_drug_id: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose inventory item" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No pharmacy stock link</SelectItem>
                          {inventoryDrugs.map((drug) => (
                            <SelectItem key={drug.id} value={drug.id}>
                              {drug.name} ({drug.stock_quantity} left)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Linked products deduct pharmacy stock and appear in the main dashboard with item-level profit.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="product-image">Image URL</Label>
                      <Input id="product-image" value={productForm.image_url} onChange={(event) => setProductForm({ ...productForm, image_url: event.target.value })} placeholder="https://..." />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="product-description">Description</Label>
                      <Textarea id="product-description" value={productForm.description} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex min-h-11 items-center justify-between rounded-md border px-3 text-sm">
                        Visible in shop
                        <Switch checked={productForm.is_active} onCheckedChange={(checked) => setProductForm({ ...productForm, is_active: checked })} />
                      </label>
                      <label className="flex min-h-11 items-center justify-between rounded-md border px-3 text-sm">
                        Prescription required
                        <Switch checked={productForm.prescription_required} onCheckedChange={(checked) => setProductForm({ ...productForm, prescription_required: checked })} />
                      </label>
                    </div>
                    <Button type="submit" disabled={!store || savingProduct}>
                      <PackagePlus className="mr-2 h-4 w-4" />
                      {savingProduct ? "Adding..." : "Add Product"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Categories</CardTitle>
                    <CardDescription>Use categories to organize storefront browsing.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={createCategory} className="flex flex-col gap-2 sm:flex-row">
                      <Input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="e.g. Pain Relief" />
                      <Button type="submit" disabled={!store || savingCategory}>
                        {savingCategory ? "Adding..." : "Add Category"}
                      </Button>
                    </form>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {categories.map((category) => (
                        <Badge key={category.id} variant="secondary">{category.name}</Badge>
                      ))}
                      {categories.length === 0 && <p className="text-sm text-muted-foreground">No categories yet.</p>}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Product Catalogue</CardTitle>
                    <CardDescription>Toggle visibility and review stock alerts.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {products.length === 0 ? (
                      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                        No products yet. Add the first product to replace the default storefront samples.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {products.map((product) => {
                          const category = categories.find((item) => item.id === product.category_id);
                          const prescriptionRequired =
                            typeof product.metadata === "object" &&
                            product.metadata !== null &&
                            !Array.isArray(product.metadata) &&
                            product.metadata.prescription_required === true;
                          return (
                            <div key={product.id} className="grid gap-3 rounded-md border p-3 sm:grid-cols-[76px_1fr_auto] sm:items-center">
                              <div className="h-20 overflow-hidden rounded-md bg-muted">
                                {product.image_url ? (
                                  <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full items-center justify-center text-muted-foreground">
                                    <ShoppingBag className="h-5 w-5" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-semibold">{product.name}</p>
                                  <Badge variant={product.is_active ? "default" : "outline"}>{product.is_active ? "Live" : "Hidden"}</Badge>
                                  {product.stock_quantity <= 5 && (
                                    <Badge variant="destructive">
                                      <AlertTriangle className="mr-1 h-3 w-3" />
                                      Low stock
                                    </Badge>
                                  )}
                                  {prescriptionRequired && <Badge variant="secondary">Prescription</Badge>}
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">{category?.name || "No category"} | {product.stock_quantity} in stock</p>
                                <p className="mt-1 text-sm font-medium">{formatCurrency(product.price)}</p>
                              </div>
                              <Button type="button" variant="outline" onClick={() => toggleProductVisibility(product)}>
                                {product.is_active ? "Hide" : "Publish"}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Store Settings
                </CardTitle>
                <CardDescription>Control the public store identity and contact details.</CardDescription>
              </CardHeader>
              <CardContent>
                {!store ? (
                  <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Create the default shop before editing settings.
                  </div>
                ) : (
                  <form onSubmit={saveStoreSettings} className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="store-name">Store name</Label>
                      <Input id="store-name" value={storeForm.store_name} onChange={(event) => setStoreForm({ ...storeForm, store_name: event.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="store-slug">Store slug</Label>
                      <Input id="store-slug" value={storeForm.slug} onChange={(event) => setStoreForm({ ...storeForm, slug: event.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Store status</Label>
                      <Select value={storeForm.status} onValueChange={(value) => setStoreForm({ ...storeForm, status: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="published">Published</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="store-phone">Contact phone</Label>
                      <Input id="store-phone" value={storeForm.contact_phone} onChange={(event) => setStoreForm({ ...storeForm, contact_phone: event.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="store-whatsapp">WhatsApp number</Label>
                      <Input id="store-whatsapp" value={storeForm.whatsapp_number} onChange={(event) => setStoreForm({ ...storeForm, whatsapp_number: event.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="store-email">Email</Label>
                      <Input id="store-email" type="email" value={storeForm.email} onChange={(event) => setStoreForm({ ...storeForm, email: event.target.value })} />
                    </div>
                    <div className="space-y-2 lg:col-span-2">
                      <Label htmlFor="store-location">Location</Label>
                      <Textarea id="store-location" value={storeForm.location} onChange={(event) => setStoreForm({ ...storeForm, location: event.target.value })} />
                    </div>
                    <div className="lg:col-span-2">
                      <Button type="submit" disabled={savingStore}>
                        <Save className="mr-2 h-4 w-4" />
                        {savingStore ? "Saving..." : "Save Store Settings"}
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default EcommercePage;
