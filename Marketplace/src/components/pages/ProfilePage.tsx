/* Comentario PT-PT: ficheiro de codigo da aplicacao LootBox mantido pela equipa. */
import { useEffect, useState } from 'react';
import { LogOut, Package, ShoppingBag, CreditCard, Plus, Trash2, Copy, Pencil, PauseCircle, PlayCircle, Star, Truck, CheckCircle2, AlertTriangle, FileBadge2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPrimaryProductImage } from '@/lib/product-images';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useProducts } from '@/hooks/useProducts';
import { useMarketplace } from '@/hooks/useMarketplace';
import { useNotifications } from '@/hooks/useNotifications';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api';
import type { Order, PaymentMethodType, Product } from '@/types';

interface ProfilePageProps {
  onLogout: () => void;
  onOpenPersonalData: () => void;
}

export function ProfilePage({ onLogout, onOpenPersonalData }: ProfilePageProps) {
  const {
    user,
    logout,
    deleteAccount,
    addPaymentMethod,
    refreshPaymentMethods,
    setDefaultPaymentMethod,
    removePaymentMethod,
    isSeller,
    isBuyer,
    isAdmin,
    updateProfileDetails,
    requestPhoneVerification,
    verifyPhone,
  } = useAuth();
  const { getProductsBySellerId, products, removeProduct, updateProduct, duplicateProduct, togglePauseProduct } = useProducts();
  const { orders, updateOrderStatus, attachShipmentInfo, confirmOrderReceived, openDispute, submitReview, getSellerRatingSummary, hasReviewForOrder } = useMarketplace();
  const { addNotification } = useNotifications();
  const { toast } = useToast();

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [methodType, setMethodType] = useState<PaymentMethodType>('mbway');
  const [holderName, setHolderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [mbwayPhone, setMbwayPhone] = useState('');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [activeReviewKey, setActiveReviewKey] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [shippingDrafts, setShippingDrafts] = useState<Record<string, { trackingCode: string; shippingCarrier: string; shippingProof: string; shippingNote: string }>>({});
  const [activeDisputeOrderId, setActiveDisputeOrderId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeDetails, setDisputeDetails] = useState('');
  const [disputeEvidence, setDisputeEvidence] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profileUsername, setProfileUsername] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileAvatar, setProfileAvatar] = useState('');
  const [profileAvatarTouched, setProfileAvatarTouched] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [phoneVerifyCode, setPhoneVerifyCode] = useState('');
  const [phoneVerifyVisible, setPhoneVerifyVisible] = useState(false);
  const [phoneVerifyMasked, setPhoneVerifyMasked] = useState<string | null>(null);
  const [phoneVerifyDebug, setPhoneVerifyDebug] = useState<string | null>(null);
  const [cardVerifyOpen, setCardVerifyOpen] = useState(false);
  const [cardVerifyCode, setCardVerifyCode] = useState('');
  const [cardVerifyMasked, setCardVerifyMasked] = useState<string | null>(null);
  const [cardVerifyDebug, setCardVerifyDebug] = useState<string | null>(null);
  const [pendingCardMethod, setPendingCardMethod] = useState<{
    label: string;
    holderName?: string;
    last4: string;
    brand?: string;
    expiresAt: string;
  } | null>(null);

  if (!user) return null;

  const userProducts = getProductsBySellerId(user.id);
  const soldUserProducts = userProducts.filter((p) => p.status === 'sold');
  const userOrders = orders.filter((o) => o.buyerId === user.id);
  const sellerOrders = orders.filter(
    (order) =>
      (order.sellerIds || []).includes(user.id) ||
      order.itemIds.some((itemId) => products.find((product) => product.id === itemId)?.sellerId === user.id),
  );
  const sellerSummary = getSellerRatingSummary(user.id);

  useEffect(() => {
    if (!editingProductId) return;
    const product = products.find((item) => item.id === editingProductId);
    if (!product) return;
    setEditName(product.name);
    setEditDescription(product.description);
    setEditPrice(String(product.price));
    setEditCategory(product.category);
  }, [editingProductId, products]);

  useEffect(() => {
    setProfileName(user.name || '');
    setProfileUsername(user.username || '');
    setProfileEmail(user.email || '');
    setProfilePhone(user.phone || '');
    setProfileAvatar(user.avatarUrl || '');
    setProfileAvatarTouched(false);
    setPhoneVerifyVisible(Boolean(user.phone && !user.phoneVerified));
  }, [user]);

  const protectVisibleValue = (value: string, visible = 3) => {
    const compact = value.replace(/\s+/g, '');
    if (compact.length <= visible) return compact;
    return `${'*'.repeat(Math.max(0, compact.length - visible))}${compact.slice(-visible)}`;
  };

  const maskEmail = (value: string) => {
    const [name, domain] = value.split('@');
    if (!name || !domain) return value;
    const visible = name.slice(0, 2);
    return `${visible}${'*'.repeat(Math.max(1, name.length - 2))}@${domain}`;
  };

  const formatPaymentTypeLabel = (type: PaymentMethodType) => {
    switch (type) {
      case 'mbway':
        return 'MB Way';
      case 'multibanco':
        return 'Multibanco';
      case 'paypal':
        return 'PayPal';
      case 'card':
        return 'Cartão';
      case 'other':
        return 'Outro';
      default:
        return type;
    }
  };

  const closeAndReset = () => {
    setIsPaymentModalOpen(false);
    setHolderName('');
    setCardNumber('');
    setCardExpiry('');
    setCardCvc('');
    setPaypalEmail('');
    setMbwayPhone('');
    setMethodType('mbway');
  };

  const handleLogout = () => {
    logout();
    onLogout();
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profileUsername.trim() && profileUsername.trim().length < 3) {
      toast({ title: 'Nome de utilizador inválido', description: 'Usa pelo menos 3 caracteres.', variant: 'destructive' });
      return;
    }
    if (profileEmail.trim() && !profileEmail.includes('@')) {
      toast({ title: 'Email inválido', description: 'Indica um email válido.', variant: 'destructive' });
      return;
    }
    if (profilePhone.trim() && profilePhone.replace(/\D/g, '').length < 9) {
      toast({ title: 'Telemóvel inválido', description: 'Indica um número de telemóvel válido.', variant: 'destructive' });
      return;
    }
    if (!profileEmail.trim() && !profilePhone.trim()) {
      toast({ title: 'Dados insuficientes', description: 'Indica pelo menos um email ou um telemóvel.', variant: 'destructive' });
      return;
    }

    setIsProfileSaving(true);
    const result = await updateProfileDetails({
      name: profileName,
      username: profileUsername.replace(/^@+/, ''),
      email: profileEmail.trim() ? profileEmail : user.email,
      phone: profilePhone.trim(),
      avatarUrl: profileAvatarTouched ? profileAvatar : undefined,
    });
    setIsProfileSaving(false);

    if (!result.success) {
      toast({
        title: 'Erro ao atualizar',
        description:
          result.reason === 'email_exists'
            ? 'Este email já está registado.'
            : result.reason === 'username_exists'
              ? 'Este nome de utilizador já está registado.'
              : result.reason === 'phone_exists'
                ? 'Este número já está registado.'
                : result.reason === 'recent_login_required'
                  ? 'Por segurança, termina a sessão e volta a entrar para editar o email.'
                  : 'Não foi possível atualizar o perfil.',
        variant: 'destructive',
      });
      return;
    }

    if (result.requiresEmailVerification) {
      toast({
        title: 'Email alterado',
        description: 'Enviámos um email de verificação. Depois de confirmar, volta a iniciar sessão.',
      });
      onLogout();
      return;
    }

    if (result.phoneVerificationRequired) {
      setPhoneVerifyVisible(true);
      setPhoneVerifyMasked(result.phoneMasked || null);
      setPhoneVerifyDebug(result.debugCode || null);
      toast({ title: 'SMS enviado', description: 'Enviámos um código por SMS para confirmar o teu número.' });
      return;
    }

    toast({ title: 'Perfil atualizado', description: 'As tuas alterações foram guardadas.' });
    setIsProfileModalOpen(false);
  };

  const handleAvatarChange = (file: File | null) => {
    if (!file) return;
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: 'Imagem muito grande', description: 'Escolhe uma foto até 10MB.', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProfileAvatar(reader.result);
        setProfileAvatarTouched(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSendPhoneVerification = async () => {
    const res = await requestPhoneVerification(profilePhone);
    if (!res.success) {
      toast({
        title: 'SMS não enviado',
        description: res.reason === 'phone_exists' ? 'Este número já está associado a outra conta.' : 'Não foi possível enviar o SMS.',
        variant: 'destructive',
      });
      return;
    }
    setPhoneVerifyVisible(true);
    setPhoneVerifyMasked(res.phoneMasked || null);
    setPhoneVerifyDebug(res.debugCode || null);
    toast({ title: 'SMS enviado', description: 'Enviámos um código por SMS para confirmar o teu número.' });
  };

  const handleVerifyPhone = async () => {
    if (!phoneVerifyCode.trim()) {
      toast({ title: 'Código em falta', description: 'Escreve o código recebido por SMS.' });
      return;
    }
    const res = await verifyPhone(phoneVerifyCode);
    if (!res.success) {
      toast({
        title: 'Código inválido',
        description: res.reason === 'expired_code' ? 'O código expirou. Pede um novo SMS.' : 'O código não é válido.',
        variant: 'destructive',
      });
      return;
    }
    setPhoneVerifyVisible(false);
    setPhoneVerifyCode('');
    setPhoneVerifyDebug(null);
    setPhoneVerifyMasked(null);
    toast({ title: 'Telemóvel verificado', description: 'O teu número foi confirmado com sucesso.' });
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm('Tens a certeza que queres eliminar a tua conta? Esta acao e irreversivel.');
    if (!confirmed) return;

    const result = await deleteAccount();
    if (!result.success) {
      toast({
        title: 'Não foi possível eliminar a conta',
        description:
          result.reason === 'recent_login_required'
            ? 'Por segurança, termina a sessão e volta a entrar antes de eliminar a conta.'
            : 'Ocorreu um erro ao eliminar a conta.',
        variant: 'destructive',
      });
      return;
    }

    addNotification({
      title: 'Conta eliminada',
      message: 'A tua conta foi removida com sucesso.',
      type: 'info',
    });
    onLogout();
  };

  const handleDeleteSold = async (productId: string) => {
    const ok = await removeProduct(productId);
    if (!ok) {
      toast({ title: 'Erro', description: 'Não foi possível apagar o produto.', variant: 'destructive' });
      return;
    }
    addNotification({ title: 'Produto removido', message: 'Produto vendido removido.', type: 'info' });
    toast({ title: 'Removido', description: 'Produto vendido apagado.' });
  };

  const handleDeleteAllSold = async () => {
    if (soldUserProducts.length === 0) return;
    for (const product of soldUserProducts) {
      await removeProduct(product.id);
    }
    addNotification({
      title: 'Vendidos removidos',
      message: `${soldUserProducts.length} produto(s) vendido(s) removidos.`,
      type: 'info',
    });
    toast({ title: 'Concluído', description: 'Todos os vendidos foram apagados.' });
  };

  const handleSaveProductEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProductId) return;
    const ok = await updateProduct(editingProductId, {
      name: editName.trim(),
      description: editDescription.trim(),
      price: Number(editPrice),
      category: editCategory.trim(),
    });
    if (!ok) {
      toast({ title: 'Erro', description: 'Não foi possível atualizar o anúncio.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Anuncio atualizado', description: 'As alteracoes foram guardadas.' });
    setEditingProductId(null);
  };

  const handleSellerOrderStatusChange = async (orderId: string, status: Order['status']) => {
    if (status === 'shipped') {
      toast({ title: 'Falta o código de envio', description: 'Usa o formulário de envio para anexar o código de seguimento e o comprovativo.', variant: 'destructive' });
      return;
    }
    const ok = await updateOrderStatus(orderId, status);
    if (!ok) {
      toast({ title: 'Erro', description: 'Nao foi possivel atualizar o estado da encomenda.', variant: 'destructive' });
      return;
    }
    addNotification({
      title: 'Estado da encomenda atualizado',
      message: `O estado da encomenda passou para ${status}.`,
      type: 'success',
    });
    toast({
      title: 'Estado atualizado',
      description: 'O estado da encomenda foi atualizado.',
    });
  };

  const handleShipmentField = (orderId: string, field: 'trackingCode' | 'shippingCarrier' | 'shippingProof' | 'shippingNote', value: string) => {
    setShippingDrafts((current) => ({
      ...current,
      [orderId]: {
        trackingCode: current[orderId]?.trackingCode || '',
        shippingCarrier: current[orderId]?.shippingCarrier || '',
        shippingProof: current[orderId]?.shippingProof || '',
        shippingNote: current[orderId]?.shippingNote || '',
        [field]: value,
      },
    }));
  };

  const handleSubmitShipment = async (orderId: string) => {
    const draft = shippingDrafts[orderId];
    if (!draft?.trackingCode.trim()) {
      toast({ title: 'Código de envio obrigatório', description: 'Indica um código de seguimento antes de marcares a encomenda como enviada.', variant: 'destructive' });
      return;
    }
    const result = await attachShipmentInfo({
      orderId,
      sellerId: user.id,
      trackingCode: draft.trackingCode,
      shippingCarrier: draft.shippingCarrier,
      shippingProof: draft.shippingProof,
      shippingNote: draft.shippingNote,
    });
    if (!result.success) {
      toast({ title: 'Falha no envio', description: result.message, variant: 'destructive' });
      return;
    }
    addNotification({
      title: 'Encomenda enviada',
      message: `O pedido ${orderId} foi marcado como enviado com tracking.`,
      type: 'success',
    });
    toast({ title: 'Envio registado', description: result.message });
  };

  const handleConfirmReception = async (orderId: string) => {
    const result = await confirmOrderReceived(orderId, user.id);
    if (!result.success) {
      toast({ title: 'Não foi possível confirmar', description: result.message, variant: 'destructive' });
      return;
    }
    addNotification({
      title: 'Rececao confirmada',
      message: `A encomenda ${orderId} foi concluida pelo cliente.`,
      type: 'success',
    });
    toast({ title: 'Entrega concluida', description: result.message });
  };

  const handleOpenDispute = async (orderId: string) => {
    const result = await openDispute({
      orderId,
      openedBy: isBuyer ? 'buyer' : 'seller',
      reason: disputeReason,
      details: disputeDetails,
      evidence: disputeEvidence
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 5),
    });
    if (!result.success) {
      toast({ title: 'Não foi possível enviar a denúncia', description: result.message, variant: 'destructive' });
      return;
    }
    addNotification({
      title: 'Denúncia enviada',
      message: `A encomenda ${orderId} foi enviada para análise do administrador.`,
      type: 'warning',
    });
    toast({ title: 'Denúncia enviada', description: result.message });
    setActiveDisputeOrderId(null);
    setDisputeReason('');
    setDisputeDetails('');
    setDisputeEvidence('');
  };

  const handleSubmitReview = async (orderId: string, sellerId: string) => {
    const result = await submitReview({
      orderId,
      sellerId,
      buyerId: user.id,
      rating: reviewRating,
      comment: reviewComment,
    });
    if (!result.success) {
      toast({ title: 'Não foi possível publicar', description: result.message, variant: 'destructive' });
      return;
    }
    addNotification({
      title: 'Avaliacao publicada',
      message: 'A tua avaliação já está visível no perfil do distribuidor.',
      type: 'success',
    });
    toast({ title: 'Avaliacao enviada', description: result.message });
    setActiveReviewKey(null);
    setReviewRating(5);
    setReviewComment('');
  };

  const getPaymentMethodMeta = (method: NonNullable<typeof user>['paymentMethods'][number]) => {
    if (method.type === 'paypal' && method.email) return maskEmail(method.email);
    if (method.type === 'mbway' && method.phone) return protectVisibleValue(method.phone, 3);
    if (method.type === 'multibanco' && method.iban) return protectVisibleValue(method.iban, 4);
    if (method.type === 'card' && method.last4) return `**** ${method.last4}`;
    if (method.type === 'other' && method.details) return method.details;
    return method.holderName || undefined;
  };

  const getSafePaymentMethodLabel = (method: NonNullable<typeof user>['paymentMethods'][number]) => {
    const meta = getPaymentMethodMeta(method);
    return meta ? `${formatPaymentTypeLabel(method.type)} ${meta}` : formatPaymentTypeLabel(method.type);
  };

  const getOrderStatusLabel = (status: Order['status']) => {
    switch (status) {
      case 'paid':
        return 'Pago';
      case 'processing':
        return 'Em preparação';
      case 'shipped':
        return 'Enviado';
      case 'completed':
        return 'Concluído';
      default:
        return status;
    }
  };

  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();

    if (methodType === 'card') {
      const digits = cardNumber.replace(/\D/g, '');
      if (digits.length < 12 || digits.length > 19) {
        toast({ title: 'Erro', description: 'Número do cartão inválido.', variant: 'destructive' });
        return;
      }
      if (!cardExpiry.trim().match(/^(0[1-9]|1[0-2])\/\d{2}$/)) {
        toast({ title: 'Erro', description: 'Validade inválida (MM/AA).', variant: 'destructive' });
        return;
      }
      if (cardCvc.replace(/\D/g, '').length < 3) {
        toast({ title: 'Erro', description: 'CVC inválido.', variant: 'destructive' });
        return;
      }
      if (!user?.phone) {
        toast({
          title: 'Telemóvel em falta',
          description: 'Para adicionar cartão, confirma um número de telemóvel no perfil.',
          variant: 'destructive',
        });
        return;
      }
      const pending = {
        label: `Cartão **** ${digits.slice(-4)}`,
        holderName: holderName.trim() || undefined,
        last4: digits.slice(-4),
        brand: digits.startsWith('4') ? 'Visa' : digits.startsWith('5') ? 'Mastercard' : undefined,
        expiresAt: cardExpiry.trim(),
      };
      setPendingCardMethod(pending);
      void (async () => {
        try {
          const data = await apiFetch<{ phoneMasked?: string; debugSmsCode?: string }>('/api/payment-methods/card/request-code', {
            method: 'POST',
          });
          setCardVerifyMasked(data.phoneMasked || null);
          setCardVerifyDebug(data.debugSmsCode || null);
          setCardVerifyCode('');
          setCardVerifyOpen(true);
          toast({ title: 'Código enviado', description: 'Enviámos um código para confirmar o cartão.' });
        } catch (err) {
          toast({
            title: 'Falha no envio',
            description: err instanceof Error ? err.message : 'Não foi possível enviar o código.',
            variant: 'destructive',
          });
        }
      })();
      return;
    }

    if (methodType === 'paypal') {
      if (!paypalEmail.includes('@')) {
        toast({ title: 'Erro', description: 'Email PayPal inválido.', variant: 'destructive' });
        return;
      }
      void addPaymentMethod({
        type: 'paypal',
        label: `PayPal (${maskEmail(paypalEmail.trim())})`,
        email: paypalEmail.trim(),
      });
    }

    if (methodType === 'mbway') {
      if (mbwayPhone.replace(/\D/g, '').length < 9) {
        toast({ title: 'Erro', description: 'Número MB Way inválido.', variant: 'destructive' });
        return;
      }
      void addPaymentMethod({
        type: 'mbway',
        label: `MB Way (${protectVisibleValue(mbwayPhone.trim(), 3)})`,
        phone: mbwayPhone.trim(),
      });
    }

    addNotification({ title: 'Método adicionado', message: 'Pagamento guardado com sucesso.', type: 'success' });
    toast({ title: 'Método adicionado', description: 'Pagamento guardado com sucesso.' });
    closeAndReset();
  };

  const handleConfirmCardVerification = async () => {
    if (!cardVerifyCode.trim()) {
      toast({ title: 'Código em falta', description: 'Escreve o código recebido por SMS.' });
      return;
    }
    if (!pendingCardMethod) {
      toast({ title: 'Erro', description: 'Não foi possível validar o cartão.', variant: 'destructive' });
      return;
    }
    try {
      await apiFetch('/api/payment-methods/card/confirm', {
        method: 'POST',
        body: JSON.stringify({ code: cardVerifyCode.trim(), method: pendingCardMethod }),
      });
      await refreshPaymentMethods();
      addNotification({ title: 'Cartão confirmado', message: 'O cartão foi adicionado com sucesso.', type: 'success' });
      toast({ title: 'Cartão confirmado', description: 'O cartão foi adicionado com sucesso.' });
      setCardVerifyOpen(false);
      setPendingCardMethod(null);
      closeAndReset();
    } catch (err) {
      toast({
        title: 'Erro na verificação',
        description: err instanceof Error ? err.message : 'Não foi possível validar o cartão.',
        variant: 'destructive',
      });
    }
  };

  const handleSetDefaultPaymentMethod = async (methodId: string) => {
    await setDefaultPaymentMethod(methodId);
    toast({ title: 'Método principal atualizado', description: 'O método principal foi alterado com sucesso.' });
  };

  const handleRemovePaymentMethod = async (methodId: string) => {
    await removePaymentMethod(methodId);
    toast({ title: 'Método removido', description: 'O método de pagamento foi removido.' });
  };

  const handleDuplicateProduct = async (productId: string) => {
    const ok = await duplicateProduct(productId);
    if (!ok) {
      toast({ title: 'Falha ao duplicar', description: 'Não foi possível criar a cópia do anúncio.', variant: 'destructive' });
      return;
    }
    addNotification({ title: 'Anúncio duplicado', message: 'Foi criada uma cópia em rascunho do anúncio.', type: 'success' });
    toast({ title: 'Anúncio duplicado', description: 'A cópia ficou guardada como rascunho.' });
  };

  const handleTogglePauseProduct = async (product: Product) => {
    const ok = await togglePauseProduct(product.id);
    if (!ok) {
      toast({ title: 'Falha na alteração', description: 'Não foi possível atualizar o estado do anúncio.', variant: 'destructive' });
      return;
    }
    const resumed = product.status === 'paused';
    addNotification({
      title: resumed ? 'Anúncio reativado' : 'Anúncio pausado',
      message: resumed ? 'O anúncio voltou a ficar ativo.' : 'O anúncio foi pausado com sucesso.',
      type: 'success',
    });
    toast({
      title: resumed ? 'Anúncio reativado' : 'Anúncio pausado',
      description: resumed ? 'O produto voltou a ficar disponível.' : 'O produto ficou temporariamente pausado.',
    });
  };

  return (
    <div className="pb-8 pt-4 px-3 md:px-6 w-full">
      <section className="panel-surface p-4 md:p-5 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[#E8E0C8]">Perfil</h2>
          <Button variant="outline" size="sm" onClick={handleLogout} className="text-[#A09060] border-[#222] bg-[#121212]">
            <LogOut className="w-4 h-4 mr-1" />
            Sair
          </Button>
        </div>

        <div className="bg-[#111] rounded-xl p-4 border border-[#222]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-[#C9A962] to-[#8B7355] rounded-full flex items-center justify-center overflow-hidden">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-[#0A0A0A] font-bold text-lg">{user.avatar || user.name.charAt(0)}</span>
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-semibold text-[#E8E0C8]">{user.name}</h3>
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(true)}
                  className="text-xs text-[#C9A962] hover:text-[#E8E0C8]"
                >
                  Editar perfil
                </button>
                <button
                  type="button"
                  onClick={onOpenPersonalData}
                  className="text-xs text-[#8c826f] hover:text-[#E8E0C8]"
                >
                  Ver dados pessoais
                </button>
              </div>
              <p className="text-sm text-[#666]">@{profileUsername.trim() || user.username || 'user'}</p>
              {isSeller && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Star
                        key={value}
                        className={`w-4 h-4 ${value <= Math.round(sellerSummary.average) ? 'fill-[#D4AF37] text-[#D4AF37]' : 'text-[#5e5648]'}`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-[#8c826f]">
                    {sellerSummary.total > 0 ? `${sellerSummary.average.toFixed(1)} em ${sellerSummary.total} avaliações` : 'Sem avaliações ainda'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        <Dialog open={isProfileModalOpen} onOpenChange={setIsProfileModalOpen}>
          <DialogContent className="sm:max-w-lg border-0 bg-[#111]">
            <DialogHeader>
              <DialogTitle className="text-[#E8E0C8]">Editar perfil</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleProfileSave} className="space-y-3">
              <div className="flex flex-wrap items-center gap-4 rounded-xl border border-[#27221a] bg-gradient-to-br from-[#0f0c07] to-[#14110b] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
                <div className="h-16 w-16 rounded-full border border-[#3a2f1e] bg-[#0A0A0A] flex items-center justify-center overflow-hidden shadow-[0_10px_20px_rgba(0,0,0,0.35)]">
                  {profileAvatar ? (
                    <img src={profileAvatar} alt={profileName} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[#E8E0C8] font-semibold text-lg">
                      {(profileName || user.name || 'U').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#E2D2A2]">Foto de perfil</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#3e3727] bg-[#16110b] px-4 py-2 text-xs font-semibold text-[#E8E0C8] hover:border-[#C9A962]/70 hover:text-[#fff3d4]">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleAvatarChange(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                      Escolher foto
                    </label>
                    {profileAvatar ? (
                      <button
                        type="button"
                        onClick={() => {
                          setProfileAvatar('');
                          setProfileAvatarTouched(true);
                        }}
                        className="text-xs text-[#9b8f75] hover:text-[#E8E0C8]"
                      >
                        Remover
                      </button>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-[#7a725f]">PNG ou JPG até 10MB.</p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="profile-name" className="text-sm font-medium text-[#A09060]">
                    Nome
                  </Label>
                  <Input
                    id="profile-name"
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full h-11 rounded-lg bg-[#0A0A0A] border-[#222] text-[#E8E0C8]"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-username" className="text-sm font-medium text-[#A09060]">
                    Nome de utilizador
                  </Label>
                  <div className="flex items-center rounded-lg border border-[#222] bg-[#0A0A0A] h-11">
                    <span className="px-3 text-[#8c826f]">@</span>
                    <input
                      id="profile-username"
                      type="text"
                      value={profileUsername}
                      onChange={(e) => setProfileUsername(e.target.value.replace(/^@+/, ''))}
                      className="h-10 w-full bg-transparent pr-3 text-[#E8E0C8] outline-none"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                <Label htmlFor="profile-email" className="text-sm font-medium text-[#A09060]">
                  Email (opcional)
                </Label>
                  <Input
                    id="profile-email"
                    type="email"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    className="w-full h-11 rounded-lg bg-[#0A0A0A] border-[#222] text-[#E8E0C8]"
                  />
                </div>
                <div className="space-y-2">
                <Label htmlFor="profile-phone" className="text-sm font-medium text-[#A09060]">
                  Telemóvel (opcional)
                </Label>
                  <Input
                    id="profile-phone"
                    type="tel"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    className="w-full h-11 rounded-lg bg-[#0A0A0A] border-[#222] text-[#E8E0C8]"
                  />
                </div>
              </div>
              <Button type="submit" disabled={isProfileSaving} className="w-full h-11 btn-gold rounded-lg font-semibold">
                {isProfileSaving ? 'A guardar...' : 'Guardar alterações'}
              </Button>
            </form>

            {phoneVerifyVisible && (
              <div className="mt-4 rounded-lg border border-[#2b2b2b] bg-[#0c0c0c] p-3 space-y-3">
                <div>
                  <p className="text-sm text-[#E8E0C8] font-medium">Verificar telemóvel</p>
                  <p className="text-xs text-[#8a816a]">
                    {phoneVerifyMasked ? `Código enviado para ${phoneVerifyMasked}.` : 'Envia um código por SMS para confirmar o número.'}
                  </p>
                  {phoneVerifyDebug ? <p className="text-[11px] text-[#d8c28a]">Código de teste: {phoneVerifyDebug}</p> : null}
                </div>
                <Input
                  type="text"
                  placeholder="Código SMS"
                  value={phoneVerifyCode}
                  onChange={(e) => setPhoneVerifyCode(e.target.value)}
                  className="w-full h-11 rounded-lg bg-[#0A0A0A] border-[#222] text-[#E8E0C8]"
                />
                <div className="flex flex-col gap-2">
                  <Button onClick={() => void handleVerifyPhone()} className="w-full h-11 btn-gold rounded-lg font-semibold">
                    Confirmar código
                  </Button>
                  <button
                    type="button"
                    onClick={() => void handleSendPhoneVerification()}
                    className="w-full h-10 rounded-lg border border-[#2b2b2b] text-[#A09060] hover:text-[#E8E0C8]"
                  >
                    Reenviar SMS
                  </button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>


        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#C9A962]" />
              <h3 className="font-semibold text-[#E8E0C8]">
                {isAdmin ? 'Conta de administração' : `${isSeller ? 'Receber pagamentos' : 'Métodos de pagamento'} (${user.paymentMethods.length})`}
              </h3>
            </div>
            {!isAdmin && (
              <button type="button" onClick={() => setIsPaymentModalOpen(true)} className="text-[#C9A962] text-sm flex items-center gap-1">
                <Plus className="w-4 h-4" />
                Adicionar
              </button>
            )}
          </div>
          {isAdmin ? (
            <div className="rounded-xl border border-[#2b251a] bg-[#15120d] p-4 text-sm text-[#d8c28a]">
              Esta conta está reservada à gestão da plataforma. O administrador pode ver produtos, moderar anúncios e gerir utilizadores, mas não pode comprar.
            </div>
          ) : (
            <div className="space-y-2">
              {user.paymentMethods.map((method) => (
                <div key={method.id} className="bg-[#111] rounded-xl p-3 border border-[#222] flex items-center justify-between">
                  <div>
                    <p className="text-[#E8E0C8] text-sm">
                      {getSafePaymentMethodLabel(method)} {method.isDefault ? <span className="text-[#C9A962]">(Principal)</span> : null}
                    </p>
                    <p className="text-[#666] text-xs">{formatPaymentTypeLabel(method.type)}</p>
                    {getPaymentMethodMeta(method) && <p className="text-[#666] text-xs">{getPaymentMethodMeta(method)}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {!method.isDefault && (
                      <button
                        type="button"
                        onClick={() => void handleSetDefaultPaymentMethod(method.id)}
                        className="text-xs px-2 py-1 rounded border border-[#333] text-[#A09060]"
                      >
                        Definir principal
                      </button>
                    )}
                    <button type="button" onClick={() => void handleRemovePaymentMethod(method.id)} className="p-2 text-[#666] hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {user.paymentMethods.length === 0 && (
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="w-full bg-[#111] rounded-xl p-4 border border-[#222] border-dashed text-[#666]"
                >
                  Adicionar método de pagamento
                </button>
              )}
            </div>
          )}
        </div>

        {isSeller && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-[#C9A962]" />
              <h3 className="font-semibold text-[#E8E0C8]">Meus Produtos ({userProducts.length})</h3>
            </div>
            {soldUserProducts.length > 0 && (
              <button
                onClick={() => void handleDeleteAllSold()}
                className="text-xs px-3 py-1.5 rounded-lg border border-[#3a2a2a] text-red-300 hover:bg-[#221515]"
              >
                Apagar vendidos ({soldUserProducts.length})
              </button>
            )}
          </div>

          {userProducts.length > 0 ? (
            <div className="space-y-3">
              {userProducts.map((product) => (
                <div key={product.id} className="bg-[#111] rounded-xl p-3 border border-[#222] flex items-center gap-3">
                  <img src={getPrimaryProductImage(product)} alt={product.name} className="w-14 h-14 rounded-lg object-cover bg-[#1a1a1a]" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-[#E8E0C8] text-sm truncate">{product.name}</h4>
                    <p className="text-[#C9A962] font-semibold text-sm">{product.price.toFixed(2)}€</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      product.status === 'available'
                        ? 'bg-[#C9A962]/20 text-[#C9A962]'
                        : product.status === 'pending_review'
                          ? 'bg-[#2f2a1b] text-[#d8c28a]'
                        : product.status === 'draft'
                          ? 'bg-[#2f2935] text-[#d4b4ff]'
                          : product.status === 'paused'
                            ? 'bg-[#3a321d] text-[#d8c28a]'
                            : product.status === 'rejected'
                              ? 'bg-[#351d1d] text-[#f2aaaa]'
                            : 'bg-[#333] text-[#999]'
                    }`}
                  >
                    {product.status === 'available'
                      ? 'Disponivel'
                      : product.status === 'pending_review'
                        ? 'Pendente'
                        : product.status === 'draft'
                          ? 'Rascunho'
                          : product.status === 'paused'
                            ? 'Pausado'
                            : product.status === 'rejected'
                              ? 'Rejeitado'
                              : 'Vendido'}
                  </span>
                  <button type="button" onClick={() => setEditingProductId(product.id)} className="p-2 text-[#A09060] hover:text-[#E8E0C8]">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => void handleDuplicateProduct(product.id)} className="p-2 text-[#A09060] hover:text-[#E8E0C8]">
                    <Copy className="w-4 h-4" />
                  </button>
                  {product.status !== 'sold' && (
                    <button type="button" onClick={() => void handleTogglePauseProduct(product)} className="p-2 text-[#A09060] hover:text-[#E8E0C8]">
                      {product.status === 'paused' ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
                    </button>
                  )}
                  {product.status === 'sold' && (
                    <button type="button" onClick={() => void handleDeleteSold(product.id)} className="p-2 text-red-300 hover:text-red-200">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#111] rounded-xl p-6 text-center border border-[#222]">
              <p className="text-[#666] text-sm">Ainda não publicaste nenhum produto.</p>
            </div>
          )}
        </div>
        )}

        {isSeller && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ShoppingBag className="w-5 h-5 text-[#C9A962]" />
            <h3 className="font-semibold text-[#E8E0C8]">Vendas ({sellerOrders.length})</h3>
          </div>
          <div className="space-y-3">
            {sellerOrders.map((order) => {
              const sellerItems = order.itemIds
                .map((id) => products.find((product) => product.id === id))
                .filter((product): product is Product => Boolean(product && product.sellerId === user.id));
              return (
                <div key={order.id} className="bg-[#111] rounded-xl p-4 border border-[#222] space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[#E8E0C8] font-semibold text-sm">{order.id}</p>
                      <p className="text-[#666] text-xs">{sellerItems.length} item(ns) desta venda</p>
                    </div>
                    <select
                      value={order.status}
                      onChange={(e) => void handleSellerOrderStatusChange(order.id, e.target.value as Order['status'])}
                      className="h-9 rounded-lg border border-[#222] bg-[#0A0A0A] px-3 text-sm text-[#E8E0C8]"
                    >
                      <option value="paid">Pago</option>
                      <option value="processing">Em preparação</option>
                    </select>
                  </div>
                  {order.reservationExpiresAt && order.status !== 'completed' && (
                    <div className="rounded-lg border border-[#2b251a] bg-[#15120d] p-3 text-xs text-[#d8c28a]">
                      Reserva de checkout criada até {order.reservationExpiresAt.toLocaleString('pt-PT')}.
                    </div>
                  )}
                  {(order.status === 'paid' || order.status === 'processing') && (
                    <div className="rounded-lg border border-[#222] bg-[#0A0A0A] p-3 space-y-3">
                      <p className="text-sm font-medium text-[#E8E0C8]">Dados de envio</p>
                      <div className="grid gap-3 md:grid-cols-2">
                        <input
                          value={shippingDrafts[order.id]?.trackingCode || order.trackingCode || ''}
                          onChange={(e) => handleShipmentField(order.id, 'trackingCode', e.target.value)}
                        placeholder="Código de seguimento"
                          className="h-10 rounded-lg border border-[#222] bg-[#111] px-3 text-sm text-[#E8E0C8]"
                        />
                        <input
                          value={shippingDrafts[order.id]?.shippingCarrier || order.shippingCarrier || ''}
                          onChange={(e) => handleShipmentField(order.id, 'shippingCarrier', e.target.value)}
                          placeholder="Transportadora"
                          className="h-10 rounded-lg border border-[#222] bg-[#111] px-3 text-sm text-[#E8E0C8]"
                        />
                        <input
                          value={shippingDrafts[order.id]?.shippingProof || order.shippingProof || ''}
                          onChange={(e) => handleShipmentField(order.id, 'shippingProof', e.target.value)}
                          placeholder="Link do comprovativo"
                          className="h-10 rounded-lg border border-[#222] bg-[#111] px-3 text-sm text-[#E8E0C8] md:col-span-2"
                        />
                        <input
                          value={shippingDrafts[order.id]?.shippingNote || order.shippingNote || ''}
                          onChange={(e) => handleShipmentField(order.id, 'shippingNote', e.target.value)}
                          placeholder="Nota do envio"
                          className="h-10 rounded-lg border border-[#222] bg-[#111] px-3 text-sm text-[#E8E0C8] md:col-span-2"
                        />
                      </div>
                      <Button onClick={() => void handleSubmitShipment(order.id)} className="btn-gold">
                        <FileBadge2 className="w-4 h-4 mr-2" />
                        Registar envio
                      </Button>
                    </div>
                  )}
                  {order.status === 'shipped' && (
                    <div className="rounded-lg border border-[#2f2719] bg-[#1a150f] p-3 text-xs text-[#d8c28a]">
                      Esta encomenda já foi enviada. Agora o cliente precisa de confirmar a receção para a venda ficar concluída.
                    </div>
                  )}
                  {order.trackingCode && (
                    <div className="rounded-lg border border-[#222] bg-[#0A0A0A] p-3 text-xs text-[#8c826f]">
                      Código de seguimento: <span className="text-[#E8E0C8]">{order.trackingCode}</span>
                      {order.shippingCarrier ? <span> · {order.shippingCarrier}</span> : null}
                      {order.shippingProof ? <span> · comprovativo anexado</span> : null}
                    </div>
                  )}
                  {order.dispute && (
                    <div className="rounded-lg border border-[#4a2e1f] bg-[#20150f] p-3 text-sm text-[#f2c8a8]">
                      Denúncia {order.dispute.status === 'open' ? 'aberta' : order.dispute.status === 'resolved' ? 'resolvida' : 'encerrada'}: {order.dispute.reason}
                      {order.dispute.evidence?.length ? (
                        <p className="mt-1 text-xs text-[#e5d3c2]">Evidência: {order.dispute.evidence.join(', ')}</p>
                      ) : null}
                      {order.dispute.resolutionNote ? <p className="mt-1 text-xs text-[#e5d3c2]">Resposta do admin: {order.dispute.resolutionNote}</p> : null}
                    </div>
                  )}
                  {sellerItems.map((product) => (
                    <div key={`${order.id}-${product.id}`} className="flex items-center gap-3 rounded-lg border border-[#222] bg-[#0A0A0A] p-3">
                      <img src={getPrimaryProductImage(product)} alt={product.name} className="w-12 h-12 rounded-lg object-cover bg-[#1a1a1a]" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[#E8E0C8] text-sm truncate">{product.name}</p>
                        <p className="text-[#666] text-xs">{product.price.toFixed(2)}€</p>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
            {sellerOrders.length === 0 && (
              <div className="bg-[#111] rounded-xl p-6 text-center border border-[#222]">
                <p className="text-[#666] text-sm">Ainda nao tens vendas registadas.</p>
              </div>
            )}
          </div>
        </div>
        )}

        {isBuyer && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ShoppingBag className="w-5 h-5 text-[#C9A962]" />
            <h3 className="font-semibold text-[#E8E0C8]">Compras ({userOrders.length})</h3>
          </div>
          <div className="space-y-3">
            {userOrders.map((order) => (
              <div key={order.id} className="bg-[#111] rounded-xl p-4 border border-[#222] space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[#E8E0C8] font-semibold text-sm">{order.id}</p>
                    <p className="text-[#666] text-xs">
                      Pago online · Entrega em casa
                    </p>
                  </div>
                  <span className="rounded-full border border-[#3e3727] bg-[#1f1a12] px-3 py-1 text-xs text-[#d8c28a]">
                    {getOrderStatusLabel(order.status)}
                  </span>
                </div>
                {order.shippingAddress && (
                  <div className="rounded-lg border border-[#222] bg-[#0A0A0A] p-3 text-sm">
                    <div className="flex items-center gap-2 text-[#E8E0C8]">
                      <Truck className="w-4 h-4 text-[#C9A962]" />
                      <span>Entrega para {order.shippingAddress}</span>
                    </div>
                    {order.paymentMethodLabel && (
                      <p className="mt-1 text-xs text-[#8c826f]">Pagamento: {order.paymentMethodLabel}</p>
                    )}
                    {order.trackingCode && (
                      <p className="mt-1 text-xs text-[#8c826f]">Tracking: {order.trackingCode}{order.shippingCarrier ? ` · ${order.shippingCarrier}` : ''}</p>
                    )}
                    {order.shippingProof && (
                      <p className="mt-1 text-xs text-[#8c826f]">Comprovativo anexado pelo distribuidor.</p>
                    )}
                  </div>
                )}
                {order.itemIds
                  .map((id) => products.find((product) => product.id === id))
                  .filter((product): product is Product => Boolean(product))
                  .map((product) => (
                    <div key={`${order.id}-${product.id}`} className="flex items-center gap-3 rounded-lg border border-[#222] bg-[#0A0A0A] p-3">
                      <img src={getPrimaryProductImage(product)} alt={product.name} className="w-12 h-12 rounded-lg object-cover bg-[#1a1a1a]" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-[#E8E0C8] text-sm truncate">{product.name}</h4>
                        <p className="text-[#C9A962] font-semibold text-sm">{product.price.toFixed(2)}€</p>
                      </div>
                    </div>
                  ))}
                {order.status === 'shipped' && (
                  <Button
                    onClick={() => void handleConfirmReception(order.id)}
                    className="w-full btn-gold"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Confirmar receção
                  </Button>
                )}
                <div className="space-y-3">
                  {!order.dispute && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDisputeOrderId(activeDisputeOrderId === order.id ? null : order.id);
                        setDisputeReason('');
                        setDisputeDetails('');
                        setDisputeEvidence('');
                      }}
                      className="w-full rounded-lg border border-[#513131] bg-[#211414] px-4 py-2 text-sm text-red-200"
                    >
                      <AlertTriangle className="w-4 h-4 inline mr-2" />
                      Denunciar problema nesta encomenda
                    </button>
                  )}
                  {activeDisputeOrderId === order.id && !order.dispute && (
                    <div className="rounded-lg border border-[#513131] bg-[#181010] p-3 space-y-3">
                      <input
                        value={disputeReason}
                        onChange={(e) => setDisputeReason(e.target.value)}
                        placeholder="Motivo da denúncia"
                        className="h-10 w-full rounded-lg border border-[#5a3636] bg-[#111] px-3 text-sm text-[#E8E0C8]"
                      />
                      <textarea
                        value={disputeDetails}
                        onChange={(e) => setDisputeDetails(e.target.value)}
                        placeholder="Explica o problema para o admin analisar."
                        className="min-h-[96px] w-full rounded-lg border border-[#5a3636] bg-[#111] px-3 py-2 text-sm text-[#E8E0C8]"
                      />
                      <textarea
                        value={disputeEvidence}
                        onChange={(e) => setDisputeEvidence(e.target.value)}
                        placeholder="Links de evidência (um por linha)"
                        className="min-h-[70px] w-full rounded-lg border border-[#5a3636] bg-[#111] px-3 py-2 text-sm text-[#E8E0C8]"
                      />
                      <Button onClick={() => void handleOpenDispute(order.id)} className="w-full border border-[#6b3b3b] bg-[#221515] text-red-100 hover:bg-[#2a1717]">
                        Enviar denúncia
                      </Button>
                    </div>
                  )}
                  {order.dispute && (
                    <div className="rounded-lg border border-[#513131] bg-[#181010] p-3 text-sm text-[#f0c4c4]">
                      Denúncia {order.dispute.status === 'open' ? 'em análise pelo admin' : order.dispute.status === 'resolved' ? 'resolvida' : 'fechada'}.
                      {order.dispute.evidence?.length ? (
                        <p className="mt-1 text-xs text-[#e6d8d8]">Evidência: {order.dispute.evidence.join(', ')}</p>
                      ) : null}
                      {order.dispute.resolutionNote ? <p className="mt-1 text-xs text-[#e6d8d8]">Resposta do admin: {order.dispute.resolutionNote}</p> : null}
                    </div>
                  )}
                </div>
                {order.status === 'completed' && (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-[#203524] bg-[#101a12] p-3 text-sm text-[#b8d7bd]">
                      A entrega foi confirmada. Agora já podes avaliar o distribuidor.
                    </div>
                    {Array.from(
                      new Map(
                        order.itemIds
                          .map((id) => products.find((product) => product.id === id))
                          .filter((product): product is Product => Boolean(product))
                          .map((product) => [product.sellerId, product.seller]),
                      ).values(),
                    ).map((seller) => {
                      const reviewKey = `${order.id}:${seller.id}`;
                      const alreadyReviewed = hasReviewForOrder(order.id, seller.id);
                      const isOpen = activeReviewKey === reviewKey;
                      return (
                        <div key={reviewKey} className="rounded-lg border border-[#222] bg-[#0A0A0A] p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[#E8E0C8] text-sm font-medium">{seller.name}</p>
                              <p className="text-xs text-[#8c826f]">
                                {alreadyReviewed ? 'Avaliacao ja publicada' : 'Partilha como correu esta compra'}
                              </p>
                            </div>
                            {!alreadyReviewed && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveReviewKey(isOpen ? null : reviewKey);
                                  setReviewRating(5);
                                  setReviewComment('');
                                }}
                                className="rounded-lg border border-[#2b2b2b] bg-[#161616] px-3 py-2 text-xs text-[#E8E0C8]"
                              >
                                {isOpen ? 'Fechar' : 'Avaliar'}
                              </button>
                            )}
                          </div>
                          {isOpen && !alreadyReviewed && (
                            <div className="mt-3 space-y-3">
                              <div className="flex items-center gap-2">
                                {[1, 2, 3, 4, 5].map((value) => (
                                  <button
                                    key={value}
                                    type="button"
                                    onClick={() => setReviewRating(value)}
                                    className="p-1"
                                  >
                                    <Star
                                      className={`w-5 h-5 ${value <= reviewRating ? 'fill-[#D4AF37] text-[#D4AF37]' : 'text-[#5e5648]'}`}
                                    />
                                  </button>
                                ))}
                              </div>
                              <textarea
                                value={reviewComment}
                                onChange={(e) => setReviewComment(e.target.value)}
                                placeholder="Conta ao resto da comunidade como foi a experiencia."
                                className="min-h-[96px] w-full rounded-lg border border-[#222] bg-[#111] px-3 py-2 text-sm text-[#E8E0C8] outline-none focus:border-[#C9A962]"
                              />
                              <Button onClick={() => void handleSubmitReview(order.id, seller.id)} className="btn-gold">
                                Publicar avaliação
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            {userOrders.length === 0 && (
              <div className="bg-[#111] rounded-xl p-6 text-center border border-[#222]">
                <p className="text-[#666] text-sm">Ainda nao fizeste nenhuma compra.</p>
              </div>
            )}
          </div>
        </div>
        )}

        <div className="rounded-xl border border-[#3a2525] bg-[#161010] p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-semibold text-[#E8E0C8]">Eliminar conta</h3>
              <p className="text-sm text-[#b4aa90] mt-1">Remove a tua conta e os dados associados a esta sessão.</p>
            </div>
            <Button
              variant="outline"
              onClick={() => void handleDeleteAccount()}
              className="border-[#6b3b3b] bg-[#221515] text-red-200 hover:bg-[#2a1717] hover:text-red-100"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar conta
            </Button>
          </div>
        </div>
      </section>

      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-md bg-[#111] border-[#222] text-[#E8E0C8]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Adicionar pagamento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddPayment} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-[#A09060]">Tipo</Label>
              <select
                value={methodType}
                onChange={(e) => setMethodType(e.target.value as PaymentMethodType)}
                className="w-full h-11 rounded-lg border border-[#222] px-3 bg-[#0A0A0A] text-[#E8E0C8]"
              >
                <option value="paypal">PayPal</option>
                <option value="mbway">MB Way</option>
                <option value="card">Cartão</option>
              </select>
            </div>
            {methodType === 'card' && (
              <div className="space-y-3">
                <Input placeholder="Número do cartão" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} className="bg-[#0A0A0A] border-[#222] text-[#E8E0C8]" />
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Validade (MM/AA)" value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} className="bg-[#0A0A0A] border-[#222] text-[#E8E0C8]" />
                  <Input placeholder="CVC" value={cardCvc} onChange={(e) => setCardCvc(e.target.value)} className="bg-[#0A0A0A] border-[#222] text-[#E8E0C8]" />
                </div>
                <Input placeholder="Titular (opcional)" value={holderName} onChange={(e) => setHolderName(e.target.value)} className="bg-[#0A0A0A] border-[#222] text-[#E8E0C8]" />
              </div>
            )}
            {methodType === 'paypal' && (
              <Input placeholder="email@paypal.com" value={paypalEmail} onChange={(e) => setPaypalEmail(e.target.value)} className="bg-[#0A0A0A] border-[#222] text-[#E8E0C8]" />
            )}
            {methodType === 'mbway' && (
              <Input placeholder="912345678" value={mbwayPhone} onChange={(e) => setMbwayPhone(e.target.value)} className="bg-[#0A0A0A] border-[#222] text-[#E8E0C8]" />
            )}
            <Button type="submit" className="w-full btn-gold rounded-lg font-semibold">
              Guardar método
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={cardVerifyOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCardVerifyOpen(false);
            setPendingCardMethod(null);
            setCardVerifyCode('');
          }
        }}
      >
        <DialogContent className="sm:max-w-sm bg-[#111] border-[#222] text-[#E8E0C8]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Confirmar cartão</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-[#b4aa90]">
              {cardVerifyMasked ? `Enviámos um código para ${cardVerifyMasked}.` : 'Enviámos um código para o teu telemóvel.'}
            </p>
            {cardVerifyDebug ? <p className="text-[11px] text-[#d8c28a]">Código de teste: {cardVerifyDebug}</p> : null}
            <Input
              placeholder="Código SMS"
              value={cardVerifyCode}
              onChange={(e) => setCardVerifyCode(e.target.value)}
              className="bg-[#0A0A0A] border-[#222] text-[#E8E0C8]"
            />
            <Button onClick={() => void handleConfirmCardVerification()} className="w-full btn-gold rounded-lg font-semibold">
              Confirmar cartão
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingProductId)} onOpenChange={(open) => !open && setEditingProductId(null)}>
        <DialogContent className="sm:max-w-md bg-[#111] border-[#222] text-[#E8E0C8]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Editar anúncio</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveProductEdit} className="space-y-4 mt-4">
            <Input placeholder="Nome" value={editName} onChange={(e) => setEditName(e.target.value)} className="bg-[#0A0A0A] border-[#222] text-[#E8E0C8]" />
            <Input placeholder="Categoria" value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="bg-[#0A0A0A] border-[#222] text-[#E8E0C8]" />
            <Input placeholder="Preço" type="number" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="bg-[#0A0A0A] border-[#222] text-[#E8E0C8]" />
            <Input placeholder="Descrição" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="bg-[#0A0A0A] border-[#222] text-[#E8E0C8]" />
            <Button type="submit" className="w-full btn-gold rounded-lg font-semibold">
              Guardar alteracoes
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
