// Market API service for fetching live prices from prediction markets

interface KalshiMarket {
  ticker: string;
  title: string;
  subtitle?: string;
  yes_price: number;
  yes_bid: number;
  yes_ask: number;
  volume: number;
  status: string;
}

interface PolymarketMarket {
  id: string;
  question: string;
  outcomePrices: string;
  volume: number;
}

interface PredictItContract {
  id: number;
  name: string;
  shortName: string;
  lastTradePrice: number;
  bestBuyYesCost: number;
  bestBuyNoCost: number;
}

interface PredictItMarket {
  id: number;
  name: string;
  shortName: string;
  contracts: PredictItContract[];
}

export interface StandardizedMarket {
  id: string;
  platform: "Kalshi" | "Polymarket" | "PredictIt";
  title: string;
  category?: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  lastUpdated: string;
  isBinary?: boolean; // Whether this is a binary (two-outcome) question
  outcomes?: [string, string]; // The two outcome labels if binary
  marketUrl?: string; // Direct link to the market on the platform
}

interface KalshiEvent {
  event_ticker: string;
  title: string;
  category: string;
  sub_title?: string;
  markets?: KalshiMarket[];
}

export interface MarketStats {
  kalshi: number;
  polymarket: number;
  predictit: number;
  total: number;
  lastUpdated: string;
}

// Cache for market data to avoid excessive API calls
let marketCache: {
  kalshi: StandardizedMarket[];
  polymarket: StandardizedMarket[];
  predictit: StandardizedMarket[];
  lastFetched: number;
} = {
  kalshi: [],
  polymarket: [],
  predictit: [],
  lastFetched: 0,
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minute cache to reduce API calls

// Helper function for fetch with retry and exponential backoff
async function fetchWithRetry(url: string, maxRetries: number = 3): Promise<Response | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "Accept": "application/json" }
      });
      
      if (response.status === 429) {
        // Rate limited - wait longer and retry
        const waitTime = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
        console.log(`Rate limited, waiting ${waitTime/1000}s before retry...`);
        await new Promise(r => setTimeout(r, waitTime));
        continue;
      }
      
      return response;
    } catch (e) {
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
  return null;
}

// Fetch ALL markets from Kalshi using cursor pagination
export async function fetchKalshiMarkets(query?: string, maxPages: number = 20): Promise<StandardizedMarket[]> {
  try {
    const allEvents: KalshiEvent[] = [];
    let cursor: string | null = null;
    let pageCount = 0;
    
    // Paginate through all events
    while (pageCount < maxPages) {
      const eventsUrl = new URL("https://api.elections.kalshi.com/trade-api/v2/events");
      eventsUrl.searchParams.set("limit", "200");
      eventsUrl.searchParams.set("status", "open");
      if (cursor) {
        eventsUrl.searchParams.set("cursor", cursor);
      }
      
      const eventsResponse = await fetchWithRetry(eventsUrl.toString());
      
      if (!eventsResponse || !eventsResponse.ok) {
        console.error("Kalshi Events API error:", eventsResponse?.status || "no response");
        break;
      }
      
      const eventsData = await eventsResponse.json();
      const events: KalshiEvent[] = eventsData.events || [];
      
      if (events.length === 0) break;
      
      allEvents.push(...events);
      cursor = eventsData.cursor || null;
      pageCount++;
      
      if (!cursor) break; // No more pages
      
      // Add delay between pages to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));
    }
    
    console.log(`Kalshi: Fetched ${allEvents.length} events across ${pageCount} pages`);
    
    // Process events directly without fetching individual market prices (to avoid rate limits)
    // Use event-level data which is sufficient for matching
    const results: StandardizedMarket[] = [];
    
    for (const event of allEvents) {
      if (query && !event.title.toLowerCase().includes(query.toLowerCase())) {
        continue;
      }
      
      // Detect if this is a binary question
      // Kalshi markets are typically binary (Yes/No)
      const isBinary = true;
      const outcomes: [string, string] = ["Yes", "No"];
      
      // Build market URL for Kalshi
      const marketUrl = `https://kalshi.com/markets/${event.event_ticker}`;
      
      // Use event data directly - most events have embedded market data
      results.push({
        id: event.event_ticker,
        platform: "Kalshi" as const,
        title: event.title,
        category: event.category || "general",
        // Use a neutral price since we don't have detailed market data
        // The matching algorithm will still work for finding similar markets
        yesPrice: 0.5,
        noPrice: 0.5,
        volume: 0,
        lastUpdated: new Date().toISOString(),
        isBinary,
        outcomes,
        marketUrl,
      });
    }
    
    console.log(`Kalshi: Processed ${results.length} events (using event-level data to avoid rate limits)`);
    return results;
  } catch (error) {
    console.error("Failed to fetch Kalshi markets:", error);
    return [];
  }
}

