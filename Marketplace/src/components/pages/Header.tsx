/* Comentario PT-PT: ficheiro de codigo da aplicacao LootBox mantido pela equipa. */
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ArrowLeft, LogIn, Moon, Search, Sun, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NotificationsPanel } from '@/components/ui-custom/NotificationsPanel';
import type { View } from '@/types';

interface HeaderProps {
  currentView: View;
  onViewChange: (view: View) => void;
  onBack: () => void;
  canGoBack: boolean;
  onLoginClick: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

const NAV_ITEMS: Array<{ id: View; label: string; auth: boolean; roles: string[] }> = [
  { id: 'home', label: 'Página Inicial', auth: false, roles: ['cliente', 'destribuidior', 'admin'] },
  { id: 'favorites', label: 'Favoritos', auth: false, roles: ['cliente'] },
  { id: 'cart', label: 'Carrinho', auth: true, roles: ['cliente'] },
  { id: 'publish', label: 'Publicar', auth: true, roles: ['destribuidior'] },
  { id: 'profile', label: 'Perfil', auth: true, roles: ['cliente', 'destribuidior', 'admin'] },
  { id: 'admin', label: 'Administrador', auth: true, roles: ['admin'] },
];

export function Header({ currentView, onViewChange, onBack, canGoBack, onLoginClick, theme, onToggleTheme, searchQuery, onSearchChange }: HeaderProps) {
  const { isAuthenticated, user } = useAuth();
  const isLight = theme === 'light';
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!user) return !item.auth;
    return item.roles.includes(user.role);
  });

  useEffect(() => {
    if (!isSearchOpen) return;
    searchInputRef.current?.focus();
  }, [isSearchOpen]);

  const handleNav = (itemId: View, requiresAuth: boolean, roles: string[]) => {
    if (requiresAuth && !isAuthenticated) {
      onLoginClick();
      return;
    }
    if (requiresAuth && user && !roles.includes(user.role)) return;
    onViewChange(itemId);
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 border-b backdrop-blur ${
        isLight ? 'border-[#d8cfbf] bg-[#f6f1e7]/95' : 'border-[#1f1f1f] bg-[#0A0A0A]/95'
      }`}
    >
      <div className="w-full px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {canGoBack && (
            <button
              type="button"
              onClick={onBack}
              className={`h-9 w-9 rounded-full border inline-flex items-center justify-center ${
                isLight
                  ? 'border-[#d5cab7] bg-[#fffaf1] text-[#2e2419] hover:border-[#C9A962]/60'
                  : 'border-[#2b2b2b] bg-[#151515] text-[#E8E0C8] hover:border-[#C9A962]/60'
              }`}
              aria-label="Voltar"
              title="Voltar"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <img
            src="/lootbox-logo.png"
            alt="Loot Box"
            className="h-8 w-8 rounded-full border border-[#c9a962] object-cover"
          />
          <h1 className="text-xl font-extrabold tracking-[0.18em]">
            <span className="gradient-text">LOOT BOX</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {currentView === 'home' && (
            <div className="flex items-center gap-2">
              {isSearchOpen && (
                <div className={`flex items-center gap-2 rounded-full border px-3 h-9 ${
                  isLight ? 'border-[#d5cab7] bg-[#fffaf1]' : 'border-[#2b2b2b] bg-[#151515]'
                }`}>
                  <Search className={`w-4 h-4 ${isLight ? 'text-[#7c6a51]' : 'text-[#9c9278]'}`} />
                  <input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Pesquisar produtos..."
                    className={`w-40 bg-transparent text-sm outline-none ${
                      isLight ? 'text-[#2e2419] placeholder:text-[#8c7a62]' : 'text-[#E8E0C8] placeholder:text-[#6b6453]'
                    }`}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => onSearchChange('')}
                      className={isLight ? 'text-[#7c6a51] hover:text-[#2e2419]' : 'text-[#9c9278] hover:text-[#E8E0C8]'}
                      aria-label="Limpar pesquisa"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  if (isSearchOpen && !searchQuery) {
                    setIsSearchOpen(false);
                    return;
                  }
                  setIsSearchOpen(true);
                }}
                className={`h-9 w-9 rounded-full border inline-flex items-center justify-center ${
                  isLight
                    ? 'border-[#d5cab7] bg-[#fffaf1] text-[#2e2419] hover:border-[#C9A962]/60'
                    : 'border-[#2b2b2b] bg-[#151515] text-[#E8E0C8] hover:border-[#C9A962]/60'
                }`}
                aria-label="Pesquisar"
                title="Pesquisar"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={onToggleTheme}
            className={`h-9 w-9 rounded-full border inline-flex items-center justify-center ${
              isLight
                ? 'border-[#d5cab7] bg-[#fffaf1] text-[#2e2419] hover:border-[#C9A962]/60'
                : 'border-[#2b2b2b] bg-[#151515] text-[#E8E0C8] hover:border-[#C9A962]/60'
            }`}
            aria-label={theme === 'dark' ? 'Ativar light mode' : 'Ativar dark mode'}
            title={theme === 'dark' ? 'Ativar light mode' : 'Ativar dark mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <NotificationsPanel />
              <div className="w-9 h-9 bg-gradient-to-br from-[#C9A962] to-[#8B7355] rounded-full flex items-center justify-center overflow-hidden">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user?.name || 'Utilizador'} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[#0A0A0A] font-bold text-sm">{user?.avatar || user?.name?.charAt(0) || 'U'}</span>
                )}
              </div>
            </div>
          ) : (
          <Button onClick={onLoginClick} className="h-9 px-4 btn-gold rounded-full text-sm font-semibold">
            <LogIn className="w-4 h-4 mr-1" />
            Entrar
          </Button>
        )}
        </div>
      </div>

      <div className="px-4 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {visibleItems.map((item) => {
            const active = currentView === item.id || (item.id === 'home' && currentView === 'product-detail');
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id, item.auth, item.roles)}
                className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-gradient-to-r from-[#C9A962] to-[#D4AF37] text-[#0A0A0A] font-semibold'
                    : isLight
                      ? 'text-[#6f6453] hover:text-[#2b2118] hover:bg-[#ece2d4]'
                      : 'text-[#8a816a] hover:text-[#E8E0C8] hover:bg-[#171717]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
