/* Comentario PT-PT: ficheiro de codigo da aplicacao LootBox mantido pela equipa. */
import { Home, Heart, PlusCircle, User, ShoppingCart, Shield } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMarketplace } from '@/hooks/useMarketplace';
import type { View } from '@/types';

interface BottomNavigationProps {
  currentView: View;
  onViewChange: (view: View) => void;
  onLoginClick: () => void;
}

const NAV_ITEMS: Array<{ id: View; label: string; icon: typeof Home; auth: boolean; roles: string[] }> = [
  { id: 'home', label: 'Página Inicial', icon: Home, auth: false, roles: ['cliente', 'destribuidior', 'admin'] },
  { id: 'favorites', label: 'Favoritos', icon: Heart, auth: false, roles: ['cliente'] },
  { id: 'cart', label: 'Carrinho', icon: ShoppingCart, auth: true, roles: ['cliente'] },
  { id: 'publish', label: 'Publicar', icon: PlusCircle, auth: true, roles: ['destribuidior'] },
  { id: 'profile', label: 'Perfil', icon: User, auth: true, roles: ['cliente', 'destribuidior', 'admin'] },
  { id: 'admin', label: 'Administrador', icon: Shield, auth: true, roles: ['admin'] },
];

export function BottomNavigation({ currentView, onViewChange, onLoginClick }: BottomNavigationProps) {
  const { isAuthenticated, user } = useAuth();
  const { cartCount } = useMarketplace();
  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!user) return !item.auth;
    return item.roles.includes(user.role);
  });

  const handleClick = (viewId: View, auth: boolean, roles: string[]) => {
    if (auth && !isAuthenticated) {
      onLoginClick();
      return;
    }
    if (auth && user && !roles.includes(user.role)) return;
    onViewChange(viewId);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#1f1f1f] bg-[#0A0A0A]/97 backdrop-blur">
      <div className="w-full px-2">
        <div className="flex items-center justify-around py-2">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => handleClick(item.id, item.auth, item.roles)}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-md transition-colors ${
                  isActive 
                    ? 'text-[#C9A962]' 
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-6 h-6 ${isActive ? 'fill-current' : ''}`} />
                  {item.id === 'cart' && cartCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 bg-[#C9A962] text-[#0A0A0A] rounded-full text-[10px] font-bold flex items-center justify-center">
                      {cartCount > 9 ? '9+' : cartCount}
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      {/* Safe area for mobile */}
      <div className="h-safe-area-inset-bottom" />
    </nav>
  );
}
