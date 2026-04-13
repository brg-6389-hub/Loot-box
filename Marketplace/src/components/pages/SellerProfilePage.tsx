/* Comentario PT-PT: ficheiro de codigo da aplicacao LootBox mantido pela equipa. */
import { ArrowLeft, Package, ShieldCheck, Star } from 'lucide-react';
import { useMemo } from 'react';
import { useMarketplace } from '@/hooks/useMarketplace';
import { useProducts } from '@/hooks/useProducts';
import { getPrimaryProductImage } from '@/lib/product-images';

interface SellerProfilePageProps {
  sellerId: string;
  onBack: () => void;
  onProductClick: (productId: string) => void;
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          className={`w-4 h-4 ${value <= Math.round(rating) ? 'fill-[#D4AF37] text-[#D4AF37]' : 'text-[#5e5648]'}`}
        />
      ))}
    </div>
  );
}

export function SellerProfilePage({ sellerId, onBack, onProductClick }: SellerProfilePageProps) {
  const { products } = useProducts();
  const { getReviewsForSeller, getSellerRatingSummary, orders } = useMarketplace();

  const sellerProducts = useMemo(
    () => products.filter((product) => product.sellerId === sellerId),
    [products, sellerId],
  );
  const seller = sellerProducts[0]?.seller;
  const activeProducts = sellerProducts.filter((product) => product.status === 'available');
  const summary = getSellerRatingSummary(sellerId);
  const sellerReviews = getReviewsForSeller(sellerId);
  const completedSales = orders.filter(
    (order) => order.status === 'completed' && (order.sellerIds || []).includes(sellerId),
  ).length;

  if (!seller) {
    return (
      <div className="pb-8 pt-4 px-3 md:px-6 w-full">
        <section className="panel-surface p-4 md:p-6">
          <button onClick={onBack} className="inline-flex items-center gap-2 text-sm text-[#9a917a] hover:text-[#E8E0C8]">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
          <div className="mt-6 rounded-xl border border-[#222] bg-[#111] p-8 text-center">
            <p className="text-[#E8E0C8] text-lg font-semibold">Perfil não encontrado</p>
            <p className="text-[#7f7661] text-sm mt-1">Este distribuidor pode não ter anúncios ativos.</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="pb-8 pt-4 px-3 md:px-6 w-full">
      <section className="panel-surface p-4 md:p-6 space-y-6">
        <button onClick={onBack} className="inline-flex items-center gap-2 text-sm text-[#9a917a] hover:text-[#E8E0C8]">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-[#222] bg-[#111] p-5">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#C9A962] to-[#8B7355] text-[#0A0A0A] font-bold text-2xl flex items-center justify-center overflow-hidden">
                {seller.avatarUrl ? (
                  <img src={seller.avatarUrl} alt={seller.name} className="h-full w-full object-cover" />
                ) : (
                  seller.avatar || seller.name.charAt(0)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-2xl font-bold text-[#E8E0C8]">{seller.name}</h2>
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#3e3727] bg-[#1f1a12] px-2.5 py-1 text-[11px] text-[#d8c28a]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Distribuidor
                  </span>
                </div>
                <p className="text-sm text-[#8c826f] mt-1">{seller.email}</p>
                <div className="mt-3 flex items-center gap-3">
                  <Stars rating={summary.average} />
                  <p className="text-sm text-[#E8E0C8] font-semibold">
                    {summary.total > 0 ? `${summary.average.toFixed(1)} / 5` : 'Sem avaliações ainda'}
                  </p>
                  {summary.total > 0 && (
                    <p className="text-xs text-[#8c826f]">({summary.total} avaliação{summary.total === 1 ? '' : 'ões'})</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[#222] bg-[#111] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[#8a816a]">Anúncios ativos</p>
              <p className="mt-2 text-3xl font-bold text-[#E8E0C8]">{activeProducts.length}</p>
            </div>
            <div className="rounded-2xl border border-[#222] bg-[#111] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[#8a816a]">Vendas concluídas</p>
              <p className="mt-2 text-3xl font-bold text-[#E8E0C8]">{completedSales}</p>
            </div>
            <div className="rounded-2xl border border-[#222] bg-[#111] p-4 col-span-2">
              <p className="text-xs uppercase tracking-[0.18em] text-[#8a816a]">Reputação</p>
              <div className="mt-3 space-y-2">
                {[5, 4, 3, 2, 1].map((value, index) => {
                  const count = summary.distribution[index];
                  const width = summary.total > 0 ? `${(count / summary.total) * 100}%` : '0%';
                  return (
                    <div key={value} className="flex items-center gap-3">
                      <span className="w-10 text-xs text-[#8c826f]">{value} estrela{value === 1 ? '' : 's'}</span>
                      <div className="h-2 flex-1 rounded-full bg-[#1a1a1a] overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#C9A962] to-[#D4AF37]" style={{ width }} />
                      </div>
                      <span className="w-6 text-right text-xs text-[#E8E0C8]">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#222] bg-[#111] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-[#C9A962]" />
            <h3 className="font-semibold text-[#E8E0C8]">Produtos ativos</h3>
          </div>
          {activeProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {activeProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onProductClick(product.id)}
                  className="rounded-xl border border-[#222] bg-[#0A0A0A] p-3 text-left hover:border-[#3a3326] transition-colors"
                >
                  <img
                    src={getPrimaryProductImage(product)}
                    alt={product.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-40 rounded-lg object-contain bg-[#141414] p-3"
                  />
                  <h4 className="mt-3 text-sm font-semibold text-[#E8E0C8] truncate">{product.name}</h4>
                  <p className="text-xs text-[#8c826f] truncate">{product.category}</p>
                  <p className="mt-2 text-[#C9A962] font-semibold">{product.price.toFixed(2)}€</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-[#222] bg-[#0A0A0A] p-6 text-center">
              <p className="text-[#8c826f] text-sm">Este distribuidor não tem produtos ativos neste momento.</p>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[#222] bg-[#111] p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="font-semibold text-[#E8E0C8]">Avaliações</h3>
            <p className="text-xs text-[#8c826f]">{sellerReviews.length} publicadas</p>
          </div>
          {sellerReviews.length > 0 ? (
            <div className="space-y-3">
              {sellerReviews.map((review) => (
                <div key={review.id} className="rounded-xl border border-[#222] bg-[#0A0A0A] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Stars rating={review.rating} />
                    <p className="text-xs text-[#8c826f]">{review.createdAt.toLocaleDateString('pt-PT')}</p>
                  </div>
                  <p className="mt-2 text-[#E8E0C8] text-sm">{review.comment || 'Sem comentário adicional.'}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-[#222] bg-[#0A0A0A] p-6 text-center">
              <p className="text-[#8c826f] text-sm">Ainda não existem avaliações públicas para este perfil.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
