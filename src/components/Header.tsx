
import { useState } from 'react';
import { Menu, X, User, LogOut, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import Cart from './Cart';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, signOut, loading, isAdmin } = useAuth();
  const [isUserAdmin, setIsUserAdmin] = useState(false);

  // Check if user is admin when component mounts and user changes
  React.useEffect(() => {
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
    <header className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-md border-b border-border z-50 shadow-soft">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo - Now clickable */}
          <div className="flex-shrink-0">
            <Link to="/" className="text-2xl font-heading text-gradient hover:opacity-80 transition-opacity">
              Ubadesklimp
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            {navigation.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="text-foreground hover:text-primary transition-colors duration-200 font-medium"
              >
                {item.name}
              </a>
            ))}
          </nav>

          {/* Desktop CTA - Right aligned */}
          <div className="hidden md:flex items-center space-x-4 ml-auto">
            <Cart />
            
            {/* Auth Section */}
            {!loading && (
              user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-foreground hover:text-primary">
                      <User className="h-4 w-4 mr-2" />
                      {user.email?.split('@')[0]}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {isUserAdmin && (
                      <>
                        <DropdownMenuItem asChild>
                          <Link to="/admin" className="flex items-center">
                            <Shield className="h-4 w-4 mr-2" />
                            Admin
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
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

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 bg-white border-t border-border shadow-medium">
            {navigation.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="block px-3 py-2 text-foreground hover:text-primary hover:bg-accent rounded-md transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                {item.name}
              </a>
            ))}
            <div className="pt-4 pb-2 px-3 space-y-2">
              <div className="flex justify-center">
                <Cart />
              </div>
              
              {/* Mobile Auth Section */}
              {!loading && (
                user ? (
                  <div className="space-y-2 pt-2 border-t border-border">
                    {isUserAdmin && (
                      <Button variant="ghost" className="w-full justify-start" asChild>
                        <Link to="/admin">
                          <Shield className="h-4 w-4 mr-2" />
                          Admin
                        </Link>
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start text-destructive hover:text-destructive"
                      onClick={signOut}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sair
                    </Button>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-border">
                    <Button asChild variant="default" className="w-full bg-gradient-primary">
                      <Link to="/auth">Entrar</Link>
                    </Button>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
