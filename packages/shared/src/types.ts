import {
  DeliveryMethod,
  DisputeStatus,
  ListingCondition,
  ListingStatus,
  MessageType,
  NotificationChannel,
  NotificationType,
  OfferStatus,
  OrderStatus,
  ReportReason,
  ReportStatus,
  Role,
  VerificationStatus,
} from "./enums";

export interface PublicUser {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: Role;
  locale: string;
  cityId: string | null;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: PublicUser;
}

export interface CityDto {
  id: string;
  nameFr: string;
  nameEn: string;
  region: string;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
}

export interface CategoryDto {
  id: string;
  slug: string;
  nameFr: string;
  nameEn: string;
  icon: string | null;
  parentId: string | null;
}

export interface ListingPhotoDto {
  id: string;
  thumbUrl: string | null;
  mediumUrl: string | null;
  largeUrl: string | null;
  position: number;
}

export interface ListingSummaryDto {
  id: string;
  title: string;
  priceXaf: number;
  condition: ListingCondition;
  status: ListingStatus;
  cityId: string;
  cityNameFr: string;
  neighborhood: string | null;
  coverPhotoUrl: string | null;
  createdAt: string;
  isFavorite?: boolean;
}

export interface ListingDetailDto extends ListingSummaryDto {
  description: string;
  brand: string | null;
  size: string | null;
  categoryId: string;
  viewsCount: number;
  photos: ListingPhotoDto[];
  seller: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    createdAt: string;
  };
}

export interface ListingSearchQuery {
  q?: string;
  categoryId?: string;
  cityId?: string;
  condition?: ListingCondition;
  minPriceXaf?: number;
  maxPriceXaf?: number;
  sort?: "recent" | "price_asc" | "price_desc";
  cursor?: string;
  limit?: number;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  content: string | null;
  offerAmountXaf: number | null;
  offerStatus: OfferStatus | null;
  readAt: string | null;
  createdAt: string;
}

export interface ConversationParticipantDto {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export interface ConversationSummaryDto {
  id: string;
  listingId: string;
  listingTitle: string;
  listingCoverPhotoUrl: string | null;
  buyer: ConversationParticipantDto;
  seller: ConversationParticipantDto;
  lastMessage: MessageDto | null;
  unreadCount: number;
  updatedAt: string;
}

export interface ConversationDetailDto extends ConversationSummaryDto {
  messages: MessageDto[];
}

export interface OrderPartyDto {
  id: string;
  firstName: string;
  lastName: string;
}

export interface OrderSummaryDto {
  id: string;
  listingId: string;
  listingTitle: string;
  listingCoverPhotoUrl: string | null;
  buyer: OrderPartyDto;
  seller: OrderPartyDto;
  priceXaf: number;
  deliveryFeeXaf: number;
  commissionXaf: number;
  totalXaf: number;
  deliveryMethod: DeliveryMethod;
  status: OrderStatus;
  trackingNumber: string | null;
  autoReleaseAt: string | null;
  createdAt: string;
}

export interface OrderStatusHistoryEntryDto {
  id: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  reason: string | null;
  createdAt: string;
}

export interface OrderDetailDto extends OrderSummaryDto {
  recipientName: string;
  recipientPhone: string;
  deliveryAddressText: string | null;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  releasedAt: string | null;
  cancelledAt: string | null;
  statusHistory: OrderStatusHistoryEntryDto[];
}

export interface ReviewDto {
  id: string;
  orderId: string;
  authorId: string;
  authorFirstName: string;
  authorLastName: string;
  targetId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface SellerProfileDto {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  city: string | null;
  memberSince: string;
  averageRating: number | null;
  reviewCount: number;
  reviews: ReviewDto[];
  listings: ListingSummaryDto[];
}

export interface DisputeMessageDto {
  id: string;
  senderId: string;
  content: string;
  photoUrls: string[];
  createdAt: string;
}

export interface DisputeDto {
  id: string;
  orderId: string;
  openedById: string;
  reason: string;
  description: string;
  photoUrls: string[];
  status: DisputeStatus;
  resolvedById: string | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  messages: DisputeMessageDto[];
}

export interface AdminStatsDto {
  userCount: number;
  listingCount: number;
  publishedListingCount: number;
  orderCount: number;
  totalVolumeXaf: number;
  openDisputeCount: number;
  pendingVerificationCount: number;
  openReportCount: number;
}

export interface SellerVerificationDto {
  id: string;
  userId: string;
  userFirstName: string;
  userLastName: string;
  userPhone: string;
  idCardPhotoUrl: string;
  selfiePhotoUrl: string;
  status: VerificationStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface ReportDto {
  id: string;
  reporterId: string;
  reporterFirstName: string;
  reporterLastName: string;
  listingId: string | null;
  listingTitle: string | null;
  reason: ReportReason;
  description: string | null;
  status: ReportStatus;
  resolvedById: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface AdminListingSummaryDto extends ListingSummaryDto {
  sellerFirstName: string;
  sellerLastName: string;
}

export interface NotificationDto {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}
