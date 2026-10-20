import {
  buildTablePdfBlob,
  downloadBlob,
  escapeCsv,
  escapeMarkup,
} from "@/shared/export";

describe("shared export helpers", () => {
  it("escapes markup and CSV fields", () => {
    expect(escapeMarkup(`<a href="x">A & B</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;A &amp; B&lt;/a&gt;",
    );
    expect(escapeCsv('Say "hi"')).toBe('"Say ""hi"""');
  });

  it("builds a landscape letter PDF containing the table", async () => {
    let pageSize: { width: number; height: number } | undefined;
    const pdf = buildTablePdfBlob((doc) => {
      pageSize = {
        width: doc.internal.pageSize.getWidth(),
        height: doc.internal.pageSize.getHeight(),
      };
      doc.text("Report title", 36, 36);
      return { startY: 48, head: [["Name"]], body: [["Alpha"]] };
    });

    expect(pageSize).toEqual({ width: 792, height: 612 });
    expect(pdf.type).toBe("application/pdf");
    const bytes = new Uint8Array(await pdf.arrayBuffer());
    const text = String.fromCharCode(...bytes);
    expect(text.startsWith("%PDF-")).toBe(true);
    expect(text).toContain("Alpha");
    expect(text).toContain("Report title");
  });

  it("downloads a blob through a temporary anchor", () => {
    const createObjectURL = jest
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:test");
    const revokeObjectURL = jest
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const click = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe("file.txt");
        expect(this.isConnected).toBe(true);
      });

    downloadBlob(new Blob(["x"]), "file.txt");

    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
    expect(document.querySelector("a[download]")).toBeNull();

    click.mockRestore();
    revokeObjectURL.mockRestore();
    createObjectURL.mockRestore();
  });
});
