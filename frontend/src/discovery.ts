// Events are saved as a campus-local YYYY-MM-DD date and a separate time.
// Compare calendar values in Los Angeles so travel and UTC parsing cannot shift a day.
export const CAMPUS_TIME_ZONE = "America/Los_Angeles";
const campusFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CAMPUS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

type Searchable = {
  title?: string; name?: string; first_name?: string; last_name?: string;
  category?: string; description?: string; location?: string; major?: string;
  interests?: string[]; tags?: string[];
};
export type DiscoveryEvent = Searchable & { date?: string; time?: string };

export const vibeTerms: Record<string, string[]> = {
  Food: ["food", "eat", "restaurant", "cafe", "coffee", "dining"],
  Study: ["study", "library", "academic", "homework", "school"],
  Active: ["active", "fitness", "gym", "sport", "basketball", "soccer", "run", "hike", "hiking"],
  Gaming: ["gaming", "game", "esports", "video game"],
  Creative: ["creative", "art", "design", "photo", "film", "writing"],
  Music: ["music", "concert", "band", "dj", "sing"],
  Social: ["social", "party", "hangout", "meet", "community"],
  Explore: ["explore", "adventure", "trip", "outdoor", "travel"],
};

export function discoveryText(item: Searchable): string {
  return [item.title, item.name, item.first_name, item.last_name, item.category,
    item.description, item.location, item.major, ...(item.interests || []), ...(item.tags || [])]
    .filter(Boolean).join(" ").toLowerCase();
}

export function matchesSearch(item: Searchable, query: string): boolean {
  const text = discoveryText(item);
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean).every(term => text.includes(term));
}

export function matchesVibe(item: Searchable, vibe: string): boolean {
  return (vibeTerms[vibe] || []).some(term => discoveryText(item).includes(term));
}

export function relevance(item: Searchable, interests: string[]): number {
  const text = discoveryText(item);
  return interests.reduce((score, interest) => score + (text.includes(interest.toLowerCase()) ? 1 : 0), 0);
}

export function timeMinutes(value: string | undefined): number | null {
  const time = (value || "").trim().toUpperCase().replace(/\./g, "");
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/.exec(time);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  if (minute > 59) return null;
  if (match[3]) {
    if (hour < 1 || hour > 12) return null;
    hour = hour % 12 + (match[3] === "PM" ? 12 : 0);
  } else if (!match[2] || hour > 23) return null;
  return hour * 60 + minute;
}

export function campusClock(now = new Date()): { date: string; minutes: number } {
  const parts = campusFormatter.formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return { date: `${part("year")}-${part("month")}-${part("day")}`,
    minutes: Number(part("hour")) * 60 + Number(part("minute")) };
}

function validDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isUpcoming(event: DiscoveryEvent, now = new Date()): boolean {
  if (!validDate(event.date)) return false;
  const clock = campusClock(now);
  if (event.date !== clock.date) return event.date > clock.date;
  const minutes = timeMinutes(event.time);
  // Keep today's events with a free-form time discoverable, but don't invent a start time.
  return minutes === null || minutes >= clock.minutes;
}

export function isTonight(event: DiscoveryEvent, now = new Date()): boolean {
  const clock = campusClock(now);
  const minutes = timeMinutes(event.time);
  return event.date === clock.date && minutes !== null && minutes >= Math.max(17 * 60, clock.minutes);
}

