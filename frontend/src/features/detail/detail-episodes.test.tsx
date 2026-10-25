import * as pb from "@/gen/paired_ratings";
import { renderWithQuery } from "@/test/render";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getEpisodes = vi.fn();
const toggleEpisode = vi.fn();
const toggleSeason = vi.fn();
const syncEpisodes = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: {
    getEpisodes: (id: number) => getEpisodes(id),
    toggleEpisode: (episodeId: number, watched: boolean) => toggleEpisode(episodeId, watched),
    toggleSeason: (showId: number, season: number, watched: boolean) =>
      toggleSeason(showId, season, watched),
    syncEpisodes: (id: number) => syncEpisodes(id),
  },
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: (message: string) => toastError(message) },
}));

const { DetailEpisodes } = await import("@/features/detail/detail-episodes");

// The wire shape: encoding/json leaves out `watched` when it is false. The api
// layer decodes it, so the component always sees a boolean.
const response = pb.EpisodesResponse.fromJSON({
  episodes: [
    { id: 11, season_number: 1, episode_number: 1, title: "Pilot" },
    { id: 12, season_number: 1, episode_number: 2, title: "Second", watched: true },
    { id: 21, season_number: 2, episode_number: 1, title: "Return" },
  ],
  total_seasons: 2,
});

describe("DetailEpisodes", () => {
  beforeEach(() => {
    getEpisodes.mockResolvedValue(response);
    toggleEpisode.mockResolvedValue(undefined);
    toggleSeason.mockResolvedValue(undefined);
  });

  it("groups episodes by season and counts the watched ones", async () => {
    renderWithQuery(<DetailEpisodes showId={5} />);

    expect(await screen.findByText("Season 1")).toBeInTheDocument();
    expect(screen.getByText("Season 2")).toBeInTheDocument();
    expect(screen.getByText("1/2 watched")).toBeInTheDocument();
    expect(screen.getByText("0/1 watched")).toBeInTheDocument();
  });

  it("marks one episode watched after the season is expanded", async () => {
    const user = userEvent.setup();
    renderWithQuery(<DetailEpisodes showId={5} />);

    await user.click(await screen.findByRole("button", { name: /Season 1/ }));
    expect(screen.getByText("Pilot")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Mark episode 1 as watched" }));

    await waitFor(() => expect(toggleEpisode).toHaveBeenCalledWith(11, true));
    expect(await screen.findByText("2/2 watched")).toBeInTheDocument();
  });

  it("marks a whole season watched from the season checkbox", async () => {
    const user = userEvent.setup();
    renderWithQuery(<DetailEpisodes showId={5} />);

    await user.click(await screen.findByRole("checkbox", { name: "Mark all Season 2 as watched" }));

    await waitFor(() => expect(toggleSeason).toHaveBeenCalledWith(5, 2, true));
    expect(await screen.findByText("1/1 watched")).toBeInTheDocument();
  });

  it("leaves an unwatched episode unchecked when marking it fails", async () => {
    toggleEpisode.mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    renderWithQuery(<DetailEpisodes showId={5} />);

    await user.click(await screen.findByRole("button", { name: /Season 1/ }));
    const checkbox = screen.getByRole("checkbox", { name: "Mark episode 1 as watched" });
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Failed to update episode."));
    expect(checkbox).not.toBeChecked();
    expect(screen.getByText("1/2 watched")).toBeInTheDocument();
  });

  it("warns and leaves the count alone when the toggle fails", async () => {
    toggleSeason.mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    renderWithQuery(<DetailEpisodes showId={5} />);

    await user.click(await screen.findByRole("checkbox", { name: "Mark all Season 2 as watched" }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Failed to update season."));
    expect(screen.getByText("0/1 watched")).toBeInTheDocument();
  });
});
