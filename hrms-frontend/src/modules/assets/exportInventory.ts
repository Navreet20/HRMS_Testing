import { buildTablePdfBlob, downloadBlob, escapeMarkup } from "@/shared/export";

import type { AssetRecord } from "./types";

export type AssetExportFormat = "pdf" | "excel" | "word";

/**
 * Inventory-list export columns.
 * Identity columns match the on-screen grid (minus Actions), then
 * spreadsheet-only extras: Specs, OS, Condition, Purchase date, Warranty, Warranty plan.
 */
export const ASSET_EXPORT_COLUMNS = [
  { key: "categoryName", header: "Category", excelWidth: 90 },
  { key: "status", header: "Status", excelWidth: 70 },
  { key: "assignedEmployeeName", header: "Assigned to", excelWidth: 110 },
  { key: "assetId", header: "Asset ID", excelWidth: 100 },
  { key: "serialNumber", header: "Serial", excelWidth: 90 },
  { key: "model", header: "Model", excelWidth: 90 },
  { key: "specifications", header: "Specs", excelWidth: 140 },
  { key: "osPlatform", header: "OS", excelWidth: 55 },
  { key: "condition", header: "Condition", excelWidth: 65 },
  { key: "purchaseDate", header: "Purchase date", excelWidth: 85 },
  { key: "warrantyExpiry", header: "Warranty", excelWidth: 75 },
  { key: "warrantyPlanType", header: "Warranty plan type", excelWidth: 120 },
  { key: "warrantyPlan", header: "Plan / contract no.", excelWidth: 110 },
] as const;

type ExportColumnKey = (typeof ASSET_EXPORT_COLUMNS)[number]["key"];

const BRAND = "EAOVA HRMS";
const REPORT_TITLE = "Asset Inventory Report";
const ACCENT = "#0F4C81";
const TEXT = "#1F2937";
const MUTED = "#6B7280";
const BORDER = "#D1D5DB";
const ROW_ALT = "#F8FAFC";

function displayValue(asset: AssetRecord, key: ExportColumnKey): string {
  if (key === "categoryName") {
    const name = asset.categoryName?.trim() ?? "";
    return name || "Uncategorized";
  }
  const value = asset[key];
  if (value == null || String(value).trim() === "") {
    return "-";
  }
  return String(value).trim();
}

function stamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

