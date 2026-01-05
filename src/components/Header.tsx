
import React, { useState, useEffect } from 'react';
import { Menu, X, User, LogOut, Shield, History, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { Link } from 'react-router-dom';
import Cart from './Cart';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { user, signOut, loading, isAdmin } = useAuth();
  const { profile } = useProfile();
  const [isUserAdmin, setIsUserAdmin] = useState(false);

  // Track scroll position
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Get display name - priority: profile name, company name/trade name, email
  const getDisplayName = () => {
    if (profile?.name) return profile.name;
    if (profile?.company_name) return profile.company_name;
    if (profile?.trade_name) return profile.trade_name;
    return user?.email?.split('@')[0] || 'Usuário';
  };

  // Check if user is admin when component mounts and user changes
  useEffect(() => {
    const checkAdmin = async () => {
      if (user && isAdmin) {
        try {
          const adminStatus = await isAdmin();
          setIsUserAdmin(adminStatus);
        } catch (error) {
          setIsUserAdmin(false);
        }
      } else {
        setIsUserAdmin(false);
      }
    };

    checkAdmin();
  }, [user, isAdmin]);

  const navigation = [
    { name: 'Início', href: '#home' },
    { name: 'Produtos', href: '#products' },
    { name: 'Sobre', href: '#about' },
    { name: 'Contato', href: '#contact' },
  ];

  const handleWhatsAppContact = () => {
    const message = encodeURIComponent('Olá! Gostaria de mais informações sobre os produtos da Ubadesklimp.');
    window.open(`https://wa.me/551238332434?text=${message}`, '_blank');
  };

  const handlePhoneContact = () => {
    window.open('tel:1238324474', '_self');
  };

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out ${
      isScrolled 
        ? 'bg-background/98 backdrop-blur-lg shadow-md border-b border-border/80' 
        : 'bg-background/95 backdrop-blur-md shadow-soft border-b border-border/50'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`flex justify-between items-center transition-all duration-300 ${
          isScrolled ? 'h-14' : 'h-16'
        }`}>
          {/* Logo - Now clickable */}
          <div className="flex-shrink-0">
            <Link to="/" className={`font-heading text-gradient hover:opacity-80 transition-all duration-300 ${
              isScrolled ? 'text-xl' : 'text-2xl'
            }`}>
              Ubadesklimp
            </Link>
          </div>

          {/* Desktop Navigation - Centered */}
          <nav className="hidden md:flex space-x-8 flex-1 justify-center">
            {navigation.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className={`transition-colors duration-200 font-medium ${
                  isScrolled 
                    ? 'text-blue-500 hover:text-blue-400' 
                    : 'text-white hover:text-blue-400'
                }`}
              >
                {item.name}
              </a>
            ))}
          </nav>

          {/* Desktop Auth & Cart - Far right */}
          <div className="hidden md:flex items-center space-x-3">
            <Cart />
            
            {/* Auth Section */}
            {!loading && (
              user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-foreground hover:text-primary">
                      <User className="h-4 w-4 mr-2" />
                      {getDisplayName()}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link to="/profile" className="flex items-center">
                        <Settings className="h-4 w-4 mr-2" />
                        Meu Perfil
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/orders" className="flex items-center">
                        <History className="h-4 w-4 mr-2" />
                        Histórico de Pedidos
                      </Link>
                    </DropdownMenuItem>
                    {isUserAdmin && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link to="/admin" className="flex items-center">
                            <Shield className="h-4 w-4 mr-2" />
                            Admin
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={signOut} className="text-destructive">
                      <LogOut className="h-4 w-4 mr-2" />
                      Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button asChild variant="default" size="sm" className="bg-gradient-primary hover:shadow-glow">
                  <Link to="/auth">Entrar</Link>
                </Button>
              )
            )}
          </div>

          {/* Mobile - Cart + Menu button */}
          <div className="md:hidden flex items-center space-x-4">
            <Cart />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="relative h-10 w-10 p-0"
            >
              <Menu className={`h-6 w-6 absolute transition-all duration-300 ease-in-out ${
                isMenuOpen ? 'rotate-90 opacity-0 scale-75' : 'rotate-0 opacity-100 scale-100'
              }`} />
              <X className={`h-6 w-6 absolute transition-all duration-300 ease-in-out ${
                isMenuOpen ? 'rotate-0 opacity-100 scale-100' : '-rotate-90 opacity-0 scale-75'
              }`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation - Animated */}
      <div className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
        isMenuOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <div className="px-4 pt-3 pb-4 space-y-1 bg-background/98 backdrop-blur-sm border-t border-border/50 shadow-lg">
          {navigation.map((item, index) => (
            <a
              key={item.name}
              href={item.href}
              className={`block px-4 py-3 hover:bg-accent/50 rounded-lg transition-all duration-200 transform hover:translate-x-1 ${
                isScrolled 
                  ? 'text-blue-500 hover:text-blue-400' 
                  : 'text-white hover:text-blue-400'
              }`}
              style={{ transitionDelay: `${index * 50}ms` }}
              onClick={() => setIsMenuOpen(false)}
            >
              {item.name}
            </a>
          ))}
          <div className="pt-4 pb-2 px-2 space-y-2">
            
            {/* Mobile Auth Section */}
            {!loading && (
              user ? (
                <div className="space-y-1 pt-3 border-t border-border/50">
                  <Button variant="ghost" className="w-full justify-start py-3 hover:translate-x-1 transition-all duration-200" asChild>
                    <Link to="/profile">
                      <Settings className="h-4 w-4 mr-3" />
                      Meu Perfil
                    </Link>
                  </Button>
                  <Button variant="ghost" className="w-full justify-start py-3 hover:translate-x-1 transition-all duration-200" asChild>
                    <Link to="/orders">
                      <History className="h-4 w-4 mr-3" />
                      Histórico de Pedidos
                    </Link>
                  </Button>
                  {isUserAdmin && (
                    <Button variant="ghost" className="w-full justify-start py-3 hover:translate-x-1 transition-all duration-200" asChild>
                      <Link to="/admin">
                        <Shield className="h-4 w-4 mr-3" />
                        Admin
                      </Link>
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start py-3 text-destructive hover:text-destructive hover:translate-x-1 transition-all duration-200"
                    onClick={signOut}
                  >
                    <LogOut className="h-4 w-4 mr-3" />
                    Sair
                  </Button>
                </div>
              ) : (
                <div className="pt-3 border-t border-border/50">
                  <Button asChild variant="default" className="w-full bg-gradient-primary hover:shadow-glow transition-all duration-200">
                    <Link to="/auth">Entrar</Link>
                  </Button>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
