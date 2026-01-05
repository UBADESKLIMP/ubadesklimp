import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import carNeonLogo from '@/assets/teste_carro_gpt_2.0.png';

const AutomotiveBanner = () => {
  const [isExiting, setIsExiting] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isExiting || isShaking) return;
    
    // Primeiro tremor de potência
    setIsShaking(true);
    
    // Depois arranca
    setTimeout(() => {
      setIsShaking(false);
      setIsExiting(true);
      
      // Navegação após saída
      setTimeout(() => {
        navigate('/automotivo');
      }, 500);
    }, 300);
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
            <div className={`relative bg-[#0b0d10] rounded-[20px] px-8 md:px-12 py-4 md:py-6 overflow-hidden ${
              isShaking ? 'animate-power-shake' : ''
            }`}>
              <div className="flex items-center justify-between">
                
                {/* Logo Section */}
                <div className="flex items-center gap-3 md:gap-4">
                  {/* Car Container with Reflection */}
                  <div className="relative">
                    {/* Tire Marks - marcas de derrapagem azul neon */}
                    {isExiting && (
                      <div className="absolute bottom-[32%] left-[12%] pointer-events-none">
                        <div 
                          className="absolute h-[3px] rounded-full animate-tire-mark"
                          style={{
                            background: 'linear-gradient(90deg, rgba(30, 144, 255, 0.8), rgba(30, 144, 255, 0.4), transparent)',
                            boxShadow: '0 0 10px rgba(30, 144, 255, 0.6), 0 0 20px rgba(30, 144, 255, 0.3)',
                            top: '-6px'
                          }}
                        />
                        <div 
                          className="absolute h-[3px] rounded-full animate-tire-mark"
                          style={{
                            background: 'linear-gradient(90deg, rgba(30, 144, 255, 0.7), rgba(30, 144, 255, 0.3), transparent)',
                            boxShadow: '0 0 8px rgba(30, 144, 255, 0.5), 0 0 16px rgba(30, 144, 255, 0.2)',
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
                    
                    {/* Headlight Trails - rastro de faróis */}
                    {isExiting && (
                      <div className="absolute top-[35%] right-[0%] pointer-events-none">
                        <div 
                          className="absolute h-[2px] rounded-full animate-headlight-trail"
                          style={{
                            background: 'linear-gradient(90deg, rgba(30, 144, 255, 0.9), transparent)',
                            boxShadow: '0 0 12px rgba(30, 144, 255, 0.8), 0 0 24px rgba(30, 144, 255, 0.4)',
                            top: '-4px'
                          }}
                        />
                        <div 
                          className="absolute h-[2px] rounded-full animate-headlight-trail"
                          style={{
                            background: 'linear-gradient(90deg, rgba(30, 144, 255, 0.8), transparent)',
                            boxShadow: '0 0 10px rgba(30, 144, 255, 0.6), 0 0 20px rgba(30, 144, 255, 0.3)',
                            top: '12px',
                            animationDelay: '0.03s'
                          }}
                        />
                      </div>
                    )}
                    
                    {/* Subtle headlight glow - stays within image bounds */}
                    {isHovered && !isShaking && !isExiting && (
                      <div 
                        className="absolute top-[38%] right-[28%] w-6 h-3 pointer-events-none z-10 animate-headlight-on"
                        style={{
                          background: 'radial-gradient(ellipse, rgba(30, 144, 255, 0.7), transparent 80%)',
                          filter: 'blur(4px)',
                          mixBlendMode: 'screen'
                        }}
                      />
                    )}
                    
                    {/* Light beam from headlights to text - more tapered */}
                    {isHovered && !isShaking && !isExiting && (
                      <div className="absolute top-[14%] right-[15%] pointer-events-none z-5 translate-x-full">
                        <div 
                          className="w-64 h-20 animate-headlight-beam origin-left"
                          style={{
                            background: 'linear-gradient(90deg, rgba(30, 144, 255, 0.45), rgba(30, 144, 255, 0.16) 55%, transparent)',
                            clipPath: 'polygon(0% 48%, 0% 52%, 100% 100%, 100% 0%)',
                            filter: 'blur(10px)'
                          }}
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
                        filter: isShaking 
                          ? 'drop-shadow(0 0 25px rgba(30, 144, 255, 1)) drop-shadow(0 0 50px rgba(30, 144, 255, 0.7))'
                          : 'drop-shadow(0 0 15px rgba(30, 144, 255, 0.8))',
                        animationDelay: isExiting ? '0s' : '0.3s',
                        transition: 'filter 0.1s ease-out'
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
                    {/* Bicolor logo with illumination effect */}
                    <h2 
                      className={`text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight transition-all duration-300 ${
                        isHovered && !isShaking && !isExiting ? 'animate-text-illuminate' : ''
                      }`}
                      style={{
                        filter: isHovered && !isShaking && !isExiting 
                          ? 'drop-shadow(0 0 20px rgba(30, 144, 255, 0.8)) drop-shadow(0 0 40px rgba(30, 144, 255, 0.4))'
                          : 'none'
                      }}
                    >
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
