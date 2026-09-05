import { ShowCard } from "@/components/show-card";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const OVERVIEW = "A long synopsis that runs past three lines in the card.";

// jsdom does no layout, so both heights read 0 and the toggle never appears.
// Model the clamp instead: while the paragraph carries line-clamp its visible
// height is short, and expanding makes the two heights equal. That equality is
// exactly what used to make the button remove itself.
function stubClampedLayout() {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get() {
      return 100;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return String(this.className).includes("line-clamp") ? 40 : 100;
    },
  });
}

describe("ShowCard overview toggle", () => {
  beforeEach(stubClampedLayout);

  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, "scrollHeight");
    Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
  });

  function renderCard() {
    return render(
      <ShowCard title="Widow's Bay" posterAlt="Widow's Bay" imageBase="" overview={OVERVIEW} />,
    );
  }

  it("offers a way back after expanding", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole("button", { name: "Show more" }));

    // The regression: measuring while expanded decided the text fit and
    // unmounted this button, leaving no way to collapse the card.
    const collapse = screen.getByRole("button", { name: "Show less" });
    expect(collapse).toBeInTheDocument();
    expect(collapse).toHaveAttribute("aria-expanded", "true");

    await user.click(collapse);
    expect(screen.getByRole("button", { name: "Show more" })).toBeInTheDocument();
  });

  it("offers no toggle when the overview already fits", () => {
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get() {
        return 40;
      },
    });
    renderCard();
    expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();
  });
});
