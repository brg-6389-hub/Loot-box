/* Comentario PT-PT: ficheiro de codigo da aplicacao LootBox mantido pela equipa. */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Product } from '@/types';
import { apiFetch } from '@/lib/api';

type NewProductInput = Omit<Product, 'id' | 'createdAt' | 'seller' | 'status' | 'buyerId' | 'image'> & {
  image?: string;
  status?: Product['status'];
};

type UpdateProductInput = Partial<Pick<Product, 'name' | 'description' | 'price' | 'category' | 'images' | 'image' | 'status'>>;

interface ProductsContextType {
  products: Product[];
  addProduct: (product: NewProductInput) => Promise<void>;
  updateProduct: (productId: string, data: UpdateProductInput) => Promise<boolean>;
  duplicateProduct: (productId: string) => Promise<boolean>;
  togglePauseProduct: (productId: string) => Promise<boolean>;
  reserveProducts: (productIds: string[], buyerId: string, minutes?: number) => Promise<{ success: string[]; failed: string[]; expiresAt?: Date }>;
  releaseReservedProducts: (buyerId: string, productIds?: string[]) => Promise<void>;
  buyProducts: (productIds: string[], buyerId: string) => { success: string[]; failed: string[] };
  removeProduct: (productId: string) => Promise<boolean>;
  getProductById: (id: string) => Product | undefined;
  getProductsBySellerId: (sellerId: string) => Product[];
  refreshProducts: () => Promise<void>;
}

const ProductsContext = createContext<ProductsContextType | null>(null);
function isReservationExpired(product: Pick<Product, 'status' | 'reservationExpiresAt'>) {
  return product.status === 'reserved' && !!product.reservationExpiresAt && new Date(product.reservationExpiresAt).getTime() <= Date.now();
}

function releaseReservationState(product: Product): Product {
  return {
    ...product,
    status: 'available',
    reservedById: undefined,
    reservedAt: undefined,
    reservationExpiresAt: undefined,
  };
}

function normalizeProduct(product: Product): Product {
  return {
    ...product,
    createdAt: new Date(product.createdAt),
    updatedAt: product.updatedAt ? new Date(product.updatedAt) : undefined,
    reservedAt: product.reservedAt ? new Date(product.reservedAt) : undefined,
    reservationExpiresAt: product.reservationExpiresAt ? new Date(product.reservationExpiresAt) : undefined,
  };
}