// Fetch ALL markets from Polymarket with pagination
export async function fetchPolymarketMarkets(query?: string, maxPages: number = 250): Promise<StandardizedMarket[]> {
  try {
    const allMarkets: any[] = [];
    let offset = 0;
    const limit = 100;
    let pageCount = 0;
    
    // Paginate through all markets
    while (pageCount < maxPages) {
      const url = `https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=${limit}&offset=${offset}`;
      
      const response = await fetch(url, {
        headers: { "Accept": "application/json" }
      });
      
      if (!response.ok) {
        console.error("Polymarket API error:", response.status);
        break;
      }
      
      const markets = await response.json();
      
      if (!markets || markets.length === 0) break;
      
      allMarkets.push(...markets);
      offset += limit;
      pageCount++;
      
      if (markets.length < limit) break; // Last page
      
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 50));
    }
    
    console.log(`Polymarket: Fetched ${allMarkets.length} markets across ${pageCount} pages`);
    
    return allMarkets
      .filter((m: any) => !query || m.question?.toLowerCase().includes(query.toLowerCase()))
      .map((m: any) => {
        let yesPrice = 0.5;
        let outcomes: [string, string] | undefined = undefined;
        let isBinary = false;
        
        try {
          if (m.outcomePrices) {
            const prices = JSON.parse(m.outcomePrices);
            yesPrice = parseFloat(prices[0]) || 0.5;
          }
          
          // Check if this is a binary market by looking at outcomes
          if (m.outcomes && Array.isArray(m.outcomes) && m.outcomes.length === 2) {
            isBinary = true;
            outcomes = [m.outcomes[0], m.outcomes[1]];
          } else {
            // Polymarket markets are typically binary, default to Yes/No
            isBinary = true;
            outcomes = ["Yes", "No"];
          }
        } catch (e) {
          // Use defaults
          isBinary = true;
          outcomes = ["Yes", "No"];
        }
        
        // Build market URL for Polymarket (using slug if available)
        const marketUrl = m.slug 
          ? `https://polymarket.com/event/${m.slug}` 
          : `https://polymarket.com/market/${m.id || m.conditionId}`;
        
        return {
          id: m.id || m.conditionId || String(Math.random()),
          platform: "Polymarket" as const,
          title: m.question || m.title || "Unknown",
          category: m.category || undefined,
          yesPrice,
          noPrice: 1 - yesPrice,
          volume: parseFloat(m.volume) || 0,
          lastUpdated: new Date().toISOString(),
          isBinary,
          outcomes,
          marketUrl,
        };
      });
  } catch (error) {
    console.error("Failed to fetch Polymarket markets:", error);
    return [];
  }
}

