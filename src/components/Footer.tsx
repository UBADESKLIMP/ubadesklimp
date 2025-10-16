import { Mail, MapPin, Clock, Facebook, Instagram, Twitter } from 'lucide-react';
import WhatsAppIcon from './WhatsAppIcon';
const Footer = () => {
  return <footer id="contact" className="bg-foreground text-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="grid md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Company Info */}
        <div className="lg:col-span-3">
            <h3 className="text-3xl font-heading text-gradient mb-4">
              Ubadesklimp
            </h3>
            <p className="text-background/80 mb-6 max-w-md">Sua loja de confiança para produtos de limpeza profissionais. Qualidade, eficiência e atendimento excepcional há mais de 25 anos.</p>
            
            {/* Social Media */}
            <div className="flex space-x-4">
              <a href="#" className="text-background/60 hover:text-primary transition-colors">
                <Facebook className="h-6 w-6" />
              </a>
              <a href="#" className="text-background/60 hover:text-primary transition-colors">
                <Instagram className="h-6 w-6" />
              </a>
              <a href="#" className="text-background/60 hover:text-primary transition-colors">
                <Twitter className="h-6 w-6" />
              </a>
            </div>
          </div>

        {/* Contact Info */}
        <div className="lg:col-span-2">
            <h4 className="text-lg font-semibold mb-6">Contato</h4>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <WhatsAppIcon className="h-5 w-5 text-primary" />
                <div>
                  <a 
                    href="https://wa.me/551238332434"
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-background/80 hover:text-primary transition-colors"
                  >
                    (12) 3833-2434
                  </a>
                  <p className="text-background/60 text-sm">WhatsApp</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <Mail className="h-5 w-5 text-primary mt-1" />
                <div>
                  <p className="text-background/80">Ubadesk.pedidos@gmail.com</p>
                  <p className="text-background/60 text-sm">Email</p>
                </div>
              </div>
            </div>
          </div>

        {/* Address Info */}
        <div className="lg:col-span-4">
            <h4 className="text-lg font-semibold mb-6">Endereço</h4>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <MapPin className="h-5 w-5 text-primary mt-1" />
                <div>
                  <p className="text-background/80">Av Rio Grande do Sul, 259</p>
                  <p className="text-background/80">Ubatuba, São Paulo</p>
                  <p className="text-background/60 text-sm">Centro</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <MapPin className="h-5 w-5 text-primary mt-1" />
                <div>
                  <p className="text-background/80">Av Padre Manoel da Nobrega, 2101</p>
                  <p className="text-background/80">Ubatuba, São Paulo</p>
                  <p className="text-background/60 text-sm">Pereque-Açu</p>
                </div>
              </div>
            </div>
          </div>

        {/* Business Hours */}
        <div className="lg:col-span-3">
            <h4 className="text-lg font-semibold mb-6">Horário de Funcionamento</h4>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Clock className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-background/80 text-sm">Segunda - Sexta</p>
                  <p className="text-background/60 text-sm">8h às 18h</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Clock className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-background/80 text-sm">Sábado</p>
                  <p className="text-background/60 text-sm">8h às 13h</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Clock className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-background/80 text-sm">Domingo</p>
                  <p className="text-background/60 text-sm">Fechado</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-background/20 pt-8 mt-12">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-background/60 text-sm">
              © 2024 Ubadesklimp. Todos os direitos reservados.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="#" className="text-background/60 hover:text-primary text-sm transition-colors">
                Política de Privacidade
              </a>
              <a href="#" className="text-background/60 hover:text-primary text-sm transition-colors">
                Termos de Uso
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>;
};
export default Footer;