/* Comentario PT-PT: ficheiro de codigo da aplicacao LootBox mantido pela equipa. */
import { useMemo, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMarketplace } from '@/hooks/useMarketplace';
import { useProducts } from '@/hooks/useProducts';
import { formatDistanceToNow } from '@/lib/utils';

export function ChatPage() {
  const { user } = useAuth();
  const { getUserConversations, sendMessage } = useMarketplace();
  const { products } = useProducts();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const conversations = useMemo(() => {
    if (!user) return [];
    return getUserConversations(user.id).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [getUserConversations, user]);

  const activeConversation = conversations.find((conv) => conv.id === activeConversationId) ?? conversations[0];

  if (!user) return null;

  const getCounterpartyName = (participantIds: string[]) => {
    const otherId = participantIds.find((id) => id !== user.id);
    if (!otherId) return 'Conversa';
    const productSeller = products.find((p) => p.sellerId === otherId)?.seller;
    return productSeller?.name ?? 'Utilizador';
  };

  const handleSend = async () => {
    if (!activeConversation || !message.trim()) return;
    await sendMessage(activeConversation.id, user.id, message);
    setMessage('');
  };

  return (
    <div className="pb-8 pt-4 px-3 md:px-6 w-full">
      <section className="panel-surface p-4 md:p-5">
      <h2 className="text-2xl font-bold text-[#E8E0C8] mb-4">Mensagens</h2>

      {conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-[#111] rounded-full flex items-center justify-center mb-4 border border-[#222]">
            <MessageCircle className="w-8 h-8 text-[#444]" />
          </div>
          <h3 className="text-[#E8E0C8] font-medium mb-1">Sem mensagens</h3>
          <p className="text-[#666] text-sm">Abre um anúncio e carrega no ícone de conversa para começar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-1 space-y-2">
            {conversations.map((conversation) => {
              const lastMessage = conversation.messages[conversation.messages.length - 1];
              const isActive = (activeConversation?.id ?? conversation.id) === conversation.id;
              return (
                <button
                  key={conversation.id}
                  onClick={() => setActiveConversationId(conversation.id)}
                  className={`w-full text-left rounded-xl p-3 border transition-colors ${
                    isActive ? 'bg-[#1a1a1a] border-[#C9A962]/50' : 'bg-[#111] border-[#222] hover:bg-[#171717]'
                  }`}
                >
                  <p className="text-sm font-medium text-[#E8E0C8]">{getCounterpartyName(conversation.participantIds)}</p>
                  <p className="text-xs text-[#666] truncate">{lastMessage?.text ?? 'Sem mensagens ainda'}</p>
                </button>
              );
            })}
          </div>

          {activeConversation && (
            <div className="lg:col-span-2 bg-[#111] border border-[#222] rounded-xl p-3 flex flex-col min-h-[420px]">
              <div className="flex-1 space-y-2 overflow-y-auto mb-3 pr-1">
                {activeConversation.messages.length === 0 ? (
                  <p className="text-[#666] text-sm">Envia a primeira mensagem.</p>
                ) : (
                  activeConversation.messages.map((msg) => {
                    const mine = msg.senderId === user.id;
                    return (
                      <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                            mine ? 'bg-[#C9A962] text-[#0A0A0A]' : 'bg-[#1b1b1b] text-[#E8E0C8]'
                          }`}
                        >
                          <p>{msg.text}</p>
                          <p className={`text-[10px] mt-1 ${mine ? 'text-[#2c2514]' : 'text-[#777]'}`}>
                            {formatDistanceToNow(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex gap-2">
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void handleSend();
                    }
                  }}
                  placeholder="Escreve uma mensagem..."
                  className="flex-1 h-10 rounded-lg border border-[#222] bg-[#0A0A0A] px-3 text-[#E8E0C8] outline-none focus:border-[#C9A962]"
                />
                <button onClick={() => void handleSend()} className="h-10 px-4 rounded-lg btn-gold">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      </section>
    </div>
  );
}
