import { Car, Wrench, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const AutomotiveBanner = () => {
  return (
    <section className="py-8 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <Link to="/automotivo" className="block group">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 p-8 md:p-12 border border-blue-500/20 shadow-2xl shadow-blue-900/20 hover:shadow-blue-500/30 transition-all duration-500">
            {/* Background decorations */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(59,130,246,0.15),transparent_50%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(59,130,246,0.1),transparent_40%)]" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-600/5 rounded-full blur-2xl" />
            
            {/* Grid pattern overlay */}
            <div className="absolute inset-0 opacity-5" style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '40px 40px'
            }} />

            <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
              {/* Left side - Icons */}
              <div className="hidden md:flex items-center gap-4">
                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors duration-300">
                  <Car className="h-10 w-10 text-blue-400" />
                </div>
                <div className="p-3 rounded-lg bg-slate-700/50 border border-slate-600/30">
                  <Wrench className="h-6 w-6 text-slate-400" />
                </div>
              </div>

              {/* Center - Text content */}
              <div className="text-center md:text-left flex-1">
                <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                  <Car className="h-6 w-6 text-blue-400 md:hidden" />
                  <span className="text-blue-400 text-sm font-semibold uppercase tracking-wider">
                    Exclusivo
                  </span>
                </div>
                <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-2 group-hover:text-blue-100 transition-colors">
                  Linha Automotiva Profissional
                </h2>
                <p className="text-slate-300 text-sm md:text-base max-w-md">
                  Produtos especializados para o cuidado completo do seu veículo
                </p>
              </div>

              {/* Right side - CTA */}
              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  className="bg-blue-500/10 border-blue-400/30 text-blue-100 hover:bg-blue-500/20 hover:border-blue-400/50 hover:text-white px-6 py-5 text-base font-semibold group-hover:scale-105 transition-all duration-300"
                >
                  Ver Catálogo
                  <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </div>

            {/* Bottom accent line */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
          </div>
        </Link>
      </div>
    </section>
  );
};

export default AutomotiveBanner;
