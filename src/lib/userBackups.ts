// Client helpers for user backups + in-app notifications.
import { supabase } from "@/integrations/supabase/client";

export interface UserBackup {
  id: string;
  user_id: string;
  backup_date: string;
  storage_path: string;
  size_bytes: number;
  story_count: number;
  status: "completed" | "failed" | "running";
  error_message: string | null;
  expires_at: string;
  created_at: string;
}

export interface UserNotification {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  message: string | null;
  severity: "info" | "success" | "warning" | "error";
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

export async function fetchUserBackups(userId: string): Promise<UserBackup[]> {
  const { data, error } = await supabase
    .from("user_backups" as never)
    .select("*")
    .eq("user_id", userId)
    .order("backup_date", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data as unknown as UserBackup[]) ?? [];
}

export async function deleteUserBackup(id: string): Promise<void> {
  const { error } = await supabase.from("user_backups" as never).delete().eq("id", id);
  if (error) throw error;
}

/**
 * Request a short-lived signed URL (5 min) for a backup. The edge function
 * verifies ownership and that the backup is completed.
 */
export async function requestBackupSignedUrl(backupId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("restore-user-backup", {
    body: { backupId },
  });
  if (error) throw error;
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return (data as { url: string }).url;
}

export async function downloadBackupJson(backup: UserBackup): Promise<void> {
  const url = await requestBackupSignedUrl(backup.id);
  const a = document.createElement("a");
  a.href = url;
  a.download = `najmah-backup-${backup.backup_date}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => document.body.removeChild(a), 200);
}

export interface RestoreResult {
  total: number;
  restored: number;
  skipped: number;
}

/**
 * Restore stories from a backup snapshot. Re-inserts any story whose ID
 * is no longer present in ai_story_history for the current user.
 */
export async function restoreStoriesFromBackup(backup: UserBackup): Promise<RestoreResult> {
  const url = await requestBackupSignedUrl(backup.id);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download_failed_${r.status}`);
  const snap = await r.json() as { stories?: Array<Record<string, unknown>> };
  const stories = Array.isArray(snap.stories) ? snap.stories : [];

  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) throw new Error("not_authenticated");

  // Find which IDs already exist
  const ids = stories.map((s) => s.id as string).filter(Boolean);
  let existing = new Set<string>();
  if (ids.length) {
    const { data: cur } = await supabase
      .from("ai_story_history")
      .select("id")
      .in("id", ids);
    existing = new Set(((cur as Array<{ id: string }>) ?? []).map((r) => r.id));
  }

  const toInsert = stories
    .filter((s) => s.id && !existing.has(s.id as string))
    .map((s) => ({ ...s, user_id: uid }));

  let restored = 0;
  for (const row of toInsert) {
    const { error } = await supabase.from("ai_story_history").insert(row as never);
    if (!error) restored++;
  }
  return { total: stories.length, restored, skipped: stories.length - restored };
}

// ----- Notifications -----
export async function fetchUserNotifications(userId: string, limit = 30): Promise<UserNotification[]> {
  const { data, error } = await supabase
    .from("user_notifications" as never)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as unknown as UserNotification[]) ?? [];
}

export async function markNotificationRead(id: string): Promise<void> {
  await supabase
    .from("user_notifications" as never)
    .update({ read_at: new Date().toISOString() } as never)
    .eq("id", id);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await supabase
    .from("user_notifications" as never)
    .update({ read_at: new Date().toISOString() } as never)
    .eq("user_id", userId)
    .is("read_at", null);
}

export function formatBytes(n: number): string {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), u.length - 1);
  return `${(n / Math.pow(1024, i)).toFixed(1)} ${u[i]}`;
}
