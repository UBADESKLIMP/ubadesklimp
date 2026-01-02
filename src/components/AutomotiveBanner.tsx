import { Car, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const AutomotiveBanner = () => {
  return (
    <section className="py-6 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <Link to="/automotivo" className="block group">
          <div className="relative overflow-hidden rounded-lg bg-black p-6 md:p-8 border border-zinc-800 hover:border-blue-500/30 transition-all duration-300">
            
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Left - Icon and Text */}
              <div className="flex items-center gap-4">
                <Car className="h-6 w-6 text-blue-500" />
                <div>
                  <h2 className="text-lg md:text-xl font-medium text-white tracking-wide">
                    Linha Automotiva
                  </h2>
                  <p className="text-zinc-500 text-sm">
                    Cuidado profissional para seu veículo
                  </p>
                </div>
              </div>

              {/* Right - CTA */}
              <div className="flex items-center gap-2 text-zinc-400 group-hover:text-blue-500 transition-colors duration-300">
                <span className="text-sm font-medium">Ver Catálogo</span>
                <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
              </div>
            </div>

            {/* Bottom accent line */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
          </div>
        </Link>
      </div>
    </section>
  );
};

export default AutomotiveBanner;
