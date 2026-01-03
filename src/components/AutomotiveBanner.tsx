import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import carNeonLogo from '@/assets/carro_unico_gpt_2.png';

const AutomotiveBanner = () => {
  return (
    <section className="py-6 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <Link to="/automotivo" className="block group">
          {/* Animated Gradient Border Container */}
          <div className="relative rounded-[20px]">
            {/* GLOW Effect (diffuse light behind) */}
            <div 
              className="absolute inset-[-8px] rounded-[28px] blur-xl opacity-50 animate-border-move"
              style={{
                background: 'linear-gradient(120deg, #1e90ff, #5a2dff, #1e90ff)',
                backgroundSize: '300% 300%'
              }}
            />
            
            {/* Animated Border (sharp line) */}
            <div 
              className="absolute inset-[-1px] rounded-[22px] animate-border-move"
              style={{
                background: 'linear-gradient(120deg, #1e90ff, #5a2dff, #1e90ff)',
                backgroundSize: '300% 300%'
              }}
            />
            
            {/* Inner Dark Container */}
            <div className="relative bg-[#0b0d10] rounded-[20px] px-10 md:px-16 py-8 md:py-10">
              <div className="flex items-center justify-between">
                
                {/* Logo Section */}
                <div className="flex items-center gap-6 md:gap-8">
                  {/* Car Neon Image */}
                  <img 
                    src={carNeonLogo} 
                    alt="UbadeskCar Logo" 
                    className="h-36 md:h-40 lg:h-48 w-auto object-contain mix-blend-screen -my-4"
                    style={{ filter: 'drop-shadow(0 0 15px rgba(30, 144, 255, 0.8))' }}
                  />
                  
                  {/* Title + Tagline Container */}
                  <div className="flex flex-col">
                    {/* Bicolor logo */}
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight">
                      <span className="text-white">Ubadesk</span>
                      <span className="text-[#1e90ff]">Car</span>
                    </h2>
                    
                    {/* Tagline */}
                    <p className="text-zinc-400 text-sm md:text-base mt-1 tracking-wide">
                      Nossa Linha profissional automotiva
                    </p>
                  </div>
                </div>
                
                {/* Minimalist arrow button */}
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-full border border-zinc-700 flex items-center justify-center group-hover:border-[#1e90ff] group-hover:bg-[#1e90ff]/10 transition-all duration-300">
                  <ArrowRight className="h-5 w-5 md:h-6 md:w-6 text-zinc-400 group-hover:text-[#1e90ff] group-hover:translate-x-0.5 transition-all duration-300" />
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
