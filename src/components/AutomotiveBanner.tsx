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
                  {/* Premium Supercar Neon Icon */}
                  <div className="relative">
                    {/* Outer glow - diffuse */}
                    <div className="absolute inset-[-4px] blur-xl opacity-40">
                      <svg className="h-20 md:h-24 w-auto" viewBox="0 0 140 50" fill="none">
                        <path d="M15 38 C15 38 18 38 22 38 L26 28 C28 24 32 20 38 18 L50 16 L90 16 L102 18 C108 20 112 24 114 28 L118 38 L125 38" stroke="#1e90ff" strokeWidth="3"/>
                      </svg>
                    </div>
                    
                    {/* Medium glow */}
                    <div className="absolute inset-[-2px] blur-md opacity-60">
                      <svg className="h-20 md:h-24 w-auto" viewBox="0 0 140 50" fill="none">
                        <path d="M15 38 C15 38 18 38 22 38 L26 28 C28 24 32 20 38 18 L50 16 L90 16 L102 18 C108 20 112 24 114 28 L118 38 L125 38" stroke="#1e90ff" strokeWidth="2"/>
                      </svg>
                    </div>
                    
                    {/* Main detailed car icon */}
                    <svg 
                      className="h-20 md:h-24 w-auto relative" 
                      viewBox="0 0 140 50" 
                      fill="none"
                      style={{ filter: 'drop-shadow(0 0 8px #1e90ff) drop-shadow(0 0 16px rgba(30,144,255,0.5))' }}
                    >
                      {/* Car body - sleek supercar silhouette */}
                      <path 
                        d="M15 38 C15 38 18 38 22 38 L26 28 C28 24 32 20 38 18 L50 16 L90 16 L102 18 C108 20 112 24 114 28 L118 38 L125 38" 
                        stroke="#1e90ff" 
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="rgba(30,144,255,0.05)"
                      />
                      
                      {/* Roof line - curved sporty roof */}
                      <path 
                        d="M42 18 C42 18 48 10 55 8 L85 8 C92 10 98 18 98 18" 
                        stroke="#1e90ff" 
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        fill="none"
                      />
                      
                      {/* Windshield */}
                      <path 
                        d="M48 16 L52 10 L78 10 L82 16" 
                        stroke="#1e90ff" 
                        strokeWidth="1"
                        strokeLinecap="round"
                        opacity="0.8"
                      />
                      
                      {/* Side windows */}
                      <path 
                        d="M44 17 L48 11 L54 11 L50 17 Z" 
                        stroke="#1e90ff" 
                        strokeWidth="0.8"
                        fill="rgba(30,144,255,0.1)"
                      />
                      <path 
                        d="M86 11 L92 11 L96 17 L90 17 Z" 
                        stroke="#1e90ff" 
                        strokeWidth="0.8"
                        fill="rgba(30,144,255,0.1)"
                      />
                      
                      {/* Hood lines - aggressive styling */}
                      <path d="M38 18 L48 20 M50 16 L55 22" stroke="#1e90ff" strokeWidth="0.6" opacity="0.6"/>
                      <path d="M102 18 L92 20 M90 16 L85 22" stroke="#1e90ff" strokeWidth="0.6" opacity="0.6"/>
                      
                      {/* Front air intake */}
                      <path d="M24 32 L32 28 L38 28 L36 32" stroke="#1e90ff" strokeWidth="0.8" opacity="0.7"/>
                      
                      {/* Rear diffuser */}
                      <path d="M104 28 L108 28 L116 32 L106 32" stroke="#1e90ff" strokeWidth="0.8" opacity="0.7"/>
                      
                      {/* LED Headlights - front */}
                      <path d="M26 30 L34 28" stroke="#1e90ff" strokeWidth="2" strokeLinecap="round">
                        <animate attributeName="opacity" values="0.7;1;0.7" dur="2s" repeatCount="indefinite"/>
                      </path>
                      <circle cx="30" cy="29" r="1.5" fill="#1e90ff" opacity="0.9"/>
                      
                      {/* LED Taillights - rear */}
                      <path d="M106 28 L114 30" stroke="#ff4444" strokeWidth="2" strokeLinecap="round" opacity="0.8"/>
                      <circle cx="110" cy="29" r="1.5" fill="#ff4444" opacity="0.7"/>
                      
                      {/* Side mirror */}
                      <ellipse cx="42" cy="18" rx="2" ry="1" stroke="#1e90ff" strokeWidth="0.6" fill="none"/>
                      <ellipse cx="98" cy="18" rx="2" ry="1" stroke="#1e90ff" strokeWidth="0.6" fill="none"/>
                      
                      {/* Door line */}
                      <path d="M60 17 L60 32 M80 17 L80 32" stroke="#1e90ff" strokeWidth="0.5" opacity="0.4"/>
                      
                      {/* Side skirt detail */}
                      <path d="M35 35 L105 35" stroke="#1e90ff" strokeWidth="0.6" opacity="0.5"/>
                      
                      {/* Front wheel with detailed rim */}
                      <circle cx="38" cy="38" r="8" stroke="#1e90ff" strokeWidth="1.2" fill="none"/>
                      <circle cx="38" cy="38" r="5" stroke="#1e90ff" strokeWidth="0.8" fill="rgba(30,144,255,0.1)"/>
                      <circle cx="38" cy="38" r="2" fill="#1e90ff" opacity="0.6"/>
                      {/* Rim spokes */}
                      <path d="M38 32 L38 35 M38 41 L38 44 M32 38 L35 38 M41 38 L44 38 M34 34 L36 36 M40 40 L42 42 M34 42 L36 40 M40 36 L42 34" stroke="#1e90ff" strokeWidth="0.5" opacity="0.6"/>
                      
                      {/* Rear wheel with detailed rim */}
                      <circle cx="102" cy="38" r="8" stroke="#1e90ff" strokeWidth="1.2" fill="none"/>
                      <circle cx="102" cy="38" r="5" stroke="#1e90ff" strokeWidth="0.8" fill="rgba(30,144,255,0.1)"/>
                      <circle cx="102" cy="38" r="2" fill="#1e90ff" opacity="0.6"/>
                      {/* Rim spokes */}
                      <path d="M102 32 L102 35 M102 41 L102 44 M96 38 L99 38 M105 38 L108 38 M98 34 L100 36 M104 40 L106 42 M98 42 L100 40 M104 36 L106 34" stroke="#1e90ff" strokeWidth="0.5" opacity="0.6"/>
                      
                      {/* Ground reflection line */}
                      <path d="M30 46 L110 46" stroke="#1e90ff" strokeWidth="0.5" opacity="0.3"/>
                      
                      {/* Spoiler hint */}
                      <path d="M88 10 L92 6 L100 6 L104 10" stroke="#1e90ff" strokeWidth="0.8" opacity="0.6"/>
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
