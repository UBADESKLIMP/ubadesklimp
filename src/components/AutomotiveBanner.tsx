import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

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
                  {/* Professional Neon Car Icon */}
                  <div className="relative">
                    {/* Glow effect */}
                    <div className="absolute inset-0 blur-md opacity-50">
                      <svg className="h-14 md:h-16 w-auto" viewBox="0 0 80 36" fill="none">
                        <path 
                          d="M12 24 L18 24 L22 14 L28 10 L52 10 L58 14 L68 14 L72 18 L72 24 L66 24 M54 24 L26 24 M14 24 L12 24" 
                          stroke="#1e90ff" 
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle cx="20" cy="26" r="5" stroke="#1e90ff" strokeWidth="2"/>
                        <circle cx="60" cy="26" r="5" stroke="#1e90ff" strokeWidth="2"/>
                        <path d="M26 10 L30 6 L50 6 L54 10" stroke="#1e90ff" strokeWidth="1.5" strokeLinecap="round"/>
                        <path d="M32 10 L32 14 M40 10 L40 14 M48 10 L48 14" stroke="#1e90ff" strokeWidth="1" opacity="0.6"/>
                      </svg>
                    </div>
                    {/* Main icon */}
                    <svg 
                      className="h-14 md:h-16 w-auto relative" 
                      viewBox="0 0 80 36" 
                      fill="none"
                      style={{ filter: 'drop-shadow(0 0 6px #1e90ff)' }}
                    >
                      <path 
                        d="M12 24 L18 24 L22 14 L28 10 L52 10 L58 14 L68 14 L72 18 L72 24 L66 24 M54 24 L26 24 M14 24 L12 24" 
                        stroke="#1e90ff" 
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="20" cy="26" r="5" stroke="#1e90ff" strokeWidth="2"/>
                      <circle cx="60" cy="26" r="5" stroke="#1e90ff" strokeWidth="2"/>
                      <path d="M26 10 L30 6 L50 6 L54 10" stroke="#1e90ff" strokeWidth="1.5" strokeLinecap="round"/>
                      <path d="M32 10 L32 14 M40 10 L40 14 M48 10 L48 14" stroke="#1e90ff" strokeWidth="1" opacity="0.6"/>
                    </svg>
                  </div>
                  
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