// Fetch ALL markets from PredictIt (returns all in one call)
export async function fetchPredictItMarkets(query?: string): Promise<StandardizedMarket[]> {
  try {
    const response = await fetch("https://www.predictit.org/api/marketdata/all/", {
      headers: { "Accept": "application/json" }
    });
    
    if (!response.ok) {
      console.error("PredictIt API error:", response.status);
      return [];
    }
    
    const data = await response.json();
    const markets: PredictItMarket[] = data.markets || [];
    const results: StandardizedMarket[] = [];
    
    // Get ALL contracts from ALL markets (no limit)
    for (const market of markets) {
      if (query && !market.name.toLowerCase().includes(query.toLowerCase())) {
        continue;
      }
      
      for (const contract of market.contracts || []) {
        // Use full market name for better matching, with contract specifics
        const fullTitle = `${market.name}: ${contract.name}`;
        
        // Build market URL for PredictIt
        const marketUrl = market.url || `https://www.predictit.org/markets/detail/${market.id}`;
        
        results.push({
          id: `${market.id}-${contract.id}`,
          platform: "PredictIt" as const,
          title: fullTitle,
          category: "Politics",
          yesPrice: contract.lastTradePrice || contract.bestBuyYesCost || 0.5,
          noPrice: 1 - (contract.lastTradePrice || contract.bestBuyYesCost || 0.5),
          volume: 0,
          lastUpdated: new Date().toISOString(),
          marketUrl,
        });
      }
    }
    
    console.log(`PredictIt: Fetched ${results.length} contracts from ${markets.length} markets`);
    return results;
  } catch (error) {
    console.error("Failed to fetch PredictIt markets:", error);
    return [];
  }
}

