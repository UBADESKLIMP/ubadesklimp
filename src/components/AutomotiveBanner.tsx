import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const AutomotiveBanner = () => {
  return (
    <section className="py-8 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <Link to="/automotivo" className="block group">
          {/* Rotating Gradient Border Container */}
          <div className="relative p-[2px] rounded-xl overflow-hidden">
            {/* Rotating Conic Gradient */}
            <div 
              className="absolute inset-[-100%] animate-border-rotate group-hover:[animation-duration:2s]"
              style={{
                background: 'conic-gradient(from 0deg, #2563eb, #60a5fa, #8b5cf6, #2563eb)'
              }}
            />
            
            {/* Inner Black Container */}
            <div className="relative bg-black rounded-[10px] px-8 py-6 md:py-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                {/* Text Content */}
                <div className="text-center md:text-left">
                  <h2 className="text-lg md:text-xl font-medium text-white tracking-wide">
                    Linha Automotiva
                  </h2>
                  <p className="text-zinc-500 text-sm mt-1">
                    Cuidado profissional para veículos
                  </p>
                </div>

                {/* CTA */}
                <div className="flex items-center gap-2 text-zinc-400 group-hover:text-white transition-colors duration-300">
                  <span className="text-sm font-medium">Ver Catálogo</span>
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                </div>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </section>
  );
};

export default AutomotiveBanner;
