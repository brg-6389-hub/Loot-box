/* Comentario PT-PT: ficheiro de codigo da aplicacao LootBox mantido pela equipa. */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CartItem, Conversation, Order, Review } from '@/types';
import { useProducts } from '@/hooks/useProducts';
import { apiFetch, getToken } from '@/lib/api';

interface CheckoutPayload {
  buyerId: string;
  paymentMethodId?: string;
  paymentMethodLabel?: string;
  shippingAddress?: string;
  note?: string;
}

interface CheckoutResult {
  success: boolean;
  message: string;
  order?: Order;
}

interface ReviewPayload {
  orderId: string;
  sellerId: string;
  buyerId: string;
  rating: number;
  comment?: string;
}

interface ShipmentPayload {
  orderId: string;
  sellerId: string;
  trackingCode: string;
  shippingCarrier?: string;
  shippingProof?: string;
  shippingNote?: string;
}

interface DisputePayload {
  orderId: string;
  openedBy: 'buyer' | 'seller';
  reason: string;
  details?: string;
  evidence?: string[];
}

interface MarketplaceContextType {
  favorites: string[];
  cart: CartItem[];
  orders: Order[];
  conversations: Conversation[];
  reviews: Review[];
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (productId: string) => Promise<void>;
  addToCart: (productId: string) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  clearCart: () => void;
  cartCount: number;
  checkout: (payload: CheckoutPayload) => Promise<CheckoutResult>;
  updateOrderStatus: (orderId: string, status: Order['status']) => Promise<boolean>;
  attachShipmentInfo: (payload: ShipmentPayload) => Promise<{ success: boolean; message: string }>;
  confirmOrderReceived: (orderId: string, buyerId: string) => Promise<{ success: boolean; message: string }>;
  openDispute: (payload: DisputePayload) => Promise<{ success: boolean; message: string }>;
  resolveDispute: (orderId: string, resolution: { status: 'resolved' | 'rejected'; resolutionNote?: string }) => Promise<{ success: boolean; message: string }>;
  submitReview: (payload: ReviewPayload) => Promise<{ success: boolean; message: string; review?: Review }>;
  getReviewsForSeller: (sellerId: string) => Review[];
  hasReviewForOrder: (orderId: string, sellerId?: string) => boolean;
  getSellerRatingSummary: (sellerId: string) => { average: number; total: number; distribution: number[] };
  createOrGetConversation: (a: string, b: string, productId?: string) => Promise<string>;
  sendMessage: (conversationId: string, senderId: string, text: string) => Promise<void>;
  getUserConversations: (userId: string) => Conversation[];
  refreshAll: () => Promise<void>;
}

const MarketplaceContext = createContext<MarketplaceContextType | null>(null);
function getCurrentUserRole() {
  const rawUser = localStorage.getItem('lootbox_user');
  if (!rawUser) return null;
  try {
    const parsed = JSON.parse(rawUser) as { id?: string; role?: string };
    return {
      id: parsed.id || '',
      role: parsed.role || '',
    };
  } catch {
    return null;
  }
}

