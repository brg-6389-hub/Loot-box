/* Comentario PT-PT: ficheiro de codigo da aplicacao LootBox mantido pela equipa. */
import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateEmail,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import type { PaymentMethod, User, UserRole } from '@/types';
import { apiFetch, getToken, setToken } from '@/lib/api';
import { firebaseAuth } from '@/lib/firebase';

interface LoginResult {
  success: boolean;
  reason?: 'invalid_credentials' | 'email_not_verified' | 'phone_not_verified';
}

interface RegisterResult {
  success: boolean;
  reason?: 'email_exists' | 'username_exists' | 'phone_exists' | 'server_error';
}

interface VerifyEmailResult {
  success: boolean;
  reason?: 'invalid_code' | 'expired_code' | 'email_not_found' | 'server_error';
}

interface ResetResult {
  success: boolean;
  reason?: 'invalid_code' | 'expired_code' | 'email_not_found' | 'server_error';
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isBuyer: boolean;
  isSeller: boolean;
  isAdmin: boolean;
  login: (identifier: string, password: string) => Promise<LoginResult>;
  register: (name: string, email: string, password: string, role: UserRole, extras?: { username?: string; phone?: string }) => Promise<RegisterResult>;
  verifyEmail: (email?: string, code?: string) => Promise<VerifyEmailResult>;
  resendVerificationCode: (email?: string) => Promise<{ success: boolean }>;
  requestPasswordReset: (identifier: string) => Promise<{ success: boolean; reason?: 'email_not_found' | 'server_error' }>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<ResetResult>;
  requestPhoneVerification: (phone: string) => Promise<{ success: boolean; reason?: 'phone_exists' | 'server_error'; debugCode?: string; phoneMasked?: string }>;
  verifyPhone: (code: string) => Promise<{ success: boolean; reason?: 'invalid_code' | 'expired_code' | 'server_error' }>;
  updateProfileDetails: (payload: { name: string; username: string; email: string; phone: string; avatarUrl?: string }) => Promise<{
    success: boolean;
    reason?: 'invalid_data' | 'email_exists' | 'username_exists' | 'phone_exists' | 'recent_login_required' | 'server_error';
    requiresEmailVerification?: boolean;
    phoneVerificationRequired?: boolean;
    phoneMasked?: string;
    debugCode?: string;
  }>;
  logout: () => void;
  deleteAccount: () => Promise<{ success: boolean; reason?: 'recent_login_required' | 'server_error' }>;
  addPaymentMethod: (method: Omit<PaymentMethod, 'id' | 'isDefault'>) => Promise<void>;
  refreshPaymentMethods: () => Promise<void>;
  setDefaultPaymentMethod: (methodId: string) => Promise<void>;
  removePaymentMethod: (methodId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);
const SESSION_KEY = 'lootbox_user';
const PENDING_ROLE_KEY = 'lootbox_pending_role';
const PENDING_ROLE_EMAIL_KEY = 'lootbox_pending_role_email';
const USERNAME_OVERRIDE_KEY = 'lootbox_username_override';

function normalizeRole(role: string | undefined | null): UserRole {
  if (role === 'admin') return 'admin';
  return role === 'vendedor' || role === 'destribuidior' ? 'destribuidior' : 'cliente';
}

function normalizeUser(user: User): User {
  return {
    ...user,
    role: normalizeRole(user.role),
  };
}

function savePendingRole(email: string, role: UserRole) {
  localStorage.setItem(PENDING_ROLE_KEY, role);
  localStorage.setItem(PENDING_ROLE_EMAIL_KEY, email.trim().toLowerCase());
}

function clearPendingRole() {
  localStorage.removeItem(PENDING_ROLE_KEY);
  localStorage.removeItem(PENDING_ROLE_EMAIL_KEY);
}

function saveUsernameOverride(username: string) {
  if (!username.trim()) return;
  localStorage.setItem(USERNAME_OVERRIDE_KEY, username.trim());
}

function getUsernameOverride() {
  return localStorage.getItem(USERNAME_OVERRIDE_KEY);
}

function purgeLocalAccountData() {
  localStorage.removeItem('lootbox_favorites');
  localStorage.removeItem('lootbox_cart');
  localStorage.removeItem('lootbox_orders');
  localStorage.removeItem('lootbox_conversations');
}

// Guarda uma copia simples do utilizador para preservar a sessao no navegador.
function saveSessionUser(user: User | null) {
  if (!user) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(normalizeUser(user)));
}

