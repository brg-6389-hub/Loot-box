/* Comentario PT-PT: ficheiro de codigo da aplicacao LootBox mantido pela equipa. */
import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/hooks/useAuth';
import { ProductsProvider } from '@/hooks/useProducts';
import { NotificationsProvider } from '@/hooks/useNotifications';
import { MarketplaceProvider } from '@/hooks/useMarketplace';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/pages/Header';
import { HomePage } from '@/components/pages/HomePage';
import { ProfilePage } from '@/components/pages/ProfilePage';
import { PersonalDataPage } from '@/components/pages/PersonalDataPage';
import { PublishPage } from '@/components/pages/PublishPage';
import { ProductDetailPage } from '@/components/pages/ProductDetailPage';
import { FavoritesPage } from '@/components/pages/FavoritesPage';
import { ChatPage } from '@/components/pages/ChatPage';
import { CartPage } from '@/components/pages/CartPage';
import { SellerProfilePage } from '@/components/pages/SellerProfilePage';
import { AdminPage } from '@/components/pages/AdminPage';
import { LoginModal } from '@/components/auth/LoginModal';
import { RegisterModal } from '@/components/auth/RegisterModal';
import { InfoModal, type InfoSection } from '@/components/ui-custom/InfoModal';
import { SiteFooter } from '@/components/ui-custom/SiteFooter';
import type { View } from '@/types';
import './App.css';

