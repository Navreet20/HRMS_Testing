import { cleanup, fireEvent, render } from "@testing-library/react";
import { DocumentList } from "@/modules/employees/components/DocumentList";
import type { EmployeeDocument } from "@/modules/employees/types";

afterEach(() => {
  cleanup();
});

const sampleDoc: EmployeeDocument = {
  id: "doc-1",
  employeeId: "emp-1",
  name: "resume.pdf",
  mimeType: "application/pdf",
  sizeBytes: 1024,
  uploadedAt: "2026-01-01",
  objectKey: "employees/emp-1/doc/resume.pdf",
};

describe("DocumentList accept + errors", () => {
  it("sets accept attribute for allowed document types", () => {
    render(
      <DocumentList
        documents={[]}
        readOnly={false}
        onUpload={() => undefined}
        onRemove={() => undefined}
      />,
    );
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(fileInput.accept).toContain("application/pdf");
    expect(fileInput.accept).toContain("image/png");
  });

  it("surfaces upload callback for selected file", () => {
    const onUpload = jest.fn();
    render(
      <DocumentList
        documents={[sampleDoc]}
        readOnly={false}
        onUpload={onUpload}
        onRemove={() => undefined}
      />,
    );
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["x"], "a.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(onUpload).toHaveBeenCalledWith(file);
  });
});
