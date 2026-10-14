export type MissionWallet = { ink: number; shards: number };
export type CommunityResult = {
  awarded?: number;
  wallet?: MissionWallet;
  token?: string;
  eligible?: boolean;
  [key: string]: unknown;
};
export type SuggestionCategory = "book" | "character" | "artwork";
export const DAILY_RESET = "00:00 UTC";
export const suggestionCategories = [
  {
    id: "book",
    title: "What should we collect next?",
    field: "Book or series title",
    related: "Author (optional)",
  },
  {
    id: "character",
    title: "Pick the next obsession",
    field: "Character name",
    related: "Book or series",
  },
  {
    id: "artwork",
    title: "You choose the vibe",
    field: "Artwork idea",
    related: "Related character or series (optional)",
  },
] as const;
