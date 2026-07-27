// backend-core/src/modules/pdf/pdf.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface PdfExportMetadata {
  title?: string;
  childName?: string;
  language?: string;
  createdAt?: string;
  coverImageUrl?: string | null;
}

/**
 * Service that generates a PDF for a story using pdf-lib.
 * Includes Cover Page, Page Numbers, Story Text, Illustrations, and Najmah Branding Footer.
 */
@Injectable()
export class PdfExportService {
  private readonly logger = new Logger(PdfExportService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /** Generate PDF and upload; returns signed download URL */
  async exportStoryPdf(
    storyId: string,
    pages: Array<{ pageNumber: number; text: string; imageUrl?: string | null }>,
    metadata?: PdfExportMetadata,
  ): Promise<string> {
    const pdfDoc = await PDFDocument.create();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const title = metadata?.title || 'Story';
    const childName = metadata?.childName || 'Little Star';
    const language = (metadata?.language || 'en').toUpperCase();
    const dateStr = metadata?.createdAt
      ? new Date(metadata.createdAt).toLocaleDateString()
      : new Date().toLocaleDateString();

    // 1. Cover Page
    const coverPage = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = coverPage.getSize();
    const margin = 50;

    coverPage.drawText(title, {
      x: margin,
      y: height - 120,
      size: 24,
      font: helveticaBold,
      color: rgb(0.1, 0.2, 0.5),
    });

    coverPage.drawText(`Created for: ${childName}`, {
      x: margin,
      y: height - 155,
      size: 15,
      font: helveticaBold,
      color: rgb(0.3, 0.3, 0.3),
    });

    coverPage.drawText(`Language: ${language}  |  Date: ${dateStr}`, {
      x: margin,
      y: height - 180,
      size: 11,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5),
    });

    const coverImage = metadata?.coverImageUrl || pages[0]?.imageUrl;
    if (coverImage) {
      try {
        const response = await fetch(coverImage);
        if (response.ok) {
          const imageBuffer = await response.arrayBuffer();
          let embeddedImage;
          if (coverImage.toLowerCase().includes('.png')) {
            embeddedImage = await pdfDoc.embedPng(imageBuffer);
          } else {
            embeddedImage = await pdfDoc.embedJpg(imageBuffer);
          }
          const maxW = width - 2 * margin;
          const maxH = 380;
          const scale = Math.min(maxW / embeddedImage.width, maxH / embeddedImage.height, 1);
          const drawW = embeddedImage.width * scale;
          const drawH = embeddedImage.height * scale;

          coverPage.drawImage(embeddedImage, {
            x: (width - drawW) / 2,
            y: height - 210 - drawH,
            width: drawW,
            height: drawH,
          });
        }
      } catch (err) {
        this.logger.warn(`Failed to embed cover image: ${err}`);
      }
    }

    // Najmah Branding Footer
    coverPage.drawText('Najmah AI Story Platform', {
      x: margin,
      y: margin,
      size: 10,
      font: helveticaBold,
      color: rgb(0.4, 0.4, 0.6),
    });

    // 2. Story Pages
    const totalPages = pages.length;
    for (let i = 0; i < totalPages; i++) {
      const pageData = pages[i];
      const pdfPage = pdfDoc.addPage([595.28, 841.89]);
      let cursorY = height - margin;

      // Header: Page number & Title
      pdfPage.drawText(title, {
        x: margin,
        y: cursorY,
        size: 10,
        font: helveticaBold,
        color: rgb(0.5, 0.5, 0.5),
      });

      pdfPage.drawText(`Page ${pageData.pageNumber} of ${totalPages}`, {
        x: width - margin - 80,
        y: cursorY,
        size: 10,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5),
      });

      cursorY -= 30;

      // Page Illustration
      if (pageData.imageUrl) {
        try {
          const response = await fetch(pageData.imageUrl);
          if (response.ok) {
            const imageBuffer = await response.arrayBuffer();
            let embeddedImage;
            if (pageData.imageUrl.toLowerCase().includes('.png')) {
              embeddedImage = await pdfDoc.embedPng(imageBuffer);
            } else {
              embeddedImage = await pdfDoc.embedJpg(imageBuffer);
            }
            const maxW = width - 2 * margin;
            const maxH = 320;
            const scale = Math.min(maxW / embeddedImage.width, maxH / embeddedImage.height, 1);
            const drawW = embeddedImage.width * scale;
            const drawH = embeddedImage.height * scale;

            pdfPage.drawImage(embeddedImage, {
              x: (width - drawW) / 2,
              y: cursorY - drawH,
              width: drawW,
              height: drawH,
            });
            cursorY -= drawH + 20;
          }
        } catch (err) {
          this.logger.warn(`Failed to embed page image ${pageData.pageNumber}: ${err}`);
        }
      }

      // Story Text
      const textLines = this.wrapText(pageData.text, 75);
      for (const line of textLines) {
        if (cursorY < margin + 30) break;
        pdfPage.drawText(line, {
          x: margin,
          y: cursorY,
          size: 11,
          font: helvetica,
          color: rgb(0.1, 0.1, 0.1),
        });
        cursorY -= 16;
      }

      // Footer
      pdfPage.drawText('Najmah AI Story Platform', {
        x: margin,
        y: margin,
        size: 9,
        font: helveticaBold,
        color: rgb(0.4, 0.4, 0.6),
      });
    }

    const pdfBytes = await pdfDoc.save();

    // 3. Upload to Supabase Storage
    const supabase = this.supabaseService.getAdminClient();
    const bucket = 'pdf_exports';
    const filePath = `${storyId}/${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      this.logger.error('PDF upload failed', uploadError);
      throw new Error('Failed to upload PDF');
    }

    const { data: signedUrlData, error: signError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 60 * 60 * 24);

    if (signError || !signedUrlData?.signedUrl) {
      this.logger.error('Signed URL generation failed', signError);
      throw new Error('Failed to generate PDF download URL');
    }

    return signedUrlData.signedUrl;
  }

  private wrapText(text: string, maxCharsPerLine = 75): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
        currentLine = (currentLine + ' ' + word).trim();
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }
}
