/* Comentario PT-PT: ficheiro de codigo da aplicacao LootBox mantido pela equipa. */
import { ArrowLeft, CircleDot, Heart, MessageCircle, ShoppingCart, Star } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMarketplace } from '@/hooks/useMarketplace';
import { useNotifications } from '@/hooks/useNotifications';
import { useProducts } from '@/hooks/useProducts';
import { useToast } from '@/hooks/use-toast';
import { getProductImages } from '@/lib/product-images';

interface ProductDetailPageProps {
  productId: string;
  onBack: () => void;
  onGoToCart: () => void;
  onGoToChat: () => void;
  onOpenSellerProfile: (sellerId: string) => void;
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          className={`w-3.5 h-3.5 ${value <= Math.round(rating) ? 'fill-[#D4AF37] text-[#D4AF37]' : 'text-[#5e5648]'}`}
        />
      ))}
    </div>
  );
}

export function ProductDetailPage({ productId, onBack, onGoToCart, onGoToChat, onOpenSellerProfile }: ProductDetailPageProps) {
  const { user, isAuthenticated, isBuyer, isAdmin } = useAuth();
  const { getProductById } = useProducts();
  const { isFavorite, toggleFavorite, addToCart, createOrGetConversation, getSellerRatingSummary } = useMarketplace();
  const { addNotification } = useNotifications();
  const { toast } = useToast();

  const product = useMemo(() => getProductById(productId), [getProductById, productId]);
  const productImages = useMemo(() => (product ? getProductImages(product) : []), [product]);
  const [selectedImage, setSelectedImage] = useState('');

  useEffect(() => {
    setSelectedImage(productImages[0] || '');
  }, [productImages]);

  if (!product) {
    return (
      <div className="pb-8 pt-4 px-3 md:px-6 w-full">
        <section className="panel-surface p-4 md:p-6">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm text-[#9a917a] hover:text-[#E8E0C8]"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
          <div className="mt-6 rounded-xl border border-[#222] bg-[#111] p-8 text-center">
            <p className="text-[#E8E0C8] text-lg font-semibold">Produto não encontrado</p>
            <p className="text-[#7f7661] text-sm mt-1">Este anúncio pode ter sido removido.</p>
          </div>
        </section>
      </div>
    );
  }

  const isSeller = user?.id === product.sellerId;
  const sold = product.status !== 'available';
  const sellerSummary = getSellerRatingSummary(product.sellerId);

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      toast({ title: 'Início de sessão necessário', description: 'Entra na tua conta para comprar.', variant: 'destructive' });
      return;
    }
    if (sold) {
      toast({ title: 'Produto indisponível', description: 'Este item já foi vendido.', variant: 'destructive' });
      return;
    }
    if (!isBuyer) {
      toast({ title: 'Acesso bloqueado', description: 'Apenas clientes podem adicionar produtos ao carrinho.', variant: 'destructive' });
      return;
    }
    if (isAdmin) {
      toast({ title: 'Conta de administrador', description: 'Os administradores podem gerir o site, mas não podem fazer compras.', variant: 'destructive' });
      return;
    }
    if (isSeller) {
      toast({ title: 'Operação inválida', description: 'Não podes comprar o teu próprio item.', variant: 'destructive' });
      return;
    }

    await addToCart(product.id);
    addNotification({
      title: 'Adicionado ao carrinho',
      message: `${product.name} foi adicionado ao teu carrinho.`,
      type: 'success',
    });
    toast({ title: 'Item adicionado', description: 'Abre o carrinho para concluir a compra.' });
    onGoToCart();
  };

  const handleOpenChat = async () => {
    if (!isAuthenticated || !user) {
      toast({ title: 'Início de sessão necessário', description: 'Entra para falar com o distribuidor.', variant: 'destructive' });
      return;
    }
    if (isSeller) {
      toast({ title: 'Informação', description: 'Este anúncio pertence-te.' });
      return;
    }

    await createOrGetConversation(user.id, product.sellerId, product.id);
    onGoToChat();
  };

  return (
    <div className="pb-8 pt-4 px-3 md:px-6 w-full">
      <section className="panel-surface p-3 md:p-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-[#9a917a] hover:text-[#E8E0C8] mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar aos produtos
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-4 md:gap-6 items-start">
          <div className="rounded-2xl border border-[#232323] bg-[#121212] p-2 md:p-3">
            <div className="rounded-xl overflow-hidden border border-[#1f1f1f] bg-[#0d0d0d] h-[260px] md:h-[340px] lg:h-[420px]">
              <img src={selectedImage || productImages[0]} alt={product.name} className="w-full h-full object-contain p-3" />
            </div>
            {productImages.length > 1 && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {productImages.map((image, index) => (
                  <button
                    key={`${product.id}-${index}`}
                    type="button"
                    onClick={() => setSelectedImage(image)}
                    className={`rounded-lg overflow-hidden border aspect-square bg-[#0d0d0d] ${selectedImage === image ? 'border-[#C9A962]' : 'border-[#232323]'}`}
                  >
                    <img src={image} alt={`${product.name} foto ${index + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[#232323] bg-[#111] p-4 md:p-6 flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.16em] text-[#8a816a]">{product.category}</p>
                <h1 className="text-2xl md:text-3xl font-bold text-[#E8E0C8] mt-1">{product.name}</h1>
              </div>
              <button
                onClick={() => void toggleFavorite(product.id)}
                className="h-10 w-10 shrink-0 rounded-full border border-[#2b2b2b] bg-[#161616] flex items-center justify-center"
                aria-label="Favoritar"
              >
                <Heart className={`w-5 h-5 ${isFavorite(product.id) ? 'text-red-400 fill-red-400' : 'text-[#9c9278]'}`} />
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-3xl font-extrabold gradient-text">{product.price.toFixed(2)} euros</p>
              <div
                className={`h-8 px-3 rounded-full border flex items-center gap-1.5 text-xs ${
                  sold
                    ? 'border-[#4a2424] bg-[#2a1717] text-[#f08f8f]'
                    : 'border-[#3e3727] bg-[#1f1a12] text-[#d8c28a]'
                }`}
              >
                <CircleDot className="w-3 h-3" />
                {sold ? 'Vendido' : 'Disponível'}
              </div>
            </div>

            <p className="mt-4 text-sm md:text-base text-[#b4aa90] leading-relaxed">{product.description}</p>

            <div className="mt-5 rounded-xl border border-[#232323] bg-[#0f0f0f] p-3 md:p-4">
              <p className="text-xs text-[#8a816a]">Distribuidor</p>
              <div className="mt-2 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C9A962] to-[#8B7355] text-[#0A0A0A] font-bold flex items-center justify-center overflow-hidden">
                  {product.seller.avatarUrl ? (
                    <img src={product.seller.avatarUrl} alt={product.seller.name} className="h-full w-full object-cover" />
                  ) : (
                    product.seller.avatar || product.seller.name.charAt(0)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[#E8E0C8] font-semibold text-sm">{product.seller.name}</p>
                  <p className="text-[#7f7661] text-xs">{product.seller.email}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Stars rating={sellerSummary.average} />
                    <span className="text-[11px] text-[#8a816a]">
                      {sellerSummary.total > 0 ? `${sellerSummary.average.toFixed(1)} · ${sellerSummary.total} avaliações` : 'Sem avaliações ainda'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenSellerProfile(product.sellerId)}
                  className="rounded-lg border border-[#2b2b2b] bg-[#161616] px-3 py-2 text-xs text-[#E8E0C8] hover:border-[#C9A962]/60"
                >
                  Ver perfil
                </button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2.5">
              <button
                onClick={() => void handleAddToCart()}
                disabled={sold || isSeller || !isBuyer || isAdmin}
                className="h-11 rounded-xl btn-gold inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShoppingCart className="w-4 h-4" />
                {sold ? 'Item vendido' : isSeller ? 'Este anúncio é teu' : isAdmin ? 'Administrador não pode comprar' : !isBuyer ? 'Reservado a clientes' : 'Adicionar ao carrinho e pagar'}
              </button>
              <button
                onClick={() => void handleOpenChat()}
                disabled={isSeller}
                className="h-11 px-4 rounded-xl border border-[#2b2b2b] bg-[#161616] text-[#E8E0C8] inline-flex items-center justify-center gap-2 hover:border-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MessageCircle className="w-4 h-4" />
                Conversar
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