export function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);

  const refreshProducts = async () => {
    const data = await apiFetch<{ products: Product[] }>('/api/products');
    setProducts(data.products.map(normalizeProduct));
  };

  useEffect(() => {
    void refreshProducts();
    const onAuthChange = () => {
      void refreshProducts();
    };
    window.addEventListener('lootbox-auth-changed', onAuthChange);
    return () => window.removeEventListener('lootbox-auth-changed', onAuthChange);
  }, []);

  const reserveProducts = async (productIds: string[], buyerId: string, minutes = 10) => {
    const expiresAt = new Date(Date.now() + minutes * 60 * 1000);
    const ids = new Set(productIds);
    const success: string[] = [];
    const failed: string[] = [];
    const next = products.map((product) => {
      if (!ids.has(product.id)) return isReservationExpired(product) ? releaseReservationState(product) : product;

      const normalized = isReservationExpired(product) ? releaseReservationState(product) : product;

      const reservable =
        normalized.status === 'available' ||
        (normalized.status === 'reserved' && normalized.reservedById === buyerId);

      if (!reservable || normalized.sellerId === buyerId) {
        failed.push(product.id);
        return normalized;
      }

      success.push(product.id);
      return {
        ...normalized,
        status: 'reserved' as const,
        reservedById: buyerId,
        reservedAt: new Date(),
        reservationExpiresAt: expiresAt,
        updatedAt: new Date(),
      };
    });
    if (success.length > 0) setProducts(next);
    return { success, failed, expiresAt };
  };

  const releaseReservedProducts = async (buyerId: string, productIds?: string[]) => {
    const ids = productIds ? new Set(productIds) : null;
    const next = products.map((product) => {
      const shouldRelease =
        product.status === 'reserved' &&
        product.reservedById === buyerId &&
        (!ids || ids.has(product.id));
      if (!shouldRelease) return product;
      return {
        ...product,
        status: 'available' as const,
        reservedById: undefined,
        reservedAt: undefined,
        reservationExpiresAt: undefined,
        updatedAt: new Date(),
      };
    });
    setProducts(next);
  };

  const addProduct = async (productData: NewProductInput) => {
    const gallery = Array.isArray(productData.images) ? productData.images.filter(Boolean) : [];
    const primaryImage = gallery[0] || productData.image || '';
    const data = await apiFetch<{ product: Product }>('/api/products', {
      method: 'POST',
      body: JSON.stringify({
        ...productData,
        image: primaryImage,
        images: gallery.length > 0 ? gallery : primaryImage ? [primaryImage] : [],
      }),
    });
    setProducts((prev) => [normalizeProduct(data.product), ...prev]);
  };

  const updateProduct = async (productId: string, data: UpdateProductInput) => {
    try {
      const response = await apiFetch<{ product: Product }>(`/api/products/${productId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      setProducts((prev) => prev.map((product) => (product.id === productId ? normalizeProduct(response.product) : product)));
      return true;
    } catch {
      return false;
    }
  };

  const duplicateProduct = async (productId: string) => {
    const found = products.find((p) => p.id === productId);
    if (!found) return false;
    try {
      await addProduct({
        name: `${found.name} (Cópia)`,
        description: found.description,
        price: found.price,
        category: found.category,
        image: found.image,
        images: found.images,
        sellerId: found.sellerId,
        status: 'draft',
      });
      return true;
    } catch {
      return false;
    }
  };

  const togglePauseProduct = async (productId: string) => {
    const found = products.find((p) => p.id === productId);
    if (!found) return false;
    if (found.status === 'sold') return false;

    const nextStatus: Product['status'] =
      found.status === 'paused'
        ? 'available'
        : found.status === 'draft'
          ? 'pending_review'
          : found.status === 'pending_review' || found.status === 'rejected'
            ? found.status
            : 'paused';
    return updateProduct(productId, { status: nextStatus });
  };

  const buyProducts = (productIds: string[], buyerId: string) => {
    const ids = new Set(productIds);
    const success: string[] = [];
    const failed: string[] = [];
    const next = products.map((product) => {
      if (!ids.has(product.id)) return product;
      const normalized = isReservationExpired(product)
        ? releaseReservationState(product)
        : product;
      const purchasable =
        normalized.status === 'available' ||
        (normalized.status === 'reserved' && normalized.reservedById === buyerId);
      if (!purchasable || normalized.sellerId === buyerId) {
        failed.push(product.id);
        return normalized;
      }
      success.push(product.id);
      return {
        ...normalized,
        status: 'sold' as const,
        buyerId,
        reservedById: undefined,
        reservedAt: undefined,
        reservationExpiresAt: undefined,
        updatedAt: new Date(),
      };
    });
    if (success.length > 0) setProducts(next);
    return { success, failed };
  };

  const removeProduct = async (productId: string) => {
    try {
      await apiFetch(`/api/products/${productId}`, { method: 'DELETE' });
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      return true;
    } catch {
      return false;
    }
  };

  const getProductById = (id: string) => products.find((p) => p.id === id);
  const getProductsBySellerId = (sellerId: string) => products.filter((p) => p.sellerId === sellerId);

  return (
    <ProductsContext.Provider
      value={{
        products,
        addProduct,
        updateProduct,
        duplicateProduct,
        togglePauseProduct,
        reserveProducts,
        releaseReservedProducts,
        buyProducts,
        removeProduct,
        getProductById,
        getProductsBySellerId,
        refreshProducts,
      }}
    >
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts() {
  const context = useContext(ProductsContext);
  if (!context) throw new Error('useProducts must be used within a ProductsProvider');
  return context;
}
