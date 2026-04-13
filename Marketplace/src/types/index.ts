/* Comentario PT-PT: ficheiro de codigo da aplicacao LootBox mantido pela equipa. */
export type PaymentMethodType = 'paypal' | 'mbway' | 'multibanco' | 'card' | 'other';
export type UserRole = 'cliente' | 'destribuidior' | 'admin';

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  label: string;
  isDefault: boolean;
  brand?: string;
  last4?: string;
  holderName?: string;
  expiresAt?: string;
  phone?: string;
  email?: string;
  iban?: string;
  details?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  username?: string;
  phone?: string;
  phoneVerified?: boolean;
  emailVerified?: boolean;
  role: UserRole;
  isBlocked?: boolean;
  avatar?: string;
  avatarUrl?: string;
  paymentMethods: PaymentMethod[];
}

export interface StoredUser extends User {
  password: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  images?: string[];
  seller: User;
  sellerId: string;
  buyerId?: string;
  reservedById?: string;
  reservedAt?: Date;
  reservationExpiresAt?: Date;
  status: 'draft' | 'pending_review' | 'available' | 'paused' | 'rejected' | 'reserved' | 'sold';
  createdAt: Date;
  updatedAt?: Date;
}

export interface CartItem {
  productId: string;
  quantity: number;
}

export interface Order {
  id: string;
  itemIds: string[];
  items?: Array<{
    product_id: string;
    price: number;
    name: string;
    image: string;
    category: string;
  }>;
  buyerId: string;
  subtotal: number;
  serviceFee: number;
  total: number;
  paymentMethodId?: string;
  paymentMethodLabel?: string;
  sellerIds?: string[];
  shippingAddress?: string;
  note?: string;
  reservationExpiresAt?: Date;
  status: 'processing' | 'paid' | 'shipped' | 'completed';
  createdAt: Date;
  shippedAt?: Date;
  completedAt?: Date;
  trackingCode?: string;
  shippingCarrier?: string;
  shippingProof?: string;
  shippingNote?: string;
  dispute?: OrderDispute;
}

export interface OrderDispute {
  id: string;
  status: 'open' | 'resolved' | 'rejected';
  openedBy: 'buyer' | 'seller';
  reason: string;
  details?: string;
  evidence?: string[];
  resolutionNote?: string;
  createdAt: Date;
  resolvedAt?: Date;
}

export interface Review {
  id: string;
  orderId: string;
  sellerId: string;
  buyerId: string;
  rating: number;
  comment?: string;
  createdAt: Date;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: Date;
}

export interface Conversation {
  id: string;
  participantIds: string[];
  productId?: string;
  messages: ChatMessage[];
  updatedAt: Date;
}

export type View =
  | 'home'
  | 'favorites'
  | 'publish'
  | 'chat'
  | 'profile'
  | 'personal-data'
  | 'product-detail'
  | 'cart'
  | 'seller-profile'
  | 'admin';
