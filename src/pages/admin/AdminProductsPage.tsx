import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  Star,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Video as VideoIcon,
  GripVertical,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import MultilingualField from "@/components/admin/MultilingualField";
import FileUploadField from "@/components/admin/FileUploadField";
import {
  fetchProducts,
  upsertProduct,
  deleteProduct,
  uploadProductImage,
  uploadProductAttachment,
  type ProductRecord,
  type ProductGalleryItem,
} from "@/lib/adminApi";
import { PRODUCT_CATEGORIES, AGE_RANGES } from "@/lib/adminConstants";
import { getLocalized } from "@/lib/multilingual";

const emptyProduct = (): ProductRecord => ({
  id: `new-${Date.now()}`,
  sku: "",
  name: {},
  description: {},
  category: "course",
  image: null,
  gallery: [],
  price_egp: 0,
  price_usd: 0,
  price_eur: 0,
  age_range: null,
  stock: 999,
  active: true,
  featured: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

const FILE_ICON: Record<ProductGalleryItem["type"], typeof FileText> = {
  pdf: FileText,
  image: ImageIcon,
  video: VideoIcon,
  link: LinkIcon,
};

export default function AdminProductsPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [editing, setEditing] = useState<ProductRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: fetchProducts,
  });

  const saveMutation = useMutation({
    mutationFn: upsertProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(t("admin_dashboard.toast.saved"));
      setEditing(null);
    },
    onError: (e) => {
      console.error(e);
      toast.error(t("admin_dashboard.toast.save_failed"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(t("admin_dashboard.toast.deleted"));
      setDeletingId(null);
    },
    onError: (e) => {
      console.error(e);
      toast.error(t("admin_dashboard.toast.delete_failed"));
    },
  });

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (activeFilter === "active" && !p.active) return false;
      if (activeFilter === "inactive" && p.active) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const name = `${p.name?.en ?? ""} ${p.name?.ar ?? ""} ${p.sku ?? ""}`.toLowerCase();
      return name.includes(q);
    });
  }, [products, search, activeFilter]);

  const isAr = i18n.language?.startsWith("ar");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold">
            {t("admin_products.products", "Products")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("admin_products.manage_store_products_pricing_and_attach", "Manage store products, pricing, and attachments.")}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            className="gap-2 rounded-full"
            onClick={async () => {
              const tid = toast.loading(
                t("admin_products.syncing_paddle", "Syncing products to Paddle…"),
              );
              try {
                const { supabase } = await import("@/integrations/supabase/client");
                const { data, error } = await supabase.functions.invoke(
                  "paddle-seed-store-products",
                  { method: "POST" },
                );
                if (error) throw error;
                console.log("paddle-seed-store-products result", data);
                toast.success(
                  t("admin_products.paddle_synced", "Products synced with Paddle."),
                  { id: tid },
                );
                qc.invalidateQueries({ queryKey: ["admin-products"] });
              } catch (err: any) {
                toast.error(err?.message ?? "Failed to sync", { id: tid });
              }
            }}
          >
            {t("admin_products.sync_to_paddle", "Sync to Paddle")}
          </Button>
          <Button onClick={() => setEditing(emptyProduct())} className="gap-2 rounded-full">
            <Plus className="h-4 w-4" />
            {t("admin_products.new_product", "New Product")}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("admin_products.search_by_name_or_sku", "Search by name or SKU…")}
                className="ps-9"
              />
            </div>
            <Select value={activeFilter} onValueChange={(v: typeof activeFilter) => setActiveFilter(v)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin_products.all", "All")}</SelectItem>
                <SelectItem value="active">{t("admin_products.active", "Active")}</SelectItem>
                <SelectItem value="inactive">{t("admin_products.inactive", "Inactive")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              {t("admin_products.no_products", "No products.")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">{t("admin_products.image", "Image")}</TableHead>
                    <TableHead>{t("admin_products.name", "Name")}</TableHead>
                    <TableHead>{t("admin_products.category", "Category")}</TableHead>
                    <TableHead>{t("admin_products.price_egp_usd_eur", "Price (EGP/USD/EUR)")}</TableHead>
                    <TableHead>{t("admin_products.files", "Files")}</TableHead>
                    <TableHead>{t("admin_products.status", "Status")}</TableHead>
                    <TableHead className="text-end">{t("admin_products.actions", "Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        {p.image ? (
                          <img src={p.image} alt="" className="h-10 w-10 rounded-md object-cover border" />
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-muted" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold">
                          {getLocalized(p.name, i18n.language) || "—"}
                        </div>
                        {p.sku && (
                          <div className="text-xs text-muted-foreground">{p.sku}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{p.category ?? "—"}</Badge>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {p.price_egp ?? 0} / {p.price_usd ?? 0} / {p.price_eur ?? 0}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{p.gallery.length}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={p.active ? "default" : "secondary"} className="w-fit">
                            {p.active ? (t("admin_products.active", "Active")) : (t("admin_products.inactive", "Inactive"))}
                          </Badge>
                          {p.featured && (
                            <Badge className="w-fit bg-amber-500 text-white">
                              <Star className="h-3 w-3 me-1" /> {t("admin_products.featured", "Featured")}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-end">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setEditing(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeletingId(p.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {editing && (
        <ProductEditDialog
          product={editing}
          onCancel={() => setEditing(null)}
          onSave={(p) => saveMutation.mutate(p)}
          saving={saveMutation.isPending}
        />
      )}

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin_products.delete_product", "Delete product")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin_products.this_action_cannot_be_undone", "This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin_products.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              className="bg-destructive text-destructive-foreground"
            >
              {t("admin_products.delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============== Edit Dialog ==============
interface EditProps {
  product: ProductRecord;
  onCancel: () => void;
  onSave: (p: ProductRecord) => void;
  saving: boolean;
}

function ProductEditDialog({ product, onCancel, onSave, saving }: EditProps) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const [draft, setDraft] = useState<ProductRecord>(product);
  const isNew = product.id.startsWith("new-");

  const update = <K extends keyof ProductRecord>(key: K, value: ProductRecord[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const updateGallery = (next: ProductGalleryItem[]) => update("gallery", next);

  const addGalleryItem = (item: ProductGalleryItem) =>
    updateGallery([...draft.gallery, item]);

  const removeGalleryAt = (idx: number) =>
    updateGallery(draft.gallery.filter((_, i) => i !== idx));

  const moveGallery = (idx: number, dir: -1 | 1) => {
    const next = [...draft.gallery];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    updateGallery(next);
  };

  const updateGalleryAt = (idx: number, patch: Partial<ProductGalleryItem>) =>
    updateGallery(draft.gallery.map((g, i) => (i === idx ? { ...g, ...patch } : g)));

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isNew
              ? t("admin_products.new_product", "New Product")
              : t("admin_products.edit_product", "Edit Product")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <MultilingualField
            label={t("admin_products.name", "Name")}
            value={draft.name}
            onChange={(v) => update("name", v)}
          />
          <MultilingualField
            label={t("admin_products.description", "Description")}
            value={draft.description}
            onChange={(v) => update("description", v)}
            multiline
            rows={3}
          />

          <FileUploadField
            label={t("admin_products.main_image", "Main image")}
            value={draft.image}
            onChange={(v) => update("image", v)}
            uploader={uploadProductImage}
            accept="image/*"
            preview="image"
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>EGP</Label>
              <Input
                type="number"
                value={draft.price_egp ?? 0}
                onChange={(e) => update("price_egp", Number(e.target.value))}
              />
            </div>
            <div>
              <Label>USD</Label>
              <Input
                type="number"
                step="0.01"
                value={draft.price_usd ?? 0}
                onChange={(e) => update("price_usd", Number(e.target.value))}
              />
            </div>
            <div>
              <Label>EUR</Label>
              <Input
                type="number"
                step="0.01"
                value={draft.price_eur ?? 0}
                onChange={(e) => update("price_eur", Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>SKU</Label>
              <Input
                value={draft.sku ?? ""}
                onChange={(e) => update("sku", e.target.value)}
                placeholder="my-product-sku"
              />
            </div>
            <div>
              <Label>{t("admin_products.category", "Category")}</Label>
              <Select
                value={draft.category ?? ""}
                onValueChange={(v) => update("category", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("admin_products.age_range", "Age range")}</Label>
              <Select
                value={draft.age_range ?? "none"}
                onValueChange={(v) => update("age_range", v === "none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="adults">{t("admin_products.adults", "Adults")}</SelectItem>
                  {AGE_RANGES.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>{t("admin_products.stock", "Stock")}</Label>
              <Input
                type="number"
                value={draft.stock ?? 0}
                onChange={(e) => update("stock", Number(e.target.value))}
              />
            </div>
            <div className="flex items-center gap-2 sm:pt-6">
              <Switch
                checked={draft.active}
                onCheckedChange={(v) => update("active", v)}
              />
              <Label>{t("admin_products.active", "Active")}</Label>
            </div>
            <div className="flex items-center gap-2 sm:pt-6">
              <Switch
                checked={draft.featured}
                onCheckedChange={(v) => update("featured", v)}
              />
              <Label>{t("admin_products.featured", "Featured")}</Label>
            </div>
          </div>

          {/* Gallery / Attachments */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">
                {t("admin_products.attachments_pdf_images_links", "Attachments (PDF / images / links)")}
              </h3>
              <Badge variant="secondary">{draft.gallery.length}</Badge>
            </div>

            {draft.gallery.map((item, idx) => {
              const Icon = FILE_ICON[item.type];
              return (
                <div key={idx} className="rounded-lg border p-3 space-y-2 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <Icon className="h-4 w-4 text-primary" />
                    <Select
                      value={item.type}
                      onValueChange={(v: ProductGalleryItem["type"]) =>
                        updateGalleryAt(idx, { type: v })
                      }
                    >
                      <SelectTrigger className="w-[110px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">PDF</SelectItem>
                        <SelectItem value="image">Image</SelectItem>
                        <SelectItem value="video">Video</SelectItem>
                        <SelectItem value="link">Link</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex-1" />
                    <Button size="icon" variant="ghost" onClick={() => moveGallery(idx, -1)}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => moveGallery(idx, 1)}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeGalleryAt(idx)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    value={item.url}
                    onChange={(e) => updateGalleryAt(idx, { url: e.target.value })}
                    placeholder="https://…"
                    className="text-xs"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={item.label_ar ?? ""}
                      onChange={(e) => updateGalleryAt(idx, { label_ar: e.target.value })}
                      placeholder={t("admin_products.arabic_label", "Arabic label")}
                      dir="rtl"
                    />
                    <Input
                      value={item.label_en ?? ""}
                      onChange={(e) => updateGalleryAt(idx, { label_en: e.target.value })}
                      placeholder="English label"
                    />
                  </div>
                </div>
              );
            })}

            <AddAttachment onAdd={addGalleryItem} isAr={isAr} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            {t("admin_products.cancel", "Cancel")}
          </Button>
          <Button onClick={() => onSave(draft)} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("admin_products.save", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddAttachment({
  onAdd,
  isAr,
}: {
  onAdd: (item: ProductGalleryItem) => void;
  isAr: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border-2 border-dashed p-3">
      <p className="text-sm font-semibold mb-2">
        {t("admin_products.add_new_attachment", "Add new attachment")}
      </p>
      <FileUploadField
        label={t("admin_products.upload_pdf_or_image", "Upload PDF or image")}
        value={null}
        onChange={(url) => {
          if (!url) return;
          const isImg = /\.(png|jpe?g|webp|gif|svg)$/i.test(url);
          onAdd({
            type: isImg ? "image" : "pdf",
            url,
            label_ar: "",
            label_en: "",
          });
        }}
        uploader={uploadProductAttachment}
        accept=".pdf,image/*"
        uploadLabel={t("admin_products.upload_file", "Upload file")}
      />
    </div>
  );
}
