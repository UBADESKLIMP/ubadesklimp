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
                  {/* Premium Sedan Neon Icon - Minimalist Executive Style */}
                  <div className="relative">
                    {/* Subtle glow layer */}
                    <div className="absolute inset-[-2px] blur-lg opacity-50">
                      <svg className="h-14 md:h-18 w-auto" viewBox="0 0 160 50" fill="none">
                        <path d="M20 36 L28 36 L34 24 C38 18 48 14 60 14 L100 14 C112 14 122 18 126 24 L132 36 L140 36" stroke="#1e90ff" strokeWidth="3"/>
                      </svg>
                    </div>
                    
                    {/* Main sedan icon */}
                    <svg 
                      className="h-14 md:h-18 w-auto relative" 
                      viewBox="0 0 160 50" 
                      fill="none"
                      style={{ filter: 'drop-shadow(0 0 6px #1e90ff)' }}
                    >
                      {/* Body silhouette - elegant sedan profile */}
                      <path 
                        d="M20 36 L28 36 L34 24 C38 18 48 14 60 14 L100 14 C112 14 122 18 126 24 L132 36 L140 36" 
                        stroke="#1e90ff" 
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                      
                      {/* Roof line - smooth executive curve */}
                      <path 
                        d="M56 14 C56 14 62 6 72 6 L88 6 C98 6 104 14 104 14" 
                        stroke="#1e90ff" 
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        fill="none"
                      />
                      
                      {/* Windows - clean glass area */}
                      <path 
                        d="M60 14 L66 8 L94 8 L100 14" 
                        stroke="#1e90ff" 
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        opacity="0.7"
                        fill="none"
                      />
                      
                      {/* Pillar line */}
                      <path d="M80 8 L80 14" stroke="#1e90ff" strokeWidth="0.8" opacity="0.5"/>
                      
                      {/* Front LED headlight - thin modern line */}
                      <path d="M28 30 L38 26" stroke="#1e90ff" strokeWidth="2" strokeLinecap="round" opacity="0.9"/>
                      
                      {/* Rear LED taillight */}
                      <path d="M122 26 L132 30" stroke="#1e90ff" strokeWidth="2" strokeLinecap="round" opacity="0.9"/>
                      
                      {/* Character line - subtle body crease */}
                      <path d="M36 28 L124 28" stroke="#1e90ff" strokeWidth="0.6" opacity="0.35"/>
                      
                      {/* Front wheel - elegant alloy */}
                      <circle cx="48" cy="36" r="9" stroke="#1e90ff" strokeWidth="1.5" fill="none"/>
                      <circle cx="48" cy="36" r="5.5" stroke="#1e90ff" strokeWidth="0.8" fill="none" opacity="0.6"/>
                      <circle cx="48" cy="36" r="2" fill="#1e90ff" opacity="0.4"/>
                      
                      {/* Rear wheel - elegant alloy */}
                      <circle cx="112" cy="36" r="9" stroke="#1e90ff" strokeWidth="1.5" fill="none"/>
                      <circle cx="112" cy="36" r="5.5" stroke="#1e90ff" strokeWidth="0.8" fill="none" opacity="0.6"/>
                      <circle cx="112" cy="36" r="2" fill="#1e90ff" opacity="0.4"/>
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
