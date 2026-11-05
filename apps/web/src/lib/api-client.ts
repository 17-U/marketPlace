import type {
  AdminListingSummaryDto,
  AdminStatsDto,
  AuthResponse,
  AuthTokens,
  CategoryDto,
  CityDto,
  ConversationDetailDto,
  ConversationSummaryDto,
  DisputeDto,
  ListingDetailDto,
  ListingSearchQuery,
  ListingSummaryDto,
  NotificationDto,
  OrderDetailDto,
  OrderSummaryDto,
  PaginatedResult,
  PublicUser,
  ReportDto,
  ReviewDto,
  SellerProfileDto,
  SellerVerificationDto,
} from "@marketplace/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    throw new ApiError(body.message ?? "Erreur réseau", response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function authHeader(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

export const authApi = {
  requestOtp: (phone: string) =>
    apiFetch<{ expiresInSeconds: number }>("/auth/otp/request", {
      method: "POST",
      body: JSON.stringify({ phone }),
    }),

  verifyOtp: (input: { phone: string; code: string; firstName?: string; lastName?: string }) =>
    apiFetch<AuthResponse>("/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  refresh: (refreshToken: string) =>
    apiFetch<AuthTokens>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),

  logout: (refreshToken: string) =>
    apiFetch<void>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),

  me: (accessToken: string) => apiFetch<PublicUser>("/auth/me", { headers: authHeader(accessToken) }),
};

export const categoriesApi = {
  findAll: () => apiFetch<CategoryDto[]>("/categories"),
};

export const citiesApi = {
  findAll: () => apiFetch<CityDto[]>("/cities"),
};

export const listingsApi = {
  search: (query: ListingSearchQuery = {}) => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== "") params.set(key, String(value));
    });
    const qs = params.toString();
    return apiFetch<PaginatedResult<ListingSummaryDto>>(`/listings${qs ? `?${qs}` : ""}`);
  },

  getById: (id: string) => apiFetch<ListingDetailDto>(`/listings/${id}`),

  getOwned: (accessToken: string, id: string) =>
    apiFetch<ListingDetailDto>(`/me/listings/${id}`, { headers: authHeader(accessToken) }),

  findMine: (accessToken: string) =>
    apiFetch<ListingSummaryDto[]>("/me/listings", { headers: authHeader(accessToken) }),

  create: (accessToken: string, input: Record<string, unknown>) =>
    apiFetch<ListingDetailDto>("/listings", {
      method: "POST",
      headers: authHeader(accessToken),
      body: JSON.stringify(input),
    }),

  update: (accessToken: string, id: string, input: Record<string, unknown>) =>
    apiFetch<ListingDetailDto>(`/listings/${id}`, {
      method: "PATCH",
      headers: authHeader(accessToken),
      body: JSON.stringify(input),
    }),

  publish: (accessToken: string, id: string) =>
    apiFetch<ListingDetailDto>(`/listings/${id}/publish`, {
      method: "POST",
      headers: authHeader(accessToken),
    }),

  hide: (accessToken: string, id: string) =>
    apiFetch<ListingDetailDto>(`/listings/${id}/hide`, {
      method: "POST",
      headers: authHeader(accessToken),
    }),

  markSold: (accessToken: string, id: string) =>
    apiFetch<ListingDetailDto>(`/listings/${id}/sold`, {
      method: "POST",
      headers: authHeader(accessToken),
    }),

  remove: (accessToken: string, id: string) =>
    apiFetch<void>(`/listings/${id}`, { method: "DELETE", headers: authHeader(accessToken) }),

  uploadPhoto: (accessToken: string, listingId: string, file: File) => {
    const formData = new FormData();
    formData.append("photo", file);
    return apiFetch<{ id: string; thumbUrl: string | null }>(`/listings/${listingId}/photos`, {
      method: "POST",
      headers: authHeader(accessToken),
      body: formData,
    });
  },

  deletePhoto: (accessToken: string, listingId: string, photoId: string) =>
    apiFetch<void>(`/listings/${listingId}/photos/${photoId}`, {
      method: "DELETE",
      headers: authHeader(accessToken),
    }),
};

