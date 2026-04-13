/* Comentario PT-PT: ficheiro de codigo da aplicacao LootBox mantido pela equipa. */
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ShieldAlert, ShieldCheck, Trash2, Users, XCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useProducts } from '@/hooks/useProducts';
import { useMarketplace } from '@/hooks/useMarketplace';
import { useNotifications } from '@/hooks/useNotifications';
import { useToast } from '@/hooks/use-toast';
import { getPrimaryProductImage } from '@/lib/product-images';
import { Button } from '@/components/ui/button';
import type { Product, UserRole } from '@/types';

interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isBlocked: boolean;
  avatar?: string;
  avatarUrl?: string;
  createdAt: string;
  productsCount: number;
}

export function AdminPage() {
  const { user, isAdmin } = useAuth();
  const { products, updateProduct, removeProduct, refreshProducts } = useProducts();
  const { orders, resolveDispute } = useMarketplace();
  const { addNotification } = useNotifications();
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'users' | 'products' | 'disputes'>('users');
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch<{ users: AdminUserRow[] }>('/api/admin/users');
      setUsers(data.users);
    } catch (error) {
      toast({
        title: 'Erro no painel',
        description: error instanceof Error ? error.message : 'Não foi possível carregar os utilizadores.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    void loadUsers();
  }, [isAdmin]);

  const pendingProducts = useMemo(
    () => products.filter((product) => product.status === 'pending_review'),
    [products],
  );

  const moderatedProducts = useMemo(
    () => products.filter((product) => product.status !== 'draft'),
    [products],
  );

  const disputedOrders = useMemo(
    () => orders.filter((order) => order.dispute),
    [orders],
  );

  const getUserLabel = (userId?: string) => {
    if (!userId) return 'Conta não identificada';
    const found = users.find((entry) => entry.id === userId);
    if (!found) return userId;
    return `${found.name} · ${found.email}`;
  };

  const getSellerLabels = (order: typeof orders[number]) => {
    const sellerIds = order.sellerIds && order.sellerIds.length > 0
      ? order.sellerIds
      : order.itemIds
          .map((itemId) => products.find((product) => product.id === itemId)?.sellerId)
          .filter((sellerId): sellerId is string => Boolean(sellerId));
    const uniqueSellerIds = Array.from(new Set(sellerIds));
    const labels = uniqueSellerIds
      .map((sellerId) => users.find((entry) => entry.id === sellerId)?.name)
      .filter((name): name is string => Boolean(name));
    if (labels.length > 0) return labels;
    return uniqueSellerIds.length > 0 ? uniqueSellerIds : ['Distribuidor não identificado'];
  };

  const getOrderItemLabels = (order: typeof orders[number]) => {
    if (order.items && order.items.length > 0) {
      return order.items.map((item) => item.name);
    }
    const labels = order.itemIds
      .map((itemId) => products.find((product) => product.id === itemId)?.name || itemId)
      .filter(Boolean);
    return labels.length > 0 ? labels : ['Itens não identificados'];
  };

  const getDisputeStatusLabel = (status?: 'open' | 'resolved' | 'rejected') => {
    switch (status) {
      case 'open':
        return 'aberta';
      case 'resolved':
        return 'resolvida';
      case 'rejected':
        return 'rejeitada';
      default:
        return 'desconhecido';
    }
  };

  const getOrderStatusLabel = (status: typeof orders[number]['status']) => {
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

  const handleUserUpdate = async (userId: string, payload: Partial<Pick<AdminUserRow, 'isBlocked'>>) => {
    try {
      const data = await apiFetch<{ user: AdminUserRow }>(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setUsers((current) => current.map((entry) => (entry.id === userId ? { ...entry, ...data.user } : entry)));
      addNotification({
        title: 'Perfil atualizado',
        message: 'As permissões da conta foram atualizadas no painel de administração.',
        type: 'success',
      });
      toast({ title: 'Conta atualizada', description: 'A alteração foi guardada com sucesso.' });
    } catch (error) {
      toast({
        title: 'Falha ao atualizar',
        description: error instanceof Error ? error.message : 'Não foi possível atualizar o perfil.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const confirmed = window.confirm('Queres mesmo eliminar esta conta? Esta ação remove os dados associados.');
    if (!confirmed) return;
    try {
      await apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      await refreshProducts();
      setUsers((current) => current.filter((entry) => entry.id !== userId));
      addNotification({
        title: 'Conta removida',
        message: 'A conta e os dados associados foram eliminados pelo painel.',
        type: 'info',
      });
      toast({ title: 'Conta eliminada', description: 'O utilizador foi removido com sucesso.' });
    } catch (error) {
      toast({
        title: 'Falha ao eliminar',
        description: error instanceof Error ? error.message : 'Não foi possível eliminar a conta.',
        variant: 'destructive',
      });
    }
  };

  const handleProductStatus = async (productId: string, status: Product['status']) => {
    const ok = await updateProduct(productId, { status });
    if (!ok) {
      toast({ title: 'Falha na moderação', description: 'Não foi possível atualizar este anúncio.', variant: 'destructive' });
      return;
    }
    addNotification({
      title: status === 'available' ? 'Anúncio aprovado' : 'Anúncio moderado',
      message:
        status === 'available'
          ? 'O anúncio foi aprovado e já pode aparecer na loja.'
          : `O anúncio foi atualizado para o estado ${status}.`,
      type: 'success',
    });
    toast({
      title: 'Anúncio atualizado',
      description: status === 'available' ? 'O produto foi aprovado com sucesso.' : 'O estado do anúncio foi alterado.',
    });
  };

  const handleDeleteProduct = async (productId: string) => {
    const confirmed = window.confirm('Queres remover este anúncio do marketplace?');
    if (!confirmed) return;
    const ok = await removeProduct(productId);
    if (!ok) {
      toast({ title: 'Falha na remoção', description: 'Não foi possível apagar este anúncio.', variant: 'destructive' });
      return;
    }
    addNotification({
      title: 'Anúncio removido',
      message: 'O anúncio foi eliminado a partir do painel de administração.',
      type: 'info',
    });
    toast({ title: 'Anúncio eliminado', description: 'O produto foi removido da plataforma.' });
  };

  const handleResolveDispute = async (orderId: string, status: 'resolved' | 'rejected') => {
    const result = await resolveDispute(orderId, {
      status,
      resolutionNote: resolutionNotes[orderId],
    });
    if (!result.success) {
      toast({ title: 'Falha na denúncia', description: result.message, variant: 'destructive' });
      return;
    }
    addNotification({
      title: 'Denúncia atualizada',
      message: `A denúncia da encomenda ${orderId} foi tratada pelo administrador.`,
      type: 'success',
    });
    toast({ title: 'Denúncia atualizada', description: result.message });
  };

  if (!isAdmin || !user) {
    return (
      <div className="pb-8 pt-4 px-3 md:px-6 w-full">
        <section className="panel-surface p-6">
          <div className="rounded-xl border border-[#3a2525] bg-[#161010] p-6 text-center">
            <h2 className="text-2xl font-bold text-[#E8E0C8]">Acesso reservado a administradores</h2>
            <p className="mt-2 text-sm text-[#b4aa90]">Só contas com perfil de administrador podem gerir utilizadores e aprovar anúncios.</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="pb-8 pt-4 px-3 md:px-6 w-full">
      <section className="panel-surface p-4 md:p-5 space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-[#E8E0C8]">Painel de Administração</h2>
            <p className="text-sm text-[#7f7661] mt-1">Gere contas, modera anúncios e acompanha o estado da plataforma.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="rounded-xl border border-[#222] bg-[#111] px-4 py-3">
              <p className="text-xs text-[#8a816a] uppercase tracking-[0.14em]">Contas</p>
              <p className="text-2xl font-bold text-[#E8E0C8] mt-1">{users.length}</p>
            </div>
            <div className="rounded-xl border border-[#222] bg-[#111] px-4 py-3">
              <p className="text-xs text-[#8a816a] uppercase tracking-[0.14em]">Administradores</p>
              <p className="text-2xl font-bold text-[#E8E0C8] mt-1">{users.filter((entry) => entry.role === 'admin').length}</p>
            </div>
            <div className="rounded-xl border border-[#222] bg-[#111] px-4 py-3">
              <p className="text-xs text-[#8a816a] uppercase tracking-[0.14em]">Pendentes</p>
              <p className="text-2xl font-bold text-[#E8E0C8] mt-1">{pendingProducts.length}</p>
            </div>
            <div className="rounded-xl border border-[#222] bg-[#111] px-4 py-3">
              <p className="text-xs text-[#8a816a] uppercase tracking-[0.14em]">Bloqueadas</p>
              <p className="text-2xl font-bold text-[#E8E0C8] mt-1">{users.filter((entry) => entry.isBlocked).length}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveSection('users')}
            className={`rounded-lg px-4 py-2 text-sm ${activeSection === 'users' ? 'bg-[#C9A962] text-[#0A0A0A] font-semibold' : 'border border-[#222] bg-[#111] text-[#E8E0C8]'}`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Utilizadores
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('products')}
            className={`rounded-lg px-4 py-2 text-sm ${activeSection === 'products' ? 'bg-[#C9A962] text-[#0A0A0A] font-semibold' : 'border border-[#222] bg-[#111] text-[#E8E0C8]'}`}
          >
            <ShieldCheck className="w-4 h-4 inline mr-2" />
            Moderar anúncios
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('disputes')}
            className={`rounded-lg px-4 py-2 text-sm ${activeSection === 'disputes' ? 'bg-[#C9A962] text-[#0A0A0A] font-semibold' : 'border border-[#222] bg-[#111] text-[#E8E0C8]'}`}
          >
            <ShieldAlert className="w-4 h-4 inline mr-2" />
            Denúncias
          </button>
        </div>

        {activeSection === 'users' ? (
          <div className="space-y-3">
            {isLoading ? (
              <div className="rounded-xl border border-[#222] bg-[#111] p-6 text-center text-[#8c826f]">A carregar utilizadores...</div>
            ) : users.length > 0 ? (
              users.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-[#222] bg-[#111] p-4 space-y-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#C9A962] to-[#8B7355] text-[#0A0A0A] font-bold flex items-center justify-center overflow-hidden">
                        {entry.avatarUrl ? (
                          <img src={entry.avatarUrl} alt={entry.name} className="h-full w-full object-cover" />
                        ) : (
                          entry.avatar || entry.name.charAt(0)
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[#E8E0C8] font-semibold">{entry.name}</p>
                          <span className="rounded-full border border-[#3e3727] bg-[#1f1a12] px-2 py-0.5 text-[11px] text-[#d8c28a]">
                            {entry.role === 'admin' ? 'Administrador' : entry.role === 'destribuidior' ? 'Distribuidor' : 'Cliente'}
                          </span>
                          {entry.isBlocked && (
                            <span className="rounded-full border border-[#542828] bg-[#2a1717] px-2 py-0.5 text-[11px] text-[#f2a7a7]">Bloqueada</span>
                          )}
                        </div>
                        <p className="text-sm text-[#8c826f]">{entry.email}</p>
                        <p className="text-xs text-[#6f6656]">Anúncios: {entry.productsCount} · Criada em {new Date(entry.createdAt).toLocaleDateString('pt-PT')}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => void handleUserUpdate(entry.id, { isBlocked: !entry.isBlocked })}
                        className={entry.isBlocked ? 'border-[#29412e] bg-[#132016] text-[#bfe0c5]' : 'border-[#513131] bg-[#211414] text-[#f0c4c4]'}
                        disabled={entry.id === user.id}
                      >
                        {entry.isBlocked ? <ShieldCheck className="w-4 h-4 mr-2" /> : <ShieldAlert className="w-4 h-4 mr-2" />}
                        {entry.isBlocked ? 'Desbloquear' : 'Bloquear'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => void handleDeleteUser(entry.id)}
                        className="border-[#6b3b3b] bg-[#221515] text-red-200"
                        disabled={entry.id === user.id}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-[#222] bg-[#111] p-6 text-center text-[#8c826f]">Ainda não existem contas registadas.</div>
            )}
          </div>
        ) : activeSection === 'products' ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#2c2419] bg-[#17120d] p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-[#D4AF37]" />
                <h3 className="font-semibold text-[#E8E0C8]">À espera de aprovação</h3>
              </div>
              {pendingProducts.length > 0 ? (
                <div className="space-y-3">
                  {pendingProducts.map((product) => (
                    <div key={product.id} className="rounded-xl border border-[#3a3226] bg-[#111] p-4 flex flex-col gap-3 lg:flex-row lg:items-center">
                      <img src={getPrimaryProductImage(product)} alt={product.name} className="w-full lg:w-24 h-24 rounded-lg object-cover bg-[#1a1a1a]" />
                      <div className="flex-1">
                        <p className="text-[#E8E0C8] font-semibold">{product.name}</p>
                        <p className="text-sm text-[#8c826f]">{product.category} · {product.price.toFixed(2)}€</p>
                        <p className="text-xs text-[#6f6656] mt-1">Por {product.seller.name}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => void handleProductStatus(product.id, 'available')} className="btn-gold">
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Aprovar
                        </Button>
                        <Button variant="outline" onClick={() => void handleProductStatus(product.id, 'rejected')} className="border-[#5b3232] bg-[#221515] text-red-200">
                          <XCircle className="w-4 h-4 mr-2" />
                          Rejeitar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#8c826f]">Não há anúncios pendentes neste momento.</p>
              )}
            </div>

            <div className="space-y-3">
              {moderatedProducts.map((product) => (
                <div key={product.id} className="rounded-xl border border-[#222] bg-[#111] p-4 flex flex-col gap-3 lg:flex-row lg:items-center">
                  <img src={getPrimaryProductImage(product)} alt={product.name} className="w-full lg:w-24 h-24 rounded-lg object-cover bg-[#1a1a1a]" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[#E8E0C8] font-semibold">{product.name}</p>
                      <span className="rounded-full border border-[#2f2a1d] bg-[#17140f] px-2 py-0.5 text-[11px] text-[#d8c28a]">{product.status}</span>
                    </div>
                    <p className="text-sm text-[#8c826f]">{product.category} · {product.price.toFixed(2)}€</p>
                    <p className="text-xs text-[#6f6656] mt-1">Por {product.seller.name}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.status !== 'available' && product.status !== 'sold' && (
                      <Button onClick={() => void handleProductStatus(product.id, 'available')} className="btn-gold">
                        Aprovar
                      </Button>
                    )}
                    {product.status === 'available' && (
                      <Button variant="outline" onClick={() => void handleProductStatus(product.id, 'paused')} className="border-[#3d3729] bg-[#1b1712] text-[#E8E0C8]">
                        Pausar
                      </Button>
                    )}
                    {product.status !== 'rejected' && product.status !== 'sold' && (
                      <Button variant="outline" onClick={() => void handleProductStatus(product.id, 'rejected')} className="border-[#5b3232] bg-[#221515] text-red-200">
                        Rejeitar
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => void handleDeleteProduct(product.id)} className="border-[#6b3b3b] bg-[#221515] text-red-200">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remover
                    </Button>
                  </div>
                </div>
              ))}
              {moderatedProducts.length === 0 && (
                <div className="rounded-xl border border-[#222] bg-[#111] p-6 text-center text-[#8c826f]">Ainda não existem anúncios para moderar.</div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {disputedOrders.length > 0 ? (
              disputedOrders.map((order) => (
                <div key={order.id} className="rounded-xl border border-[#222] bg-[#111] p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[#E8E0C8] font-semibold">{order.id}</p>
                      <p className="text-xs text-[#8c826f]">
                        Denúncia aberta por {order.dispute?.openedBy === 'buyer' ? 'cliente' : 'distribuidor'} · Estado {getDisputeStatusLabel(order.dispute?.status)}
                      </p>
                      <p className="text-xs text-[#6f6656] mt-1">
                        Aberta em {order.dispute?.createdAt ? new Date(order.dispute.createdAt).toLocaleString('pt-PT') : 'momento não registado'}
                      </p>
                    </div>
                    <span className="rounded-full border border-[#5b3232] bg-[#221515] px-2 py-1 text-[11px] text-red-200">
                      {order.dispute?.reason}
                    </span>
                  </div>
                  <div className="rounded-lg border border-[#1e1b14] bg-[#0d0b08] px-3 py-2 text-xs text-[#c9bda3] space-y-1">
                    <p>Comprador: <span className="text-[#E8E0C8]">{getUserLabel(order.buyerId)}</span></p>
                    <p>Distribuidor(es): <span className="text-[#E8E0C8]">{getSellerLabels(order).join(', ')}</span></p>
                    <p>Estado da encomenda: <span className="text-[#E8E0C8]">{getOrderStatusLabel(order.status)}</span></p>
                    <p>Total: <span className="text-[#E8E0C8]">{order.total.toFixed(2)}€</span></p>
                    {order.paymentMethodLabel ? (
                      <p>Método de pagamento: <span className="text-[#E8E0C8]">{order.paymentMethodLabel}</span></p>
                    ) : null}
                    <p>Itens: <span className="text-[#E8E0C8]">{getOrderItemLabels(order).join(', ')}</span></p>
                  </div>
                  {order.dispute?.details && (
                    <p className="text-sm text-[#d9c2c2]">{order.dispute.details}</p>
                  )}
                  {order.dispute?.evidence?.length ? (
                    <div className="text-xs text-[#d8c28a]">
                      Evidência: {order.dispute.evidence.join(', ')}
                    </div>
                  ) : null}
                  <textarea
                    value={resolutionNotes[order.id] || order.dispute?.resolutionNote || ''}
                    onChange={(e) => setResolutionNotes((current) => ({ ...current, [order.id]: e.target.value }))}
                    placeholder="Nota da resolução do admin"
                    className="min-h-[96px] w-full rounded-lg border border-[#222] bg-[#0A0A0A] px-3 py-2 text-sm text-[#E8E0C8]"
                  />
                  <div className="flex flex-wrap gap-2">
                    {order.dispute?.status === 'open' && (
                      <>
                        <Button onClick={() => void handleResolveDispute(order.id, 'resolved')} className="btn-gold">
                          Resolver denúncia
                        </Button>
                        <Button variant="outline" onClick={() => void handleResolveDispute(order.id, 'rejected')} className="border-[#5b3232] bg-[#221515] text-red-200">
                          Rejeitar denúncia
                        </Button>
                      </>
                    )}
                    {order.dispute?.status !== 'open' && (
                      <div className="rounded-lg border border-[#29412e] bg-[#132016] px-3 py-2 text-sm text-[#bfe0c5]">
                        Denúncia concluída em {order.dispute?.resolvedAt ? new Date(order.dispute.resolvedAt).toLocaleString('pt-PT') : 'momento não registado'}.
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-[#222] bg-[#111] p-6 text-center text-[#8c826f]">Não existem denúncias abertas ou históricas.</div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
