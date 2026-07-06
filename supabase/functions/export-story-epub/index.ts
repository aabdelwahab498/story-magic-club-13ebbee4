// export-story-epub — Generate an EPUB 3.0 of an AI story (text + per-page illustrations).
// Stores in `story-epubs` bucket under user_id/storyId.epub and returns a signed URL.

import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { checkRateLimits, rateLimitResponse } from "../_shared/rateLimit.ts";

interface ReqBody { storyId: string }

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function safeFilename(s: string): string {
  return (s || "story").replace(/[^a-zA-Z0-9-_]+/g, "_").slice(0, 60) || "story";
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  const pre = handlePreflight(req);
  if (pre) return pre;

  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const cl = Number(req.headers.get("content-length") || "0");
    if (cl > 4_096) return json({ error: "payload_too_large" }, 413);

    const raw = (await req.json().catch(() => ({}))) as Partial<ReqBody>;
    const storyId = typeof raw.storyId === "string" ? raw.storyId.slice(0, 64) : "";
    if (!storyId) return json({ error: "missing_storyId" }, 400);

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return json({ error: "unauthorized" }, 401);

    const rl = await checkRateLimits(`u:${userId}`, "export-story-epub", [
      { windowSec: 60, max: 2 },
      { windowSec: 3600, max: 10 },
    ]);
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: paidAllowed } = await admin.rpc("has_paid_feature", {
      _user_id: userId,
      _feature: "pdf",
    });
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!paidAllowed && !isAdmin) {
      return json({ error: "subscription_required", feature: "pdf", blocked: true }, 200);
    }

    const { data: story, error: sErr } = await supabase
      .from("ai_story_history")
      .select("id, user_id, title, pages, language, generated_story")
      .eq("id", storyId)
      .single();
    if (sErr || !story) return json({ error: "story_not_found" }, 404);
    if (story.user_id !== userId && !isAdmin) return json({ error: "forbidden" }, 403);

    type Page = { text: string; image_url?: string | null };
    let pages: Page[] = [];
    if (Array.isArray(story.pages) && story.pages.length > 0) {
      pages = (story.pages as Page[]).map((p) => ({
        text: String((p as { text?: string; content?: string }).text ?? (p as { content?: string }).content ?? "").trim(),
        image_url: p.image_url ?? null,
      })).filter((p) => p.text.length > 0);
    } else {
      const txt = String((story.generated_story as { text?: string } | null)?.text ?? "");
      pages = txt
        .split(/\n{2,}/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((t) => ({ text: t, image_url: null }));
    }
    if (pages.length === 0) return json({ error: "empty_story" }, 400);

    // Augment with illustrations
    const { data: ills } = await supabase
      .from("generated_illustrations")
      .select("page_index,image_url,status")
      .eq("story_id", storyId);
    const illMap = new Map<number, string>();
    for (const i of ills ?? []) {
      if (i.image_url && i.status === "ready") illMap.set(i.page_index as number, i.image_url as string);
    }
    pages = pages.map((p, idx) => ({ ...p, image_url: p.image_url || illMap.get(idx) || null }));

    const title = (story.title || "Story").slice(0, 200);
    const lang = (story.language || "en").slice(0, 8);
    const bookId = `urn:uuid:${crypto.randomUUID()}`;
    const isRtl = lang === "ar";

    const zip = new JSZip();
    // 1. mimetype (must be first, uncompressed)
    zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

    // 2. META-INF/container.xml
    zip.folder("META-INF")!.file("container.xml",
      `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

    const oebps = zip.folder("OEBPS")!;
    const images = oebps.folder("images")!;

    // 3. Download images
    const imageEntries: { id: string; href: string; mime: string; pageIdx: number }[] = [];
    for (let i = 0; i < pages.length; i++) {
      const url = pages[i].image_url;
      if (!url) continue;
      try {
        const r = await fetch(url);
        if (!r.ok) continue;
        const ab = await r.arrayBuffer();
        const mime = r.headers.get("content-type")?.split(";")[0] || "image/jpeg";
        const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
        const fname = `page-${i + 1}.${ext}`;
        images.file(fname, new Uint8Array(ab));
        imageEntries.push({ id: `img-${i + 1}`, href: `images/${fname}`, mime, pageIdx: i });
      } catch (_) { /* skip */ }
    }
    const imgByPage = new Map<number, { href: string }>();
    imageEntries.forEach((e) => imgByPage.set(e.pageIdx, { href: e.href }));

    // 4. Stylesheet
    oebps.file("styles.css", `
body { font-family: serif; line-height: 1.7; margin: 1em; ${isRtl ? "direction: rtl; text-align: right;" : ""} }
h1 { font-size: 1.6em; text-align: center; margin: 1em 0; }
h2 { font-size: 1.2em; margin: 1.2em 0 0.4em; color: #333; }
p { margin: 0.6em 0; font-size: 1em; }
img { max-width: 100%; height: auto; display: block; margin: 1em auto; border-radius: 8px; }
.cover { text-align: center; padding: 2em 1em; }
.cover h1 { font-size: 2em; }
`);

    // 5. Cover
    oebps.file("cover.xhtml", `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${lang}" lang="${lang}">
<head><title>${escapeXml(title)}</title><link rel="stylesheet" type="text/css" href="styles.css"/></head>
<body><div class="cover"><h1>${escapeXml(title)}</h1><p>NajmaH · Starry Tales</p></div></body>
</html>`);

    // 6. Chapter files
    const chapterFiles: { id: string; href: string }[] = [];
    pages.forEach((p, idx) => {
      const id = `ch-${idx + 1}`;
      const href = `${id}.xhtml`;
      const img = imgByPage.get(idx);
      const imgHtml = img ? `<img src="${img.href}" alt="Page ${idx + 1} illustration"/>` : "";
      const textHtml = escapeXml(p.text).split(/\n+/).map((line) => `<p>${line}</p>`).join("\n");
      oebps.file(href, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${lang}" lang="${lang}">
<head><title>Page ${idx + 1}</title><link rel="stylesheet" type="text/css" href="styles.css"/></head>
<body><h2>Page ${idx + 1}</h2>${imgHtml}${textHtml}</body>
</html>`);
      chapterFiles.push({ id, href });
    });

    // 7. Nav
    const navItems = chapterFiles.map((c, i) => `<li><a href="${c.href}">Page ${i + 1}</a></li>`).join("");
    oebps.file("nav.xhtml", `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">
<head><title>Contents</title></head>
<body><nav epub:type="toc" id="toc"><h2>Contents</h2><ol>${navItems}</ol></nav></body>
</html>`);

    // 8. OPF manifest
    const manifestItems = [
      `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
      `<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>`,
      `<item id="css" href="styles.css" media-type="text/css"/>`,
      ...chapterFiles.map((c) => `<item id="${c.id}" href="${c.href}" media-type="application/xhtml+xml"/>`),
      ...imageEntries.map((e) => `<item id="${e.id}" href="${e.href}" media-type="${e.mime}"/>`),
    ].join("\n    ");

    const spineItems = [
      `<itemref idref="cover"/>`,
      ...chapterFiles.map((c) => `<itemref idref="${c.id}"/>`),
    ].join("\n    ");

    oebps.file("content.opf", `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${lang}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${bookId}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:language>${lang}</dc:language>
    <dc:creator>NajmaH</dc:creator>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, "Z")}</meta>
  </metadata>
  <manifest>
    ${manifestItems}
  </manifest>
  <spine${isRtl ? ' page-progression-direction="rtl"' : ""}>
    ${spineItems}
  </spine>
</package>`);

    const blob = await zip.generateAsync({ type: "uint8array", mimeType: "application/epub+zip" });
    const path = `${userId}/${safeFilename(title)}-${storyId.slice(0, 8)}.epub`;

    const { error: upErr } = await admin.storage
      .from("story-epubs")
      .upload(path, blob, { contentType: "application/epub+zip", upsert: true });
    if (upErr) {
      console.error("[epub] upload failed", upErr);
      return json({ error: "upload_failed" }, 500);
    }

    const { data: signed, error: signErr } = await admin.storage
      .from("story-epubs")
      .createSignedUrl(path, 3600);
    if (signErr || !signed) {
      return json({ error: "sign_failed" }, 500);
    }

    return json({ epubUrl: signed.signedUrl, path, bytes: blob.length, pages: pages.length });
  } catch (e) {
    console.error("[epub] unexpected", e);
    return new Response(JSON.stringify({ error: "internal_error", message: String((e as Error)?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
