import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Eye, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  fetchAllPaymentRequests,
  approvePaymentRequest,
  rejectPaymentRequest,
  getProofSignedUrl,
  type ManualPaymentRequest,
  type PaymentStatus,
} from "@/lib/subscriptionApi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const tabs: { key: PaymentStatus | "all"; labelAr: string; labelEn: string }[] = [
  { key: "pending", labelAr: "قيد المراجعة", labelEn: "Pending" },
  { key: "approved", labelAr: "مقبول", labelEn: "Approved" },
  { key: "rejected", labelAr: "مرفوض", labelEn: "Rejected" },
  { key: "all", labelAr: "الكل", labelEn: "All" },
];

const AdminPaymentsPage = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<PaymentStatus | "all">("pending");
  const [selected, setSelected] = useState<ManualPaymentRequest | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["admin-payment-requests", tab],
    queryFn: () => fetchAllPaymentRequests(tab === "all" ? undefined : tab),
  });

  const openDetail = async (r: ManualPaymentRequest) => {
    setSelected(r);
    setProofUrl(null);
    setRejectNote("");
    if (r.proof_url) {
      try {
        const url = await getProofSignedUrl(r.proof_url);
        setProofUrl(url);
      } catch {
        setProofUrl(null);
      }
    }
  };

  const approve = async () => {
    if (!selected || !user) return;
    setBusy(true);
    try {
      await approvePaymentRequest(selected, user.id);
      toast({ title: t("admin_payments.approved", "Approved") });
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["admin-payment-requests"] });
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!selected || !user) return;
    if (!rejectNote.trim()) {
      toast({ title: t("admin_payments.add_rejection_note", "Add rejection note"), variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await rejectPaymentRequest(selected.id, user.id, rejectNote.trim());
      toast({ title: t("admin_payments.rejected", "Rejected") });
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["admin-payment-requests"] });
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold">{t("admin_payments.payment_requests", "Payment Requests")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("admin_payments.review_proofs_and_activate_subscriptions", "Review proofs and activate subscriptions")}
        </p>
      </header>

      <div className="flex gap-2 flex-wrap">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-bold border-2 ${
              tab === tb.key
                ? "bg-primary text-primary-foreground border-primary"
                : "border-muted text-foreground"
            }`}
          >
            {isAr ? tb.labelAr : tb.labelEn}
          </button>
        ))}
      </div>

      {q.isLoading && <Loader2 className="h-6 w-6 animate-spin text-primary" />}

      <div className="overflow-x-auto bg-white dark:bg-card rounded-2xl border-2 border-muted">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr>
              <th className="text-start p-3">{t("admin_payments.date", "Date")}</th>
              <th className="text-start p-3">{t("admin_payments.plan", "Plan")}</th>
              <th className="text-start p-3">{t("admin_payments.amount", "Amount")}</th>
              <th className="text-start p-3">{t("admin_payments.method", "Method")}</th>
              <th className="text-start p-3">{t("admin_payments.sender", "Sender")}</th>
              <th className="text-start p-3">{t("admin_payments.status", "Status")}</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {q.data?.map((r) => (
              <tr key={r.id} className="border-t border-muted">
                <td className="p-3">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="p-3 capitalize font-bold">{r.plan_tier}</td>
                <td className="p-3">{r.amount} {r.currency}</td>
                <td className="p-3 capitalize">{r.method.replace("_", " ")}</td>
                <td className="p-3">{r.sender_name ?? "—"}</td>
                <td className="p-3 capitalize">{r.status}</td>
                <td className="p-3">
                  <button
                    onClick={() => openDetail(r)}
                    className="p-2 rounded-lg hover:bg-accent"
                    aria-label="View"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {q.data?.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  {t("admin_payments.no_requests", "No requests")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("admin_payments.request_details", "Request Details")}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><b>{t("admin_payments.plan_2", "Plan:")}</b> {selected.plan_tier}</div>
                <div><b>{t("admin_payments.amount_2", "Amount:")}</b> {selected.amount} {selected.currency}</div>
                <div><b>{t("admin_payments.method_2", "Method:")}</b> {selected.method}</div>
                <div><b>{t("admin_payments.status_2", "Status:")}</b> {selected.status}</div>
                <div><b>{t("admin_payments.sender_2", "Sender:")}</b> {selected.sender_name}</div>
                <div><b>{t("admin_payments.phone", "Phone:")}</b> {selected.sender_phone ?? "—"}</div>
                <div className="col-span-2"><b>Ref:</b> {selected.transaction_ref ?? "—"}</div>
              </div>

              {proofUrl ? (
                <div>
                  <p className="font-bold text-sm mb-2">{t("admin_payments.proof", "Proof:")}</p>
                  <img src={proofUrl} alt="proof" className="max-h-96 w-auto rounded-xl border-2 border-muted" />
                  <a href={proofUrl} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 mt-1">
                    <ExternalLink className="h-3 w-3" /> {t("admin_payments.open_full_size", "Open full size")}
                  </a>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("admin_payments.loading_proof", "Loading proof...")}</p>
              )}

              {selected.status === "pending" && (
                <>
                  <div>
                    <label className="text-xs font-semibold mb-1 block">
                      {t("admin_payments.rejection_note_required_to_reject", "Rejection note (required to reject)")}
                    </label>
                    <textarea
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      className="w-full p-2 rounded-lg border-2 border-muted bg-background text-sm"
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={approve}
                      disabled={busy}
                      className="flex-1 px-4 py-2.5 rounded-full bg-green-600 text-white font-bold inline-flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" /> {t("admin_payments.approve_activate", "Approve & activate")}
                    </button>
                    <button
                      onClick={reject}
                      disabled={busy}
                      className="flex-1 px-4 py-2.5 rounded-full bg-red-600 text-white font-bold inline-flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" /> {t("admin_payments.reject", "Reject")}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPaymentsPage;
