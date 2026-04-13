/* Comentario PT-PT: ficheiro de codigo da aplicacao LootBox mantido pela equipa. */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface SellerManualModalProps {
  isOpen: boolean;
  onAcknowledge: () => void;
}

export function SellerManualModal({ isOpen, onAcknowledge }: SellerManualModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onAcknowledge}>
      <DialogContent className="sm:max-w-2xl border-0 bg-[#0f0f0f] text-[#E8E0C8]">
        <DialogHeader>
          <DialogTitle className="text-[#E8E0C8]">Manual do distribuidor</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm text-[#b4aa90] leading-relaxed">
          <p>
            Bem-vindo à Loot Box. Este manual resume as regras essenciais para vender com segurança e manter a confiança da comunidade.
          </p>
          <div className="space-y-2">
            <p><strong>1. Publicação de anúncios</strong></p>
            <p>Usa descrições claras, fotos reais e informa o estado do produto. Anúncios enganosos são removidos.</p>
          </div>
          <div className="space-y-2">
            <p><strong>2. Produtos proibidos</strong></p>
            <p>Não são permitidos itens ilegais, pirataria, contas roubadas ou qualquer produto que viole direitos de terceiros.</p>
          </div>
          <div className="space-y-2">
            <p><strong>3. Preços e taxas</strong></p>
            <p>O total e a taxa de serviço são apresentados antes do pagamento. Mantém os preços atualizados e transparentes.</p>
          </div>
          <div className="space-y-2">
            <p><strong>4. Envio e prazos</strong></p>
            <p>Depois da venda, regista o envio com código de seguimento e comprovativo. Responde rapidamente ao comprador.</p>
          </div>
          <div className="space-y-2">
            <p><strong>5. Reembolsos e devoluções</strong></p>
            <p>Segue as regras de reembolso indicadas na plataforma. Em caso de falha comprovada, coopera com a equipa.</p>
          </div>
          <div className="space-y-2">
            <p><strong>6. Denúncias</strong></p>
            <p>Se houver problema, a denúncia será analisada pelo admin. Mantém comprovativos e respostas claras.</p>
          </div>
          <div className="space-y-2">
            <p><strong>7. Conduta e reputação</strong></p>
            <p>A tua reputação depende das avaliações. Comunicação educada e transparente é obrigatória.</p>
          </div>
        </div>
        <Button onClick={onAcknowledge} className="mt-4 w-full h-11 btn-gold rounded-lg font-semibold">
          Li e compreendo
        </Button>
      </DialogContent>
    </Dialog>
  );
}
