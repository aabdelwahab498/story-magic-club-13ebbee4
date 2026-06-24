// Periodic dispatcher for download-alerts: computes the same alerts as the
// admin UI from the last 24h of audit + history, dedupes by signature, and
// fans out to Lovable Emails and Slack when configured.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY") ?? "";

type Fmt = "pdf" | "mp3" | "txt" | "docx" | "epub" | "images" | "pack";
const FORMATS: Fmt[] = ["pdf", "mp3", "txt", "docx", "epub", "images", "pack"];

interface Alert {
  kind: "rejections" | "format_spike";
  severity: "warning" | "critical";
  title: string;
  detail: string;
}

async function countByFormat(supabase: ReturnType<typeof createClient>, sinceMs: number) {
  const since = new Date(Date.now() - sinceMs).toISOString();
  const { data } = await supabase
    .from("download_history")
    .select("format")
    .gte("created_at", since)
    .limit(10000);
  const out = {} as Record<Fmt, number>;
  for (const r of (data as Array<{ format: Fmt }> | null) ?? []) {
    out[r.format] = (out[r.format] ?? 0) + 1;
  }
  return out;
}

async function computeAlerts(supabase: ReturnType<typeof createClient>): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const since = new Date(Date.now() - 86400_000).toISOString();

  const { data: rej } = await supabase
    .from("download_audit_log")
    .select("user_id")
    .eq("outcome", "rejected")
    .gte("created_at", since)
    .limit(5000);
  const counts = new Map<string, number>();
  for (const r of (rej as Array<{ user_id: string | null }> | null) ?? []) {
    if (!r.user_id) continue;
    counts.set(r.user_id, (counts.get(r.user_id) ?? 0) + 1);
  }
  for (const [uid, n] of counts) {
    if (n >= 5) {
      alerts.push({
        kind: "rejections",
        severity: n >= 10 ? "critical" : "warning",
        title: `User ${uid.slice(0, 8)}… exceeded limits ${n}× in 24h`,
        detail: "Repeated rejected download attempts.",
      });
    }
  }

  const today = await countByFormat(supabase, 86400_000);
  const week = await countByFormat(supabase, 7 * 86400_000);
  for (const f of FORMATS) {
    const t = today[f] ?? 0;
    const avg = (week[f] ?? 0) / 7;
    if (avg >= 3 && t >= avg * 3) {
      alerts.push({
        kind: "format_spike",
        severity: t >= avg * 5 ? "critical" : "warning",
        title: `Spike in ${f.toUpperCase()} downloads`,
        detail: `${t} today vs 7-day avg ${avg.toFixed(1)}.`,
      });
    }
  }
  return alerts;
}

function signature(alerts: Alert[]): string {
  return alerts.map((a) => `${a.kind}|${a.severity}|${a.title}`).sort().join("§");
}

async function sendEmail(to: string, alerts: Alert[]) {
  const html = `
    <h2>NajmaH download alerts</h2>
    <ul>${alerts.map((a) => `<li><b>[${a.severity}]</b> ${a.title}<br/><small>${a.detail}</small></li>`).join("")}</ul>
    <p style="color:#888;font-size:12px">Sent by NajmaH Download Center.</p>
  `;
  try {
    const supa = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { error } = await supa.functions.invoke("send-transactional-email", {
      body: {
        templateName: "generic-notification",
        recipientEmail: to,
        idempotencyKey: `download-alerts-${Date.now()}`,
        templateData: { subject: "NajmaH download alerts", html, title: "Download alerts" },
      },
    });
    if (error) console.error("email error", error);
  } catch (e) {
    console.error("email send failed (expected if email infra not set up):", (e as Error).message);
  }
}

async function sendSlack(channel: string, alerts: Alert[]) {
  if (!LOVABLE_API_KEY || !SLACK_API_KEY) {
    console.warn("Slack not configured — skipping");
    return;
  }
  const text =
    `*NajmaH download alerts*\n` +
    alerts.map((a) => `• *[${a.severity}]* ${a.title} — ${a.detail}`).join("\n");
  try {
    const r = await fetch("https://connector-gateway.lovable.dev/slack/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": SLACK_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel, text }),
    });
    const body = await r.text();
    if (!r.ok) console.error("slack error", r.status, body);
  } catch (e) {
    console.error("slack send failed", (e as Error).message);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supa = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: settings } = await supa.from("download_settings").select("*").limit(1).maybeSingle();
    if (!settings) {
      return new Response(JSON.stringify({ ok: true, reason: "no_settings" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const alerts = await computeAlerts(supa);
    if (alerts.length === 0) {
      return new Response(JSON.stringify({ ok: true, alerts: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sig = signature(alerts);
    if (settings.last_alert_signature === sig) {
      return new Response(JSON.stringify({ ok: true, alerts: alerts.length, deduped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tasks: Promise<unknown>[] = [];
    if (settings.alerts_email_enabled && settings.alert_email) {
      tasks.push(sendEmail(settings.alert_email as string, alerts));
    }
    if (settings.alerts_slack_enabled && settings.slack_channel_id) {
      tasks.push(sendSlack(settings.slack_channel_id as string, alerts));
    }
    await Promise.allSettled(tasks);

    await supa
      .from("download_settings")
      .update({ last_alert_signature: sig, last_alert_sent_at: new Date().toISOString() })
      .eq("id", true);

    return new Response(JSON.stringify({ ok: true, alerts: alerts.length, dispatched: tasks.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
