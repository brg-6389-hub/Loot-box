/* Comentario PT-PT: ficheiro de codigo da aplicacao LootBox mantido pela equipa. */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export type InfoSection = 'sobre' | 'como-funciona' | 'faq' | 'termos' | 'privacidade' | 'devolucoes' | 'checklist';

interface InfoModalProps {
  isOpen: boolean;
  section: InfoSection;
  onClose: () => void;
}

const SECTION_TITLES: Record<InfoSection, string> = {
  sobre: 'Sobre a Loot Box',
  'como-funciona': 'Como funciona',
  faq: 'Perguntas frequentes',
  termos: 'Termos e condições',
  privacidade: 'Política de privacidade',
  devolucoes: 'Reembolsos e devoluções',
  checklist: 'Checklist de divulgação',
};

export function InfoModal({ isOpen, section, onClose }: InfoModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl border-0 bg-[#0f0f0f] text-[#E8E0C8]">
        <DialogHeader>
          <DialogTitle className="text-[#E8E0C8]">{SECTION_TITLES[section]}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm text-[#b4aa90] leading-relaxed">
          {section === 'sobre' && (
            <>
              <p>
                A Loot Box é um marketplace focado em confiança, transparência e segurança nas trocas entre clientes e distribuidores.
                Trabalhamos para tornar o processo de compra e venda simples, com comunicação clara e acompanhamento em cada etapa.
              </p>
              <p>
                Mantemos regras de publicação, moderação de anúncios e um sistema de denúncias para proteger a comunidade. O nosso
                objetivo é criar um ambiente seguro onde os utilizadores se sintam confortáveis para negociar.
              </p>
            </>
          )}

          {section === 'como-funciona' && (
            <>
              <p>
                1. O distribuidor publica o anúncio e aguarda aprovação. 2. O cliente compra, paga e acompanha a entrega.
                3. Após receção, o cliente confirma e pode avaliar o vendedor.
              </p>
              <p>
                As taxas de serviço são apresentadas antes do pagamento para garantir transparência. As encomendas ficam registadas
                no histórico e podem ser acompanhadas no perfil.
              </p>
              <p>
                Em caso de problema, o cliente ou distribuidor pode abrir uma denúncia com motivo e evidências para análise do administrador.
              </p>
            </>
          )}

          {section === 'faq' && (
            <>
              <p><strong>Como sei se o vendedor é confiável?</strong> Consulta as avaliações, histórico de vendas e o estado do anúncio.</p>
              <p><strong>O que acontece após a compra?</strong> Recebes confirmação, acompanhas o envio e confirmas a receção.</p>
              <p><strong>Posso denunciar um problema?</strong> Sim, podes abrir uma denúncia com motivo e evidências.</p>
              <p><strong>Como são tratadas as devoluções?</strong> Seguem as regras descritas na política de reembolsos e devoluções.</p>
            </>
          )}

          {section === 'termos' && (
            <>
              <p>
                Ao utilizar a plataforma, concordas com as regras de publicação, conduta e pagamentos. É proibida qualquer tentativa
                de fraude, anúncios ilegais ou violação dos direitos de terceiros.
              </p>
              <p>
                O administrador pode suspender contas que violem as políticas. As transações ficam registadas para auditoria interna.
              </p>
            </>
          )}

          {section === 'privacidade' && (
            <>
              <p>
                Guardamos apenas os dados necessários para operar o marketplace. Nunca partilhamos dados sensíveis de pagamento com outros utilizadores.
              </p>
              <p>
                Podes pedir a eliminação da tua conta e dos teus dados diretamente no perfil, respeitando a legislação aplicável.
              </p>
            </>
          )}

          {section === 'devolucoes' && (
            <>
              <p>
                As devoluções devem ser solicitadas dentro do prazo indicado no anúncio ou nas regras da plataforma.
                A equipa analisa cada caso, especialmente quando existe denúncia associada.
              </p>
              <p>
                Sempre que aplicável, o reembolso será processado pelo mesmo método de pagamento utilizado na compra.
              </p>
            </>
          )}

          {section === 'checklist' && (
            <>
              <p>
                Antes de divulgar, confirma estes pontos essenciais para garantir credibilidade e uma boa experiência.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-[#cbbfa6]">
                <li>Domínio próprio com HTTPS ativo e favicon correto.</li>
                <li>Email de suporte real e funcional (ex: suporte@teudominio.com).</li>
                <li>Fluxo completo testado: registo, login, compra, envio, denúncia e avaliação.</li>
                <li>Políticas legais publicadas e fáceis de encontrar no rodapé.</li>
                <li>Tempo médio de resposta do suporte definido e comunicado.</li>
                <li>Conteúdos mínimos visíveis: Sobre, Como funciona e FAQ.</li>
              </ul>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
