// Run with Node 22.18+ / 24+: node --test tests/home-feed.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { rankHomeEvents, mixHomeFeed, eventDayLabel } from "../src/discovery.ts";

const now = new Date("2026-10-02T19:00:00Z"); // Noon on campus
const event = (id, extra = {}) => ({ id, title: id, date: "2026-10-03", time: "7 PM", ...extra });

test("events remain visible with zero, one or two posts", () => {
  const cards = rankHomeEvents([event("a"), event("b")], [], now);
  for (const count of [0, 1, 2]) {
    const posts = Array.from({ length: count }, (_, i) => ({ id: `post-${i}` }));
    const feed = mixHomeFeed(posts, cards);
    assert.equal(feed.filter(item => item.type === "event").length, 2);
    assert.equal(feed.filter(item => item.type === "post").length, count);
    assert.ok(feed.findIndex(item => item.type === "event") <= 2);
  }
});

test("both personal RSVP states and fresh suggestions appear near the top", () => {
  const cards = rankHomeEvents([
    event("joined", { my_status: "going", date: "2026-10-02" }),
    event("considering", { my_status: "interested" }),
    event("music", { tags: ["Music"] }),
    event("explore", { date: "2026-10-02", time: "1 PM" }),
  ], ["Music"], now);
  assert.deepEqual(cards.map(card => card.kind), ["going", "recommended", "interested", "explore"]);
  assert.equal(cards[1].event.id, "music");
  assert.match(cards[1].reason, /Music/);
});

test("recommendations use saved event categories and tags without inventing shared interests", () => {
  const cards = rankHomeEvents([
    event("saved", { my_status: "interested", category: "Gaming", tags: ["board games"] }),
    event("related", { category: "Gaming", tags: ["board games"] }),
    event("unrelated", { category: "Food" }),
  ], [], now);
  assert.equal(cards.find(card => card.event.id === "related").kind, "recommended");
  assert.match(cards.find(card => card.event.id === "related").reason, /Interested or Going/);
  assert.equal(cards.find(card => card.event.id === "unrelated").kind, "explore");
});

test("returning after an RSVP change replaces the label without duplicating the event", () => {
  for (const [status, kind] of [[null, "explore"], ["interested", "interested"], ["going", "going"], ["none", "explore"]]) {
    const item = event("same", { my_status: status });
    const cards = rankHomeEvents([item, item], [], now);
    assert.equal(cards.length, 1);
    assert.equal(cards[0].kind, kind);
  }
});

test("past events drop out and the soonest personal plan appears first", () => {
  const cards = rankHomeEvents([
    event("yesterday", { date: "2026-10-01", my_status: "going" }),
    event("already-started", { date: "2026-10-02", time: "9 AM", my_status: "interested" }),
    event("later", { date: "2026-10-05", my_status: "going" }),
    event("soon", { my_status: "interested" }),
  ], [], now);
  assert.deepEqual(cards.map(card => card.event.id), ["soon", "later"]);
});

test("mixing preserves post order, unique keys and connections-only input", () => {
  const posts = [{ id: "same" }, { id: "two" }, { id: "three" }];
  const cards = rankHomeEvents([event("same")], [], now);
  const feed = mixHomeFeed(posts, cards);
  assert.deepEqual(feed.filter(item => item.type === "post").map(item => item.post.id), posts.map(post => post.id));
  assert.equal(new Set(feed.map(item => item.key)).size, feed.length);
  assert.equal(mixHomeFeed(posts, []).some(item => item.type === "event"), false);
});

test("event day labels use campus dates across month boundaries", () => {
  const late = new Date("2026-11-01T05:00:00Z"); // Oct 31 at 10 PM
  assert.equal(eventDayLabel("2026-10-31", late), "Today");
  assert.equal(eventDayLabel("2026-11-01", late), "Tomorrow");
  assert.equal(eventDayLabel("2026-02-30", late), "Date to be confirmed");
});