// Este componente gere a navegacao principal da interface sem recorrer a um router dedicado.
function AppContent() {
  const [currentView, setCurrentView] = useState<View>('home');
  const [viewHistory, setViewHistory] = useState<View[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [infoSection, setInfoSection] = useState<InfoSection>('sobre');
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark';
    const saved = window.localStorage.getItem('lootbox_theme');
    return saved === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('lootbox_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (currentView !== 'favorites') return;
    if (!user) return;
    if (user.role !== 'cliente') {
      setCurrentView('home');
    }
  }, [currentView, user]);

  // Ao escolher um produto, guardamos o identificador e mudamos para o detalhe.
  const navigateTo = (nextView: View) => {
    if (nextView === currentView) return;
    setViewHistory((prev) => [...prev, currentView]);
    setCurrentView(nextView);
  };

  const handleProductClick = (productId: string) => {
    setSelectedProductId(productId);
    navigateTo('product-detail');
  };

  // Voltar do detalhe limpa o produto selecionado e regressa a pagina inicial.
  const handleBackFromProduct = () => {
    setSelectedProductId(null);
    if (viewHistory.length > 0) {
      const next = viewHistory[viewHistory.length - 1];
      setViewHistory((prev) => prev.slice(0, -1));
      setCurrentView(next);
    } else {
      setCurrentView('home');
    }
  };

  const handleSellerProfileOpen = (sellerId: string) => {
    setSelectedSellerId(sellerId);
    navigateTo('seller-profile');
  };

  const handleBackFromSellerProfile = () => {
    setSelectedSellerId(null);
    if (viewHistory.length > 0) {
      const next = viewHistory[viewHistory.length - 1];
      setViewHistory((prev) => prev.slice(0, -1));
      setCurrentView(next);
    } else {
      setCurrentView(selectedProductId ? 'product-detail' : 'home');
    }
  };

  // Depois de publicar um produto, regressamos a listagem principal.
  const handlePublishSuccess = () => {
    navigateTo('home');
  };

  // O logout devolve o utilizador a vista publica da aplicacao.
  const handleLogout = () => {
    setViewHistory([]);
    setCurrentView('home');
  };

  const handleBack = () => {
    if (viewHistory.length === 0) return;
    const previous = viewHistory[viewHistory.length - 1];
    setViewHistory((prev) => prev.slice(0, -1));
    if (currentView === 'product-detail') {
      setSelectedProductId(null);
    }
    if (currentView === 'seller-profile') {
      setSelectedSellerId(null);
    }
    setCurrentView(previous);
  };

  // A vista atual determina que pagina deve ser apresentada no conteudo principal.
  const renderContent = () => {
    switch (currentView) {
      case 'home':
        return (
          <HomePage
            onProductClick={handleProductClick}
            onViewChange={navigateTo}
            onLoginClick={() => setIsLoginOpen(true)}
            searchQuery={searchQuery}
          />
        );
      case 'profile':
        return <ProfilePage onLogout={handleLogout} onOpenPersonalData={() => navigateTo('personal-data')} />;
      case 'personal-data':
        return <PersonalDataPage onBack={handleBack} />;
      case 'publish':
        return <PublishPage onPublishSuccess={handlePublishSuccess} />;
      case 'favorites':
        return <FavoritesPage />;
      case 'chat':
        return <ChatPage />;
      case 'cart':
        return <CartPage />;
      case 'admin':
        return <AdminPage />;
      case 'seller-profile':
        return selectedSellerId ? (
          <SellerProfilePage
            sellerId={selectedSellerId}
            onBack={handleBackFromSellerProfile}
            onProductClick={handleProductClick}
          />
        ) : (
          <HomePage
            onProductClick={handleProductClick}
            onViewChange={navigateTo}
            onLoginClick={() => setIsLoginOpen(true)}
            searchQuery={searchQuery}
          />
        );
      case 'product-detail':
        return selectedProductId ? (
          <ProductDetailPage 
            productId={selectedProductId} 
            onBack={handleBackFromProduct}
            onGoToCart={() => navigateTo('cart')}
            onGoToChat={() => navigateTo('chat')}
            onOpenSellerProfile={handleSellerProfileOpen}
          />
        ) : (
          <HomePage
            onProductClick={handleProductClick}
            onViewChange={navigateTo}
            onLoginClick={() => setIsLoginOpen(true)}
            searchQuery={searchQuery}
          />
        );
      default:
        return (
          <HomePage
            onProductClick={handleProductClick}
            onViewChange={navigateTo}
            onLoginClick={() => setIsLoginOpen(true)}
            searchQuery={searchQuery}
          />
        );
    }
  };

  return (
    <div className={`min-h-screen ambient-bg ${theme === 'light' ? 'bg-[#f6f1e7] text-[#1f1a14]' : 'bg-[#0A0A0A] text-[#E8E0C8]'}`}>
      <Header
        currentView={currentView}
        onViewChange={navigateTo}
        onBack={handleBack}
        canGoBack={viewHistory.length > 0}
        onLoginClick={() => setIsLoginOpen(true)}
        theme={theme}
        onToggleTheme={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      
      {/* Main Content */}
      <main className="pt-24 md:pt-24 relative z-[1]">
        {renderContent()}
      </main>

      <SiteFooter
        onOpenSection={(section) => {
          setInfoSection(section);
          setIsInfoOpen(true);
        }}
      />

      {isAuthenticated && user && currentView !== 'chat' && (
        <button
          type="button"
          onClick={() => setCurrentView('chat')}
          className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#C9A962] to-[#8B7355] text-[#0A0A0A] shadow-[0_18px_40px_rgba(0,0,0,0.35)] transition-transform hover:scale-105"
          aria-label="Abrir conversas"
          title="Abrir conversas"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Modals */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSuccess={() => setCurrentView('profile')}
        onRegisterClick={() => {
          setIsLoginOpen(false);
          setIsRegisterOpen(true);
        }}
      />

      <RegisterModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onLoginClick={() => {
          setIsRegisterOpen(false);
          setIsLoginOpen(true);
        }}
      />

      <InfoModal
        isOpen={isInfoOpen}
        section={infoSection}
        onClose={() => setIsInfoOpen(false)}
      />

      {/* Toast notifications */}
      <Toaster position="bottom-right" />
    </div>
  );
}

// Este componente encapsula todos os providers globais necessarios a aplicacao.
function App() {
  return (
    <AuthProvider>
      <ProductsProvider>
        <MarketplaceProvider>
          <NotificationsProvider>
            <AppContent />
          </NotificationsProvider>
        </MarketplaceProvider>
      </ProductsProvider>
    </AuthProvider>
  );
}

export default App;
