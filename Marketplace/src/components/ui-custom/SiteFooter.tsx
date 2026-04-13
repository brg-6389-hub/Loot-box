/* Comentario PT-PT: ficheiro de codigo da aplicacao LootBox mantido pela equipa. */
import type { InfoSection } from '@/components/ui-custom/InfoModal';

interface SiteFooterProps {
  onOpenSection: (section: InfoSection) => void;
}

export function SiteFooter({ onOpenSection }: SiteFooterProps) {
  return (
    <footer className="mt-12 border-t border-[#1f1f1f] bg-[#0b0b0b] text-[#b4aa90]">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 grid gap-8 md:grid-cols-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[#8c826f]">Loot Box</p>
          <p className="text-sm">Marketplace seguro para comprar e vender com transparência.</p>
          <button
            type="button"
            onClick={() => onOpenSection('sobre')}
            className="text-xs text-[#C9A962] hover:text-[#E8E0C8]"
          >
            Conhecer a plataforma
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[#8c826f]">Ajuda</p>
          <div className="flex flex-col gap-2 text-sm">
            <button type="button" onClick={() => onOpenSection('como-funciona')} className="text-left hover:text-[#E8E0C8]">
              Como funciona
            </button>
            <button type="button" onClick={() => onOpenSection('faq')} className="text-left hover:text-[#E8E0C8]">
              Perguntas frequentes
            </button>
            <button type="button" onClick={() => onOpenSection('devolucoes')} className="text-left hover:text-[#E8E0C8]">
              Reembolsos e devoluções
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[#8c826f]">Legal e Contacto</p>
          <div className="flex flex-col gap-2 text-sm">
            <button type="button" onClick={() => onOpenSection('termos')} className="text-left hover:text-[#E8E0C8]">
              Termos e condições
            </button>
            <button type="button" onClick={() => onOpenSection('privacidade')} className="text-left hover:text-[#E8E0C8]">
              Política de privacidade
            </button>
            <button type="button" onClick={() => onOpenSection('checklist')} className="text-left hover:text-[#E8E0C8]">
              Checklist de divulgação
            </button>
            <div className="pt-2 text-xs text-[#8c826f]">
              Apoio: suporte@lootbox.marketplace
              <br />
              Horário: 09:00–19:00 (dias úteis)
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-[#151515] px-4 py-4 text-center text-xs text-[#6f6656]">
        © {new Date().getFullYear()} Loot Box. Todos os direitos reservados.
      </div>
    </footer>
  );
}
