import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, Rocket, Star, Zap, Shield, Cpu } from 'lucide-react';

interface WelcomeSplashProps {
  onComplete?: () => void;
  duration?: number;
}

const WelcomeSplash: React.FC<WelcomeSplashProps> = ({ 
  onComplete, 
  duration = 3000 
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  // Play welcome sound using Web Audio API
  const playWelcomeSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create a pleasant startup chime sequence
      const playTone = (frequency: number, startTime: number, duration: number, volume: number) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime + startTime);
        
        // Smooth envelope
        gainNode.gain.setValueAtTime(0, audioContext.currentTime + startTime);
        gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + startTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + startTime + duration);
        
        oscillator.start(audioContext.currentTime + startTime);
        oscillator.stop(audioContext.currentTime + startTime + duration);
      };

      // Tech startup chime - ascending notes
      playTone(523.25, 0, 0.3, 0.15);      // C5
      playTone(659.25, 0.1, 0.3, 0.12);    // E5
      playTone(783.99, 0.2, 0.4, 0.1);     // G5
      playTone(1046.50, 0.35, 0.5, 0.08);  // C6
      
    } catch (error) {
      console.log('Audio not supported or blocked');
    }
  }, []);

  useEffect(() => {
    // Play sound on mount
    playWelcomeSound();

    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, duration - 500);

    const hideTimer = setTimeout(() => {
      setIsVisible(false);
      onComplete?.();
    }, duration);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(hideTimer);
    };
  }, [duration, onComplete, playWelcomeSound]);

  if (!isVisible) return null;

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden transition-all duration-500 ${
        isExiting ? 'opacity-0 scale-110' : 'opacity-100 scale-100'
      }`}
    >
      {/* Dark tech gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 animate-gradient" />
      
      {/* Grid pattern overlay for tech feel */}
      <div className="absolute inset-0 opacity-10">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(rgba(99, 102, 241, 0.3) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(99, 102, 241, 0.3) 1px, transparent 1px)`,
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      {/* Animated circuit lines */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent animate-circuit"
            style={{
              top: `${20 + i * 15}%`,
              left: '-100%',
              right: '-100%',
              animationDelay: `${i * 0.3}s`,
              animationDuration: '3s',
            }}
          />
        ))}
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-indigo-400/40 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${3 + Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Glowing orbs */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-cyan-600/20 rounded-full blur-3xl animate-pulse delay-300" />
      <div className="absolute top-1/2 right-1/3 w-32 h-32 bg-violet-600/20 rounded-full blur-2xl animate-pulse delay-700" />

      {/* Main content */}
      <div className={`relative z-10 text-center px-8 transition-all duration-700 ${
        isExiting ? 'translate-y-10 opacity-0' : 'translate-y-0 opacity-100'
      }`}>
        {/* Top tech icons */}
        <div className="flex justify-center gap-6 mb-8 animate-bounce-slow">
          <Shield className="w-7 h-7 text-cyan-400 animate-pulse" />
          <Cpu className="w-8 h-8 text-indigo-400 animate-spin-slow" />
          <Shield className="w-7 h-7 text-cyan-400 animate-pulse delay-150" />
        </div>

        {/* Logo/Icon with glow effect */}
        <div className="mb-8 animate-rocket relative">
          <div className="absolute inset-0 bg-indigo-500/30 blur-2xl rounded-full scale-150" />
          <Rocket className="w-24 h-24 text-white mx-auto drop-shadow-2xl relative z-10" />
        </div>

        {/* Main text with tech styling */}
        <div className="space-y-6">
          <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-400 to-violet-400 drop-shadow-lg animate-text-glow">
            🚀 نظام ذكي
          </h1>
          
          {/* Animated dots connector */}
          <div className="flex items-center justify-center gap-2 my-6">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 bg-indigo-400/80 rounded-full animate-dot-wave"
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
          
          <h2 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-indigo-400 to-cyan-400 drop-shadow-lg animate-text-glow delay-300">
            مستقبل مشرق ✨
          </h2>

          {/* Tagline */}
          <p className="text-sm md:text-base text-slate-400 font-medium mt-4 animate-fade-in">
            تقنية موثوقة • أداء متميز • اعتمادية عالية
          </p>
        </div>

        {/* Bottom icons */}
        <div className="flex justify-center gap-6 mt-10 animate-bounce-slow delay-500">
          <Zap className="w-6 h-6 text-cyan-400 animate-pulse" />
          <Sparkles className="w-8 h-8 text-indigo-400 animate-pulse delay-150" />
          <Star className="w-6 h-6 text-violet-400 animate-pulse delay-300" />
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-950 to-transparent" />

      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-32 h-32 border-l-2 border-t-2 border-indigo-500/30 rounded-tl-3xl" />
      <div className="absolute top-0 right-0 w-32 h-32 border-r-2 border-t-2 border-indigo-500/30 rounded-tr-3xl" />
      <div className="absolute bottom-0 left-0 w-32 h-32 border-l-2 border-b-2 border-indigo-500/30 rounded-bl-3xl" />
      <div className="absolute bottom-0 right-0 w-32 h-32 border-r-2 border-b-2 border-indigo-500/30 rounded-br-3xl" />
    </div>
  );
};

export default WelcomeSplash;
