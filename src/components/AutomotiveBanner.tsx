import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import carNeonLogo from '@/assets/ubadesk-car-neon.png';

const AutomotiveBanner = () => {
  return (
    <section className="py-8 px-4 md:px-8">
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
            <div className="relative bg-[#0b0d10] rounded-[20px] px-8 md:px-12 py-12 md:py-16">
              <div className="flex items-center justify-between">
                
                {/* Logo Section */}
                <div className="flex items-center gap-5">
                  {/* Car Neon Image */}
                  <img 
                    src={carNeonLogo} 
                    alt="UbadeskCar Logo" 
                    className="h-16 md:h-20 w-auto object-contain mix-blend-screen"
                    style={{ filter: 'drop-shadow(0 0 8px #1e90ff)' }}
                  />
                  
                  {/* Bicolor logo */}
                  <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
                    <span className="text-white">Ubadesk</span>
                    <span className="text-[#1e90ff]">Car</span>
                  </h2>
                </div>
                
                {/* Minimalist arrow button */}
                <div className="w-10 h-10 rounded-full border border-zinc-700 flex items-center justify-center group-hover:border-[#1e90ff] group-hover:bg-[#1e90ff]/10 transition-all duration-300">
                  <ArrowRight className="h-4 w-4 text-zinc-400 group-hover:text-[#1e90ff] group-hover:translate-x-0.5 transition-all duration-300" />
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
