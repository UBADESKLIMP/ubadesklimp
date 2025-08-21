
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, Phone } from 'lucide-react';
import WhatsAppIcon from './WhatsAppIcon';

const Hero = () => {
  const handleWhatsAppContact = () => {
    const message = encodeURIComponent('Olá! Gostaria de mais informações sobre os produtos da Ubadesklimp.');
    window.open(`https://wa.me/551238332434?text=${message}`, '_blank');
  };

  const handlePhoneContact = () => {
    window.open('tel:1238324474', '_self');
  };

  const scrollToProducts = () => {
    const productsSection = document.getElementById('products');
    productsSection?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="home" className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-accent/20 to-background overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      <div className="absolute top-20 left-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-10 w-40 h-40 bg-secondary/10 rounded-full blur-3xl"></div>
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center space-y-8 max-w-4xl mx-auto">
          {/* Main heading */}
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-heading text-gradient leading-tight">
              Produtos de Limpeza
              <span className="block text-primary">Profissionais</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Qualidade superior para sua casa e empresa. Produtos eficientes que fazem a diferença na limpeza do dia a dia.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button 
              onClick={handleWhatsAppContact}
              size="lg" 
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 text-lg font-semibold shadow-glow hover:shadow-glow-intense transition-all duration-300 flex items-center space-x-3"
            >
              <WhatsAppIcon className="w-6 h-6" />
              <span>Fale Conosco</span>
            </Button>
            
            <Button 
              onClick={handlePhoneContact}
              variant="outline"
              size="lg" 
              className="px-8 py-4 text-lg font-semibold border-2 hover:bg-accent transition-all duration-300 flex items-center space-x-3"
            >
              <Phone className="w-5 h-5" />
              <span>(12) 3832-4474</span>
            </Button>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16">
            <Card className="bg-card/50 backdrop-blur-sm border-border/50 hover:shadow-soft transition-all duration-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-2xl font-bold text-primary">+500</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">Clientes Satisfeitos</CardDescription>
              </CardContent>
            </Card>
            
            <Card className="bg-card/50 backdrop-blur-sm border-border/50 hover:shadow-soft transition-all duration-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-2xl font-bold text-primary">15+</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">Anos de Experiência</CardDescription>
              </CardContent>
            </Card>
            
            <Card className="bg-card/50 backdrop-blur-sm border-border/50 hover:shadow-soft transition-all duration-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-2xl font-bold text-primary">100%</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">Qualidade Garantida</CardDescription>
              </CardContent>
            </Card>
          </div>

          {/* Scroll indicator */}
          <div className="flex justify-center mt-16">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={scrollToProducts}
              className="animate-bounce hover:animate-none transition-all duration-300"
            >
              <ChevronDown className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
