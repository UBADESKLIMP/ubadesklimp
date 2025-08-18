import { Users, Award, Truck, HeartHandshake } from 'lucide-react';
const About = () => {
  const stats = [{
    icon: Users,
    number: '10K+',
    label: 'Clientes Satisfeitos'
  }, {
    icon: Award,
    number: '25+',
    label: 'Anos de Experiência'
  }, {
    icon: Truck,
    number: '500+',
    label: 'Entregas por Mês'
  }, {
    icon: HeartHandshake,
    number: '98%',
    label: 'Taxa de Satisfação'
  }];
  return <section id="about" className="py-20 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Content */}
          <div className="animate-fade-in">
            <h2 className="text-3xl md:text-5xl font-heading text-foreground mb-6">
              Sobre a <span className="text-gradient">Ubadesklimp</span>
            </h2>
            
            <p className="text-lg text-muted-foreground mb-6 leading-relaxed">Há mais de 25 anos no mercado, a Ubadesklimp é referência em produtos de limpeza de alta qualidade. Nossa missão é proporcionar ambientes mais limpos e saudáveis para nossos clientes.</p>
            
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              Trabalhamos com as melhores marcas do mercado e oferecemos uma linha completa 
              de produtos para atender desde residências até grandes empresas.
            </p>

            {/* Values */}
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-3"></div>
                <div>
                  <h4 className="font-semibold text-foreground">Qualidade Garantida</h4>
                  <p className="text-muted-foreground">Produtos testados e aprovados pelos melhores laboratórios</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-secondary rounded-full mt-3"></div>
                <div>
                  <h4 className="font-semibold text-foreground">Atendimento Personalizado</h4>
                  <p className="text-muted-foreground">Equipe especializada para orientar na melhor escolha</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-3"></div>
                <div>
                  <h4 className="font-semibold text-foreground">Entrega Rápida</h4>
                  <p className="text-muted-foreground">Logística eficiente para sua comodidade</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-6 animate-slide-up">
            {stats.map((stat, index) => <div key={index} className="bg-gradient-card p-6 rounded-2xl border border-border text-center hover-lift" style={{
            animationDelay: `${index * 0.1}s`
          }}>
                <stat.icon className="h-8 w-8 text-primary mx-auto mb-4" />
                <div className="text-3xl font-bold text-foreground mb-2">
                  {stat.number}
                </div>
                <div className="text-muted-foreground text-sm">
                  {stat.label}
                </div>
              </div>)}
          </div>
        </div>
      </div>
    </section>;
};
export default About;