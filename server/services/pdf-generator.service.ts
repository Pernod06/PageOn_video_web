/**
 * PDF Generator Service — pdfmake-based
 * Migrated from pdf_generator.py
 */
import PdfPrinter from "pdfmake";
import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";

const fonts = {
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
};

export function generateVideoPdf(
  videoData: Record<string, unknown>,
  notes: Array<{ text?: string; timestamp?: string }> = [],
): Buffer {
  const meta = (videoData.meta ?? {}) as Record<string, string>;
  const title = meta.title ?? "Video Report";
  const summaryBox = (videoData.summary_box ?? {}) as Record<string, unknown>;
  const mainBody = (videoData.main_body ?? []) as Array<Record<string, unknown>>;
  const qaInteractions = (videoData.qa_interactions ?? []) as Array<Record<string, unknown>>;
  const footer = (videoData.footer ?? {}) as Record<string, unknown>;

  const content: Content[] = [];

  // Title
  content.push({ text: title, style: "title" });
  content.push({ text: `Tags: ${(meta.tags ?? "").toString()}`, style: "subtitle", margin: [0, 5, 0, 10] });

  // Summary
  if (summaryBox.key_insight) {
    content.push({ text: "Key Insight", style: "sectionHeader" });
    content.push({ text: String(summaryBox.key_insight), margin: [0, 0, 0, 10] });
    const bullets = summaryBox.bullet_points;
    if (Array.isArray(bullets)) {
      content.push({ ul: bullets.map(String), margin: [0, 0, 0, 15] });
    }
  }

  // Main body sections
  for (const section of mainBody) {
    content.push({ text: String(section.section_title ?? ""), style: "sectionHeader" });
    const md = String(section.content_markdown ?? "");
    // Strip markdown to plain text for PDF
    const plain = md
      .replace(/#{1,3}\s*/g, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/>\s?(.*)/g, '"$1"')
      .replace(/\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g, "($1)");
    content.push({ text: plain, margin: [0, 0, 0, 15] });
  }

  // Q&A
  if (qaInteractions.length > 0) {
    content.push({ text: "Q&A", style: "sectionHeader" });
    for (const qa of qaInteractions) {
      content.push({ text: `Q: ${qa.question}`, bold: true, margin: [0, 5, 0, 2] } as Content);
      content.push({ text: `A: ${qa.answer}`, margin: [0, 0, 0, 10] });
    }
  }

  // Notes
  if (notes.length > 0) {
    content.push({ text: "Notes", style: "sectionHeader" });
    for (const note of notes) {
      const prefix = note.timestamp ? `[${note.timestamp}] ` : "";
      content.push({ text: `${prefix}${note.text ?? ""}`, margin: [0, 2, 0, 5] });
    }
  }

  // Footer resources
  const resources = footer.resources as Array<Record<string, string>> | undefined;
  if (resources?.length) {
    content.push({ text: "Resources", style: "sectionHeader" });
    content.push({ ul: resources.map((r) => `${r.name} (${r.type})`), margin: [0, 0, 0, 10] });
  }

  const nextSteps = footer.actionable_next_steps as string[] | undefined;
  if (nextSteps?.length) {
    content.push({ text: "Next Steps", style: "sectionHeader" });
    content.push({ ul: nextSteps, margin: [0, 0, 0, 10] });
  }

  const docDefinition: TDocumentDefinitions = {
    content,
    defaultStyle: { font: "Helvetica", fontSize: 11 },
    styles: {
      title: { fontSize: 20, bold: true, margin: [0, 0, 0, 5] },
      subtitle: { fontSize: 12, color: "#666" },
      sectionHeader: { fontSize: 14, bold: true, margin: [0, 15, 0, 8] },
    },
  };

  const printer = new PdfPrinter(fonts);
  const doc = printer.createPdfKitDocument(docDefinition);

  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  }) as unknown as Buffer;
}