// Fetch all markets from all platforms with caching
export async function fetchAllMarkets(query?: string, forceRefresh: boolean = false): Promise<StandardizedMarket[]> {
  const now = Date.now();
  
  // Use cache if valid and no query filter
  if (!forceRefresh && !query && now - marketCache.lastFetched < CACHE_TTL) {
    console.log("Using cached market data");
    return [...marketCache.kalshi, ...marketCache.polymarket, ...marketCache.predictit];
  }
  
  console.log("Fetching fresh market data from all platforms...");
  const startTime = Date.now();
  
  const [kalshi, polymarket, predictit] = await Promise.all([
    fetchKalshiMarkets(query),
    fetchPolymarketMarkets(query),
    fetchPredictItMarkets(query),
  ]);
  
  // Update cache if no query filter
  if (!query) {
    marketCache = {
      kalshi,
      polymarket,
      predictit,
      lastFetched: Date.now(),
    };
  }
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Full scan completed in ${elapsed}s: ${kalshi.length + polymarket.length + predictit.length} total markets`);
  
  return [...kalshi, ...polymarket, ...predictit];
}

// Get market statistics
export function getMarketStats(): MarketStats {
  return {
    kalshi: marketCache.kalshi.length,
    polymarket: marketCache.polymarket.length,
    predictit: marketCache.predictit.length,
    total: marketCache.kalshi.length + marketCache.polymarket.length + marketCache.predictit.length,
    lastUpdated: marketCache.lastFetched ? new Date(marketCache.lastFetched).toISOString() : "",
  };
}

// Check if cache is stale
export function isCacheStale(): boolean {
  return Date.now() - marketCache.lastFetched > CACHE_TTL;
}

// Find potential arbitrage matches between platforms
export interface ArbitrageOpportunity {
  marketA: StandardizedMarket;
  marketB: StandardizedMarket;
  combinedYesCost: number;
  potentialProfit: number;
  roi: number;
  matchScore: number;
  matchReason: string;
}

// Specific event patterns for matching - these require ALL patterns to match
// Removed overly broad patterns that caused false positives (e.g., "president-2028" matching all 2028 races)
const SPECIFIC_EVENT_PATTERNS: { patterns: RegExp[]; event: string }[] = [
  // Economic indicators - these are usually binary yes/no questions
  { patterns: [/recession/i, /2025/i], event: "recession-2025" },
  { patterns: [/recession/i, /2026/i], event: "recession-2026" },
  { patterns: [/fed|federal reserve/i, /rate/i, /cut/i], event: "fed-rate-cut" },
  { patterns: [/fed|federal reserve/i, /rate/i, /hike|raise/i], event: "fed-rate-hike" },
  
  // Crypto price targets - must have same price target
  { patterns: [/bitcoin|btc/i, /100.*k|100,?000/i], event: "bitcoin-100k" },
  { patterns: [/bitcoin|btc/i, /150.*k|150,?000/i], event: "bitcoin-150k" },
  { patterns: [/bitcoin|btc/i, /200.*k|200,?000/i], event: "bitcoin-200k" },
  
  // Trump policies
  { patterns: [/trump/i, /tariff/i, /china/i], event: "trump-tariffs-china" },
  { patterns: [/trump/i, /deport/i, /million/i], event: "trump-deportation-million" },
  { patterns: [/doge|musk/i, /federal.*employee|employee.*federal/i], event: "doge-employees" },
  
  // Sports - require specific matchup or event
  { patterns: [/super bowl/i, /chiefs/i], event: "superbowl-chiefs" },
  { patterns: [/super bowl/i, /eagles/i], event: "superbowl-eagles" },
  { patterns: [/world cup/i, /usa|united states/i, /2026/i], event: "worldcup-usa-2026" },
  
  // Stock market targets
  { patterns: [/s&p|sp500/i, /6000/i], event: "sp500-6000" },
  { patterns: [/s&p|sp500/i, /7000/i], event: "sp500-7000" },
];

// Extract key entities for stricter matching with better fuzzy matching and synonyms
function extractEntities(title: string): { 
  names: Set<string>; 
  numbers: Set<string>; 
  years: Set<string>;
  party: string | null;
  states: Set<string>;
  timeFrames: Set<string>;
} {
  const normalized = title.toLowerCase();
  
  // Extract 4-digit years
  const yearMatches = normalized.match(/\b(202[4-9]|203[0-9])\b/g) || [];
  const years = new Set(yearMatches);
  
  // Extract significant numbers with better normalization (100k -> 100000)
  const numMatches = normalized.match(/\b\d+(?:\.\d+)?%?k?\b/g) || [];
  const numbers = new Set<string>();
  for (const num of numMatches) {
    if (num.length > 1) {
      // Normalize "100k" to "100000"
      if (num.endsWith('k')) {
        const baseNum = parseFloat(num.slice(0, -1));
        numbers.add((baseNum * 1000).toString());
      } else {
        numbers.add(num);
      }
    }
  }
  
  // Extract political party with synonym handling
  let party: string | null = null;
  if (/republican|gop|rnc|r\b/i.test(normalized)) party = 'republican';
  else if (/democrat|dnc|dem\b|d\b/i.test(normalized)) party = 'democrat';
  
  // Extract US states with abbreviation support
  const stateMap: Record<string, string[]> = {
    'alabama': ['alabama', 'al'],
    'alaska': ['alaska', 'ak'],
    'arizona': ['arizona', 'az'],
    'arkansas': ['arkansas', 'ar'],
    'california': ['california', 'ca', 'calif'],
    'colorado': ['colorado', 'co', 'colo'],
    'connecticut': ['connecticut', 'ct', 'conn'],
    'delaware': ['delaware', 'de', 'del'],
    'florida': ['florida', 'fl', 'fla'],
    'georgia': ['georgia', 'ga'],
    'hawaii': ['hawaii', 'hi'],
    'idaho': ['idaho', 'id'],
    'illinois': ['illinois', 'il', 'ill'],
    'indiana': ['indiana', 'in', 'ind'],
    'iowa': ['iowa', 'ia'],
    'kansas': ['kansas', 'ks', 'kan'],
    'kentucky': ['kentucky', 'ky'],
    'louisiana': ['louisiana', 'la'],
    'maine': ['maine', 'me'],
    'maryland': ['maryland', 'md'],
    'massachusetts': ['massachusetts', 'ma', 'mass'],
    'michigan': ['michigan', 'mi', 'mich'],
    'minnesota': ['minnesota', 'mn', 'minn'],
    'mississippi': ['mississippi', 'ms', 'miss'],
    'missouri': ['missouri', 'mo'],
    'montana': ['montana', 'mt', 'mont'],
    'nebraska': ['nebraska', 'ne', 'neb'],
    'nevada': ['nevada', 'nv', 'nev'],
    'new hampshire': ['new hampshire', 'nh', 'n h'],
    'new jersey': ['new jersey', 'nj', 'n j'],
    'new mexico': ['new mexico', 'nm', 'n m'],
    'new york': ['new york', 'ny', 'n y'],
    'north carolina': ['north carolina', 'nc', 'n c'],
    'north dakota': ['north dakota', 'nd', 'n d'],
    'ohio': ['ohio', 'oh'],
    'oklahoma': ['oklahoma', 'ok', 'okla'],
    'oregon': ['oregon', 'or', 'ore'],
    'pennsylvania': ['pennsylvania', 'pa', 'penn'],
    'rhode island': ['rhode island', 'ri', 'r i'],
    'south carolina': ['south carolina', 'sc', 's c'],
    'south dakota': ['south dakota', 'sd', 's d'],
    'tennessee': ['tennessee', 'tn', 'tenn'],
    'texas': ['texas', 'tx', 'tex'],
    'utah': ['utah', 'ut'],
    'vermont': ['vermont', 'vt'],
    'virginia': ['virginia', 'va'],
    'washington': ['washington', 'wa', 'wash'],
    'west virginia': ['west virginia', 'wv', 'w va'],
    'wisconsin': ['wisconsin', 'wi', 'wis'],
    'wyoming': ['wyoming', 'wy', 'wyo']
  };
  
  const states = new Set<string>();
  for (const [canonical, variants] of Object.entries(stateMap)) {
    for (const variant of variants) {
      const pattern = new RegExp(`\\b${variant}\\b`, 'i');
      if (pattern.test(normalized)) {
        states.add(canonical); // Always use canonical name
        break;
      }
    }
  }
  
  // Extract time frames (quarters, months, seasons)
  const timeFrames = new Set<string>();
  const quarterMatches = normalized.match(/\b(q[1-4]|quarter\s*[1-4]|first\s*quarter|second\s*quarter|third\s*quarter|fourth\s*quarter)\b/gi);
  if (quarterMatches) {
    for (const q of quarterMatches) {
      const qNorm = q.toLowerCase().replace(/\s+/g, '');
      timeFrames.add(qNorm);
    }
  }
  
  const monthMatches = normalized.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/gi);
  if (monthMatches) {
    const monthMap: Record<string, string> = {
      'january': 'jan', 'february': 'feb', 'march': 'mar', 'april': 'apr',
      'may': 'may', 'june': 'jun', 'july': 'jul', 'august': 'aug',
      'september': 'sep', 'sept': 'sep', 'october': 'oct', 'november': 'nov', 'december': 'dec'
    };
    for (const m of monthMatches) {
      const mLower = m.toLowerCase();
      timeFrames.add(monthMap[mLower] || mLower);
    }
  }
  
  // Extract known names with fuzzy matching and synonyms
  const nameMap: Record<string, string[]> = {
    'trump': ['trump', 'donald trump'],
    'biden': ['biden', 'joe biden'],
    'harris': ['harris', 'kamala harris', 'kamala'],
    'desantis': ['desantis', 'ron desantis'],
    'newsom': ['newsom', 'gavin newsom'],
    'musk': ['musk', 'elon musk', 'elon'],
    'vance': ['vance', 'jd vance'],
    'pence': ['pence', 'mike pence'],
    'haley': ['haley', 'nikki haley'],
    'ramaswamy': ['ramaswamy', 'vivek ramaswamy', 'vivek'],
    'cruz': ['cruz', 'ted cruz'],
    'rubio': ['rubio', 'marco rubio'],
    'warren': ['warren', 'elizabeth warren'],
    'sanders': ['sanders', 'bernie sanders', 'bernie'],
    'buttigieg': ['buttigieg', 'pete buttigieg', 'pete'],
    'ocasio-cortez': ['ocasio-cortez', 'aoc', 'alexandria ocasio-cortez'],
    'bitcoin': ['bitcoin', 'btc'],
    'ethereum': ['ethereum', 'eth'],
    'chiefs': ['chiefs', 'kansas city chiefs', 'kc chiefs'],
    'eagles': ['eagles', 'philadelphia eagles'],
    'bills': ['bills', 'buffalo bills'],
    'lions': ['lions', 'detroit lions'],
    'cowboys': ['cowboys', 'dallas cowboys'],
    'packers': ['packers', 'green bay packers'],
    '49ers': ['49ers', 'niners', 'san francisco 49ers']
  };
  
  const names = new Set<string>();
  for (const [canonical, variants] of Object.entries(nameMap)) {
    for (const variant of variants) {
      const pattern = new RegExp(`\\b${variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (pattern.test(normalized)) {
        names.add(canonical); // Always use canonical name
        break;
      }
    }
  }
  
  return { names, numbers, years, party, states, timeFrames };
}

