import React from 'react';
import { Sparkles, Rocket, Star } from 'lucide-react';

interface WelcomeBannerProps {
  className?: string;
}

const WelcomeBanner: React.FC<WelcomeBannerProps> = ({ className = '' }) => {
  return (
    <div className={`bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 rounded-2xl p-4 shadow-lg overflow-hidden relative ${className}`}>
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-20 h-20 bg-white/10 rounded-full -translate-x-10 -translate-y-10" />
      <div className="absolute bottom-0 right-0 w-16 h-16 bg-white/10 rounded-full translate-x-8 translate-y-8" />
      <div className="absolute top-1/2 left-1/4 w-2 h-2 bg-yellow-300 rounded-full animate-pulse" />
      <div className="absolute top-1/3 right-1/3 w-1.5 h-1.5 bg-pink-300 rounded-full animate-pulse delay-300" />
      
      <div className="relative flex items-center justify-center gap-3 text-white">
        <div className="flex items-center gap-1">
          <Star className="w-4 h-4 text-yellow-300 animate-pulse" />
          <Sparkles className="w-5 h-5 text-white/90" />
        </div>
        
        <div className="text-center">
          <p className="font-black text-sm md:text-base tracking-wide">
            🚀 نظام ذكي <span className="mx-2 text-white/60">........</span> مستقبل مشرق ✨
          </p>
        </div>
        
        <div className="flex items-center gap-1">
          <Rocket className="w-5 h-5 text-white/90" />
          <Star className="w-4 h-4 text-yellow-300 animate-pulse delay-150" />
        </div>
      </div>
    </div>
  );
};

export default WelcomeBanner;
