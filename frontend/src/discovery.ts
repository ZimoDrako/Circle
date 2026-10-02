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
