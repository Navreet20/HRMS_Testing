import { jsPDF } from "jspdf";
import autoTable, { type UserOptions } from "jspdf-autotable";

/**
 * Landscape US Letter (pt) report with a single table.
 * `layout` draws any header onto the page and returns the table options.
 */
export function buildTablePdfBlob(layout: (doc: jsPDF) => UserOptions): Blob {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "letter",
  });
  autoTable(doc, layout(doc));
  return doc.output("blob");
}
