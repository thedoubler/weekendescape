import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SearchReceipt, type ReceiptValues } from "@/components/SearchReceipt";

const values: ReceiptValues = {
  style: "strict",
  stopMode: "direct",
  adults: 1,
  bridges: false,
  region: null,
};

function mount(overrides: Partial<React.ComponentProps<typeof SearchReceipt>> = {}) {
  const props = {
    origins: ["CLJ"],
    originCities: { CLJ: "Cluj-Napoca" },
    values,
    onChange: vi.fn(),
    onCommit: vi.fn(),
    onEditOrigins: vi.fn(),
    ...overrides,
  };
  return render(<SearchReceipt {...props} />);
}

// The receipt's four values are the controls that cost a search, and they wear
// the weakest affordance on the board — a dotted underline, which is the
// convention for <abbr>. The owner watched someone miss them entirely, so a
// light now runs along each underline on a first visit. A hint that cannot
// stop is noise, which is the half these tests exist to protect: it teaches
// once and then it is gone for good on that device.
//
// The spans always render; the row's `receipt-hint-on` class is what turns the
// animation on, so that is what these assert.
describe("the receipt's one-time hint", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("plays for a visitor who has never opened a control", () => {
    const { container } = mount();
    expect(container.querySelector(".receipt-hint-on")).not.toBeNull();
    expect(container.querySelectorAll(".receipt-hint").length).toBeGreaterThan(0);
  });

  // Not just the first page view: someone who loads the board twice without
  // touching it has not learned anything yet.
  it("plays again while the lesson has not landed", () => {
    mount().unmount();
    const { container } = mount();
    expect(container.querySelector(".receipt-hint-on")).not.toBeNull();
  });

  it("stops the moment a control is opened, and stays stopped", () => {
    const { container } = mount();
    fireEvent.click(screen.getByRole("button", { name: /Fri–Sun/ }));
    expect(container.querySelector(".receipt-hint-on")).toBeNull();
    expect(localStorage.getItem("receipt-hint-seen")).toBe("1");

    // A later visit on the same device gets no hint at all.
    const second = mount();
    expect(second.container.querySelector(".receipt-hint-on")).toBeNull();
  });

  it("never plays for a returning visitor", () => {
    localStorage.setItem("receipt-hint-seen", "1");
    const { container } = mount();
    expect(container.querySelector(".receipt-hint-on")).toBeNull();
  });

  // A board that throws because storage is blocked is worse than a board with
  // no hint, and private mode makes localStorage throw on access.
  it("renders the receipt when storage is unavailable", () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    expect(() => mount()).not.toThrow();
    expect(screen.getByRole("button", { name: /Cluj-Napoca/ })).toBeInTheDocument();
    getItem.mockRestore();
  });
});