export const conversationsApi = {
  start: (accessToken: string, listingId: string) =>
    apiFetch<ConversationDetailDto>("/conversations", {
      method: "POST",
      headers: authHeader(accessToken),
      body: JSON.stringify({ listingId }),
    }),

  findMine: (accessToken: string) =>
    apiFetch<ConversationSummaryDto[]>("/conversations", { headers: authHeader(accessToken) }),

  getDetail: (accessToken: string, id: string) =>
    apiFetch<ConversationDetailDto>(`/conversations/${id}`, { headers: authHeader(accessToken) }),

  markRead: (accessToken: string, id: string) =>
    apiFetch<void>(`/conversations/${id}/read`, {
      method: "POST",
      headers: authHeader(accessToken),
    }),
};

export const ordersApi = {
  create: (accessToken: string, input: Record<string, unknown>) =>
    apiFetch<OrderDetailDto>("/orders", {
      method: "POST",
      headers: authHeader(accessToken),
      body: JSON.stringify(input),
    }),

  findMineAsBuyer: (accessToken: string) =>
    apiFetch<OrderSummaryDto[]>("/me/orders/buying", { headers: authHeader(accessToken) }),

  findMineAsSeller: (accessToken: string) =>
    apiFetch<OrderSummaryDto[]>("/me/orders/selling", { headers: authHeader(accessToken) }),

  getById: (accessToken: string, id: string) =>
    apiFetch<OrderDetailDto>(`/orders/${id}`, { headers: authHeader(accessToken) }),

  ship: (accessToken: string, id: string, trackingNumber?: string) =>
    apiFetch<OrderDetailDto>(`/orders/${id}/ship`, {
      method: "POST",
      headers: authHeader(accessToken),
      body: JSON.stringify({ trackingNumber }),
    }),

  confirmDelivery: (accessToken: string, id: string) =>
    apiFetch<OrderDetailDto>(`/orders/${id}/confirm-delivery`, {
      method: "POST",
      headers: authHeader(accessToken),
    }),

  cancel: (accessToken: string, id: string) =>
    apiFetch<OrderDetailDto>(`/orders/${id}/cancel`, {
      method: "POST",
      headers: authHeader(accessToken),
    }),
};

export const usersApi = {
  getProfile: (id: string) => apiFetch<SellerProfileDto>(`/users/${id}/profile`),
};

export const reviewsApi = {
  create: (accessToken: string, orderId: string, input: { rating: number; comment?: string }) =>
    apiFetch<ReviewDto>(`/orders/${orderId}/reviews`, {
      method: "POST",
      headers: authHeader(accessToken),
      body: JSON.stringify(input),
    }),
};

export const disputesApi = {
  open: (accessToken: string, orderId: string, input: { reason: string; description: string }) =>
    apiFetch<DisputeDto>(`/orders/${orderId}/dispute`, {
      method: "POST",
      headers: authHeader(accessToken),
      body: JSON.stringify(input),
    }),

  getDetail: (accessToken: string, id: string) =>
    apiFetch<DisputeDto>(`/disputes/${id}`, { headers: authHeader(accessToken) }),

  findMine: (accessToken: string) =>
    apiFetch<DisputeDto[]>("/me/disputes", { headers: authHeader(accessToken) }),

  addMessage: (accessToken: string, id: string, content: string) =>
    apiFetch<void>(`/disputes/${id}/messages`, {
      method: "POST",
      headers: authHeader(accessToken),
      body: JSON.stringify({ content }),
    }),

  resolve: (accessToken: string, id: string, outcome: "RELEASE" | "REFUND", resolutionNote?: string) =>
    apiFetch<DisputeDto>(`/disputes/${id}/resolve`, {
      method: "POST",
      headers: authHeader(accessToken),
      body: JSON.stringify({ outcome, resolutionNote }),
    }),
};

