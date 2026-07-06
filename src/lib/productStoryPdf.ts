import { jsPDF } from "jspdf";

interface ProductLike {
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  author?: string | null;
}

async function fetchImageAsDataUrl(url: string): Promise<{ data: string; mime: string } | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const mime = blob.type || "image/jpeg";
    const data = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    return { data, mime };
  } catch {
    return null;
  }
}

/**
 * Build a simple, branded story PDF (cover + title + description) and trigger download.
 * Used by the Store to give the user an immediate PDF download of a story product
 * when a real pre-generated PDF isn't attached to the product yet.
 */
export async function downloadProductStoryPdf(
  product: ProductLike,
  filename: string,
): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;

  // Dark cover background (Najmah midnight)
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, pageH, "F");

  // Cover image
  if (product.imageUrl) {
    const img = await fetchImageAsDataUrl(product.imageUrl);
    if (img) {
      try {
        const format = img.mime.includes("png") ? "PNG" : "JPEG";
        const imgW = pageW - margin * 2;
        const imgH = imgW * 0.6; // book-cover-ish crop
        doc.addImage(img.data, format, margin, margin + 40, imgW, imgH);
      } catch {
        /* ignore image failures */
      }
    }
  }

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  const titleLines = doc.splitTextToSize(product.title, pageW - margin * 2);
  doc.text(titleLines, pageW / 2, pageH - 180, { align: "center" });

  // Author line
  if (product.author) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.setTextColor(203, 213, 225);
    doc.text(`by ${product.author}`, pageW / 2, pageH - 140, { align: "center" });
  }

  // Footer brand
  doc.setFont("helvetica", "italic");
  doc.setFontSize(12);
  doc.setTextColor(148, 163, 184);
  doc.text("NajmaH — Starry Tales", pageW / 2, pageH - 40, { align: "center" });

  // Second page: description
  if (product.description) {
    doc.addPage();
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageW, pageH, "F");

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(product.title, margin, margin + 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(13);
    doc.setTextColor(51, 65, 85);
    const bodyLines = doc.splitTextToSize(product.description, pageW - margin * 2);
    doc.text(bodyLines, margin, margin + 60, { lineHeightFactor: 1.5 });

    doc.setFontSize(11);
    doc.setTextColor(148, 163, 184);
    doc.text(
      "Preview PDF — full illustrated story available inside the NajmaH app.",
      pageW / 2,
      pageH - 40,
      { align: "center" },
    );
  }

  doc.save(filename);
}