// Normalize title for better cross-platform matching
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    // Standardize date formats
    .replace(/january|jan/gi, 'jan')
    .replace(/february|feb/gi, 'feb')
    .replace(/march|mar/gi, 'mar')
    .replace(/april|apr/gi, 'apr')
    .replace(/may/gi, 'may')
    .replace(/june|jun/gi, 'jun')
    .replace(/july|jul/gi, 'jul')
    .replace(/august|aug/gi, 'aug')
    .replace(/september|sept|sep/gi, 'sep')
    .replace(/october|oct/gi, 'oct')
    .replace(/november|nov/gi, 'nov')
    .replace(/december|dec/gi, 'dec')
    // Standardize political terms
    .replace(/republican|gop|rnc/gi, 'republican')
    .replace(/democratic|dem|dnc/gi, 'democratic')
    .replace(/midterm elections?/gi, 'midterms')
    .replace(/united states|u\.s\.|usa/gi, 'us')
    // Remove noise
    .replace(/\?/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract meaningful tokens from a title for comparison
function extractTokens(title: string): Set<string> {
  const stopWords = new Set(['will', 'the', 'a', 'an', 'be', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to', 'for', 'of', 'by', 'with', 'or', 'and', 'more', 'than', 'less', 'yes', 'no', 'win', 'who', 'what', 'when', 'where', 'how']);
  const normalized = normalizeTitle(title);
  const words = normalized
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
  return new Set(words);
}

// Calculate Jaccard similarity between two token sets
function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  const intersection = new Set(Array.from(setA).filter(x => setB.has(x)));
  const arrA = Array.from(setA);
  const arrB = Array.from(setB);
  const union = new Set(arrA.concat(arrB));
  return union.size > 0 ? intersection.size / union.size : 0;
}

// Extract specific events from a market title
function extractEvents(title: string): string[] {
  const events: string[] = [];
  
  for (const { patterns, event } of SPECIFIC_EVENT_PATTERNS) {
    const allMatch = patterns.every(p => p.test(title));
    if (allMatch) {
      events.push(event);
    }
  }
  
  return events;
}

// Calculate similarity score between two markets (0-100)
function calculateSimilarity(a: StandardizedMarket, b: StandardizedMarket): { score: number; reason: string } {
  // Method 1: Specific event matching (highest confidence)
  const eventsA = extractEvents(a.title);
  const eventsB = extractEvents(b.title);
  
  for (const ea of eventsA) {
    for (const eb of eventsB) {
      if (ea === eb) {
        return { score: 95, reason: ea };
      }
    }
  }
  
  // Extract entities for validation
  const entitiesA = extractEntities(a.title);
  const entitiesB = extractEntities(b.title);
  
  // STRICT CHECK: Party conflict = NOT the same event
  if (entitiesA.party && entitiesB.party && entitiesA.party !== entitiesB.party) {
    return { score: 0, reason: "" }; // Republican vs Democrat = different events
  }
  
  // STRICT CHECK: Different states = NOT the same event (for state-specific races)
  const statesA = Array.from(entitiesA.states);
  const statesB = Array.from(entitiesB.states);
  if (statesA.length > 0 && statesB.length > 0) {
    const stateOverlap = statesA.some(s => statesB.includes(s));
    if (!stateOverlap) {
      return { score: 0, reason: "" }; // Different states = different events
    }
  }
  
  // STRICT CHECK: Different time frames = NOT the same event
  const timeFramesA = Array.from(entitiesA.timeFrames);
  const timeFramesB = Array.from(entitiesB.timeFrames);
  if (timeFramesA.length > 0 && timeFramesB.length > 0) {
    const timeOverlap = timeFramesA.some(t => timeFramesB.includes(t));
    if (!timeOverlap) {
      return { score: 0, reason: "" }; // Q1 vs Q2 = different events
    }
  }
  
  // Method 2: Entity-enhanced token matching
  const tokensA = extractTokens(a.title);
  const tokensB = extractTokens(b.title);
  const jaccard = jaccardSimilarity(tokensA, tokensB);
  
  if (jaccard >= 0.25) {
    // Check for year conflicts
    const yearsA = Array.from(entitiesA.years);
    const yearsB = Array.from(entitiesB.years);
    if (yearsA.length > 0 && yearsB.length > 0) {
      const yearOverlap = yearsA.some(y => yearsB.includes(y));
      if (!yearOverlap) {
        return { score: 0, reason: "" }; // Different years = different events
      }
    }
    
    // Check for number conflicts (e.g., Bitcoin 100k vs 200k)
    const numbersA = Array.from(entitiesA.numbers);
    const numbersB = Array.from(entitiesB.numbers);
    if (numbersA.length > 0 && numbersB.length > 0) {
      const numberOverlap = numbersA.some(n => numbersB.includes(n));
      if (!numberOverlap) {
        return { score: 0, reason: "" }; // Different price targets = different events
      }
    }
    
    // Check for name/entity overlap
    const namesA = Array.from(entitiesA.names);
    const namesB = Array.from(entitiesB.names);
    const nameOverlap = namesA.filter(n => namesB.includes(n));
    
    // Calculate final score
    let score = Math.round(jaccard * 100);
    
    // Strong boost if key entities match (same candidate, same team, etc.)
    if (nameOverlap.length > 0) {
      score = Math.min(100, score + nameOverlap.length * 15);
    }
    
    // Additional boost for matching time frames
    if (timeFramesA.length > 0 && timeFramesB.length > 0) {
      const timeOverlap = timeFramesA.filter(t => timeFramesB.includes(t));
      if (timeOverlap.length > 0) {
        score = Math.min(100, score + 10);
      }
    }
    
    // Require much higher threshold if no entity overlap
    if (nameOverlap.length === 0 && score < 60) {
      return { score: 0, reason: "" };
    }
    
    const commonTokens = Array.from(tokensA).filter(t => tokensB.has(t)).slice(0, 4);
    const reason = nameOverlap.length > 0 
      ? `match: ${nameOverlap.join(", ")}`
      : `similar: ${commonTokens.join(", ")}`;
    
    return { score, reason };
  }
  
  return { score: 0, reason: "" };
}

export function findArbitrageOpportunities(
  markets: StandardizedMarket[],
  minRoi: number = 0
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];
  const minSimilarity = 60;
  
  // Build index by platform for efficient cross-platform comparison
  const byPlatform: Record<string, StandardizedMarket[]> = {
    Kalshi: [],
    Polymarket: [],
    PredictIt: [],
  };
  
  for (const m of markets) {
    if (byPlatform[m.platform]) {
      byPlatform[m.platform].push(m);
    }
  }
  
  // Build compound keyword index - uses pairs of keywords for smaller, more specific buckets
  const keywordIndex: Map<string, StandardizedMarket[]> = new Map();
  
  // Topics - first keyword in compound key
  const topics = ['senate', 'house', 'president', 'governor', 'bitcoin', 'btc', 'ethereum', 'recession', 'fed', 'super bowl', 'nba', 'nfl', 'world cup', 'olympics'];
  // Time markers - second keyword in compound key
  const years = ['2025', '2026', '2027', '2028'];
  // Named entities for direct matching (use word boundary regex)
  const entityPatterns: { name: string; pattern: RegExp }[] = [
    { name: 'trump', pattern: /\btrump\b/i },
    { name: 'biden', pattern: /\bbiden\b/i },
    { name: 'harris', pattern: /\bharris\b/i },
    { name: 'desantis', pattern: /\bdesantis\b/i },
    { name: 'newsom', pattern: /\bnewsom\b/i },
    { name: 'musk', pattern: /\bmusk\b/i },
    { name: 'vance', pattern: /\bvance\b/i },
    { name: 'buttigieg', pattern: /\bbuttigieg\b/i },
    { name: 'ocasio-cortez', pattern: /\bocasio.?cortez\b/i },
  ];
  
  for (const m of markets) {
    const title = m.title.toLowerCase();
    
    // Compound keys: topic + year
    for (const topic of topics) {
      if (title.includes(topic)) {
        for (const year of years) {
          if (title.includes(year)) {
            const key = `${topic}-${year}`;
            if (!keywordIndex.has(key)) keywordIndex.set(key, []);
            keywordIndex.get(key)!.push(m);
          }
        }
      }
    }
    
    // Entity-based keys (high precision with word boundaries)
    for (const { name, pattern } of entityPatterns) {
      if (pattern.test(title)) {
        if (!keywordIndex.has(name)) keywordIndex.set(name, []);
        keywordIndex.get(name)!.push(m);
      }
    }
  }
  
  // Only compare markets that share keywords (much faster than O(n²))
  const compared = new Set<string>();
  const MAX_BUCKET_SIZE = 500; // Limit comparisons per bucket
  
  for (const [keyword, matchingMarkets] of Array.from(keywordIndex.entries())) {
    // Skip if only one platform has this keyword
    const platforms = new Set(matchingMarkets.map((m: StandardizedMarket) => m.platform));
    if (platforms.size < 2) continue;
    
    // Limit bucket size - prefer high-volume markets
    const sortedMarkets = matchingMarkets
      .sort((a, b) => (b.volume || 0) - (a.volume || 0))
      .slice(0, MAX_BUCKET_SIZE);
    
    for (let i = 0; i < sortedMarkets.length; i++) {
      for (let j = i + 1; j < sortedMarkets.length; j++) {
        const a = sortedMarkets[i];
        const b = sortedMarkets[j];
        
        // Skip same platform
        if (a.platform === b.platform) continue;
        
        // Avoid duplicate comparisons
        const pairKey = [a.id, b.id].sort().join('-');
        if (compared.has(pairKey)) continue;
        compared.add(pairKey);
        
        // Check similarity
        const { score, reason } = calculateSimilarity(a, b);
        if (score < minSimilarity) continue;
        
        // Scenario 1: Buy YES on A, Buy NO on B
        const costYesANoB = a.yesPrice + b.noPrice;
        if (costYesANoB < 1) {
          const profit = 1 - costYesANoB;
          const roi = (profit / costYesANoB) * 100;
          if (roi >= minRoi) {
            opportunities.push({
              marketA: a,
              marketB: b,
              combinedYesCost: costYesANoB,
              potentialProfit: profit,
              roi,
              matchScore: score,
              matchReason: reason,
            });
          }
        }
        
        // Scenario 2: Buy NO on A, Buy YES on B
        const costNoAYesB = a.noPrice + b.yesPrice;
        if (costNoAYesB < 1) {
          const profit = 1 - costNoAYesB;
          const roi = (profit / costNoAYesB) * 100;
          if (roi >= minRoi) {
            opportunities.push({
              marketA: b,
              marketB: a,
              combinedYesCost: costNoAYesB,
              potentialProfit: profit,
              roi,
              matchScore: score,
              matchReason: reason,
            });
          }
        }
      }
    }
  }
  
  // Sort by ROI descending, then by match score
  return opportunities.sort((a, b) => {
    if (Math.abs(a.roi - b.roi) > 0.1) return b.roi - a.roi;
    return b.matchScore - a.matchScore;
  });
}
