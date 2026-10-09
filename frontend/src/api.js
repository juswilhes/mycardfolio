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
export const getCardsByArtist = (artist) => request(`/cards/by-artist?name=${encodeURIComponent(artist)}`);
export const getCardInfo = (externalId) => request(`/cards/external/${externalId}`);
export const getCardPriceHistory = (externalId) => request(`/cards/external/${externalId}/prices`);
export const updateCardArtist = (externalId, artist) =>
  request(`/cards/external/${externalId}/artist`, { method: "PATCH", body: { artist } });

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
export const undoSale = (id) => request(`/sales/${id}/undo`, { method: "POST" });

// --- Sets --------------------------------------------------------
export const getSets = () => request("/sets");
export const getSet = (setId) => request(`/sets/${setId}`);
export const getCardsForSet = (setId) => request(`/sets/${setId}/cards`);
export const getSetProgress = () => request("/sets/progress");
export const getOwnedInSet = (setId) => request(`/sets/${setId}/owned`);
export const updateSetPrices = (setId, { boxEur, boosterEur }) =>
  request(`/sets/${setId}/prices`, { method: "PATCH", body: { boxEur, boosterEur } });
export const getPullRates = (setId) => request(`/sets/${setId}/pull-rates`);
export const updatePullRates = (setId, payload) =>
  request(`/sets/${setId}/pull-rates`, { method: "PATCH", body: payload });

// --- Orden ---------------------------------------------------------
export const getAchievements = () => request("/achievements");

// --- Watchlist -----------------------------------------------------
export const getWatchlist = () => request("/watchlist");
export const getWatchlistIds = () => request("/watchlist/ids");
export const addToWatchlist = (externalId) =>
  request("/watchlist", { method: "POST", body: { externalId } });
export const removeFromWatchlist = (externalId) =>
  request(`/watchlist/${externalId}`, { method: "DELETE" });

// --- Sealed Produkte -------------------------------------------------
export const getSealedProducts = () => request("/sealed-products");
export const addSealedProduct = (payload) => request("/sealed-products", { method: "POST", body: payload });
export const updateSealedProduct = (id, payload) =>
  request(`/sealed-products/${id}`, { method: "PATCH", body: payload });
export const deleteSealedProduct = (id) => request(`/sealed-products/${id}`, { method: "DELETE" });

// --- Markt-Statistik -------------------------------------------------
export const getMarketMovers = (days = 7, set = null) =>
  request(`/stats/market-movers?days=${days}${set ? `&set=${encodeURIComponent(set)}` : ""}`);
export const getSetValueAnalysis = () => request("/stats/set-value");
export const getPullRateOverview = () => request("/stats/pull-rates");
export const getPackValueAnalysis = () => request("/stats/pack-value");
export const getPullOrBuy = () => request("/stats/pull-or-buy");
export const getSetRanking = () => request("/stats/set-ranking");

// --- News & Artikel ----------------------------------------------------
export const getLanding = () => request("/stats/landing");
export const getArticles = () => request("/articles");
export const getArticle = (slug) => request(`/articles/${encodeURIComponent(slug)}`);
export const createArticle = (payload) => request("/articles", { method: "POST", body: payload });
export const updateArticle = (id, payload) => request(`/articles/${id}`, { method: "PATCH", body: payload });
export const deleteArticle = (id) => request(`/articles/${id}`, { method: "DELETE" });
// Titelbild hochladen (multipart) -> { url }
export async function uploadArticleImage(file) {
  const form = new FormData();
  form.append("image", file);
  const res = await fetch(`${BASE}/articles/image`, { method: "POST", credentials: "include", body: form });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Fehler ${res.status}`);
  return data;
}

// --- Marktplatz --------------------------------------------------------
export const getMarketplaceConfig = () => request("/marketplace/config");
export const getMarketplaceListings = () => request("/marketplace/listings");
export const getListingsForCard = (externalId) =>
  request(`/marketplace/listings?externalId=${encodeURIComponent(externalId)}`);
export const getMyListings = () => request("/marketplace/listings/mine");
// Läuft als EIN multipart-Request (Felder + optionales Foto zusammen),
// damit ein Angebot ab dem Pflichtfoto-Preis nie ohne Foto existieren kann.
export async function createListing({ photoFile, ...fields }) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v != null) form.append(k, v);
  }
  if (photoFile) form.append("photo", photoFile);
  const res = await fetch(`${BASE}/marketplace/listings`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error || `Fehler ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}
export const cancelListing = (id) => request(`/marketplace/listings/${id}`, { method: "DELETE" });
export const buyListing = (id) => request(`/marketplace/listings/${id}/checkout`, { method: "POST" });
export const getSellerStatus = () => request("/marketplace/seller/status");
export const startSellerOnboarding = () => request("/marketplace/seller/onboard", { method: "POST" });
export const refreshSellerStatus = () => request("/marketplace/seller/refresh");
export const getMyOrders = () => request("/marketplace/orders");
export const shipOrder = (id, trackingCode) =>
  request(`/marketplace/orders/${id}/ship`, { method: "POST", body: { trackingCode } });
export const submitOrderReview = (id, payload) =>
  request(`/marketplace/orders/${id}/review`, { method: "POST", body: payload });
export const getListing = (id) => request(`/marketplace/listings/${id}`);
export const postListingComment = (id, body) =>
  request(`/marketplace/listings/${id}/comments`, { method: "POST", body: { body } });
export const getSellerProfile = (userId) => request(`/marketplace/sellers/${userId}`);
export const contactSeller = (id, message) =>
  request(`/marketplace/listings/${id}/contact`, { method: "POST", body: { message } });
export const getListingContacts = (id) => request(`/marketplace/listings/${id}/contacts`);
export const markListingSold = (id, buyerUserId) =>
  request(`/marketplace/listings/${id}/sold`, { method: "POST", body: { buyerUserId: buyerUserId ?? null } });
