export interface TrackedLeague {
  id: number;
  name: string;
  shortName: string;
  country: string;
  emoji: string;
  slug: string;
}

export const CATEGORIES: TrackedLeague[] = [
  {
    id: 1,
    name: "Politics",
    shortName: "Politics",
    country: "Global",
    emoji: "🏛️",
    slug: "politics"
  },
  {
    id: 2,
    name: "Crypto",
    shortName: "Crypto",
    country: "Global",
    emoji: "🪙",
    slug: "crypto"
  },
  {
    id: 3,
    name: "Pop Culture",
    shortName: "Pop Culture",
    country: "Global",
    emoji: "🎬",
    slug: "pop-culture"
  },
  {
    id: 4,
    name: "Science & Tech",
    shortName: "Science",
    country: "Global",
    emoji: "🔬",
    slug: "science"
  },
  {
    id: 5,
    name: "Sports",
    shortName: "Sports",
    country: "Global",
    emoji: "⚽",
    slug: "sports"
  }
];

export const DEFAULT_LEAGUES = CATEGORIES;
export const DEFAULT_LEAGUE_IDS = CATEGORIES.map(c => c.id);

export const getLeagueById = (id: number): TrackedLeague | undefined => {
  return CATEGORIES.find((c) => c.id === id);
};

export const getCategoryBySlug = (slug: string): TrackedLeague | undefined => {
  return CATEGORIES.find((c) => c.slug === slug);
};

export const updateTrackedLeagues = (sport: string) => {
  // Legacy compatibility stub
};
export const LEAGUE_TO_SPORTMONKS = {};
export const SPORTMONKS_TO_LEAGUE = {};
export const FOOTBALL_LEAGUES = CATEGORIES;
export const CRICKET_LEAGUES = CATEGORIES;
