import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, Search, CheckCircle2, Reply, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Status = "new" | "resolved" | "all";

interface Message {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  language: string | null;
  status: string;
  created_at: string;
}

async function fetchMessages(status: Status, search: string): Promise<Message[]> {
  let q = supabase.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(200);
  if (status !== "all") q = q.eq("status", status);
  if (search.trim()) {
    const s = `%${search.trim()}%`;
    q = q.or(`name.ilike.${s},email.ilike.${s},subject.ilike.${s},message.ilike.${s}`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Message[];
}

export default function AdminContactInboxPage() {
  const [tab, setTab] = useState<Status>("new");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Message | null>(null);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["contact-messages", tab, search],
    queryFn: () => fetchMessages(tab, search),
  });

  const counts = useMemo(() => ({ total: q.data?.length ?? 0 }), [q.data]);

  const setStatus = async (id: string, status: "new" | "resolved") => {
    const { error } = await supabase
      .from("contact_messages")
      .update({ status })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status === "resolved" ? "Marked as resolved ✅" : "Reopened");
    qc.invalidateQueries({ queryKey: ["contact-messages"] });
    setSelected(null);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this message?")) return;
    const { error } = await supabase.from("contact_messages").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["contact-messages"] });
    setSelected(null);
  };

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" /> Contact Inbox
          </h1>
          <p className="text-sm text-muted-foreground">
            Messages from the public contact form. Replies are sent manually from{" "}
            <a className="text-primary hover:underline" href="mailto:support@najmah.com">
              support@najmah.com
            </a>
            .
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="pl-8 w-56"
            />
          </div>
        </div>
      </header>

      <div className="flex gap-2 flex-wrap">
        {(["new", "resolved", "all"] as Status[]).map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-bold border-2 capitalize ${
              tab === s
                ? "bg-primary text-primary-foreground border-primary"
                : "border-muted text-foreground"
            }`}
          >
            {s}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground self-center">
          {counts.total} {counts.total === 1 ? "message" : "messages"}
        </span>
      </div>

      {q.isLoading && <Loader2 className="h-6 w-6 animate-spin text-primary" />}

      <div className="overflow-x-auto bg-white dark:bg-card rounded-2xl border-2 border-muted">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr>
              <th className="text-start p-3">Date</th>
              <th className="text-start p-3">Name</th>
              <th className="text-start p-3">Email</th>
              <th className="text-start p-3">Subject</th>
              <th className="text-start p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {q.data?.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  No messages.
                </td>
              </tr>
            )}
            {q.data?.map((m) => (
              <tr key={m.id} className="border-t border-muted hover:bg-muted/30 cursor-pointer" onClick={() => setSelected(m)}>
                <td className="p-3 whitespace-nowrap">{new Date(m.created_at).toLocaleDateString()}</td>
                <td className="p-3 font-semibold">{m.name}</td>
                <td className="p-3 text-muted-foreground">{m.email}</td>
                <td className="p-3 max-w-xs truncate">{m.subject ?? "—"}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    m.status === "resolved"
                      ? "bg-green-100 text-green-800"
                      : "bg-amber-100 text-amber-800"
                  }`}>
                    {m.status}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelected(m); }}>
                    View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.subject ?? "Contact message"}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><b>From:</b> {selected.name}</div>
                <div><b>Email:</b> <a className="text-primary hover:underline" href={`mailto:${selected.email}`}>{selected.email}</a></div>
                <div><b>Language:</b> {selected.language ?? "en"}</div>
                <div><b>Status:</b> {selected.status}</div>
                <div className="col-span-2"><b>Received:</b> {new Date(selected.created_at).toLocaleString()}</div>
              </div>
              <div className="rounded-xl border-2 border-muted bg-muted/30 p-4 whitespace-pre-wrap text-sm">
                {selected.message}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button asChild className="gap-1">
                  <a href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.subject ?? "")}`}>
                    <Reply className="h-4 w-4" /> Reply by email
                  </a>
                </Button>
                {selected.status !== "resolved" ? (
                  <Button variant="secondary" className="gap-1" onClick={() => setStatus(selected.id, "resolved")}>
                    <CheckCircle2 className="h-4 w-4" /> Mark resolved
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => setStatus(selected.id, "new")}>
                    Reopen
                  </Button>
                )}
                <Button variant="destructive" className="gap-1 ml-auto" onClick={() => remove(selected.id)}>
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
