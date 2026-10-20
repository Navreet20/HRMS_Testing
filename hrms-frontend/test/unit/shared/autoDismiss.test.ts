import { AUTO_DISMISS_MS } from "@/shared/ui/autoDismiss";

describe("AUTO_DISMISS_MS", () => {
  it("is 8 seconds for toast and popup auto-dismiss", () => {
    expect(AUTO_DISMISS_MS).toBe(8000);
  });
});
