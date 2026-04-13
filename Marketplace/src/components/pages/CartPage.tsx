/* Comentario PT-PT: ficheiro de codigo da aplicacao LootBox mantido pela equipa. */
import { useMemo, useState } from 'react';
import { Trash2, ShoppingCart, CreditCard } from 'lucide-react';
import { useMarketplace } from '@/hooks/useMarketplace';
import { useProducts } from '@/hooks/useProducts';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getPrimaryProductImage } from '@/lib/product-images';

export function CartPage() {
  const { user, isBuyer, isAdmin } = useAuth();
  const { cart, removeFromCart, clearCart, checkout } = useMarketplace();
  const { getProductById } = useProducts();
  const { addNotification } = useNotifications();
  const { toast } = useToast();

  const [shippingAddress, setShippingAddress] = useState('');
  const [selectedPayment, setSelectedPayment] = useState('');
  const [note, setNote] = useState('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const protectVisibleValue = (value: string, visible = 3) => {
    const compact = value.replace(/\s+/g, '');
    if (compact.length <= visible) return compact;
    return `${'*'.repeat(Math.max(0, compact.length - visible))}${compact.slice(-visible)}`;
  };

  const maskEmail = (value: string) => {
    const [name, domain] = value.split('@');
    if (!name || !domain) return value;
    return `${name.slice(0, 2)}${'*'.repeat(Math.max(1, name.length - 2))}@${domain}`;
  };

  const getSafePaymentMethodLabel = (method: NonNullable<typeof user>['paymentMethods'][number]) => {
    if (method.type === 'paypal' && method.email) return `PayPal ${maskEmail(method.email)}`;
    if (method.type === 'mbway' && method.phone) return `MB Way ${protectVisibleValue(method.phone, 3)}`;
    if (method.type === 'multibanco' && method.iban) return `Multibanco ${protectVisibleValue(method.iban, 4)}`;
    if (method.type === 'card' && method.last4) return `Cartão **** ${method.last4}`;
    if (method.type === 'other' && method.details) return `${method.label}`;
    return method.label;
  };

  const cartProducts = useMemo(
    () =>
      cart
        .map((item) => getProductById(item.productId))
        .filter((product): product is NonNullable<typeof product> => Boolean(product)),
    [cart, getProductById],
  );

  const subtotal = cartProducts.reduce((sum, item) => sum + item.price, 0);
  const serviceFee = subtotal * 0.04;
  const total = subtotal + serviceFee;

  const handleCheckout = async () => {
    if (!user) {
      toast({ title: 'Erro', description: 'Faz o início de sessão para concluir a compra.', variant: 'destructive' });
      return;
    }
    if (!isBuyer) {
      toast({ title: 'Acesso bloqueado', description: 'Apenas clientes podem concluir compras.', variant: 'destructive' });
      return;
    }
    if (isAdmin) {
      toast({ title: 'Conta de administrador', description: 'Os administradores podem gerir a plataforma, mas não podem comprar.', variant: 'destructive' });
      return;
    }
    if (!selectedPayment) {
      toast({ title: 'Erro', description: 'Seleciona um método de pagamento.', variant: 'destructive' });
      return;
    }
    if (!shippingAddress.trim()) {
      toast({ title: 'Erro', description: 'Preenche a morada de envio.', variant: 'destructive' });
      return;
    }

    setIsCheckingOut(true);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const result = await checkout({
      buyerId: user.id,
      paymentMethodId: selectedPayment,
      paymentMethodLabel: (() => {
        const method = user.paymentMethods.find((entry) => entry.id === selectedPayment);
        return method ? getSafePaymentMethodLabel(method) : undefined;
      })(),
      shippingAddress: shippingAddress.trim(),
      note: note.trim() || undefined,
    });

    setIsCheckingOut(false);
    if (!result.success) {
      toast({ title: 'Falha no pagamento', description: result.message, variant: 'destructive' });
      return;
    }

    addNotification({
      title: 'Pagamento aprovado',
      message: `Pedido ${result.order?.id} pago com sucesso.`,
      type: 'success',
    });
    toast({ title: 'Compra concluída', description: result.message });
    clearCart();
    setShippingAddress('');
    setSelectedPayment('');
    setNote('');
  };

  return (
    <div className="pb-8 pt-4 px-3 md:px-6 w-full">
      <section className="panel-surface p-4 md:p-5">
      {!isBuyer || isAdmin ? (
        <div className="bg-[#161010] rounded-xl border border-[#3a2525] p-8 text-center">
          <ShoppingCart className="w-10 h-10 text-[#7a5d5d] mx-auto mb-3" />
          <p className="text-[#E8E0C8]">Acesso reservado a clientes</p>
          <p className="text-[#b4aa90] text-sm mt-1">
            {isAdmin
              ? 'A conta de administrador serve apenas para gerir a plataforma e aprovar anúncios.'
              : 'Os perfis de distribuidor não podem aceder ao carrinho nem ao pagamento.'}
          </p>
        </div>
      ) : (
        <>
      <h2 className="text-2xl font-bold text-[#E8E0C8] mb-6">Carrinho</h2>

      {cartProducts.length === 0 ? (
        <div className="bg-[#111] rounded-xl border border-[#222] p-8 text-center">
          <ShoppingCart className="w-10 h-10 text-[#444] mx-auto mb-3" />
          <p className="text-[#E8E0C8]">O teu carrinho está vazio</p>
          <p className="text-[#666] text-sm mt-1">Adiciona produtos para avançar para o pagamento.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            {cartProducts.map((product) => (
              <div key={product.id} className="bg-[#111] rounded-xl p-3 border border-[#222] flex items-center gap-3">
                <img
                  src={getPrimaryProductImage(product)}
                  alt={product.name}
                  loading="lazy"
                  decoding="async"
                  className="w-16 h-16 rounded-lg object-cover bg-[#1a1a1a]"
                />
                <div className="flex-1">
                  <p className="text-[#E8E0C8] text-sm font-medium">{product.name}</p>
                  <p className="text-[#666] text-xs">{product.category}</p>
                  <p className="text-[#C9A962] font-semibold">{product.price.toFixed(2)}€</p>
                </div>
                <button
                  onClick={() => removeFromCart(product.id)}
                  className="p-2 text-[#666] hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="bg-[#111] rounded-xl p-4 border border-[#222] space-y-3">
            <h3 className="font-semibold text-[#E8E0C8] flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#C9A962]" />
              Pagamento
            </h3>

            <label className="text-xs text-[#A09060] block">
              Método de pagamento
              <select
                value={selectedPayment}
                onChange={(e) => setSelectedPayment(e.target.value)}
                className="mt-1 w-full h-10 rounded-lg border border-[#222] bg-[#0A0A0A] px-3 text-[#E8E0C8]"
              >
                <option value="">Selecionar</option>
                {user?.paymentMethods.map((method) => (
                  <option key={method.id} value={method.id}>
                    {getSafePaymentMethodLabel(method)}{method.isDefault ? ' (Principal)' : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs text-[#A09060] block">
              Morada de envio
              <Input
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                placeholder="Rua, nº, cidade, código postal"
                className="mt-1 bg-[#0A0A0A] border-[#222] text-[#E8E0C8]"
              />
            </label>

            <label className="text-xs text-[#A09060] block">
              Nota para o distribuidor (opcional)
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex: entregar após as 18h"
                className="mt-1 bg-[#0A0A0A] border-[#222] text-[#E8E0C8]"
              />
            </label>

            <div className="rounded-lg border border-[#2b251a] bg-[#15120d] p-3 text-xs text-[#d8c28a]">
              Ao confirmar o pagamento, os itens ficam reservados temporariamente durante o processo de pagamento para evitar compras duplicadas.
            </div>

            <div className="pt-2 border-t border-[#222] text-sm space-y-1">
              <div className="flex justify-between text-[#A09060]">
                <span>Subtotal</span>
                <span>{subtotal.toFixed(2)}€</span>
              </div>
              <div className="flex justify-between text-[#A09060]">
                <span>Taxa de serviço</span>
                <span>{serviceFee.toFixed(2)}€</span>
              </div>
              <div className="flex justify-between text-[#E8E0C8] font-semibold">
                <span>Total</span>
                <span>{total.toFixed(2)}€</span>
              </div>
            </div>

            <Button onClick={handleCheckout} className="w-full btn-gold" disabled={isCheckingOut}>
              {isCheckingOut ? 'A processar...' : 'Pagar agora'}
            </Button>
          </div>
        </div>
      )}
        </>
      )}
      </section>
    </div>
  );
}
