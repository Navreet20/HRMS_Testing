import { cleanup, render, screen } from "@testing-library/react";
import { IdentityBlock } from "@/shared/ui/IdentityBlock";

afterEach(() => {
  cleanup();
});

describe("IdentityBlock photoSrc", () => {
  it("renders initials when photoSrc is absent", () => {
    render(<IdentityBlock name="Ada Lovelace" />);
    expect(screen.getByLabelText("Ada Lovelace identity")).toHaveTextContent(
      "AL",
    );
    expect(
      screen.getByLabelText("Ada Lovelace identity").querySelector("img"),
    ).toBeNull();
  });

  it("renders duplicate detail labels with unique field keys", () => {
    const { container } = render(
      <IdentityBlock
        name="Pat Lee"
        designation="ACCOUNTANT"
        department="ACCOUNTANT"
      />,
    );
    const detailSpans = container.querySelectorAll(
      "[data-identity-details] > span",
    );
    expect(detailSpans).toHaveLength(2);
    expect(detailSpans[0]).toHaveTextContent("ACCOUNTANT");
    expect(detailSpans[1]).toHaveTextContent("ACCOUNTANT");
  });

  it("renders business employee id when provided", () => {
    render(
      <IdentityBlock
        name="Ada Lovelace"
        businessEmployeeId="EMP10001"
        employeeCode="LOV_ADA"
      />,
    );
    const block = screen.getByLabelText("Ada Lovelace identity");
    expect(block).toHaveTextContent("ID: EMP10001");
    expect(block).toHaveTextContent("LOV_ADA");
  });

  it("renders image when photoSrc is set", () => {
    render(
      <IdentityBlock name="Ada Lovelace" photoSrc="blob:http://test/photo" />,
    );
    const avatar = screen.getByLabelText("Ada Lovelace identity");
    const photo = avatar.querySelector("img");
    expect(photo).not.toBeNull();
    expect(photo?.getAttribute("src")).toBe("blob:http://test/photo");
    expect(avatar).not.toHaveTextContent("AL");
  });
});