// Normaliza erros do Firebase para facilitar a traducao para estados da interface.
function mapFirebaseError(err: unknown): string {
  const message = err instanceof Error ? err.message : '';
  return message.toLowerCase();
}

// Sincroniza a sessao autenticada do Firebase com o backend da aplicacao.
async function backendSync(firebaseUser: FirebaseUser): Promise<User | null> {
  const token = await firebaseUser.getIdToken();
  setToken(token);
  try {
    const res = await apiFetch<{ user: User }>('/api/auth/me');
    return normalizeUser(res.user);
  } catch {
    try {
      const sync = await apiFetch<{ token: string; user: User }>('/api/auth/client-sync', {
        method: 'POST',
        body: JSON.stringify({
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || 'Utilizador',
          emailVerified: firebaseUser.emailVerified,
        }),
      });
      setToken(sync.token);
      return normalizeUser(sync.user);
    } catch {
      return {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || 'Utilizador',
        email: firebaseUser.email || '',
        role: 'cliente',
        avatar: (firebaseUser.displayName || firebaseUser.email || 'U').charAt(0).toUpperCase(),
        isBlocked: false,
        paymentMethods: [],
      };
    }
  }
}

async function syncBackendProfile(
  firebaseUser: FirebaseUser,
  payload: { name?: string; role?: UserRole; username?: string; phone?: string; avatarUrl?: string },
) {
  const token = await firebaseUser.getIdToken();
  setToken(token);
  try {
    await apiFetch('/api/auth/profile', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch {
    const sync = await apiFetch<{ token: string; user: User }>('/api/auth/client-sync', {
      method: 'POST',
      body: JSON.stringify({
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        name: payload.name || firebaseUser.displayName || 'Utilizador',
        role: payload.role,
        username: payload.username,
        phone: payload.phone,
        emailVerified: firebaseUser.emailVerified,
      }),
    });
    setToken(sync.token);
  }
}

async function resolveIdentifierToEmail(identifier: string): Promise<string | null> {
  if (!identifier.trim()) return null;
  if (identifier.includes('@')) return identifier.trim().toLowerCase();
  try {
    const result = await apiFetch<{ email: string }>('/api/auth/resolve-identifier', {
      method: 'POST',
      body: JSON.stringify({ identifier }),
    });
    return result.email;
  } catch {
    return null;
  }
}

// Este provider concentra toda a logica de autenticacao e metodos de pagamento do utilizador.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Sem Firebase configurado, a aplicacao funciona em modo sem autenticacao remota.
    if (!firebaseAuth) {
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      saveSessionUser(null);
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      // Quando a sessao termina, limpamos todo o estado local associado ao utilizador.
      if (!firebaseUser) {
        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
        saveSessionUser(null);
        return;
      }

      await reload(firebaseUser);
      // A sessao so fica ativa depois de o email estar verificado.
      if (!firebaseUser.emailVerified) {
        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
        saveSessionUser(null);
        return;
      }

      let synced = await backendSync(firebaseUser);
      const pendingRole = localStorage.getItem(PENDING_ROLE_KEY) as UserRole | null;
      const pendingEmail = localStorage.getItem(PENDING_ROLE_EMAIL_KEY);

      if (
        synced &&
        firebaseUser.email &&
        pendingRole &&
        pendingEmail === firebaseUser.email.trim().toLowerCase() &&
        synced.role !== 'admin' &&
        synced.role !== pendingRole
      ) {
        try {
          await syncBackendProfile(firebaseUser, { role: pendingRole, name: synced.name });
          synced = await backendSync(firebaseUser);
          clearPendingRole();
        } catch {
          // Mantemos a sessao funcional mesmo que a sincronizacao do perfil falhe.
        }
      }

      const override = getUsernameOverride();
      if (synced && override && (synced.username || '').startsWith('user')) {
        try {
          await syncBackendProfile(firebaseUser, { username: override, name: synced.name });
          synced = await backendSync(firebaseUser);
        } catch {
          // Ignora falhas de override.
        }
      }

      const normalized = synced ? normalizeUser(synced) : null;
      if (normalized?.phone && !normalized.phoneVerified) {
        if (firebaseAuth) {
          void signOut(firebaseAuth);
        }
        setUser(null);
        setIsAuthenticated(false);
        saveSessionUser(null);
        window.dispatchEvent(new Event('lootbox-auth-changed'));
        return;
      }

      setUser(normalized);
      setIsAuthenticated(true);
      saveSessionUser(normalized);
      window.dispatchEvent(new Event('lootbox-auth-changed'));
    });

    return () => unsubscribe();
  }, []);

  const login = async (identifier: string, password: string): Promise<LoginResult> => {
    if (!firebaseAuth) return { success: false, reason: 'invalid_credentials' };
    try {
      const email = await resolveIdentifierToEmail(identifier);
      if (!email) return { success: false, reason: 'invalid_credentials' };
      const cred = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      await reload(cred.user);
      const userEmail = (cred.user.email || '').toLowerCase();
      if (!cred.user.emailVerified && !userEmail.endsWith('@lootbox.local')) {
        return { success: false, reason: 'email_not_verified' };
      }
      const synced = await backendSync(cred.user);
      const normalized = synced ? normalizeUser(synced) : null;
      if (normalized?.phone && !normalized.phoneVerified) {
        return { success: false, reason: 'phone_not_verified' };
      }
      const override = getUsernameOverride();
      if (normalized && override && (normalized.username || '').startsWith('user')) {
        try {
          await syncBackendProfile(cred.user, { username: override, name: normalized.name });
          const resynced = await backendSync(cred.user);
          const renormalized = resynced ? normalizeUser(resynced) : null;
          if (renormalized) {
            setUser(renormalized);
            setIsAuthenticated(true);
            saveSessionUser(renormalized);
            window.dispatchEvent(new Event('lootbox-auth-changed'));
            return { success: true };
          }
        } catch {
          // Ignora falhas de override.
        }
      }
      setUser(normalized);
      setIsAuthenticated(true);
      saveSessionUser(normalized);
      window.dispatchEvent(new Event('lootbox-auth-changed'));
      return { success: true };
    } catch {
      return { success: false, reason: 'invalid_credentials' };
    }
  };

  // O registo cria a conta e desencadeia o envio do email de verificacao.
  const register = async (
    name: string,
    email: string,
    password: string,
    role: UserRole,
    extras?: { username?: string; phone?: string },
  ): Promise<RegisterResult> => {
    if (!firebaseAuth) return { success: false, reason: 'server_error' };
    try {
      const cred = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
      await updateProfile(cred.user, { displayName: name.trim() });
      savePendingRole(email, role);
      try {
        await syncBackendProfile(cred.user, { name: name.trim(), role, username: extras?.username, phone: extras?.phone });
        if (extras?.username) {
          saveUsernameOverride(extras.username);
        }
      } catch (err) {
        const msg = mapFirebaseError(err);
        try {
          await deleteUser(cred.user);
        } catch {
          // Se falhar, nao interrompemos para evitar bloqueios.
        }
        if (msg.includes('username already exists')) return { success: false, reason: 'username_exists' };
        if (msg.includes('phone already exists')) return { success: false, reason: 'phone_exists' };
        // Guardamos o papel em localStorage e voltamos a aplicar na primeira sessao valida.
        return { success: false, reason: 'server_error' };
      }
      await sendEmailVerification(cred.user);
      return { success: true };
    } catch (err) {
      const msg = mapFirebaseError(err);
      if (msg.includes('email-already-in-use')) return { success: false, reason: 'email_exists' };
      return { success: false, reason: 'server_error' };
    }
  };

  // A verificacao valida o estado atual da conta no Firebase.
  const verifyEmail = async (): Promise<VerifyEmailResult> => {
    if (!firebaseAuth) return { success: false, reason: 'server_error' };
    try {
      const current = firebaseAuth.currentUser;
      if (!current) return { success: false, reason: 'email_not_found' };
      await reload(current);
      if (!current.emailVerified) return { success: false, reason: 'invalid_code' };
      return { success: true };
    } catch {
      return { success: false, reason: 'server_error' };
    }
  };

  // O reenvio reaproveita o utilizador autenticado atualmente no cliente.
  const resendVerificationCode = async () => {
    if (!firebaseAuth) return { success: false };
    try {
      const current = firebaseAuth.currentUser;
      if (!current) return { success: false };
      await sendEmailVerification(current);
      return { success: true };
    } catch {
      return { success: false };
    }
  };

  // O pedido de reposicao delega no Firebase o envio do email de recuperacao.
  const requestPasswordReset = async (identifier: string) => {
    if (!firebaseAuth) return { success: false, reason: 'server_error' as const };
    try {
      const email = await resolveIdentifierToEmail(identifier);
      if (!email) return { success: false, reason: 'email_not_found' as const };
      await sendPasswordResetEmail(firebaseAuth, email.trim());
      return { success: true };
    } catch (err) {
      const msg = mapFirebaseError(err);
      if (msg.includes('user-not-found')) return { success: false, reason: 'email_not_found' as const };
      return { success: false, reason: 'server_error' as const };
    }
  };

  const requestPhoneVerification = async (phone: string) => {
    if (!firebaseAuth) return { success: false, reason: 'server_error' as const };
    const current = firebaseAuth.currentUser;
    if (!current) return { success: false, reason: 'server_error' as const };
    try {
      const token = await current.getIdToken();
      setToken(token);
      const res = await apiFetch<{ success: boolean; debugSmsCode?: string; phoneMasked?: string }>(
        '/api/auth/request-phone-verification',
        {
          method: 'POST',
          body: JSON.stringify({ phone }),
        },
      );
      return { success: true, debugCode: res.debugSmsCode, phoneMasked: res.phoneMasked };
    } catch (err) {
      const msg = mapFirebaseError(err);
      if (msg.includes('phone already exists')) return { success: false, reason: 'phone_exists' as const };
      return { success: false, reason: 'server_error' as const };
    }
  };

  const verifyPhone = async (code: string) => {
    if (!firebaseAuth) return { success: false, reason: 'server_error' as const };
    const current = firebaseAuth.currentUser;
    if (!current) return { success: false, reason: 'server_error' as const };
    try {
      const token = await current.getIdToken();
      setToken(token);
      await apiFetch('/api/auth/verify-phone', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      const synced = await backendSync(current);
      const normalized = synced ? normalizeUser(synced) : null;
      setUser(normalized);
      setIsAuthenticated(Boolean(normalized));
      saveSessionUser(normalized);
      window.dispatchEvent(new Event('lootbox-auth-changed'));
      return { success: true };
    } catch (err) {
      const msg = mapFirebaseError(err);
      if (msg.includes('expired')) return { success: false, reason: 'expired_code' as const };
      if (msg.includes('invalid')) return { success: false, reason: 'invalid_code' as const };
      return { success: false, reason: 'server_error' as const };
    }
  };

  const updateProfileDetails = async (payload: { name: string; username: string; email: string; phone: string; avatarUrl?: string }) => {
    if (!firebaseAuth) return { success: false, reason: 'server_error' as const };
    const current = firebaseAuth.currentUser;
    if (!current) return { success: false, reason: 'server_error' as const };

    const nextName = payload.name.trim();
    const nextEmail = payload.email.trim().toLowerCase();
    const nextUsername = payload.username.trim();
    const nextPhone = payload.phone.trim();
    if (!nextName || (!nextEmail && !nextPhone)) {
      return { success: false, reason: 'invalid_data' as const };
    }

    const emailChanged = nextEmail && nextEmail !== (current.email || '').toLowerCase();
    const nameChanged = nextName !== (current.displayName || '');
    const phoneChanged = nextPhone !== (user?.phone || '');

    try {
      if (nameChanged) {
        await updateProfile(current, { displayName: nextName });
      }
      if (emailChanged) {
        await updateEmail(current, nextEmail);
        await sendEmailVerification(current);
      }

      await syncBackendProfile(current, {
        name: nextName,
        username: nextUsername,
        phone: nextPhone,
        avatarUrl: payload.avatarUrl,
      });

      const synced = await backendSync(current);
      const normalized = synced ? normalizeUser(synced) : null;
      if (normalized) {
        if (nextName) normalized.name = nextName;
        if (nextUsername) normalized.username = nextUsername;
        if (nextEmail) normalized.email = nextEmail;
        if (nextPhone) normalized.phone = nextPhone;
        if (payload.avatarUrl !== undefined) normalized.avatarUrl = payload.avatarUrl || undefined;
      }
      setUser(normalized);
      setIsAuthenticated(Boolean(normalized));
      saveSessionUser(normalized);
      window.dispatchEvent(new Event('lootbox-auth-changed'));

      if (nextUsername) {
        saveUsernameOverride(nextUsername);
      }

      if (emailChanged) {
        if (firebaseAuth) {
          await signOut(firebaseAuth);
        }
        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
        saveSessionUser(null);
        window.dispatchEvent(new Event('lootbox-auth-changed'));
        return { success: true, requiresEmailVerification: true };
      }

      if (nextPhone && (phoneChanged || (normalized?.phone && !normalized.phoneVerified))) {
        const smsResult = await requestPhoneVerification(nextPhone);
        if (smsResult.success) {
          return {
            success: true,
            phoneVerificationRequired: true,
            phoneMasked: smsResult.phoneMasked,
            debugCode: smsResult.debugCode,
          };
        }
      }

      return { success: true };
    } catch (err) {
      const msg = mapFirebaseError(err);
      if (msg.includes('requires-recent-login')) return { success: false, reason: 'recent_login_required' as const };
      if (msg.includes('email already exists')) return { success: false, reason: 'email_exists' as const };
      if (msg.includes('username already exists')) return { success: false, reason: 'username_exists' as const };
      if (msg.includes('phone already exists')) return { success: false, reason: 'phone_exists' as const };
      return { success: false, reason: 'server_error' as const };
    }
  };

  // Este fluxo ainda nao esta implementado no cliente atual.
  const resetPassword = async (): Promise<ResetResult> => {
    return { success: false, reason: 'server_error' };
  };

  // O logout remove credenciais locais e notifica o resto da aplicacao.
  const logout = () => {
    if (firebaseAuth) {
      void signOut(firebaseAuth);
    }
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    saveSessionUser(null);
    window.dispatchEvent(new Event('lootbox-auth-changed'));
  };

  const deleteAccount = async () => {
    if (!user) return { success: false, reason: 'server_error' as const };

    const current = firebaseAuth?.currentUser;
    try {
      if (current) {
        const token = await current.getIdToken();
        setToken(token || getToken());
      }

      await apiFetch('/api/auth/account', { method: 'DELETE' });

      if (current) {
        await deleteUser(current);
      }

      purgeLocalAccountData();
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      saveSessionUser(null);
      clearPendingRole();
      window.dispatchEvent(new Event('lootbox-auth-changed'));
      return { success: true };
    } catch (err) {
      const msg = mapFirebaseError(err);
      if (msg.includes('requires-recent-login')) {
        return { success: false, reason: 'recent_login_required' as const };
      }
      return { success: false, reason: 'server_error' as const };
    }
  };

  // Recarrega os metodos de pagamento do backend e atualiza o utilizador em memoria.
  const syncPaymentMethods = async () => {
    const data = await apiFetch<{ paymentMethods: PaymentMethod[] }>('/api/payment-methods');
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, paymentMethods: data.paymentMethods };
      saveSessionUser(next);
      return next;
    });
  };

  const addPaymentMethod = async (method: Omit<PaymentMethod, 'id' | 'isDefault'>) => {
    await apiFetch('/api/payment-methods', {
      method: 'POST',
      body: JSON.stringify(method),
    });
    await syncPaymentMethods();
  };

  const refreshPaymentMethods = async () => {
    await syncPaymentMethods();
  };

  const setDefaultPaymentMethod = async (methodId: string) => {
    await apiFetch(`/api/payment-methods/${methodId}/default`, { method: 'PATCH' });
    await syncPaymentMethods();
  };

  const removePaymentMethod = async (methodId: string) => {
    await apiFetch(`/api/payment-methods/${methodId}`, { method: 'DELETE' });
    await syncPaymentMethods();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isBuyer: user?.role === 'cliente',
        isSeller: user?.role === 'destribuidior',
        isAdmin: user?.role === 'admin',
        login,
        register,
        verifyEmail,
        resendVerificationCode,
        requestPasswordReset,
        resetPassword,
        requestPhoneVerification,
        verifyPhone,
        updateProfileDetails,
        logout,
        deleteAccount,
        addPaymentMethod,
        refreshPaymentMethods,
        setDefaultPaymentMethod,
        removePaymentMethod,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
