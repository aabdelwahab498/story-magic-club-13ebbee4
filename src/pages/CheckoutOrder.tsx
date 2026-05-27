import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ShoppingBag, CheckCircle2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useCart, createOrder } from "@/lib/cartApi";
import { useProducts } from "@/lib/contentApi";
import { fetchPaymentSettings } from "@/lib/subscriptionApi";
import { getLocalized } from "@/lib/multilingual";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Currency = "USD" | "EGP" | "EUR";

const CheckoutOrder = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: items = [], isLoading } = useCart(user?.id);
  const { data: products = [] } = useProducts();
  const { data: settings } = useQuery({
    queryKey: ["payment_settings"],
    queryFn: fetchPaymentSettings,
  });

  const [currency, setCurrency] = useState<Currency>("USD");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash_on_delivery");
  const [submitting, setSubmitting] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    city: "",
    country: "",
    notes: "",
  });

  const rows = useMemo(
    () =>
      items.map((it) => {
        const p = products.find((x) => x.id === it.product_id);
        const priceMap: Record<Currency, number> = {
          USD: Number(p?.price_usd ?? 0),
          EGP: Number(p?.price_egp ?? 0),
          EUR: Number(p?.price_eur ?? 0),
        };
        const unit = priceMap[currency];
        return {
          ...it,
          product: p,
          title: p ? getLocalized(p.name, i18n.language) : "—",
          unit,
          subtotal: unit * it.quantity,
        };
      }),
    [items, products, currency, i18n.language],
  );

  const total = rows.reduce((s, r) => s + r.subtotal, 0);

  const paymentOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [
      { value: "cash_on_delivery", label: t("checkout.cod", { defaultValue: "Cash on Delivery" }) },
    ];
    if (settings?.instapay_enabled && settings.instapay_handle)
      opts.push({ value: "instapay", label: "InstaPay" });
    if (settings?.vodafone_enabled && settings.vodafone_number)
      opts.push({ value: "vodafone_cash", label: "Vodafone Cash" });
    if (settings?.payoneer_enabled && settings.payoneer_email)
      opts.push({ value: "payoneer", label: "Payoneer" });
    if (settings?.bank_enabled && settings.bank_account_number)
      opts.push({ value: "bank_transfer", label: t("checkout.bank", { defaultValue: "Bank Transfer" }) });
    return opts;
  }, [settings, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (rows.length === 0) {
      toast.error(t("cart.empty", { defaultValue: "Your cart is empty" }));
      return;
    }
    setSubmitting(true);
    try {
      const id = await createOrder({
        userId: user.id,
        currency,
        paymentMethod,
        items: rows.map((r) => ({
          productId: r.product_id,
          quantity: r.quantity,
          unitPrice: r.unit,
          snapshot: {
            name: r.product?.name ?? {},
            image: r.product?.image ?? null,
            sku: r.product?.sku ?? null,
          },
        })),
        shipping: {
          name: form.name,
          phone: form.phone,
          address: form.address,
          city: form.city,
          country: form.country,
        },
        notes: form.notes || undefined,
      });
      setOrderId(id);
      toast.success(t("checkout.order_placed", { defaultValue: "Order placed successfully" }));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (orderId) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center">
        <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-4" />
        <h1 className="text-2xl font-extrabold text-foreground mb-2">
          {t("checkout.thank_you", { defaultValue: "Thank you for your order!" })}
        </h1>
        <p className="text-muted-foreground mb-2">
          {t("checkout.order_id", { defaultValue: "Order ID" })}:{" "}
          <span className="font-mono text-foreground">{orderId.slice(0, 8)}</span>
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          {t("checkout.confirm_email", {
            defaultValue: "Our team will contact you shortly to confirm payment & delivery.",
          })}
        </p>
        <div className="flex gap-3 justify-center">
          <Button asChild variant="outline">
            <Link to="/store">{t("checkout.back_to_store", { defaultValue: "Back to Store" })}</Link>
          </Button>
          <Button onClick={() => navigate("/account/subscription")}>
            {t("checkout.view_account", { defaultValue: "My Account" })}
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center">
        <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground mb-4">
          {t("cart.empty", { defaultValue: "Your cart is empty" })}
        </p>
        <Button asChild>
          <Link to="/store">{t("checkout.back_to_store", { defaultValue: "Back to Store" })}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-6 px-4">
      <Link
        to="/store"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {t("checkout.back_to_store", { defaultValue: "Back to Store" })}
      </Link>

      <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-6">
        {t("checkout.title", { defaultValue: "Checkout" })}
      </h1>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Shipping form */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-4 bg-card p-5 rounded-3xl border border-border">
          <h2 className="text-lg font-bold text-foreground">
            {t("checkout.shipping", { defaultValue: "Shipping Information" })}
          </h2>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="name">{t("checkout.name", { defaultValue: "Full Name" })}</Label>
              <Input
                id="name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="phone">{t("checkout.phone", { defaultValue: "Phone" })}</Label>
              <Input
                id="phone"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="address">{t("checkout.address", { defaultValue: "Address" })}</Label>
            <Input
              id="address"
              required
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="city">{t("checkout.city", { defaultValue: "City" })}</Label>
              <Input
                id="city"
                required
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="country">{t("checkout.country", { defaultValue: "Country" })}</Label>
              <Input
                id="country"
                required
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">{t("checkout.notes", { defaultValue: "Notes (optional)" })}</Label>
            <Textarea
              id="notes"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-border">
            <div>
              <Label>{t("checkout.currency", { defaultValue: "Currency" })}</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EGP">EGP (ج.م)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("checkout.payment_method", { defaultValue: "Payment Method" })}</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {paymentOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="submit" disabled={submitting} className="w-full rounded-full" size="lg">
            {submitting && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
            {t("checkout.place_order", { defaultValue: "Place Order" })}
          </Button>
        </form>

        {/* Summary */}
        <aside className="bg-card p-5 rounded-3xl border border-border h-fit space-y-3">
          <h2 className="text-lg font-bold text-foreground">
            {t("checkout.summary", { defaultValue: "Order Summary" })}
          </h2>
          {rows.map((r) => (
            <div key={r.id} className="flex justify-between text-sm">
              <span className="text-foreground truncate me-2">
                {r.title} × {r.quantity}
              </span>
              <span className="font-semibold text-foreground shrink-0">
                {currency} {r.subtotal.toFixed(2)}
              </span>
            </div>
          ))}
          <div className="flex justify-between border-t border-border pt-3 text-lg">
            <span className="font-bold text-foreground">
              {t("cart.total", { defaultValue: "Total" })}
            </span>
            <span className="font-extrabold text-primary">
              {currency} {total.toFixed(2)}
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default CheckoutOrder;