export function isThisWeek(event: DiscoveryEvent, now = new Date()): boolean {
  if (!isUpcoming(event, now)) return false;
  const end = new Date(`${campusClock(now).date}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  return event.date! <= end.toISOString().slice(0, 10);
}

export function chronological(a: DiscoveryEvent, b: DiscoveryEvent): number {
  return (a.date || "").localeCompare(b.date || "") ||
    (timeMinutes(a.time) ?? 1440) - (timeMinutes(b.time) ?? 1440);
}

export function visibleKinds(filter: string) {
  const timed = filter === "Tonight" || filter === "This Week";
  const category = ["People", "Events", "Clubs"].includes(filter);
  return { events: filter === "Events" || !category,
    people: filter === "People" || (!category && !timed),
    clubs: filter === "Clubs" || (!category && !timed),
    recommendations: !category && !timed };
}

export type HomeEvent = DiscoveryEvent & {
  id: string;
  my_status?: string | null;
  cover_image_url?: string | null;
  going_count?: number;
};
export type HomeEventCard = {
  event: HomeEvent;
  kind: "going" | "interested" | "recommended" | "explore";
  reason: string;
};

// Keep personal plans and fresh suggestions represented, even when one group is large.
export function rankHomeEvents(events: HomeEvent[], interests: string[], now = new Date()): HomeEventCard[] {
  const unique = [...new Map(events.map(event => [event.id, event])).values()];
  const upcoming = unique.filter(event => isUpcoming(event, now));
  const isPicked = (event: HomeEvent) => event.my_status === "going" || event.my_status === "interested";
  const picked = unique.filter(isPicked);
  const normalize = (value: string) => value.trim().toLowerCase();
  const meaningful = (value: string) => value && !["other", "general", "event", "events"].includes(value);
  const chosenCategories = new Set(picked.map(event => normalize(event.category || "")).filter(meaningful));
  const chosenTags = new Set(picked.flatMap(event => event.tags || []).map(normalize).filter(meaningful));
  const explicit = [...new Map(interests.filter(interest => interest.trim()).map(interest => [normalize(interest), interest.trim()])).values()];

  const personal: HomeEventCard[] = upcoming.filter(isPicked).sort(chronological).map(event => ({
    event, kind: event.my_status === "going" ? "going" : "interested",
    reason: event.my_status === "going" ? "Your plan is saved. See who's going and get your crew together." : "You marked this one Interested. See the details and decide if you're going.",
  }));
  const suggestions = upcoming.filter(event => !isPicked(event)).map(event => {
    const text = discoveryText(event);
    const shared = explicit.filter(interest => text.includes(normalize(interest)));
    const sameCategory = chosenCategories.has(normalize(event.category || ""));
    const sharedTags = (event.tags || []).filter(tag => chosenTags.has(normalize(tag)));
    const score = shared.length * 4 + (sameCategory ? 3 : 0) + Math.min(3, sharedTags.length) * 2;
    const reason = shared.length ? `Because you like ${shared.slice(0, 2).join(" and ")}`
      : sameCategory || sharedTags.length ? "Similar to events you've marked Interested or Going"
      : "Something new to explore around campus";
    return { event, kind: score > 0 ? "recommended" as const : "explore" as const, reason, score };
  }).sort((a, b) => b.score - a.score || chronological(a.event, b.event));

  const cards: HomeEventCard[] = [];
  for (let i = 0; i < Math.max(personal.length, suggestions.length); i++) {
    if (personal[i]) cards.push(personal[i]);
    if (suggestions[i]) cards.push(suggestions[i]);
  }
  return cards;
}

export type HomeFeedItem<T> = { type: "post"; key: string; post: T }
  | { type: "event"; key: string; card: HomeEventCard };

export function mixHomeFeed<T extends { id: string }>(posts: T[], events: HomeEventCard[]): HomeFeedItem<T>[] {
  const feed: HomeFeedItem<T>[] = [];
  const uniquePosts = [...new Map(posts.map(post => [post.id, post])).values()];
  const uniqueEvents = [...new Map(events.map(card => [card.event.id, card])).values()];
  let postIndex = 0;
  let eventIndex = 0;
  while (postIndex < uniquePosts.length || eventIndex < uniqueEvents.length) {
    for (let i = 0; i < 2 && postIndex < uniquePosts.length; i++) {
      const post = uniquePosts[postIndex++];
      feed.push({ type: "post", key: `post-${post.id}`, post });
    }
    if (eventIndex < uniqueEvents.length) {
      const card = uniqueEvents[eventIndex++];
      feed.push({ type: "event", key: `event-${card.event.id}`, card });
    }
  }
  return feed;
}

export function eventDayLabel(date: string | undefined, now = new Date()): string {
  if (!validDate(date)) return "Date to be confirmed";
  const today = campusClock(now).date;
  if (date === today) return "Today";
  const tomorrow = new Date(`${today}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (date === tomorrow.toISOString().slice(0, 10)) return "Tomorrow";
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" })
    .format(new Date(`${date}T12:00:00Z`));
}
