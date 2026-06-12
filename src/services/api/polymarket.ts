import axios from 'axios';

export interface PolymarketMarket {
  id: string;
  question: string;
  outcomes: string[]; // e.g. ["Yes", "No"]
  outcomePrices: number[]; // e.g. [0.65, 0.35]
  volumeNum: number;
  endDateIso: string;
  slug: string;
  description: string;
  clobTokenIds: string[];
}

export interface PolymarketEvent {
  id: string;
  title: string;
  description: string;
  image: string;
  icon: string;
  active: boolean;
  closed: boolean;
  volume: number;
  category: string; // resolved category slug
  tags: Array<{ id: string; label: string; slug: string }>;
  markets: PolymarketMarket[];
}

const GAMMA_BASE_URL = 'https://gamma-api.polymarket.com';

// Local tag-to-category mappings
const CATEGORY_TAG_MAP: Record<string, string> = {
  // Politics
  'politics': 'Politics',
  'elections': 'Politics',
  'us-election': 'Politics',
  'world-elections': 'Politics',
  'global-elections': 'Politics',
  // Crypto
  'crypto': 'Crypto',
  'bitcoin': 'Crypto',
  'altcoins': 'Crypto',
  'exchange': 'Crypto',
  // Pop Culture
  'culture': 'Pop Culture',
  'pop-culture': 'Pop Culture',
  'entertainment': 'Pop Culture',
  // Science & Tech
  'ai': 'Science',
  'tech': 'Science',
  'science': 'Science',
  'openai': 'Science',
  'claude': 'Science',
  // Sports
  'sports': 'Sports',
  'soccer': 'Sports',
  'nba': 'Sports',
  'nfl': 'Sports',
  'cricket': 'Sports',
};

const resolveCategory = (tags: any[] = []): string => {
  for (const t of tags) {
    const slug = t.slug?.toLowerCase();
    if (CATEGORY_TAG_MAP[slug]) {
      return CATEGORY_TAG_MAP[slug];
    }
  }
  return 'General';
};

const parseEvent = (raw: any): PolymarketEvent => {
  const tags = raw.tags || [];
  const category = resolveCategory(tags);
  
  const markets = (raw.markets || []).map((m: any) => {
    let outcomes: string[] = [];
    try {
      outcomes = typeof m.outcomes === 'string' ? JSON.parse(m.outcomes) : (m.outcomes || []);
    } catch {
      outcomes = m.outcomes || [];
    }

    let outcomePrices: number[] = [];
    try {
      outcomePrices = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices).map(Number) : (m.outcomePrices || []).map(Number);
    } catch {
      outcomePrices = (m.outcomePrices || []).map(Number);
    }

    let clobTokenIds: string[] = [];
    try {
      clobTokenIds = typeof m.clobTokenIds === 'string' ? JSON.parse(m.clobTokenIds) : (m.clobTokenIds || []);
    } catch {
      clobTokenIds = m.clobTokenIds || [];
    }

    return {
      id: m.id,
      question: m.question || '',
      outcomes,
      outcomePrices,
      volumeNum: Number(m.volumeNum || m.volume || 0),
      endDateIso: m.endDateIso || m.endDate || '',
      slug: m.slug || '',
      description: m.description || '',
      clobTokenIds,
    };
  });

  return {
    id: raw.id,
    title: raw.title || '',
    description: raw.description || '',
    image: raw.image || raw.icon || '',
    icon: raw.icon || raw.image || '',
    active: Boolean(raw.active),
    closed: Boolean(raw.closed),
    volume: Number(raw.volumeNum || raw.volume || 0),
    category,
    tags,
    markets,
  };
};

export const fetchTrendingEvents = async (): Promise<PolymarketEvent[]> => {
  try {
    const response = await axios.get(`${GAMMA_BASE_URL}/events`, {
      params: {
        active: 'true',
        closed: 'false',
        limit: 30,
        featured: 'true',
      },
    });
    if (!Array.isArray(response.data)) return [];
    return response.data.map(parseEvent);
  } catch (err: any) {
    console.error('[Polymarket API] Error in fetchTrendingEvents:', err.message);
    return [];
  }
};

export const fetchEventsByCategory = async (categorySlug: string): Promise<PolymarketEvent[]> => {
  try {
    // If 'all', return trending
    if (categorySlug === 'all') {
      return fetchTrendingEvents();
    }

    // Map local category slug to tag ids or tag query
    const targetTagSlug = categorySlug === 'science' ? 'tech' : categorySlug;
    
    // We can fetch events from Polymarket Gamma API and filter locally by tag to ensure reliability
    const response = await axios.get(`${GAMMA_BASE_URL}/events`, {
      params: {
        active: 'true',
        closed: 'false',
        limit: 50,
      },
    });
    if (!Array.isArray(response.data)) return [];
    
    const allEvents = response.data.map(parseEvent);
    
    // Filter locally by category
    const filtered = allEvents.filter(e => {
      if (categorySlug === 'all') return true;
      return e.category.toLowerCase().replace(/\s+/g, '-') === categorySlug || 
             e.tags.some(t => t.slug?.toLowerCase() === targetTagSlug);
    });

    return filtered;
  } catch (err: any) {
    console.error(`[Polymarket API] Error in fetchEventsByCategory for ${categorySlug}:`, err.message);
    return [];
  }
};

export const searchEvents = async (query: string): Promise<PolymarketEvent[]> => {
  try {
    const response = await axios.get(`${GAMMA_BASE_URL}/public-search`, {
      params: {
        q: query,
      },
    });
    
    const events = response.data?.events;
    if (!Array.isArray(events)) return [];
    return events.map(parseEvent);
  } catch (err: any) {
    console.error('[Polymarket API] Error in searchEvents:', err.message);
    return [];
  }
};

export const fetchEventById = async (id: string): Promise<PolymarketEvent | null> => {
  try {
    const response = await axios.get(`${GAMMA_BASE_URL}/events`, {
      params: {
        id,
      },
    });
    if (Array.isArray(response.data) && response.data.length > 0) {
      return parseEvent(response.data[0]);
    }
    return null;
  } catch (err: any) {
    console.error('[Polymarket API] Error in fetchEventById:', err.message);
    return null;
  }
};
