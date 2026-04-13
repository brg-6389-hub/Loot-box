/* Comentario PT-PT: ficheiro de codigo da aplicacao LootBox mantido pela equipa. */
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

interface PersonalDataPageProps {
  onBack: () => void;
}

export function PersonalDataPage({ onBack }: PersonalDataPageProps) {
  const { user, isAdmin, isSeller } = useAuth();

  if (!user) return null;

  const roleLabel = isAdmin ? 'Administrador' : isSeller ? 'Distribuidor' : 'Cliente';

  return (
    <div className="pb-8 pt-4 px-3 md:px-6 w-full">
      <section className="panel-surface p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[#E8E0C8]">Dados pessoais</h2>
            <p className="text-sm text-[#8c826f]">Consulta os teus dados registados na plataforma.</p>
          </div>
          <Button variant="outline" onClick={onBack} className="border-[#2b2b2b] text-[#C9A962] hover:text-[#E8E0C8]">
            Voltar ao perfil
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[#222] bg-[#111] p-4">
            <p className="text-xs text-[#8c826f] uppercase tracking-[0.18em]">Nome</p>
            <p className="text-[#E8E0C8] font-semibold mt-1">{user.name}</p>
          </div>
          <div className="rounded-xl border border-[#222] bg-[#111] p-4">
            <p className="text-xs text-[#8c826f] uppercase tracking-[0.18em]">Nome de utilizador</p>
            <p className="text-[#E8E0C8] font-semibold mt-1">@{user.username || 'por definir'}</p>
          </div>
          <div className="rounded-xl border border-[#222] bg-[#111] p-4">
            <p className="text-xs text-[#8c826f] uppercase tracking-[0.18em]">Email</p>
            <p className="text-[#E8E0C8] font-semibold mt-1">{user.email}</p>
            <p className="text-xs text-[#8c826f] mt-1">{user.emailVerified ? 'Verificado' : 'Por verificar'}</p>
          </div>
          <div className="rounded-xl border border-[#222] bg-[#111] p-4">
            <p className="text-xs text-[#8c826f] uppercase tracking-[0.18em]">Telemóvel</p>
            <p className="text-[#E8E0C8] font-semibold mt-1">{user.phone || 'por definir'}</p>
            <p className="text-xs text-[#8c826f] mt-1">{user.phone ? (user.phoneVerified ? 'Verificado' : 'Por verificar') : 'Sem número associado'}</p>
          </div>
          <div className="rounded-xl border border-[#222] bg-[#111] p-4">
            <p className="text-xs text-[#8c826f] uppercase tracking-[0.18em]">Perfil</p>
            <p className="text-[#E8E0C8] font-semibold mt-1">{roleLabel}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
