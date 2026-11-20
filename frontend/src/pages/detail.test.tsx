import * as pb from "@/gen/paired_ratings";
import { renderApp } from "@/test/render";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const clearRatings = vi.fn();
let saved: Record<string, unknown> = {};

const detail = (show: Record<string, unknown>) =>
  pb.ShowDetail.fromJSON({ show: { id: 1, title: "Heat", media_type: "movie", ...show } });

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: {
    session: () => Promise.resolve(pb.SessionResponse.fromJSON({ authenticated: true })),
    getShow: () => Promise.resolve(detail(saved)),
    getRelated: () => Promise.resolve(pb.GetRelatedResponse.fromJSON({})),
    clearRatings: () => {
      clearRatings();
      return Promise.resolve(detail({}));
    },
  },
}));

describe("clearing ratings", () => {
  it("asks first, because it removes both ratings and both comments", async () => {
    saved = { bf_rating: 7, gf_comment: "Loved it" };
    const user = userEvent.setup();
    renderApp("/show/1");

    await user.click(await screen.findByRole("button", { name: "Clear" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Clear ratings?" });
    expect(clearRatings).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Clear" }));
    await waitFor(() => expect(clearRatings).toHaveBeenCalledOnce());
  });

  it("has nothing to clear on a show without ratings or comments", async () => {
    saved = {};
    renderApp("/show/1");

    expect(await screen.findByRole("button", { name: "Clear" })).toBeDisabled();
  });
});
