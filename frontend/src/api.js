const BASE = "/api";

// Zentraler Fetch-Helfer: schickt immer das Session-Cookie mit und wirft
// bei Fehlern die Server-Meldung (statt einer generischen).
async function request(path, { method = "GET", body, headers } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: "include",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) data = await res.json().catch(() => null);

  if (!res.ok) {
    const err = new Error(data?.error || `Fehler ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// --- Auth ------------------------------------------------------------
// { user, registrationOpen }
export const getMe = () => request("/auth/me");
export const register = (payload) => request("/auth/register", { method: "POST", body: payload }).then((d) => d.user);
export const login = (email, password) =>
  request("/auth/login", { method: "POST", body: { email, password } }).then((d) => d.user);
export const logout = () => request("/auth/logout", { method: "POST" });
export const verifyEmail = (token) => request("/auth/verify", { method: "POST", body: { token } }).then((d) => d.user);
export const resendVerification = () => request("/auth/resend-verification", { method: "POST" });
export const requestPasswordReset = (email) =>
  request("/auth/request-reset", { method: "POST", body: { email } });
export const resetPassword = (token, password) =>
  request("/auth/reset", { method: "POST", body: { token, password } }).then((d) => d.user);
export const updateProfile = (displayName) =>
  request("/auth/me", { method: "PATCH", body: { displayName } }).then((d) => d.user);
export const deleteAccount = (password) =>
  request("/auth/account", { method: "DELETE", body: { password } });
export const exportDataUrl = `${BASE}/auth/export`;

// --- Karten-Suche / -Datenbank -------------------------------------
export const searchCards = (q) => request(`/cards/search?q=${encodeURIComponent(q)}`);
export const getCardInfo = (externalId) => request(`/cards/external/${externalId}`);
export const getCardPriceHistory = (externalId) => request(`/cards/external/${externalId}/prices`);
export const getPriceHistory = (cardId) => request(`/cards/${cardId}/prices`);
export const updateCardArtist = (externalId, artist) =>
  request(`/cards/external/${externalId}/artist`, { method: "PATCH", body: { artist } });
export const refreshCardPrice = (externalId) =>
  request(`/cards/external/${externalId}/refresh`, { method: "POST" });

// --- Sammlung -----------------------------------------------------
export const getCollection = () => request("/collection");
export const addToCollection = (payload) => request("/collection", { method: "POST", body: payload });
export const matchImportRows = (rows) => request("/collection/import/match", { method: "POST", body: { rows } });
export const commitImport = (items) => request("/collection/import/commit", { method: "POST", body: { items } });
export const updateCollectionItem = (id, payload) =>
  request(`/collection/${id}`, { method: "PATCH", body: payload });
export const deleteCollectionItem = (id) => request(`/collection/${id}`, { method: "DELETE" });
export const sellCollectionItem = (id, payload) =>
  request(`/collection/${id}/sell`, { method: "POST", body: payload });

// --- Portfolio & Verkäufe --------------------------------------------
export function getPortfolioHistory(filter = {}) {
  const qs = new URLSearchParams();
  if (filter.set) qs.set("set", filter.set);
  if (filter.language) qs.set("language", filter.language);
  if (filter.artist) qs.set("artist", filter.artist);
  return request(`/portfolio/history${qs.toString() ? `?${qs}` : ""}`);
}
export const getMovers = () => request("/portfolio/movers");
export const getSales = () => request("/sales");
export const deleteSale = (id) => request(`/sales/${id}`, { method: "DELETE" });
export const undoSale = (id) => request(`/sales/${id}/undo`, { method: "POST" });

// --- Sets --------------------------------------------------------
export const getSets = () => request("/sets");
export const getSet = (setId) => request(`/sets/${setId}`);
export const getCardsForSet = (setId) => request(`/sets/${setId}/cards`);
export const getSetProgress = () => request("/sets/progress");
export const getOwnedInSet = (setId) => request(`/sets/${setId}/owned`);

// --- Orden ---------------------------------------------------------
export const getAchievements = () => request("/achievements");

// --- Watchlist -----------------------------------------------------
export const getWatchlist = () => request("/watchlist");
export const getWatchlistIds = () => request("/watchlist/ids");
export const addToWatchlist = (externalId) =>
  request("/watchlist", { method: "POST", body: { externalId } });
export const removeFromWatchlist = (externalId) =>
  request(`/watchlist/${externalId}`, { method: "DELETE" });

// --- Markt-Statistik -------------------------------------------------
export const getMarketMovers = (days = 7, set = null) =>
  request(`/stats/market-movers?days=${days}${set ? `&set=${encodeURIComponent(set)}` : ""}`);
export const getTrackedSets = () => request("/stats/tracked-sets");
export const getWatchlistMovers = (days = 7) => request(`/stats/watchlist-movers?days=${days}`);
export const getSetMomentum = (days = 30) => request(`/stats/set-momentum?days=${days}`);
export const getThawing = () => request("/stats/thawing");
export const getSetsOverview = () => request("/stats/sets-overview");
