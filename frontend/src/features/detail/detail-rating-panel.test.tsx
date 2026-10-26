import {
  DetailRatingPanel,
  type DetailRatingPanelProps,
} from "@/features/detail/detail-rating-panel";
import { render, screen } from "@testing-library/react";
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
  it("reports the star the reader clicked", async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();

    await user.click(screen.getByRole("button", { name: "7 stars" }));

    expect(props.onRatingChange).toHaveBeenCalledWith(7);
  });

  it("marks the current rating as pressed", () => {
    renderPanel({ rating: 6 });
    expect(screen.getByRole("group", { name: "Alex's rating" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "6 stars" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "7 stars" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
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
