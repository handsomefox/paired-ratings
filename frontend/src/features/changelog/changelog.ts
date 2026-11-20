/**
 * What changed in the app, for the people using it. Add an entry for each day
 * that changes something they can see, newest first, written for them rather
 * than for developers. The "What's new" page shows the month up to the newest
 * entry, so older entries can stay here.
 */
export type ChangelogEntry = {
  /** The day the change shipped, as YYYY-MM-DD. */
  date: string;
  /**
   * The few changes worth knowing about, shown first and set apart. Each has
   * a short title and a sentence on what it does.
   */
  highlights?: Array<{ title: string; text: string }>;
  /** Everything else, as one sentence each. */
  changes: string[];
};

export const changelog: ChangelogEntry[] = [
  {
    date: "2026-11-20",
    highlights: [
      {
        title: "Half stars",
        text: "Rate a show 9.5 instead of choosing between 9 and 10. Tap the left half of a star for the half.",
      },
      {
        title: "Search the library",
        text: "Find a title by name, and switch between all titles, movies, and TV shows.",
      },
      {
        title: "Better filters",
        text: "Filter the library by TMDB rating and by who has rated a title, and leave genres you never want out of the Add page.",
      },
    ],
    changes: [
      "A new app icon: a star split into your two colors, in place of the Christmas picture. An installed app may keep the old icon until it is reinstalled.",
      "On the show page, Refresh TMDB and Delete show moved into the ••• menu next to the title.",
      "The show page shows the TMDB score as a colored badge next to the status, as the cards do.",
      "“Clear” on the show page sits next to the average and asks before it removes both ratings and comments.",
      "The number of shows per page moved into the library filters.",
      "The (i) next to Refresh TMDB explains what it does.",
      "TMDB vote counts on cards are shorter, such as 4.5K instead of 4509.",
      "Country flags show as flags in Chrome and Edge on Windows, not as two letters, and have the same size and spacing on every card.",
      "Chip and checkbox outlines stay smooth on screens that scale the page, such as Windows at 125%.",
      "The genre, country, and language lists line up their codes at the edge, and the page no longer shows through them.",
      "Opening a dropdown no longer shifts the page sideways.",
      "On the show page, the rating stars span the whole panel on wider screens.",
      "An episode's air date and length have a dot between them.",
      "The star and the AVG label line up with the numbers on rating chips.",
      "This “What's new” page.",
    ],
  },
  {
    date: "2026-10-26",
    highlights: [
      {
        title: "Made for phones",
        text: "The navigation moved to a tab bar at the bottom of the screen, and the show page, the library, and the search results fit a phone.",
      },
    ],
    changes: [
      "Search results show the language as a short code, such as JA, instead of a name that was cut off. Point at it for the full name.",
      "The show and watch order pages keep a readable width on large screens. A show's related titles start with ten, and “Show all” shows the rest.",
      "The library fits more cards on a desktop screen, and text no longer grows on large screens.",
      "Password managers can save the login.",
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
