/* Comentario PT-PT: ficheiro de codigo da aplicacao LootBox mantido pela equipa. */
import { Heart } from 'lucide-react';
import { useMarketplace } from '@/hooks/useMarketplace';
import { useProducts } from '@/hooks/useProducts';
import { getPrimaryProductImage } from '@/lib/product-images';

export function FavoritesPage() {
  const { favorites, toggleFavorite } = useMarketplace();
  const { getProductById } = useProducts();
  const favoriteProducts = favorites
    .map((productId) => getProductById(productId))
    .filter((product): product is NonNullable<typeof product> => Boolean(product));

  return (
    <div className="pb-8 pt-4 px-3 md:px-6 w-full">
      <section className="panel-surface p-4 md:p-5">
      <h2 className="text-2xl font-bold text-[#E8E0C8] mb-6">Favoritos</h2>

      {favoriteProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-[#111] rounded-full flex items-center justify-center mb-4 border border-[#222]">
            <Heart className="w-8 h-8 text-[#444]" />
          </div>
          <h3 className="text-[#E8E0C8] font-medium mb-1">Sem favoritos</h3>
          <p className="text-[#666] text-sm">Adiciona produtos aos favoritos para os veres aqui.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {favoriteProducts.map((product) => (
            <div key={product.id} className="bg-[#111] rounded-xl border border-[#222] p-3 flex items-center gap-3">
              <img
                src={getPrimaryProductImage(product)}
                alt={product.name}
                loading="lazy"
                decoding="async"
                className="w-16 h-16 rounded-lg object-cover bg-[#1a1a1a]"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[#E8E0C8] text-sm font-medium truncate">{product.name}</p>
                <p className="text-[#666] text-xs truncate">{product.seller.name}</p>
                <p className="text-[#C9A962] font-semibold">{product.price.toFixed(2)}€</p>
              </div>
              <button
                onClick={() => toggleFavorite(product.id)}
                className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors"
              >
                <Heart className="w-4 h-4 text-red-400 fill-red-400" />
              </button>
            </div>
          ))}
        </div>
      )}
      </section>
    </div>
  );
}
