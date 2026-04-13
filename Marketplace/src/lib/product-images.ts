/* Comentario PT-PT: utilitarios para normalizar e reutilizar galerias de fotos dos produtos. */
import type { Product } from '@/types';

// Garante uma lista de imagens consistente para produtos antigos e novos.
export function getProductImages(product: Pick<Product, 'image' | 'images'>): string[] {
  const gallery = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
  if (gallery.length > 0) return gallery;
  return product.image ? [product.image] : [];
}

// Recolhe sempre a imagem principal a apresentar nos listados.
export function getPrimaryProductImage(product: Pick<Product, 'image' | 'images'>): string {
  return getProductImages(product)[0] || product.image || '';
}
