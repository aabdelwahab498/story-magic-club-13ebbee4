// In-app notification bell — polls user_notifications and shows error toasts
// for unseen backup failures (per "notify on failure only" preference).
import { useEffect, useState, useCallback } from "react";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type UserNotification,
} from "@/lib/userBackups";

const POLL_MS = 60_000;
const SEEN_KEY = "najmah:notif:lastSeenId";

export function NotificationBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<UserNotification[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const rows = await fetchUserNotifications(user.id, 20);
      setItems(rows);
      // Toast only the newest unseen ERROR backup failure
      const lastSeen = localStorage.getItem(SEEN_KEY);
      const newFailures = rows.filter(
        (r) => r.severity === "error" && !r.read_at && r.id !== lastSeen,
      );
      const top = newFailures[0];
      if (top) {
        toast.error(top.title, { description: top.message ?? undefined, duration: 8000 });
        localStorage.setItem(SEEN_KEY, top.id);
      }
    } catch { /* silent */ }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [user, load]);

  if (!user) return null;
  const unread = items.filter((i) => !i.read_at).length;

  const handleOpenChange = async (v: boolean) => {
    setOpen(v);
    if (v && unread > 0) {
      try {
        await markAllNotificationsRead(user.id);
        setItems((cur) => cur.map((i) => ({ ...i, read_at: i.read_at ?? new Date().toISOString() })));
      } catch { /* silent */ }
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-xs">
              {unread > 9 ? "9+" : unread}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">No notifications</div>
        ) : (
          items.map((n) => (
            <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-1 py-2"
              onClick={() => { void markNotificationRead(n.id); }}>
              <div className="flex items-center gap-2 w-full">
                <span
                  className={
                    "inline-block h-2 w-2 rounded-full " +
                    (n.severity === "error" ? "bg-destructive" :
                     n.severity === "warning" ? "bg-amber-500" :
                     n.severity === "success" ? "bg-emerald-500" : "bg-primary")
                  }
                />
                <span className="font-medium text-sm flex-1">{n.title}</span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(n.created_at).toLocaleDateString()}
                </span>
              </div>
              {n.message && <div className="text-xs text-muted-foreground pl-4 whitespace-normal">{n.message}</div>}
              {(() => {
                const m = (n.metadata ?? {}) as { open_url?: string; pdf_url?: string };
                if (!m.open_url && !m.pdf_url) return null;
                return (
                  <div className="flex gap-3 pl-4 text-xs font-semibold">
                    {m.open_url && <Link to={m.open_url} className="text-primary underline" onClick={() => setOpen(false)}>فتح القصة</Link>}
                    {m.pdf_url && <Link to={m.pdf_url} className="text-primary underline" onClick={() => setOpen(false)}>تنزيل PDF</Link>}
                  </div>
                );
              })()}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
