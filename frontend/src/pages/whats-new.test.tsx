import { changelog, formatChangelogDate } from "@/features/changelog/changelog";
import * as pb from "@/gen/paired_ratings";
import { renderApp } from "@/test/render";
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: {
    session: () => Promise.resolve(pb.SessionResponse.fromJSON({ authenticated: true })),
    listShows: () => Promise.resolve(pb.ListResponse.fromJSON({})),
  },
}));

// The tab bar's More button carries the dot on phones, which is the layout
// jsdom gets.
const moreButton = () => within(screen.getAllByRole("navigation")[1]).getByRole("button");

describe("WhatsNewPage", () => {
  beforeEach(() => localStorage.clear());

  it("lists the changes by date and clears the new-changes dot", async () => {
    renderApp("/whats-new");

    expect(await screen.findByRole("heading", { name: "What's new" })).toBeInTheDocument();
    const newest = changelog[0];
    expect(screen.getByText(formatChangelogDate(newest.date))).toBeInTheDocument();
    expect(screen.getByText(newest.changes[0])).toBeInTheDocument();

    await waitFor(() => expect(moreButton()).toHaveAccessibleName("More"));
    expect(localStorage.getItem("changelog-seen")).toMatch(new RegExp(`^${newest.date}:\\d+$`));
  });

  it("marks the More button while there are changes this browser has not shown", async () => {
    renderApp("/watch-order");

    await waitFor(() => expect(moreButton()).toHaveAccessibleName("More, new changes to the app"));
  });

  // Only the date used to be stored, so a change added later the same day
  // stayed hidden.
  it("counts a change added later on the same day as new", async () => {
    localStorage.setItem("changelog-seen", changelog[0].date);
    renderApp("/watch-order");

    await waitFor(() => expect(moreButton()).toHaveAccessibleName("More, new changes to the app"));
  });
});