export function MarketplaceProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const { getProductById } = useProducts();

  const normalizeOrder = (order: Order): Order => ({
    ...order,
    createdAt: new Date(order.createdAt),
    shippedAt: order.shippedAt ? new Date(order.shippedAt) : undefined,
    completedAt: order.completedAt ? new Date(order.completedAt) : undefined,
    reservationExpiresAt: order.reservationExpiresAt ? new Date(order.reservationExpiresAt) : undefined,
    dispute: order.dispute
      ? {
          ...order.dispute,
          createdAt: new Date(order.dispute.createdAt),
          resolvedAt: order.dispute.resolvedAt ? new Date(order.dispute.resolvedAt) : undefined,
        }
      : undefined,
  });

  const normalizeConversation = (conversation: Conversation): Conversation => ({
    ...conversation,
    updatedAt: new Date(conversation.updatedAt),
    messages: conversation.messages.map((message) => ({
      ...message,
      createdAt: new Date(message.createdAt),
    })),
  });

  const normalizeReview = (review: Review): Review => ({
    ...review,
    createdAt: new Date(review.createdAt),
  });

  const refreshAll = async () => {
    const token = getToken();
    const reviewsData = await apiFetch<{ reviews: Review[] }>('/api/reviews');
    setReviews(reviewsData.reviews.map(normalizeReview));

    if (!token) {
      setFavorites([]);
      setCart([]);
      setOrders([]);
      setConversations([]);
      return;
    }

    const [favoritesData, cartData, ordersData, conversationsData] = await Promise.all([
      apiFetch<{ favorites: string[] }>('/api/favorites'),
      apiFetch<{ cart: CartItem[] }>('/api/cart'),
      apiFetch<{ orders: Order[] }>('/api/orders/relevant'),
      apiFetch<{ conversations: Conversation[] }>('/api/conversations'),
    ]);

    setFavorites(favoritesData.favorites);
    setCart(cartData.cart);
    setOrders(ordersData.orders.map(normalizeOrder));
    setConversations(conversationsData.conversations.map(normalizeConversation));
  };

  useEffect(() => {
    void refreshAll();
    const onAuthChange = () => {
      void refreshAll();
    };
    window.addEventListener('lootbox-auth-changed', onAuthChange);
    return () => window.removeEventListener('lootbox-auth-changed', onAuthChange);
  }, []);

  const isFavorite = (productId: string) => favorites.includes(productId);

  const toggleFavorite = async (productId: string) => {
    if (!getToken()) return;
    const data = await apiFetch<{ favorites: string[] }>(`/api/favorites/${productId}/toggle`, { method: 'POST' });
    setFavorites(data.favorites);
  };

  const addToCart = async (productId: string) => {
    const currentUser = getCurrentUserRole();
    const product = getProductById(productId);
    if (!product || product.status !== 'available') return;
    if (!currentUser || currentUser.role !== 'cliente' || currentUser.id === product.sellerId) return;
    await apiFetch('/api/cart', {
      method: 'POST',
      body: JSON.stringify({ productId }),
    });
    await refreshAll();
  };

  const removeFromCart = async (productId: string) => {
    await apiFetch(`/api/cart/${productId}`, { method: 'DELETE' });
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const clearCart = () => setCart([]);
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  const checkout = async ({
    buyerId,
    paymentMethodId,
    paymentMethodLabel,
    shippingAddress,
    note,
  }: CheckoutPayload): Promise<CheckoutResult> => {
    const currentUser = getCurrentUserRole();
    if (!currentUser || currentUser.role !== 'cliente' || currentUser.id !== buyerId) {
      return { success: false, message: 'Apenas contas de cliente podem concluir compras.' };
    }

    if (!paymentMethodId) {
      return { success: false, message: 'Seleciona um método de pagamento para pagar agora.' };
    }
    if (!shippingAddress?.trim()) {
      return { success: false, message: 'Preenche a morada de entrega.' };
    }

    const response = await apiFetch<{ success?: boolean; url?: string; order?: Order }>('/api/orders/checkout-session', {
      method: 'POST',
      body: JSON.stringify({
        paymentMethodId,
        paymentMethodLabel,
        shippingAddress: shippingAddress.trim(),
        note,
      }),
    });
    if (response.url) {
      window.location.href = response.url;
      return { success: true, message: 'A redirecionar para o pagamento.' };
    }
    await refreshAll();
    return {
      success: true,
      message: 'Pagamento registado com sucesso.',
      order: response.order ? normalizeOrder(response.order) : undefined,
    };
  };

  const createOrGetConversation = async (_a: string, b: string, productId?: string): Promise<string> => {
    const response = await apiFetch<{ conversationId: string }>('/api/conversations/start', {
      method: 'POST',
      body: JSON.stringify({ otherUserId: b, productId }),
    });
    await refreshAll();
    return response.conversationId;
  };

  const sendMessage = async (conversationId: string, senderId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    await apiFetch(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text: trimmed, senderId }),
    });
    await refreshAll();
  };

  const getUserConversations = (userId: string) =>
    conversations.filter((conv) => conv.participantIds.includes(userId));

  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    try {
      await apiFetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await refreshAll();
      return true;
    } catch {
      return false;
    }
  };

  const attachShipmentInfo = async ({
    orderId,
    sellerId,
    trackingCode,
    shippingCarrier,
    shippingProof,
    shippingNote,
  }: ShipmentPayload) => {
    try {
      await apiFetch(`/api/orders/${orderId}/shipment`, {
        method: 'PATCH',
        body: JSON.stringify({
          sellerId,
          trackingCode,
          shippingCarrier,
          shippingProof,
          shippingNote,
        }),
      });
      await refreshAll();
      return { success: true, message: 'Dados de envio guardados com sucesso.' };
    } catch {
      return { success: false, message: 'Não foi possível atualizar o envio.' };
    }
  };

  const confirmOrderReceived = async (orderId: string, buyerId: string) => {
    try {
      await apiFetch(`/api/orders/${orderId}/confirm`, {
        method: 'PATCH',
        body: JSON.stringify({ buyerId }),
      });
      await refreshAll();
      return { success: true, message: 'Receção confirmada com sucesso.' };
    } catch {
      return { success: false, message: 'Não foi possível atualizar a encomenda.' };
    }
  };

  const openDispute = async ({ orderId, openedBy, reason, details, evidence }: DisputePayload) => {
    if (!reason.trim()) return { success: false, message: 'Indica o motivo da denúncia.' };
    try {
      await apiFetch(`/api/orders/${orderId}/dispute`, {
        method: 'PATCH',
        body: JSON.stringify({ openedBy, reason, details, evidence }),
      });
      await refreshAll();
      return { success: true, message: 'Denúncia enviada para análise do administrador.' };
    } catch {
      return { success: false, message: 'Não foi possível enviar a denúncia.' };
    }
  };

  const resolveDispute = async (
    orderId: string,
    resolution: { status: 'resolved' | 'rejected'; resolutionNote?: string },
  ) => {
    try {
      await apiFetch(`/api/orders/${orderId}/dispute`, {
        method: 'PATCH',
        body: JSON.stringify(resolution),
      });
      await refreshAll();
      return { success: true, message: 'Denúncia atualizada pelo administrador.' };
    } catch {
      return { success: false, message: 'Não existe denúncia para resolver.' };
    }
  };

  const submitReview = async ({ orderId, sellerId, buyerId, rating, comment }: ReviewPayload) => {
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return { success: false, message: 'Seleciona uma classificação válida.' };
    }
    try {
      await apiFetch('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({ orderId, sellerId, buyerId, rating, comment }),
      });
      await refreshAll();
      const review = reviews.find((item) => item.orderId === orderId && item.sellerId === sellerId);
      return { success: true, message: 'Avaliação publicada com sucesso.', review };
    } catch {
      return { success: false, message: 'Não foi possível publicar a avaliação.' };
    }
  };

  const getReviewsForSeller = (sellerId: string) => reviews.filter((review) => review.sellerId === sellerId);

  const hasReviewForOrder = (orderId: string, sellerId?: string) =>
    reviews.some((review) => review.orderId === orderId && (!sellerId || review.sellerId === sellerId));

  const getSellerRatingSummary = (sellerId: string) => {
    const sellerReviews = getReviewsForSeller(sellerId);
    if (sellerReviews.length === 0) {
      return { average: 0, total: 0, distribution: [0, 0, 0, 0, 0] };
    }
    const distribution = [5, 4, 3, 2, 1].map(
      (value) => sellerReviews.filter((review) => review.rating === value).length,
    );
    const total = sellerReviews.length;
    const average =
      sellerReviews.reduce((sum, review) => sum + review.rating, 0) / total;
    return { average, total, distribution };
  };

  return (
    <MarketplaceContext.Provider
      value={{
        favorites,
        cart,
        orders,
        conversations,
        reviews,
        isFavorite,
        toggleFavorite,
        addToCart,
        removeFromCart,
        clearCart,
        cartCount,
        checkout,
        updateOrderStatus,
        attachShipmentInfo,
        confirmOrderReceived,
        openDispute,
        resolveDispute,
        submitReview,
        getReviewsForSeller,
        hasReviewForOrder,
        getSellerRatingSummary,
        createOrGetConversation,
        sendMessage,
        getUserConversations,
        refreshAll,
      }}
    >
      {children}
    </MarketplaceContext.Provider>
  );
}

export function useMarketplace() {
  const context = useContext(MarketplaceContext);
  if (!context) throw new Error('useMarketplace must be used within a MarketplaceProvider');
  return context;
}
