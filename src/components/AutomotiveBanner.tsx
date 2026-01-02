import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const AutomotiveBanner = () => {
  return (
    <section className="py-8 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <Link to="/automotivo" className="block group">
          {/* Animated Gradient Border Container */}
          <div className="relative rounded-2xl">
            {/* Animated Border - subtle gradient */}
            <div 
              className="absolute inset-[-1px] rounded-2xl animate-border-move"
              style={{
                background: 'linear-gradient(120deg, #3b82f6, #6366f1, #3b82f6)',
                backgroundSize: '300% 300%'
              }}
            />
            
            {/* Inner Dark Container */}
            <div className="relative bg-[#0f0f12] rounded-2xl px-8 md:px-12 py-12 md:py-16">
              <div className="flex items-center justify-between">
                
                {/* Logo Section */}
                <div className="flex items-center gap-5">
                  {/* Premium Sedan Icon - Minimalist Corporate Style */}
                  <div className="relative">
                    <svg 
                      className="h-12 md:h-14 w-auto" 
                      viewBox="0 0 160 50" 
                      fill="none"
                    >
                      {/* Body silhouette - elegant sedan profile */}
                      <path 
                        d="M20 36 L28 36 L34 24 C38 18 48 14 60 14 L100 14 C112 14 122 18 126 24 L132 36 L140 36" 
                        stroke="#3b82f6" 
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                      
                      {/* Roof line - smooth executive curve */}
                      <path 
                        d="M56 14 C56 14 62 6 72 6 L88 6 C98 6 104 14 104 14" 
                        stroke="#3b82f6" 
                        strokeWidth="2"
                        strokeLinecap="round"
                        fill="none"
                      />
                      
                      {/* Windows - clean glass area */}
                      <path 
                        d="M60 14 L66 8 L94 8 L100 14" 
                        stroke="#3b82f6" 
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        opacity="0.7"
                        fill="none"
                      />
                      
                      {/* Pillar line */}
                      <path d="M80 8 L80 14" stroke="#3b82f6" strokeWidth="1" opacity="0.5"/>
                      
                      {/* Front LED headlight */}
                      <path d="M28 30 L38 26" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"/>
                      
                      {/* Rear LED taillight */}
                      <path d="M122 26 L132 30" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"/>
                      
                      {/* Character line - subtle body crease */}
                      <path d="M36 28 L124 28" stroke="#3b82f6" strokeWidth="0.75" opacity="0.4"/>
                      
                      {/* Front wheel */}
                      <circle cx="48" cy="36" r="9" stroke="#3b82f6" strokeWidth="2" fill="none"/>
                      <circle cx="48" cy="36" r="5" stroke="#3b82f6" strokeWidth="1" fill="none" opacity="0.6"/>
                      
                      {/* Rear wheel */}
                      <circle cx="112" cy="36" r="9" stroke="#3b82f6" strokeWidth="2" fill="none"/>
                      <circle cx="112" cy="36" r="5" stroke="#3b82f6" strokeWidth="1" fill="none" opacity="0.6"/>
                    </svg>
                  </div>
                  
                  {/* Bicolor logo */}
                  <h2 className="text-2xl md:text-3xl font-medium tracking-tight">
                    <span className="text-white">Ubadesk</span>
                    <span className="text-[#3b82f6]">Car</span>
                  </h2>
                </div>
                
                {/* Minimalist arrow button */}
                <div className="w-10 h-10 rounded-full border border-zinc-800 flex items-center justify-center group-hover:border-[#3b82f6] transition-all duration-500">
                  <ArrowRight className="h-4 w-4 text-zinc-500 group-hover:text-[#3b82f6] group-hover:translate-x-0.5 transition-all duration-500" />
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