function formatReportDate(date = new Date()): string {
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function reportMetaLine(rowCount: number, label = "Records"): string {
  return `Generated ${formatReportDate()}   |   ${label}: ${rowCount}   |   Current filtered inventory view`;
}

function inventoryTableHtml(rows: readonly AssetRecord[]): string {
  const header = ASSET_EXPORT_COLUMNS.map(
    (col) => `<th>${escapeMarkup(col.header)}</th>`,
  ).join("");
  const body =
    rows.length === 0
      ? `<tr class="empty"><td colspan="${ASSET_EXPORT_COLUMNS.length}">No matching assets for the current filters.</td></tr>`
      : rows
          .map((asset, index) => {
            const cells = ASSET_EXPORT_COLUMNS.map((col, colIndex) => {
              const value = escapeMarkup(displayValue(asset, col.key));
              const cls = colIndex === 0 ? ' class="asset-id"' : "";
              return `<td${cls}>${value}</td>`;
            }).join("");
            return `<tr class="${index % 2 === 1 ? "alt" : ""}">${cells}</tr>`;
          })
          .join("");
  return `<table class="inventory" cellspacing="0" cellpadding="0"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
}

/**
 * Shared corporate report stylesheet for Word — mirrors PDF/Excel:
 * navy masthead band, single meta line, navy table header, zebra rows.
 * Uses table-based header (Word HTML is unreliable with flex).
 */
function reportStyles(): string {
  return `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 0;
    color: ${TEXT};
    font-family: Helvetica, Arial, sans-serif;
    font-size: 9.5pt;
    line-height: 1.35;
    background: #fff;
  }
  .page {
    padding: 0 0 28px;
  }
  .banner {
    width: 100%;
    border-collapse: collapse;
    background: ${ACCENT};
  }
  .banner td {
    background: ${ACCENT};
    color: #ffffff;
    padding: 14px 28px 16px;
    border: 0;
    vertical-align: middle;
  }
  .brand {
    display: block;
    font-size: 10pt;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #ffffff;
    margin: 0 0 4px;
  }
  .title {
    display: block;
    margin: 0;
    font-size: 16pt;
    font-weight: 700;
    color: #ffffff;
  }
  .meta-bar {
    width: 100%;
    border-collapse: collapse;
    background: #F3F4F6;
  }
  .meta-bar td {
    padding: 10px 28px;
    border: 0;
    border-bottom: 1px solid ${BORDER};
    color: ${MUTED};
    font-size: 9pt;
    background: #F3F4F6;
  }
  .content {
    padding: 16px 28px 0;
  }
  table.inventory {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  table.inventory th,
  table.inventory td {
    border: 1px solid ${BORDER};
    padding: 6px 7px;
    text-align: left;
    vertical-align: top;
    word-wrap: break-word;
    overflow-wrap: anywhere;
  }
  table.inventory th {
    background: ${ACCENT};
    color: #ffffff;
    font-size: 7.5pt;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }
  table.inventory td {
    font-size: 8.5pt;
    color: ${TEXT};
    background: #ffffff;
  }
  table.inventory td.asset-id {
    font-weight: 700;
  }
  table.inventory tr.alt td {
    background: ${ROW_ALT};
  }
  table.inventory tr.empty td {
    text-align: center;
    color: ${MUTED};
    font-style: italic;
    padding: 22px 8px;
    background: #ffffff;
  }
  .footer {
    margin: 18px 28px 0;
    padding-top: 10px;
    border-top: 1px solid ${BORDER};
    color: ${MUTED};
    font-size: 8pt;
  }
  .footer .left { float: left; }
  .footer .right { float: right; }
  .footer:after { content: ""; display: block; clear: both; }
  @page {
    size: letter landscape;
    margin: 0.5in;
  }
  @media print {
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
  }
`;
}

function buildCorporateReportHtml(rows: readonly AssetRecord[]): string {
  const meta = escapeMarkup(reportMetaLine(rows.length));
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:w="urn:schemas-microsoft-com:office:word"
 xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<title>${escapeMarkup(REPORT_TITLE)}</title>
<!--[if gte mso 9]>
<xml>
 <w:WordDocument>
  <w:View>Print</w:View>
  <w:Zoom>100</w:Zoom>
  <w:DoNotOptimizeForBrowser/>
 </w:WordDocument>
</xml>
<![endif]-->
<style>
${reportStyles()}
</style>
</head>
<body>
  <div class="page">
    <table class="banner" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td>
          <span class="brand">${escapeMarkup(BRAND)}</span>
          <span class="title">${escapeMarkup(REPORT_TITLE)}</span>
        </td>
      </tr>
    </table>
    <table class="meta-bar" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td>${meta}</td>
      </tr>
    </table>
    <div class="content">
      ${inventoryTableHtml(rows)}
    </div>
    <div class="footer">
      <span class="left">Confidential - for internal HR / Asset Management use</span>
      <span class="right">${escapeMarkup(BRAND)}</span>
    </div>
  </div>
</body>
</html>`;
}

/** Excel SpreadsheetML with title band + styled header row. */
export function buildInventoryExcelBlob(rows: readonly AssetRecord[]): Blob {
  const colCount = ASSET_EXPORT_COLUMNS.length;
  const widths = ASSET_EXPORT_COLUMNS.map(
    (col, index) =>
      `<Column ss:Index="${index + 1}" ss:Width="${col.excelWidth}" />`,
  ).join("");

  const titleRow = `<Row ss:Height="28">
    <Cell ss:StyleID="Banner" ss:MergeAcross="${colCount - 1}">
      <Data ss:Type="String">${escapeMarkup(`${BRAND}  -  ${REPORT_TITLE}`)}</Data>
    </Cell>
  </Row>`;
  const metaRow = `<Row ss:Height="18">
    <Cell ss:StyleID="Meta" ss:MergeAcross="${colCount - 1}">
      <Data ss:Type="String">${escapeMarkup(reportMetaLine(rows.length))}</Data>
    </Cell>
  </Row>`;
  const blankRow = `<Row ss:Height="8"><Cell><Data ss:Type="String"></Data></Cell></Row>`;
  const headerCells = ASSET_EXPORT_COLUMNS.map(
    (col) =>
      `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeMarkup(col.header)}</Data></Cell>`,
  ).join("");
  const dataRows =
    rows.length === 0
      ? `<Row>
          <Cell ss:StyleID="Empty" ss:MergeAcross="${colCount - 1}">
            <Data ss:Type="String">No matching assets for the current filters.</Data>
          </Cell>
        </Row>`
      : rows
          .map((asset, index) => {
            const base = index % 2 === 1 ? "CellAlt" : "Cell";
            const cells = ASSET_EXPORT_COLUMNS.map((col, colIndex) => {
              const style = colIndex === 0 ? `${base}Bold` : base;
              return `<Cell ss:StyleID="${style}"><Data ss:Type="String">${escapeMarkup(
                displayValue(asset, col.key),
              )}</Data></Cell>`;
            }).join("");
            return `<Row>${cells}</Row>`;
          })
          .join("");

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Banner">
   <Font ss:Bold="1" ss:Size="14" ss:Color="#FFFFFF" />
   <Interior ss:Color="${ACCENT}" ss:Pattern="Solid" />
   <Alignment ss:Vertical="Center" />
  </Style>
  <Style ss:ID="Meta">
   <Font ss:Size="9" ss:Color="${MUTED}" />
   <Interior ss:Color="#F3F4F6" ss:Pattern="Solid" />
  </Style>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Size="9" ss:Color="#FFFFFF" />
   <Interior ss:Color="${ACCENT}" ss:Pattern="Solid" />
   <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1" />
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="${BORDER}" />
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="${BORDER}" />
   </Borders>
  </Style>
  <Style ss:ID="Cell">
   <Font ss:Size="9" ss:Color="${TEXT}" />
   <Alignment ss:Vertical="Top" ss:WrapText="1" />
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="${BORDER}" />
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="${BORDER}" />
   </Borders>
  </Style>
  <Style ss:ID="CellBold">
   <Font ss:Bold="1" ss:Size="9" ss:Color="${TEXT}" />
   <Alignment ss:Vertical="Top" ss:WrapText="1" />
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="${BORDER}" />
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="${BORDER}" />
   </Borders>
  </Style>
  <Style ss:ID="CellAlt">
   <Font ss:Size="9" ss:Color="${TEXT}" />
   <Interior ss:Color="${ROW_ALT}" ss:Pattern="Solid" />
   <Alignment ss:Vertical="Top" ss:WrapText="1" />
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="${BORDER}" />
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="${BORDER}" />
   </Borders>
  </Style>
  <Style ss:ID="CellAltBold">
   <Font ss:Bold="1" ss:Size="9" ss:Color="${TEXT}" />
   <Interior ss:Color="${ROW_ALT}" ss:Pattern="Solid" />
   <Alignment ss:Vertical="Top" ss:WrapText="1" />
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="${BORDER}" />
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="${BORDER}" />
   </Borders>
  </Style>
  <Style ss:ID="Empty">
   <Font ss:Italic="1" ss:Size="9" ss:Color="${MUTED}" />
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" />
  </Style>
 </Styles>
 <Worksheet ss:Name="Asset Inventory">
  <Table>
   ${widths}
   ${titleRow}
   ${metaRow}
   ${blankRow}
   <Row ss:Height="20">${headerCells}</Row>
   ${dataRows}
  </Table>
  <WorksheetOptions>
   <FreezePanes/>
   <FrozenNoSplit/>
   <SplitHorizontal>4</SplitHorizontal>
   <TopRowBottomPane>4</TopRowBottomPane>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;
  return new Blob([xml], { type: "application/vnd.ms-excel" });
}

/** Word-compatible HTML using the shared corporate report layout. */
export function buildInventoryWordBlob(rows: readonly AssetRecord[]): Blob {
  return new Blob(["\ufeff", buildCorporateReportHtml(rows)], {
    type: "application/msword",
  });
}

/** Landscape PDF with branded header + proper table (jspdf-autotable). */
export function buildInventoryPdfBlob(rows: readonly AssetRecord[]): Blob {
  return buildTablePdfBlob((doc) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 36;

    doc.setFillColor(15, 76, 129);
    doc.rect(0, 0, pageWidth, 52, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(BRAND, marginX, 22);
    doc.setFontSize(16);
    doc.text(REPORT_TITLE, marginX, 40);

    doc.setTextColor(31, 41, 55);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(reportMetaLine(rows.length), marginX, 68);

    const head = [ASSET_EXPORT_COLUMNS.map((col) => col.header)];
    const body =
      rows.length === 0
        ? [ASSET_EXPORT_COLUMNS.map((_, index) =>
            index === 0 ? "No matching assets for the current filters." : "",
          )]
        : rows.map((asset) =>
            ASSET_EXPORT_COLUMNS.map((col) => displayValue(asset, col.key)),
          );

    return {
      head,
      body,
      startY: 78,
      margin: { left: marginX, right: marginX, bottom: 40 },
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: { top: 5, right: 4, bottom: 5, left: 4 },
        textColor: [31, 41, 55],
        lineColor: [209, 213, 219],
        lineWidth: 0.4,
        overflow: "linebreak",
        valign: "top",
      },
      headStyles: {
        fillColor: [15, 76, 129],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7.5,
        halign: "left",
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 56, fontStyle: "bold" },
        1: { cellWidth: 46 },
        2: { cellWidth: 64 },
        3: { cellWidth: 62 },
        4: { cellWidth: 50 },
        5: { cellWidth: 52 },
        6: { cellWidth: 58 },
        7: { cellWidth: 34 },
        8: { cellWidth: 46 },
        9: { cellWidth: 52 },
        10: { cellWidth: 50 },
        11: { cellWidth: 80 },
        12: { cellWidth: 70 },
      },
      didDrawPage: (data) => {
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setDrawColor(209, 213, 219);
        doc.line(marginX, pageHeight - 28, pageWidth - marginX, pageHeight - 28);
        doc.setFontSize(8);
        doc.setTextColor(107, 114, 128);
        doc.text(
          "Confidential - for internal HR / Asset Management use",
          marginX,
          pageHeight - 14,
        );
        doc.text(
          `Page ${data.pageNumber}`,
          pageWidth - marginX,
          pageHeight - 14,
          { align: "right" },
        );
      },
    };
  });
}

export function exportInventory(
  rows: readonly AssetRecord[],
  format: AssetExportFormat,
): void {
  const base = `asset-inventory-${stamp()}`;
  if (format === "excel") {
    downloadBlob(buildInventoryExcelBlob(rows), `${base}.xls`);
    return;
  }
  if (format === "word") {
    downloadBlob(buildInventoryWordBlob(rows), `${base}.doc`);
    return;
  }
  downloadBlob(buildInventoryPdfBlob(rows), `${base}.pdf`);
}
