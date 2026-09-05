import { renderWithQuery } from "@/test/render";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listShows = vi.fn();
const reorderShows = vi.fn();
const removeFromWatchOrder = vi.fn();

vi.mock("@/lib/api", () => ({
  api: {
    session: () => Promise.resolve({ authenticated: true, image_base: "" }),
    listShows: (params: URLSearchParams) => listShows(params),
    reorderShows: (ids: number[]) => reorderShows(ids),
    removeFromWatchOrder: (id: number) => removeFromWatchOrder(id),
  },
}));

vi.mock("@/components/view-transition-link", () => ({
  ViewTransitionLink: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { WatchOrderPage } = await import("@/pages/watch-order");

const shows = [
  { id: 1, title: "Alpha", year: 2001, poster_path: "", genres: "" },
  { id: 2, title: "Beta", year: 2002, poster_path: "", genres: "" },
  { id: 3, title: "Gamma", year: 2003, poster_path: "", genres: "" },
];

function positions() {
  return screen
    .getAllByRole("button", { name: "Click to enter position" })
    .map((button) => button.textContent);
}

// getAllByText returns matches in document order, which is the rendered order.
function titles() {
  return screen.getAllByText(/^(Alpha|Beta|Gamma)$/).map((node) => node.textContent);
}

async function moveToPosition(user: ReturnType<typeof userEvent.setup>, from: number, to: number) {
  const buttons = screen.getAllByRole("button", { name: "Click to enter position" });
  await user.click(buttons[from - 1]);
  const input = screen.getAllByRole("spinbutton")[from - 1];
  await user.clear(input);
  await user.type(input, `${to}{Enter}`);
}

describe("WatchOrderPage", () => {
  beforeEach(() => {
    listShows.mockResolvedValue({ shows, total_count: shows.length });
    reorderShows.mockResolvedValue(undefined);
  });

  it("lists the shows in server order with no unsaved changes", async () => {
    renderWithQuery(<WatchOrderPage />);

    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(positions()).toEqual(["1", "2", "3"]);
    expect(screen.queryByRole("button", { name: "Save order" })).not.toBeInTheDocument();
  });

  it("saves the new order after moving a show to another position", async () => {
    const user = userEvent.setup();
    renderWithQuery(<WatchOrderPage />);
    await screen.findByText("Alpha");

    await moveToPosition(user, 3, 1);

    expect(titles()).toEqual(["Gamma", "Alpha", "Beta"]);
    await user.click(await screen.findByRole("button", { name: "Save order" }));

    await waitFor(() => expect(reorderShows).toHaveBeenCalledWith([3, 1, 2]));
  });

  it("clamps a position past the end of the list", async () => {
    const user = userEvent.setup();
    renderWithQuery(<WatchOrderPage />);
    await screen.findByText("Alpha");

    await moveToPosition(user, 1, 99);

    expect(titles()).toEqual(["Beta", "Gamma", "Alpha"]);
  });

  it("restores the server order when the reorder is cancelled", async () => {
    const user = userEvent.setup();
    renderWithQuery(<WatchOrderPage />);
    await screen.findByText("Alpha");

    await moveToPosition(user, 3, 1);
    expect(titles()).toEqual(["Gamma", "Alpha", "Beta"]);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(titles()).toEqual(["Alpha", "Beta", "Gamma"]);
    expect(reorderShows).not.toHaveBeenCalled();
  });
});
