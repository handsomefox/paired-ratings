/**
 * What changed in the app, for the people using it. Add an entry for each day
 * that changes something they can see, newest first, written for them rather
 * than for developers. The "What's new" page shows the month up to the newest
 * entry, so older entries can stay here.
 */
export type ChangelogEntry = {
  /** The day the change shipped, as YYYY-MM-DD. */
  date: string;
  changes: string[];
};

export const changelog: ChangelogEntry[] = [
  {
    date: "2026-11-20",
    changes: [
      "Ratings take half stars, so a show can get 9.5 instead of 9 or 10. Tap the left half of a star for the half.",
      "Search the library by title, and switch it between all titles, movies, and TV shows.",
      "Filter the library by a minimum TMDB rating, and by who has rated a title, which replaces “Unrated only”.",
      "The number of shows per page moved into the library filters.",
      "Leave genres out of the Add page with the button next to each genre.",
      "TMDB vote counts on cards are shorter, such as 4.5K instead of 4509.",
      "Country flags show as flags in Chrome and Edge on Windows, not as two letters.",
      "Opening a dropdown no longer shifts the page sideways.",
      "On the show page, the rating stars span the whole panel on wider screens.",
      "This “What's new” page.",
    ],
  },
  {
    date: "2026-10-26",
    changes: [
      "Search results show the language as a short code, such as JA, instead of a name that was cut off. Point at it for the full name.",
      "The show and watch order pages keep a readable width on large screens. A show's related titles start with ten, and “Show all” shows the rest.",
      "The library fits more cards on a desktop screen, and text no longer grows on large screens.",
      "Password managers can save the login.",
      "The show page, the library, and the search results fit phone screens better.",
      "On phones, the navigation moved to a tab bar at the bottom of the screen.",
      "Back returns to the same scroll position in the library and the search results.",
      "The watch order can be rearranged with the keyboard.",
    ],
  },
];

const DAY = 24 * 60 * 60 * 1000;
/** How far back from the newest entry the page reaches. */
const SHOWN_DAYS = 31;

/** The entries from the month up to the newest one. */
export function recentEntries(entries: ChangelogEntry[] = changelog): ChangelogEntry[] {
  const newest = entries[0];
  if (!newest) return [];
  const cutoff = Date.parse(newest.date) - SHOWN_DAYS * DAY;
  return entries.filter((entry) => Date.parse(entry.date) >= cutoff);
}

/** "2026-11-20" as "20.11.2026". */
export function formatChangelogDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
}
