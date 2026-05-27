import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Trash2, ShoppingCart, ArrowRight } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useCart, useRemoveCartItem } from "@/lib/cartApi";
import { useProducts } from "@/lib/contentApi";
import { getLocalized } from "@/lib/multilingual";

interface CartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CartDrawer = ({ open, onOpenChange }: CartDrawerProps) => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { data: items = [], isLoading } = useCart(user?.id);
  const { data: products = [] } = useProducts();
  const remove = useRemoveCartItem();

  const rows = useMemo(
    () =>
      items.map((it) => {
        const p = products.find((x) => x.id === it.product_id);
        const price = Number(p?.price_usd ?? 0);
        return {
          ...it,
          title: p ? getLocalized(p.name, i18n.language) : "—",
          image: p?.image ?? "",
          price,
          subtotal: price * it.quantity,
        };
      }),
    [items, products, i18n.language],
  );

  const total = rows.reduce((s, r) => s + r.subtotal, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={i18n.dir() === "rtl" ? "left" : "right"} className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            {t("cart.title", { defaultValue: "My Cart" })}
          </SheetTitle>
          <SheetDescription>
            {t("cart.subtitle", { defaultValue: "Review items before checkout" })}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {!user ? (
            <p className="text-center text-muted-foreground py-8">
              {t("cart.signin_required", { defaultValue: "Sign in to use the cart" })}
            </p>
          ) : isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {t("cart.empty", { defaultValue: "Your cart is empty" })}
            </p>
          ) : (
            rows.map((r) => (
              <div
                key={r.id}
                className="flex gap-3 p-3 rounded-2xl border border-border bg-card"
              >
                <img
                  src={r.image || "/placeholder.svg"}
                  alt={r.title}
                  className="h-16 w-16 rounded-xl object-cover bg-muted shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-foreground truncate">{r.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.quantity} × ${r.price.toFixed(2)}
                  </p>
                  <p className="text-sm font-bold text-primary mt-1">
                    ${r.subtotal.toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={() =>
                    user && remove.mutate({ userId: user.id, cartItemId: r.id })
                  }
                  aria-label={t("cart.remove", { defaultValue: "Remove" })}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {rows.length > 0 && (
          <div className="border-t border-border pt-4 space-y-3">
            <div className="flex items-center justify-between text-lg">
              <span className="font-semibold text-foreground">
                {t("cart.total", { defaultValue: "Total" })}
              </span>
              <span className="font-extrabold text-primary">${total.toFixed(2)}</span>
            </div>
            <Button asChild className="w-full rounded-full">
              <Link to="/checkout/order" onClick={() => onOpenChange(false)}>
                {t("cart.checkout", { defaultValue: "Checkout" })}
                <ArrowRight className="h-4 w-4 ms-2 rtl:rotate-180" />
              </Link>
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CartDrawer;
