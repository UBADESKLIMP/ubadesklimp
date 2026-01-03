import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import carNeonLogo from '@/assets/teste_carro_gpt_2.0.png';

const AutomotiveBanner = () => {
  const [isExiting, setIsExiting] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isExiting) return;
    
    setIsExiting(true);
    
    // Aguarda animação de saída antes de navegar
    setTimeout(() => {
      navigate('/automotivo');
    }, 500);
  };

  return (
    <section className="py-6 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div 
          onClick={handleClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="block group cursor-pointer"
        >
          {/* Animated Gradient Border Container */}
          <div className="relative rounded-[20px] animate-fade-in-up">
            {/* GLOW Effect (diffuse light behind) */}
            <div 
              className={`absolute inset-[-8px] rounded-[28px] blur-xl transition-all duration-300 ${
                isHovered ? 'animate-glow-pulse' : 'opacity-50'
              } ${isExiting ? 'animate-fade-out-fast' : ''}`}
              style={{
                background: 'linear-gradient(120deg, #1e90ff, #5a2dff, #1e90ff)',
                backgroundSize: '300% 300%'
              }}
            />
            
            {/* Animated Border (sharp line) */}
            <div 
              className={`absolute inset-[-1px] rounded-[22px] ${
                isHovered ? 'animate-border-chase' : 'animate-border-move'
              } ${isExiting ? 'animate-fade-out-fast' : ''}`}
              style={{
                background: 'linear-gradient(120deg, #1e90ff, #5a2dff, #1e90ff)',
                backgroundSize: '300% 300%'
              }}
            />
            
            {/* Inner Dark Container */}
            <div className="relative bg-[#0b0d10] rounded-[20px] px-8 md:px-12 py-4 md:py-6 overflow-hidden">
              <div className="flex items-center justify-between">
                
                {/* Logo Section */}
                <div className="flex items-center gap-3 md:gap-4">
                  {/* Car Container with Reflection */}
                  <div className="relative">
                    {/* Tire Marks - marcas de derrapagem no chão */}
                    {isExiting && (
                      <div className="absolute bottom-[15%] left-[5%] pointer-events-none">
                        <div 
                          className="absolute h-[3px] rounded-full animate-tire-mark"
                          style={{
                            background: 'linear-gradient(90deg, rgba(40,40,40,0.7), rgba(60,60,60,0.3), transparent)',
                            top: '-6px'
                          }}
                        />
                        <div 
                          className="absolute h-[3px] rounded-full animate-tire-mark"
                          style={{
                            background: 'linear-gradient(90deg, rgba(40,40,40,0.6), rgba(60,60,60,0.2), transparent)',
                            top: '6px',
                            animationDelay: '0.02s'
                          }}
                        />
                      </div>
                    )}
                    
                    {/* Tire Smoke - fumaça de borracha queimada */}
                    {isExiting && (
                      <div className="absolute bottom-[20%] left-[10%] pointer-events-none">
                        <div 
                          className="absolute w-10 h-10 rounded-full bg-zinc-400/40 animate-tire-smoke"
                          style={{ filter: 'blur(6px)' }}
                        />
                        <div 
                          className="absolute w-8 h-8 rounded-full bg-zinc-500/35 animate-tire-smoke"
                          style={{ filter: 'blur(5px)', animationDelay: '0.06s', left: '12px' }}
                        />
                        <div 
                          className="absolute w-12 h-12 rounded-full bg-zinc-300/25 animate-tire-smoke"
                          style={{ filter: 'blur(8px)', animationDelay: '0.12s', left: '-6px', top: '-4px' }}
                        />
                        <div 
                          className="absolute w-6 h-6 rounded-full bg-zinc-600/30 animate-tire-smoke"
                          style={{ filter: 'blur(4px)', animationDelay: '0.18s', left: '20px', top: '8px' }}
                        />
                      </div>
                    )}
                    
                    {/* Friction Sparks - faíscas de atrito (laranja/amarelo) */}
                    {isExiting && (
                      <div className="absolute bottom-[22%] left-[12%] pointer-events-none">
                        <div 
                          className="absolute w-1.5 h-1.5 rounded-full bg-orange-400 animate-friction-spark"
                          style={{ boxShadow: '0 0 6px 2px rgba(251, 146, 60, 0.9)' }}
                        />
                        <div 
                          className="absolute w-1 h-1 rounded-full bg-yellow-300 animate-friction-spark"
                          style={{ boxShadow: '0 0 4px 1px rgba(253, 224, 71, 0.8)', animationDelay: '0.04s', top: '4px', left: '8px' }}
                        />
                        <div 
                          className="absolute w-1 h-1 rounded-full bg-orange-500 animate-friction-spark"
                          style={{ boxShadow: '0 0 5px 2px rgba(249, 115, 22, 0.8)', animationDelay: '0.08s', top: '-3px', left: '4px' }}
                        />
                        <div 
                          className="absolute w-0.5 h-0.5 rounded-full bg-yellow-400 animate-friction-spark"
                          style={{ boxShadow: '0 0 3px 1px rgba(250, 204, 21, 0.7)', animationDelay: '0.12s', top: '6px', left: '2px' }}
                        />
                      </div>
                    )}
                    
                    {/* Car Neon Image */}
                    <img 
                      src={carNeonLogo} 
                      alt="UbadeskCar Logo" 
                      className={`h-40 md:h-44 lg:h-48 w-auto object-contain mix-blend-screen -my-10 ${
                        isExiting ? 'animate-car-exit' : 'animate-car-enter'
                      }`}
                      style={{ 
                        filter: 'drop-shadow(0 0 15px rgba(30, 144, 255, 0.8))',
                        animationDelay: isExiting ? '0s' : '0.3s'
                      }}
                    />
                    
                    {/* Car Reflection */}
                    <img 
                      src={carNeonLogo} 
                      alt="" 
                      aria-hidden="true"
                      className={`absolute top-[85%] left-0 h-40 md:h-44 lg:h-48 w-auto object-contain mix-blend-screen pointer-events-none ${
                        isExiting ? 'animate-car-exit' : 'animate-car-enter'
                      }`}
                      style={{ 
                        transform: 'scaleY(-1)',
                        filter: 'drop-shadow(0 0 10px rgba(30, 144, 255, 0.3)) blur(1px)',
                        opacity: 0.2,
                        maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 50%)',
                        WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 50%)',
                        animationDelay: isExiting ? '0s' : '0.3s'
                      }}
                    />
                  </div>
                  
                  {/* Title + Tagline Container */}
                  <div 
                    className={`flex flex-col ${
                      isExiting ? 'animate-fade-out-fast' : 'animate-fade-in-up'
                    }`}
                    style={{ animationDelay: isExiting ? '0s' : '0.2s' }}
                  >
                    {/* Bicolor logo */}
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight">
                      <span className="text-white">Ubadesk</span>
                      <span className="text-[#1e90ff]">Car</span>
                    </h2>
                    
                    {/* Tagline */}
                    <p className="text-zinc-400 text-sm md:text-base mt-1 tracking-wide">
                      Nossa Linha Profissional Automotiva
                    </p>
                  </div>
                </div>
                
                {/* Minimalist arrow button */}
                <div 
                  className={`w-12 h-12 md:w-14 md:h-14 rounded-full border border-zinc-700 flex items-center justify-center group-hover:border-[#1e90ff] group-hover:bg-[#1e90ff]/10 transition-all duration-300 ${
                    isExiting ? 'animate-fade-out-fast' : 'animate-fade-in-up'
                  }`}
                  style={{ animationDelay: isExiting ? '0s' : '0.4s' }}
                >
                  <ArrowRight className="h-5 w-5 md:h-6 md:w-6 text-zinc-400 group-hover:text-[#1e90ff] group-hover:translate-x-0.5 transition-all duration-300" />
                </div>
                
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AutomotiveBanner;
