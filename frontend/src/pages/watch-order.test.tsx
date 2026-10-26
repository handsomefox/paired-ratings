import * as pb from "@/gen/paired_ratings";
import { renderWithQuery } from "@/test/render";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listShows = vi.fn();
const reorderShows = vi.fn();
const removeFromWatchOrder = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: {
    session: () => Promise.resolve({ authenticated: true, image_base: "" }),
    listShows: (params: URLSearchParams) => listShows(params),
    reorderShows: (ids: number[]) => reorderShows(ids),
    removeFromWatchOrder: (id: number) => removeFromWatchOrder(id),
  },
}));

vi.mock("@/components/show-link", () => ({
  ShowLink: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { WatchOrderPage } = await import("@/pages/watch-order");

// Decoded the way api.listShows decodes the wire response.
function listResponse(titles: string[]) {
  return pb.ListResponse.fromJSON({
    shows: titles.map((title, i) => ({
      id: i + 1,
      title,
      year: 2001 + i,
      status: "planned",
      watch_priority: i + 1,
    })),
    total_count: titles.length,
  });
}

function positions() {
  return screen
    .getAllByRole("button", { name: /^Position \d+\. Change position/ })
    .map((button) => button.textContent);
}

// getAllByText returns matches in document order, which is the rendered order.
function titles() {
  return screen.getAllByText(/^(Alpha|Beta|Gamma)$/).map((node) => node.textContent);
}

async function moveToPosition(user: ReturnType<typeof userEvent.setup>, from: number, to: number) {
  const buttons = screen.getAllByRole("button", { name: /^Position \d+\. Change position/ });
  await user.click(buttons[from - 1]);
  const input = screen.getAllByRole("spinbutton")[from - 1];
  await user.clear(input);
  await user.type(input, `${to}{Enter}`);
}

describe("WatchOrderPage", () => {
  beforeEach(() => {
    listShows.mockResolvedValue(listResponse(["Alpha", "Beta", "Gamma"]));
    reorderShows.mockResolvedValue(undefined);
  });

  it("lists the shows in server order with no unsaved changes", async () => {
    renderWithQuery(<WatchOrderPage />);

    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(positions()).toEqual(["1", "2", "3"]);
    expect(screen.queryByRole("button", { name: "Save order" })).not.toBeInTheDocument();
  });

  // The library endpoint pages by 20 unless asked for everything. A capped
  // list would hide the rest of the order and leave it out of a save.
  it("asks for the whole watch order and shows more than 20 rows", async () => {
    const many = Array.from({ length: 25 }, (_, i) => `Show ${i + 1}`);
    listShows.mockResolvedValue(listResponse(many));
    renderWithQuery(<WatchOrderPage />);

    expect(await screen.findByText("Show 25")).toBeInTheDocument();
    const params = listShows.mock.calls[0][0] as URLSearchParams;
    expect(params.get("sort")).toBe("priority");
    expect(params.get("page_size")).toBe("all");
    expect(positions()).toHaveLength(25);
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

  it("does not move the show when the position edit is cancelled with Escape", async () => {
    const user = userEvent.setup();
    renderWithQuery(<WatchOrderPage />);
    await screen.findByText("Alpha");

    const buttons = screen.getAllByRole("button", { name: /^Position \d+\. Change position/ });
    await user.click(buttons[2]);
    const input = screen.getByRole("spinbutton", { name: "New position for Gamma" });
    expect(input).toHaveFocus();
    await user.clear(input);
    await user.type(input, "1{Escape}");
    await user.click(document.body);

    expect(titles()).toEqual(["Alpha", "Beta", "Gamma"]);
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
