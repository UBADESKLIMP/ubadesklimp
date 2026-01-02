import { Car, Wrench, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const AutomotiveBanner = () => {
  return (
    <section className="py-8 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <Link to="/automotivo" className="block group">
          <div className="relative overflow-hidden rounded-xl bg-black p-6 md:p-8 border border-zinc-800/80 hover:border-zinc-700 transition-all duration-500">
            
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              {/* Left - Icon Boxes */}
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-zinc-900/80 border border-zinc-800 group-hover:border-blue-500/30 transition-all duration-300">
                  <Car className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-zinc-900/80 border border-zinc-800 group-hover:border-blue-500/30 transition-all duration-300">
                  <Wrench className="h-5 w-5 text-blue-500" />
                </div>
              </div>

              {/* Center - Text Content */}
              <div className="flex-1 text-center md:text-left">
                <span className="inline-block text-blue-500 text-[10px] font-semibold tracking-[0.2em] uppercase mb-1">
                  Exclusivo
                </span>
                <h2 className="text-lg md:text-xl font-medium text-white tracking-wide">
                  Linha Automotiva Profissional
                </h2>
                <p className="text-zinc-500 text-sm mt-0.5">
                  Produtos especializados para cuidado automotivo
                </p>
              </div>

              {/* Right - CTA Button */}
              <div className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-blue-500/40 text-blue-400 group-hover:bg-blue-500/10 group-hover:border-blue-500/60 transition-all duration-300">
                <span className="text-sm font-medium">Ver Catálogo</span>
                <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
              </div>
            </div>

            {/* Bottom Glow Effect */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute bottom-0 left-1/4 right-1/4 h-[1px] blur-sm bg-blue-500/80 group-hover:shadow-[0_0_20px_rgba(59,130,246,0.6)] transition-all duration-500" />
          </div>
        </Link>
      </div>
    </section>
  );
};

export default AutomotiveBanner;
