// Run with Node 22.18+ / 24+: node --test tests/discovery.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { campusClock, timeMinutes, isTonight, isThisWeek, isUpcoming,
  chronological, matchesSearch, visibleKinds } from "../src/discovery.ts";

test("Tonight combines the saved date and time in Los Angeles, even after UTC midnight", () => {
  const now = new Date("2026-10-03T01:30:00Z"); // Oct 2, 6:30 PM on campus
  assert.deepEqual(campusClock(now), { date: "2026-10-02", minutes: 1110 });
  assert.equal(isTonight({ date: "2026-10-02", time: "7:00 PM" }, now), true);
  assert.equal(isTonight({ date: "2026-10-02", time: "18:00" }, now), false);
  assert.equal(isTonight({ date: "2026-10-03", time: "7 PM" }, now), false);
  assert.equal(isTonight({ date: "2026-10-02", time: "TBD" }, now), false);
});

test("12 AM, 12 PM, 24-hour and dotted times parse without guessing invalid times", () => {
  for (const [value, expected] of [["12 AM", 0], ["12PM", 720], ["7:30 p.m.", 1170],
    ["19:30", 1170], ["7 pm", 1140], ["24:00", null], ["7:75 PM", null],
    ["0 PM", null], ["13 PM", null], ["Tonight", null]]) {
    assert.equal(timeMinutes(value), expected, value);
  }
});

test("upcoming dates stay correct across the campus DST transition and midnight", () => {
  const now = new Date("2026-11-01T08:30:00Z");
  assert.equal(campusClock(now).date, "2026-11-01");
  assert.equal(isUpcoming({ date: "2026-10-31", time: "11 PM" }, now), false);
  assert.equal(isUpcoming({ date: "2026-11-01", time: "7 PM" }, now), true);
  assert.equal(isUpcoming({ date: "2026-11-01", time: "TBD" }, now), true);
  assert.equal(isUpcoming({ date: "2026-02-30", time: "7 PM" }, now), false);
  assert.equal(campusClock(new Date("2026-10-02T07:00:00Z")).minutes, 0);
});

test("This Week covers seven campus dates including today, with past start times excluded", () => {
  const now = new Date("2026-12-29T23:00:00Z"); // Dec 29, 3 PM
  assert.equal(isThisWeek({ date: "2026-12-29", time: "2 PM" }, now), false);
  assert.equal(isThisWeek({ date: "2026-12-29", time: "7 PM" }, now), true);
  assert.equal(isThisWeek({ date: "2027-01-04", time: "7 PM" }, now), true);
  assert.equal(isThisWeek({ date: "2027-01-05", time: "7 PM" }, now), false);
});

test("Happening soon uses clock order rather than sorting 12-hour times as text", () => {
  const events = ["12 PM", "9 AM", "7 PM", "TBD"].map(time => ({ date: "2026-10-02", time }));
  assert.deepEqual(events.sort(chronological).map(e => e.time), ["9 AM", "12 PM", "7 PM", "TBD"]);
});

test("search finds full names, interests, tags and locations regardless of case or spacing", () => {
  const person = { first_name: "Alex", last_name: "Rivera", interests: ["Photography"] };
  assert.equal(matchesSearch(person, "  ALEX   RIVERA "), true);
  assert.equal(matchesSearch(person, "photography"), true);
  assert.equal(matchesSearch(person, "gaming"), false);
  assert.equal(matchesSearch({ title: "Meetup", tags: ["coffee"], location: "Titan Union" }, "coffee union"), true);
});

test("a People empty state cannot be suppressed by unrelated event or club results", () => {
  const kinds = visibleKinds("People");
  const counts = { events: 5, people: 0, clubs: 3, recommendations: 1 };
  assert.equal(Object.keys(kinds).reduce((n, key) => n + (kinds[key] ? counts[key] : 0), 0), 0);
  assert.equal(visibleKinds("Tonight").people, false);
});
