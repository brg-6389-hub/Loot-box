/* Comentario PT-PT: ficheiro de codigo da aplicacao LootBox mantido pela equipa. */
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useToast } from '@/hooks/use-toast';
import type { UserRole } from '@/types';
import { SellerManualModal } from '@/components/ui-custom/SellerManualModal';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginClick: () => void;
}

export function RegisterModal({ isOpen, onClose, onLoginClick }: RegisterModalProps) {
  const [signupMethod, setSignupMethod] = useState<'email' | 'phone'>('email');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('cliente');
  const [isVerificationStep, setIsVerificationStep] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [smsCode, setSmsCode] = useState('');
  const [smsSent, setSmsSent] = useState(false);
  const [smsVerified, setSmsVerified] = useState(false);
  const [debugSmsCode, setDebugSmsCode] = useState<string | null>(null);
  const [phoneMasked, setPhoneMasked] = useState<string | null>(null);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { register, verifyEmail, resendVerificationCode, requestPhoneVerification, verifyPhone } = useAuth();
  const { addNotification } = useNotifications();
  const { toast } = useToast();

  const isPlaceholderEmail = (value: string) => value.endsWith('@lootbox.local');
  const hasRealEmail = registeredEmail.trim() && !isPlaceholderEmail(registeredEmail.trim().toLowerCase());
  const hasPhone = phone.trim().length > 0;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (username.trim().length < 3) {
      toast({ title: 'Nome de utilizador inválido', description: 'Usa pelo menos 3 caracteres.', variant: 'destructive' });
      setIsLoading(false);
      return;
    }
    if (phone.trim() && phone.replace(/\D/g, '').length < 9) {
      toast({ title: 'Telemóvel inválido', description: 'Indica um número de telemóvel válido.', variant: 'destructive' });
      setIsLoading(false);
      return;
    }

    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    if (signupMethod === 'email' && !trimmedEmail) {
      toast({ title: 'Email em falta', description: 'Escolheste email, por isso indica o teu email.', variant: 'destructive' });
      setIsLoading(false);
      return;
    }
    if (signupMethod === 'phone' && !trimmedPhone) {
      toast({ title: 'Telemóvel em falta', description: 'Escolheste telemóvel, por isso indica o número.', variant: 'destructive' });
      setIsLoading(false);
      return;
    }

    const digits = trimmedPhone.replace(/\D/g, '');
    const finalEmail =
      trimmedEmail || (signupMethod === 'phone' && digits ? `phone${digits}@lootbox.local` : trimmedEmail);

    const result = await register(name, finalEmail, password, role, { username, phone: trimmedPhone });
    if (!result.success) {
      toast({
        title: 'Erro',
        description:
          result.reason === 'email_exists'
            ? 'Este email já está registado.'
            : result.reason === 'username_exists'
              ? 'Este nome de utilizador já está registado.'
              : result.reason === 'phone_exists'
                ? 'Este número já está registado.'
                : 'Falha no registo.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    setIsVerificationStep(true);
    setEmailVerified(false);
    setSmsVerified(false);
    setSmsSent(false);
    setDebugSmsCode(null);
    setPhoneMasked(null);
    setRegisteredEmail(finalEmail);

    if (trimmedPhone) {
      const smsResult = await requestPhoneVerification(phone);
      if (smsResult.success) {
        setSmsSent(true);
        setDebugSmsCode(smsResult.debugCode || null);
        setPhoneMasked(smsResult.phoneMasked || null);
      } else {
        toast({
          title: 'SMS não enviado',
          description:
            smsResult.reason === 'phone_exists'
              ? 'Este número já está associado a outra conta.'
              : 'Não foi possível enviar o SMS agora.',
          variant: 'destructive',
        });
      }
    }

    if (trimmedEmail && !isPlaceholderEmail(finalEmail)) {
      addNotification({
        title: 'Verificação necessária',
        message: `Link enviado para ${trimmedEmail}.`,
        type: 'info',
      });
      toast({
        title: 'Verifica o teu email',
        description: 'Abrimos o fluxo real do Firebase. Clica no link enviado para o teu email.',
      });
    } else {
      setEmailVerified(true);
      toast({ title: 'Telemóvel para confirmar', description: 'Enviámos um código por SMS para confirmar o número.' });
    }
    setIsLoading(false);
  };

  const handleVerify = async () => {
    setIsLoading(true);
    const result = await verifyEmail();
    if (!result.success) {
      toast({
        title: 'Ainda não verificado',
        description: 'Depois de clicares na ligação do email, carrega em "Já verifiquei".',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    addNotification({
      title: 'Email verificado',
      message: 'A tua conta foi verificada com sucesso.',
      type: 'success',
    });
    toast({
      title: 'Conta verificada',
      description: 'Agora podes entrar com o teu email e a tua palavra-passe.',
    });
    setEmailVerified(true);
    setIsLoading(false);
    if (smsVerified || !phone.trim()) {
      if (role === 'destribuidior') {
        setIsManualOpen(true);
        return;
      }
      onClose();
      onLoginClick();
    }
  };

  const handleResend = async () => {
    const res = await resendVerificationCode(registeredEmail);
    if (!res.success) {
      toast({ title: 'Erro', description: 'Não foi possível reenviar o email de verificação.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Email reenviado', description: 'Verifica novamente a tua caixa de entrada.' });
  };

  const handleSendSms = async () => {
    const res = await requestPhoneVerification(phone);
    if (!res.success) {
      toast({
        title: 'SMS não enviado',
        description: res.reason === 'phone_exists' ? 'Este número já está associado a outra conta.' : 'Não foi possível enviar o SMS.',
        variant: 'destructive',
      });
      return;
    }
    setSmsSent(true);
    setDebugSmsCode(res.debugCode || null);
    setPhoneMasked(res.phoneMasked || null);
    toast({ title: 'SMS enviado', description: 'Enviámos um código por SMS para o teu número.' });
  };

  const handleVerifySms = async () => {
    if (!smsCode.trim()) {
      toast({ title: 'Código em falta', description: 'Escreve o código recebido por SMS.' });
      return;
    }
    setIsLoading(true);
    const res = await verifyPhone(smsCode);
    if (!res.success) {
      toast({
        title: 'Código inválido',
        description: res.reason === 'expired_code' ? 'O código expirou. Pede um novo SMS.' : 'O código não é válido.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }
    setSmsVerified(true);
    setIsLoading(false);
    toast({ title: 'Telemóvel verificado', description: 'O número ficou confirmado com sucesso.' });
    if (emailVerified) {
      if (role === 'destribuidior') {
        setIsManualOpen(true);
        return;
      }
      onClose();
      onLoginClick();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-0 bg-[#111]">
        <div className="relative rounded-lg p-6">
          <button onClick={onClose} className="absolute left-4 top-4 text-[#666] hover:text-[#E8E0C8] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>

          <DialogHeader className="text-center pt-4">
            <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 border border-[#C9A962] bg-[#0a0a0a] overflow-hidden">
              <img src="/lootbox-logo.png" alt="Loot Box" className="h-full w-full object-cover" />
            </div>
            <DialogTitle className="text-xl font-semibold text-[#E8E0C8]">
              {isVerificationStep ? 'Verificar conta' : 'Criar conta'}
            </DialogTitle>
            <p className="text-sm text-[#666] mt-1">
              {isVerificationStep ? 'Confirma os contactos escolhidos para continuar.' : 'Regista-te para comprar e vender.'}
            </p>
          </DialogHeader>

          {!isVerificationStep ? (
            <form onSubmit={handleRegister} className="space-y-4 mt-6 max-h-[70vh] overflow-y-auto pr-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#A09060]">Criar conta com</Label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSignupMethod('email')}
                    className={`rounded-full px-3 py-1 text-xs ${
                      signupMethod === 'email' ? 'bg-[#C9A962] text-[#0A0A0A]' : 'border border-[#222] text-[#8c826f]'
                    }`}
                  >
                    Email
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignupMethod('phone')}
                    className={`rounded-full px-3 py-1 text-xs ${
                      signupMethod === 'phone' ? 'bg-[#C9A962] text-[#0A0A0A]' : 'border border-[#222] text-[#8c826f]'
                    }`}
                  >
                    Telemóvel
                  </button>
                </div>
                <p className="text-[11px] text-[#7a725f]">
                  {signupMethod === 'email'
                    ? 'Escolheste email como contacto principal.'
                    : 'Escolheste telemóvel como contacto principal.'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-[#A09060]">
                  Nome
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="O teu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-11 rounded-lg bg-[#0A0A0A] border-[#222] text-[#E8E0C8]"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium text-[#A09060]">
                  Nome de utilizador
                </Label>
                <div className="flex items-center rounded-lg border border-[#222] bg-[#0A0A0A] h-11">
                  <span className="px-3 text-[#8c826f]">@</span>
                  <input
                    id="username"
                    type="text"
                    placeholder="ex: lootbox_user"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/^@+/, ''))}
                    className="h-10 w-full bg-transparent pr-3 text-[#E8E0C8] outline-none"
                    required
                  />
                </div>
              </div>

              {signupMethod === 'email' ? (
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-[#A09060]">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-11 rounded-lg bg-[#0A0A0A] border-[#222] text-[#E8E0C8]"
                    required
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-[#A09060]">
                    Email (opcional)
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-11 rounded-lg bg-[#0A0A0A] border-[#222] text-[#E8E0C8]"
                  />
                  <p className="text-[11px] text-[#7a725f]">Serve apenas para recuperação de conta.</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium text-[#A09060]">
                  {signupMethod === 'phone' ? 'Telemóvel' : 'Telemóvel (opcional)'}
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="ex: 91 000 0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-11 rounded-lg bg-[#0A0A0A] border-[#222] text-[#E8E0C8]"
                  required={signupMethod === 'phone'}
                />
                <p className="text-[11px] text-[#7a725f]">O teu contacto não é partilhado com outros utilizadores.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#A09060]">Perfil</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('cliente')}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      role === 'cliente' ? 'border-[#C9A962] bg-[#1a150d] text-[#E8E0C8]' : 'border-[#222] bg-[#0A0A0A] text-[#8a816a]'
                    }`}
                  >
                    Cliente
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('destribuidior')}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      role === 'destribuidior' ? 'border-[#C9A962] bg-[#1a150d] text-[#E8E0C8]' : 'border-[#222] bg-[#0A0A0A] text-[#8a816a]'
                    }`}
                  >
                    Distribuidor
                  </button>
                </div>
                <p className="text-xs text-[#666]">
                  {role === 'cliente'
                    ? 'Podes navegar, favoritar e comprar produtos.'
                    : 'Podes publicar e gerir os teus produtos.'}
                </p>
                <p className="text-[11px] text-[#7a725f]">
                  A primeira conta criada no site passa automaticamente a administrador.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-[#A09060]">
                  Palavra-passe
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="********"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-11 rounded-lg bg-[#0A0A0A] border-[#222] text-[#E8E0C8] pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] hover:text-[#E8E0C8]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" disabled={isLoading} className="w-full h-11 btn-gold rounded-lg font-semibold">
                {isLoading ? 'A processar...' : 'Criar conta'}
              </Button>
            </form>
          ) : (
            <div className="space-y-4 mt-6 max-h-[70vh] overflow-y-auto pr-2">
              {hasRealEmail ? (
                <div className="rounded-lg border border-[#2b2b2b] bg-[#0c0c0c] p-3 space-y-3">
                  <div>
                    <p className="text-sm text-[#E8E0C8] font-medium">Verificar email</p>
                    <p className="text-xs text-[#8a816a]">Confirma o link enviado para {registeredEmail}.</p>
                  </div>
                  <Button onClick={() => void handleVerify()} disabled={isLoading} className="w-full h-11 btn-gold rounded-lg font-semibold">
                    {isLoading ? 'A verificar...' : emailVerified ? 'Email verificado' : 'Já verifiquei'}
                  </Button>
                  <button
                    type="button"
                    onClick={handleResend}
                    className="w-full h-10 rounded-lg border border-[#2b2b2b] text-[#A09060] hover:text-[#E8E0C8]"
                  >
                    Reenviar email
                  </button>
                </div>
              ) : null}

              {hasPhone ? (
                <div className="rounded-lg border border-[#2b2b2b] bg-[#0c0c0c] p-3 space-y-3">
                  <div>
                    <p className="text-sm text-[#E8E0C8] font-medium">Verificar telemóvel</p>
                    <p className="text-xs text-[#8a816a]">
                      {phoneMasked ? `Código enviado para ${phoneMasked}.` : 'Envia um código por SMS para confirmar o número.'}
                    </p>
                    {debugSmsCode ? (
                      <p className="text-[11px] text-[#d8c28a]">Código de teste: {debugSmsCode}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Input
                      type="text"
                      placeholder="Código SMS"
                      value={smsCode}
                      onChange={(e) => setSmsCode(e.target.value)}
                      className="w-full h-11 rounded-lg bg-[#0A0A0A] border-[#222] text-[#E8E0C8]"
                    />
                    <Button onClick={() => void handleVerifySms()} disabled={isLoading} className="w-full h-11 btn-gold rounded-lg font-semibold">
                      {smsVerified ? 'Telemóvel verificado' : 'Confirmar código'}
                    </Button>
                    <button
                      type="button"
                      onClick={() => void handleSendSms()}
                      className="w-full h-10 rounded-lg border border-[#2b2b2b] text-[#A09060] hover:text-[#E8E0C8]"
                    >
                      {smsSent ? 'Reenviar SMS' : 'Enviar SMS'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-[#2b2b2b] bg-[#0c0c0c] p-3">
                  <p className="text-xs text-[#8a816a]">Sem telemóvel associado a esta conta.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
      <SellerManualModal
        isOpen={isManualOpen}
        onAcknowledge={() => {
          setIsManualOpen(false);
          onClose();
          onLoginClick();
        }}
      />
    </Dialog>
  );
}
