import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ShoppingBag, Truck, Sparkles, Loader2, ShoppingCart, Plus, ChevronDown, X, Download } from "lucide-react";
import { useProducts } from "@/lib/contentApi";
import { getLocalized } from "@/lib/multilingual";
import PaymentModal from "@/components/payment/PaymentModal";
import type { PaymentItem } from "@/components/payment/PaymentSummary";
import CartDrawer from "@/components/cart/CartDrawer";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useAddToCart, useCart } from "@/lib/cartApi";
import { usePaddle } from "@/hooks/usePaddle";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { downloadProductStoryPdf } from "@/lib/productStoryPdf";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";


const Store = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: products, isLoading } = useProducts();
  const { data: cartItems = [] } = useCart(user?.id);
  const addToCart = useAddToCart();
  const [payOpen, setPayOpen] = useState(false);
  const [payItem, setPayItem] = useState<PaymentItem | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const { ready: paddleReady, openStoreCheckout } = usePaddle();

  const cartCount = cartItems.reduce((s, it) => s + it.quantity, 0);

  // Track URL hash so we can filter to a single product when linked from About
  const [focusedSku, setFocusedSku] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const h = window.location.hash?.replace("#product-", "");
    return h || null;
  });

  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash?.replace("#product-", "");
      setFocusedSku(h || null);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const clearFocus = () => {
    setFocusedSku(null);
    if (window.location.hash) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Scroll to product when hash is present (e.g. /store#product-course-part-1)
  useEffect(() => {
    if (!products?.length) return;
    const hash = window.location.hash?.replace("#", "");
    if (!hash) return;

    let attempts = 0;
    let cancelled = false;

    const doScroll = () => {
      if (cancelled) return;
      const el = document.getElementById(hash);
      if (!el) {
        if (attempts++ < 20) setTimeout(doScroll, 150);
        return;
      }
      // Wait for images inside the card to load so layout is final
      const imgs = Array.from(el.querySelectorAll("img"));
      const pending = imgs.filter((i) => !i.complete);
      const finalize = () => {
        if (cancelled) return;
        const rect = el.getBoundingClientRect();
        const top = window.scrollY + rect.top - (window.innerHeight / 2 - rect.height / 2);
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
        el.classList.add("ring-4", "ring-primary", "ring-offset-2");
        setTimeout(() => el.classList.remove("ring-4", "ring-primary", "ring-offset-2"), 2800);
      };
      if (pending.length === 0) {
        finalize();
      } else {
        let left = pending.length;
        pending.forEach((i) => {
          const done = () => {
            if (--left <= 0) finalize();
          };
          i.addEventListener("load", done, { once: true });
          i.addEventListener("error", done, { once: true });
        });
        // Fallback in case images never resolve
        setTimeout(finalize, 1200);
      }
    };

    const timer = setTimeout(doScroll, 100);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [products]);

  const handleBuy = (
    productTitle: string,
    priceUsd: number,
    paddlePriceId: string | null | undefined,
  ) => {
    if (!user) {
      toast.info(t("cart.signin_required", { defaultValue: "Sign in to continue" }));
      navigate("/auth?redirect=/store");
      return;
    }
    // Prefer Paddle one-time checkout when configured.
    if (paddlePriceId && paddleReady) {
      try {
        openStoreCheckout({
          items: [{ priceId: paddlePriceId, quantity: 1 }],
          email: user.email ?? undefined,
          userId: user.id,
          successPath: "/store?paddle=success",
        });
        return;
      } catch (e: any) {
        toast.error(e?.message ?? "checkout_failed");
        return;
      }
    }
    // Fallback to manual payment modal
    setPayItem({
      name: productTitle,
      price: priceUsd,
      currency: "USD",
      cycle: "one-time",
      qty: 1,
    });
    setPayOpen(true);
  };

  const handleAddToCart = (productId: string) => {
    if (!user) {
      toast.info(t("cart.signin_required", { defaultValue: "Sign in to use the cart" }));
      navigate("/auth?redirect=/store");
      return;
    }
    addToCart.mutate({ userId: user.id, productId });
  };


  return (
    <div className="py-4 sm:py-6 lg:py-8">
      <header className="text-center mb-8 sm:mb-10 animate-fade-in">
        <span className="inline-block px-4 py-1.5 rounded-full bg-kids-softYellow text-amber-700 text-sm font-bold mb-3">
          🛍️ {t("store.eyebrow")}
        </span>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground mb-3">
          {t("store.title")}
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
          {t("store.subtitle")}
        </p>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (products?.length ?? 0) === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          {t("store.empty", { defaultValue: "Coming soon ✨" })}
        </p>
      ) : (() => {
        const all = products ?? [];
        const filtered = focusedSku ? all.filter((p) => p.sku === focusedSku) : all;
        const courses = filtered.filter((p) => (p.sku ?? "").startsWith("course-") || p.category === "course");
        const stories = filtered.filter((p) => !((p.sku ?? "").startsWith("course-") || p.category === "course"));

        const renderCard = (p: typeof all[number], featured = false) => {
          const title = getLocalized(p.name, i18n.language);
          const priceUsd = Number(p.price_usd ?? 0);
          const isCourse = (p.sku ?? "").startsWith("course-") || p.category === "course";
          return (
            <article
              key={p.id}
              id={p.sku ? `product-${p.sku}` : undefined}
              className={`group bg-white/95 dark:bg-card/90 rounded-3xl overflow-hidden shadow-soft border-2 border-white/60 hover:shadow-glow transition-all duration-300 hover-pop scroll-mt-28 ${
                featured ? "flex flex-col md:flex-row" : "flex flex-col"
              }`}
            >
              <div
                className={`relative overflow-hidden bg-muted shrink-0 ${
                  featured
                    ? "md:w-2/5 aspect-[4/5] md:aspect-auto md:max-h-[520px]"
                    : "aspect-square"
                }`}
              >
                <img
                  src={p.image || ""}
                  alt={title}
                  loading="lazy"
                  className="h-full w-full object-cover object-left transition-transform duration-500 group-hover:scale-105"
                />

                {p.featured && (
                  <span className="absolute top-3 start-3 px-3 py-1 rounded-full bg-sunset text-kids-midnight text-xs font-bold shadow-soft">
                    ⭐ {t("store.featured", { defaultValue: "Featured" })}
                  </span>
                )}
              </div>
              <div className={`p-4 sm:p-6 flex flex-col flex-1 ${featured ? "md:p-8" : ""}`}>
                <h3
                  className={`font-bold text-kids-midnight dark:text-foreground mb-2 ${
                    featured
                      ? "text-xl sm:text-2xl md:text-3xl"
                      : "text-base sm:text-lg line-clamp-2"
                  }`}
                >
                  {title}
                </h3>
                <p
                  className={`text-sm text-muted-foreground mb-3 flex-1 ${
                    featured ? "md:text-base" : "line-clamp-3"
                  }`}
                >
                  {getLocalized(p.description, i18n.language)}
                </p>
                <div className="flex items-baseline gap-2 mb-3">
                  <span
                    className={`font-extrabold text-primary ${
                      featured ? "text-3xl md:text-4xl" : "text-2xl"
                    }`}
                  >
                    ${priceUsd}
                  </span>
                </div>

                {isCourse && (
                  <Collapsible defaultOpen={featured}>
                    <CollapsibleTrigger className="group/coll w-full flex items-center justify-between gap-2 px-3 py-2 mb-2 rounded-xl bg-accent/40 hover:bg-accent/60 text-sm font-semibold text-kids-midnight dark:text-foreground transition-colors">
                      <span>{t("store.details", { defaultValue: "Course details" })}</span>
                      <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/coll:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                      <div className="px-3 py-2 mb-2 text-sm text-muted-foreground bg-muted/40 rounded-xl space-y-1.5">
                        <p>{getLocalized(p.description, i18n.language)}</p>
                        <ul className="list-disc list-inside space-y-0.5 text-xs">
                          <li>{t("store.detail_interactive", { defaultValue: "Interactive lessons for kids" })}</li>
                          <li>{t("store.detail_lifetime", { defaultValue: "Lifetime access" })}</li>
                          <li>{t("store.detail_certificate", { defaultValue: "Completion certificate" })}</li>
                        </ul>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                <div className="flex gap-2 mt-auto">
                  <button
                    onClick={() => handleAddToCart(p.id)}
                    className="flex-1 px-3 py-2.5 bg-secondary text-secondary-foreground rounded-full font-bold text-sm hover-pop shadow-soft inline-flex items-center justify-center gap-1.5"
                    aria-label={t("store.add_to_cart", { defaultValue: "Add to cart" })}
                  >
                    <Plus className="h-4 w-4" />
                    {t("store.add_to_cart", { defaultValue: "Add" })}
                  </button>
                  <button
                    onClick={() => handleBuy(title, priceUsd, p.paddle_price_id)}
                    className="flex-1 px-3 py-2.5 bg-primary text-primary-foreground rounded-full font-bold text-sm hover-pop shadow-soft inline-flex items-center justify-center gap-1.5"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    {t("store.buy_now")}
                  </button>
                </div>
              </div>
            </article>
          );
        };

        return (
          <div className="max-w-6xl mx-auto mb-10 space-y-12">
            {focusedSku && (
              <div className="flex items-center justify-center gap-3 -mt-2">
                <span className="text-sm text-muted-foreground">
                  {t("store.showing_one", { defaultValue: "Showing the selected item only" })}
                </span>
                <button
                  onClick={clearFocus}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-sm font-semibold hover-pop shadow-soft"
                >
                  <X className="h-3.5 w-3.5" />
                  {t("store.show_all", { defaultValue: "Show all products" })}
                </button>
              </div>
            )}
            {stories.length > 0 && (
              <section>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-5 text-center">
                  📚 {t("store.section_stories", { defaultValue: "Stories" })}
                </h2>
                <div
                  className={
                    focusedSku && stories.length === 1
                      ? "max-w-3xl mx-auto"
                      : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6"
                  }
                >
                  {stories.map((p) => renderCard(p, !!focusedSku && stories.length === 1))}
                </div>
              </section>
            )}
            {courses.length > 0 && (
              <section>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-5 text-center">
                  🎓 {t("store.section_courses", { defaultValue: "Courses" })}
                </h2>
                <div
                  className={
                    focusedSku && courses.length === 1
                      ? "max-w-3xl mx-auto"
                      : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6"
                  }
                >
                  {courses.map((p) => renderCard(p, !!focusedSku && courses.length === 1))}
                </div>
              </section>
            )}
          </div>
        );
      })()}


      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-4xl mx-auto">
        <div className="flex items-start gap-3 bg-white/80 dark:bg-card/60 rounded-2xl p-4 border-2 border-white/60">
          <Truck className="h-6 w-6 text-primary shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-foreground">{t("store.perk_shipping_title")}</h4>
            <p className="text-sm text-muted-foreground">{t("store.perk_shipping_desc")}</p>
          </div>
        </div>
        <div className="flex items-start gap-3 bg-white/80 dark:bg-card/60 rounded-2xl p-4 border-2 border-white/60">
          <Sparkles className="h-6 w-6 text-primary shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-foreground">{t("store.perk_quality_title")}</h4>
            <p className="text-sm text-muted-foreground">{t("store.perk_quality_desc")}</p>
          </div>
        </div>
      </div>

      {payItem && (
        <PaymentModal open={payOpen} onOpenChange={setPayOpen} item={payItem} />
      )}

      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} />

      {user && cartCount > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          aria-label={t("cart.open", { defaultValue: "Open cart" })}
          className="fixed bottom-36 md:bottom-20 end-4 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-glow flex items-center justify-center hover-pop"
        >
          <ShoppingCart className="h-6 w-6" />
          <span className="absolute -top-1 -end-1 h-6 min-w-6 px-1 rounded-full bg-kids-red text-white text-xs font-bold flex items-center justify-center">
            {cartCount}
          </span>
        </button>
      )}
    </div>
  );
};

export default Store;
