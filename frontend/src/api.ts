// API client for CIRCLE.
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";

let cachedToken: string | null = null;

export async function setToken(token: string | null) {
  cachedToken = token;
  if (token) await AsyncStorage.setItem("circle.token", token);
  else await AsyncStorage.removeItem("circle.token");
}

export async function getToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  cachedToken = await AsyncStorage.getItem("circle.token");
  return cachedToken;
}

async function req(path: string, opts: RequestInit = {}) {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, { ...opts, headers });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j.detail || msg;
    } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  signup: (body: any) => req("/auth/signup", { method: "POST", body: JSON.stringify(body) }),
  login: (body: any) => req("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => req("/auth/me"),
  verifyStudent: () => req("/auth/verify-student", { method: "POST" }),

  saveOnboarding: (body: any) => req("/onboarding", { method: "POST", body: JSON.stringify(body) }),

  getMatches: () => req("/matches"),
  getUser: (id: string) => req(`/users/${id}`),
  listUsers: (q?: string) => req(`/users${q ? `?q=${encodeURIComponent(q)}` : ""}`),

  listEvents: (params: { category?: string; q?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.category) qs.set("category", params.category);
    if (params.q) qs.set("q", params.q);
    const s = qs.toString();
    return req(`/events${s ? `?${s}` : ""}`);
  },
  getEvent: (id: string) => req(`/events/${id}`),
  createEvent: (body: any) => req("/events", { method: "POST", body: JSON.stringify(body) }),
  rsvp: (id: string, status: "interested" | "going" | "none") =>
    req(`/events/${id}/rsvp?status=${status}`, { method: "POST" }),
  eventAttendees: (id: string) => req(`/events/${id}/attendees`),

  listCircles: (mine = false) => req(`/circles${mine ? "?mine=true" : ""}`),
  listDMs: () => req("/circles?dm=true"),
  getLounge: () => req("/lounge"),
  getCircle: (id: string) => req(`/circles/${id}`),
  createCircle: (body: any) => req("/circles", { method: "POST", body: JSON.stringify(body) }),
  joinCircle: (id: string) => req(`/circles/${id}/join`, { method: "POST" }),
  leaveCircle: (id: string) => req(`/circles/${id}/leave`, { method: "POST" }),

  getMessages: (id: string, since?: string) =>
    req(`/circles/${id}/messages${since ? `?since=${encodeURIComponent(since)}` : ""}`),
  sendMessage: (id: string, content: string) =>
    req(`/circles/${id}/messages`, { method: "POST", body: JSON.stringify({ content }) }),

  listRecommendations: (q?: string) => req(`/recommendations${q ? `?q=${encodeURIComponent(q)}` : ""}`),

  // Connections (1:1)
  requestConnection: (userId: string) => req(`/connections/${userId}`, { method: "POST" }),
  listConnections: () => req("/connections"),
  acceptConnection: (id: string) => req(`/connections/${id}/accept`, { method: "POST" }),
  declineConnection: (id: string) => req(`/connections/${id}/decline`, { method: "POST" }),

  // Weekend digest + reminders
  weekendDigest: () => req("/digest/weekend"),
  reminders: () => req("/reminders"),
  dismissReminder: (eventId: string) => req(`/reminders/${eventId}/dismiss`, { method: "POST" }),
  createRecommendation: (body: any) =>
    req("/recommendations", { method: "POST", body: JSON.stringify(body) }),

  listClubs: () => req("/clubs"),
  getClub: (id: string) => req(`/clubs/${id}`),

  report: (body: any) => req("/reports", { method: "POST", body: JSON.stringify(body) }),
  block: (userId: string) => req(`/block/${userId}`, { method: "POST" }),

  uploadImage: async (uri: string): Promise<{ path: string; url: string }> => {
    const token = await getToken();
    const form = new FormData();
    const name = `photo-${Date.now()}.jpg`;
    // Platform-specific body shape
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      const blob = await (await fetch(uri)).blob();
      form.append("file", blob, name);
    } else {
      form.append("file", { uri, name, type: "image/jpeg" } as any);
    }
    const res = await fetch(`${BASE}/api/upload`, {
      method: "POST",
      body: form as any,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    const j = await res.json();
    return { path: j.path, url: `${BASE}${j.url}?token=${token}` };
  },
};

export function fileUrl(url: string | null | undefined, token: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${BASE}${url}${token ? `?token=${token}` : ""}`;
}
