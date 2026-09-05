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

  it("labels a single star in the singular", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: "1 star" })).toBeInTheDocument();
  });

  it("switches to the editor when the reader clicks the pencil", async () => {
    const user = userEvent.setup();
    const { props } = renderPanel({ comment: "Watched it twice." });

    expect(screen.getByText("Watched it twice.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "✎" }));

    expect(props.onEditingChange).toHaveBeenCalledWith(true);
  });

  it("reports each keystroke in the comment editor", async () => {
    const user = userEvent.setup();
    const { props } = renderPanel({ editing: true });

    await user.type(screen.getByPlaceholderText("Leave a comment by Alex"), "ok");

    expect(props.onCommentChange).toHaveBeenCalledTimes(2);
    expect(props.onCommentChange).toHaveBeenLastCalledWith("k");
  });
});