export const notificationsApi = {
  findMine: (accessToken: string) =>
    apiFetch<NotificationDto[]>("/me/notifications", { headers: authHeader(accessToken) }),

  markRead: (accessToken: string, id: string) =>
    apiFetch<void>(`/me/notifications/${id}/read`, { method: "POST", headers: authHeader(accessToken) }),

  markAllRead: (accessToken: string) =>
    apiFetch<void>("/me/notifications/read-all", { method: "POST", headers: authHeader(accessToken) }),
};

export const favoritesApi = {
  add: (accessToken: string, listingId: string) =>
    apiFetch<void>(`/listings/${listingId}/favorite`, {
      method: "POST",
      headers: authHeader(accessToken),
    }),

  remove: (accessToken: string, listingId: string) =>
    apiFetch<void>(`/listings/${listingId}/favorite`, {
      method: "DELETE",
      headers: authHeader(accessToken),
    }),

  findMine: (accessToken: string) =>
    apiFetch<ListingSummaryDto[]>("/me/favorites", { headers: authHeader(accessToken) }),
};

export const sellerVerificationApi = {
  submit: (accessToken: string, idCard: File, selfie: File) => {
    const formData = new FormData();
    formData.append("idCard", idCard);
    formData.append("selfie", selfie);
    return apiFetch<SellerVerificationDto>("/me/seller-verification", {
      method: "POST",
      headers: authHeader(accessToken),
      body: formData,
    });
  },

  findMine: (accessToken: string) =>
    apiFetch<SellerVerificationDto | null>("/me/seller-verification", {
      headers: authHeader(accessToken),
    }),
};

export const reportsApi = {
  create: (accessToken: string, input: { listingId: string; reason: string; description?: string }) =>
    apiFetch<ReportDto>("/reports", {
      method: "POST",
      headers: authHeader(accessToken),
      body: JSON.stringify(input),
    }),
};

export const adminApi = {
  getStats: (accessToken: string) =>
    apiFetch<AdminStatsDto>("/admin/stats", { headers: authHeader(accessToken) }),

  findAllListings: (accessToken: string) =>
    apiFetch<AdminListingSummaryDto[]>("/admin/listings", { headers: authHeader(accessToken) }),

  hideListing: (accessToken: string, id: string, reason: string) =>
    apiFetch<ListingDetailDto>(`/admin/listings/${id}/hide`, {
      method: "POST",
      headers: authHeader(accessToken),
      body: JSON.stringify({ reason }),
    }),

  findPendingVerifications: (accessToken: string) =>
    apiFetch<SellerVerificationDto[]>("/admin/seller-verifications", {
      headers: authHeader(accessToken),
    }),

  approveVerification: (accessToken: string, id: string) =>
    apiFetch<SellerVerificationDto>(`/admin/seller-verifications/${id}/approve`, {
      method: "POST",
      headers: authHeader(accessToken),
    }),

  rejectVerification: (accessToken: string, id: string, reason: string) =>
    apiFetch<SellerVerificationDto>(`/admin/seller-verifications/${id}/reject`, {
      method: "POST",
      headers: authHeader(accessToken),
      body: JSON.stringify({ reason }),
    }),

  findAllReports: (accessToken: string) =>
    apiFetch<ReportDto[]>("/admin/reports", { headers: authHeader(accessToken) }),

  resolveReport: (accessToken: string, id: string, outcome: "DISMISS" | "ACTION") =>
    apiFetch<ReportDto>(`/admin/reports/${id}/resolve`, {
      method: "POST",
      headers: authHeader(accessToken),
      body: JSON.stringify({ outcome }),
    }),

  findAllDisputes: (accessToken: string) =>
    apiFetch<DisputeDto[]>("/admin/disputes", { headers: authHeader(accessToken) }),
};
