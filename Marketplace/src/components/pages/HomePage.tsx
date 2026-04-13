/* Comentario PT-PT: ficheiro de codigo da aplicacao LootBox mantido pela equipa. */
import { useMemo } from 'react';
import { Heart, Search, Plus, CircleDot, ShieldCheck, BadgeInfo, Headset } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { useMarketplace } from '@/hooks/useMarketplace';
import { useAuth } from '@/hooks/useAuth';
import { getPrimaryProductImage } from '@/lib/product-images';
import type { View } from '@/types';

interface HomePageProps {
  onProductClick: (productId: string) => void;
  onViewChange: (view: View) => void;
  onLoginClick: () => void;
  searchQuery: string;
}

// A pagina inicial mostra os produtos disponiveis e centraliza a pesquisa do marketplace.
export function HomePage({ onProductClick, onViewChange, onLoginClick, searchQuery }: HomePageProps) {
  const { products } = useProducts();
  const { isFavorite, toggleFavorite } = useMarketplace();
  const { isAuthenticated, isSeller } = useAuth();

  // O filtro corre localmente para manter a interface rapida durante a pesquisa.
  const filteredProducts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return products.filter((product) => {
      if (product.status !== 'available') return false;
      if (!query) return true;
      return (
        product.name.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query)
      );
    });
  }, [products, searchQuery]);

  return (
    <div className="pb-8 pt-4 px-3 md:px-6 w-full">
      <section className="panel-surface p-3 md:p-5">
        {isAuthenticated && isSeller && (
          <div className="mb-4">
            <button
              onClick={() => {
                if (!isAuthenticated) {
                  onLoginClick();
                  return;
                }
                onViewChange('publish');
              }}
              className="h-9 px-3 rounded-lg border border-[#2b2b2b] bg-[#151515] text-[#E8E0C8] text-sm flex items-center gap-1.5 hover:border-[#3a3a3a]"
            >
              <Plus className="w-4 h-4" />
              Adicionar produto
            </button>
          </div>
        )}

        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {filteredProducts.map((product) => {
              // O estado visual do cartao adapta-se ao estado atual do produto.
              const sold = product.status !== 'available';
              return (
                <article
                  key={product.id}
                  onClick={() => onProductClick(product.id)}
                  className="rounded-xl border border-[#242424] bg-[#121212] p-2.5 md:p-3 cursor-pointer card-hover"
                >
                  <div className="relative rounded-lg border border-[#222] bg-[#181818] aspect-[4/3] overflow-hidden mb-2.5">
                    <img
                      src={getPrimaryProductImage(product)}
                      alt={product.name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-contain p-2"
                    />
                    <button
                      onClick={(e) => {
                        // Evita abrir o detalhe quando o utilizador so quer favoritar.
                        e.stopPropagation();
                        void toggleFavorite(product.id);
                      }}
                      className="absolute right-2 top-2 h-7 w-7 rounded-full bg-black/55 flex items-center justify-center"
                    >
                      <Heart className={`w-4 h-4 ${isFavorite(product.id) ? 'text-red-400 fill-red-400' : 'text-[#9c9278]'}`} />
                    </button>
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-[#E8E0C8] truncate">{product.name}</h3>
                      <p className="text-xs text-[#7a725f] truncate">{product.category}</p>
                    </div>
                    <p className="text-[#E8E0C8] font-semibold text-sm">{product.price.toFixed(0)}€</p>
                  </div>

                  <div
                    className={`mt-2.5 h-7 rounded-md border flex items-center justify-center gap-1.5 text-xs ${
                      sold
                        ? 'border-[#4a2424] bg-[#2a1717] text-[#f08f8f]'
                        : 'border-[#3e3727] bg-[#1f1a12] text-[#d8c28a]'
                    }`}
                  >
                    <CircleDot className="w-3 h-3" />
                    {sold ? 'Vendido' : 'Disponivel'}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="h-44 rounded-xl border border-[#222] bg-[#111] flex flex-col items-center justify-center text-center">
            <Search className="w-6 h-6 text-[#756c59] mb-2" />
            <p className="text-[#E8E0C8] text-sm">Nenhum produto encontrado</p>
            <p className="text-[#7f7661] text-xs">Tenta outra pesquisa.</p>
          </div>
        )}
      </section>

      <section className="mt-6 panel-surface p-4 md:p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-[#E8E0C8]">Confiança Loot Box</h3>
            <p className="text-sm text-[#8c826f]">Marketplace de vendas de produtos para gamers mobile, com transparência e segurança.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-[#222] bg-[#111] p-4">
            <ShieldCheck className="w-5 h-5 text-[#C9A962]" />
            <p className="mt-2 text-sm font-semibold text-[#E8E0C8]">Anúncios moderados</p>
            <p className="text-xs text-[#8c826f]">Os anúncios passam por validação antes de aparecerem na loja.</p>
          </div>
          <div className="rounded-xl border border-[#222] bg-[#111] p-4">
            <BadgeInfo className="w-5 h-5 text-[#C9A962]" />
            <p className="mt-2 text-sm font-semibold text-[#E8E0C8]">Taxas transparentes</p>
            <p className="text-xs text-[#8c826f]">Vês o total e a taxa de serviço antes de confirmar o pagamento.</p>
          </div>
          <div className="rounded-xl border border-[#222] bg-[#111] p-4">
            <Headset className="w-5 h-5 text-[#C9A962]" />
            <p className="mt-2 text-sm font-semibold text-[#E8E0C8]">Suporte e denúncias</p>
            <p className="text-xs text-[#8c826f]">Podes denunciar problemas e a equipa acompanha cada caso.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
