// Cart & Orders API — DB-backed (cart_items, orders, order_items).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CartItemRow {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export const useCart = (userId: string | undefined) =>
  useQuery({
    queryKey: ["cart", userId],
    enabled: !!userId,
    queryFn: async (): Promise<CartItemRow[]> => {
      const { data, error } = await supabase
        .from("cart_items")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CartItemRow[];
    },
  });

export const useAddToCart = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { userId: string; productId: string; quantity?: number }) => {
      const { data: existing } = await supabase
        .from("cart_items")
        .select("id, quantity")
        .eq("user_id", args.userId)
        .eq("product_id", args.productId)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from("cart_items")
          .update({ quantity: existing.quantity + (args.quantity ?? 1) })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cart_items")
          .insert({ user_id: args.userId, product_id: args.productId, quantity: args.quantity ?? 1 });
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["cart", vars.userId] });
      toast.success("Added to cart");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useRemoveCartItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { userId: string; cartItemId: string }) => {
      const { error } = await supabase.from("cart_items").delete().eq("id", args.cartItemId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["cart", vars.userId] }),
  });
};

// ---------- Orders ----------
export interface CreateOrderArgs {
  userId: string;
  currency: "EGP" | "USD" | "EUR";
  paymentMethod?: string;
  items: Array<{ productId: string; quantity: number; unitPrice: number; snapshot: Record<string, unknown> }>;
  shipping: {
    name: string;
    phone: string;
    address: string;
    city: string;
    country: string;
  };
  notes?: string;
}

export async function createOrder(args: CreateOrderArgs): Promise<string> {
  const total = args.items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      user_id: args.userId,
      status: "pending",
      currency: args.currency,
      total_amount: total,
      payment_method: args.paymentMethod ?? null,
      shipping_name: args.shipping.name,
      shipping_phone: args.shipping.phone,
      shipping_address: args.shipping.address,
      shipping_city: args.shipping.city,
      shipping_country: args.shipping.country,
      notes: args.notes ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  const items = args.items.map((it) => ({
    order_id: order.id,
    product_id: it.productId,
    quantity: it.quantity,
    unit_price: it.unitPrice,
    currency: args.currency,
    product_snapshot: it.snapshot as never,
  }));
  const { error: e2 } = await supabase.from("order_items").insert(items);
  if (e2) throw e2;

  // Clear cart
  await supabase.from("cart_items").delete().eq("user_id", args.userId);

  return order.id;
}

export const useMyOrders = (userId: string | undefined) =>
  useQuery({
    queryKey: ["orders", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
