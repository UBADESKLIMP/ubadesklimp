
import { ArrowRight, Sparkles, Shield, Truck, Phone, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import heroImage from '@/assets/hero-cleaning-supplies.jpg';

const Hero = () => {
  const handleWhatsAppContact = () => {
    const message = encodeURIComponent('Olá! Gostaria de mais informações sobre os produtos da Ubadesklimp.');
    window.open(`https://wa.me/551238332434?text=${message}`, '_blank');
  };

  const handlePhoneContact = () => {
    window.open('tel:1238324474', '_self');
  };

  return (
    <section id="home" className="pt-16 min-h-screen flex items-center bg-gradient-to-br from-background via-accent/20 to-muted/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="animate-fade-in">
            <div className="inline-flex items-center px-4 py-2 bg-gradient-card rounded-full border border-border mb-6">
              <Sparkles className="h-4 w-4 text-primary mr-2" />
              <span className="text-sm font-medium text-muted-foreground">
                Limpeza Profissional
              </span>
            </div>

            <h1 className="text-4xl md:text-6xl font-heading text-foreground mb-6 leading-tight">
              Material de{' '}
              <span className="text-gradient">Limpeza</span>{' '}
              Premium
            </h1>

            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              Na Ubadesklimp, oferecemos os melhores produtos de limpeza para sua casa e empresa. 
              Qualidade garantida, entrega rápida e preços competitivos.
            </p>

            {/* Features */}
            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Qualidade Garantida</span>
              </div>
              <div className="flex items-center space-x-2">
                <Truck className="h-5 w-5 text-secondary" />
                <span className="text-sm font-medium">Entrega Rápida</span>
              </div>
              <div className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Produtos Premium</span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button onClick={handleWhatsAppContact} className="btn-hero">
                <MessageCircle className="h-5 w-5 mr-2" />
                Fale Conosco (WhatsApp)
              </Button>
              <Button onClick={handlePhoneContact} variant="outline" className="btn-outline">
                <Phone className="h-5 w-5 mr-2" />
                Ligar (12) 3832-4474
              </Button>
            </div>
          </div>

          {/* Image */}
          <div className="animate-slide-up lg:order-last">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-hero rounded-3xl blur-3xl opacity-20 scale-95"></div>
              <img
                src={heroImage}
                alt="Produtos de limpeza premium da Ubadesklimp"
                className="relative rounded-3xl shadow-large hover-lift w-full h-auto"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
