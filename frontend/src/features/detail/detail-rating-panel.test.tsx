import {
  DetailRatingPanel,
  type DetailRatingPanelProps,
} from "@/features/detail/detail-rating-panel";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

function renderPanel(overrides: Partial<DetailRatingPanelProps> = {}) {
  const props: DetailRatingPanelProps = {
    tone: "bf",
    name: "Alex",
    rating: null,
    onRatingChange: vi.fn(),
    comment: "",
    onCommentChange: vi.fn(),
    editing: false,
    onEditingChange: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<DetailRatingPanel {...props} />) };
}

describe("DetailRatingPanel", () => {
  it("reports the half or whole star the reader clicked", async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();

    await user.click(screen.getByRole("radio", { name: "7 stars" }));
    expect(props.onRatingChange).toHaveBeenLastCalledWith(7);

    await user.click(screen.getByRole("radio", { name: "6.5 stars" }));
    expect(props.onRatingChange).toHaveBeenLastCalledWith(6.5);

    await user.click(screen.getByRole("radio", { name: "0.5 stars" }));
    expect(props.onRatingChange).toHaveBeenLastCalledWith(0.5);
  });

  it("marks the current rating as checked and makes only it tabbable", () => {
    renderPanel({ rating: 6.5 });
    const group = screen.getByRole("radiogroup", { name: "Alex's rating" });
    expect(within(group).getAllByRole("radio")).toHaveLength(20);
    const current = screen.getByRole("radio", { name: "6.5 stars" });
    expect(current).toHaveAttribute("aria-checked", "true");
    expect(current).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "7 stars" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radio", { name: "7 stars" })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByText("6.5/10")).toBeInTheDocument();
  });

  it("moves half a star with the arrow keys and stops at the ends", async () => {
    const user = userEvent.setup();
    const { props } = renderPanel({ rating: 10 });

    await user.tab();
    expect(screen.getByRole("radio", { name: "10 stars" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(props.onRatingChange).toHaveBeenLastCalledWith(9.5);
    expect(screen.getByRole("radio", { name: "9.5 stars" })).toHaveFocus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(props.onRatingChange).toHaveBeenLastCalledWith(10);
    await user.keyboard("{Home}");
    expect(props.onRatingChange).toHaveBeenLastCalledWith(0.5);
  });

  it("switches to the editor when the reader clicks the pencil", async () => {
    const user = userEvent.setup();
    const { props } = renderPanel({ comment: "Watched it twice." });

    expect(screen.getByText("Watched it twice.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit Alex's comment" }));

    expect(props.onEditingChange).toHaveBeenCalledWith(true);
  });

  it("names the comment editor after the person", () => {
    renderPanel({ editing: true, comment: "Loved it." });
    expect(screen.getByRole("textbox", { name: "Alex's comment" })).toHaveValue("Loved it.");
  });
});
