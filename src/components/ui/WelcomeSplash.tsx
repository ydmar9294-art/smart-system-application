/**
 * WelcomeSplash - Full-screen professional welcome screen
 * Matches LogoutScreen style with trust/security messaging.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Lock, CheckCircle } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';

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
  const [messageIndex, setMessageIndex] = useState(0);

  const messages = [
    { text: 'أهلاً بك! حسابك آمن معنا', icon: <Shield className="w-5 h-5 text-primary" /> },
    { text: 'بياناتك محمية بالكامل', icon: <Lock className="w-5 h-5 text-primary" /> },
    { text: 'تجربة موثوقة ومريحة بانتظارك', icon: <CheckCircle className="w-5 h-5 text-primary" /> },
  ];

  // Play welcome chime
  const playWelcomeSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playTone = (frequency: number, startTime: number, dur: number, volume: number) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, audioContext.currentTime + startTime);
        gain.gain.setValueAtTime(0, audioContext.currentTime + startTime);
        gain.gain.linearRampToValueAtTime(volume, audioContext.currentTime + startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + startTime + dur);
        osc.start(audioContext.currentTime + startTime);
        osc.stop(audioContext.currentTime + startTime + dur);
      };
      playTone(523.25, 0, 0.3, 0.12);
      playTone(659.25, 0.1, 0.3, 0.1);
      playTone(783.99, 0.2, 0.4, 0.08);
      playTone(1046.50, 0.35, 0.5, 0.06);
    } catch {
      // Audio not supported
    }
  }, []);

  useEffect(() => {
    playWelcomeSound();

    // Cycle messages
    const msgInterval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % 3);
    }, 900);

    const exitTimer = setTimeout(() => setIsExiting(true), duration - 500);
    const hideTimer = setTimeout(() => {
      setIsVisible(false);
      onComplete?.();
    }, duration);

    return () => {
      clearInterval(msgInterval);
      clearTimeout(exitTimer);
      clearTimeout(hideTimer);
    };
  }, [duration, onComplete, playWelcomeSound]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center p-6 text-center transition-all duration-500 safe-area-x safe-area-bottom ${
        isExiting ? 'opacity-0 scale-105' : 'opacity-100 scale-100'
      }`}
      dir="rtl"
    >
      <div className="flex flex-col items-center gap-6 max-w-xs w-full animate-fade-in">
        {/* Logo with subtle glow */}
        <div className="relative">
          <div className="absolute inset-0 bg-primary/10 rounded-full blur-2xl scale-150" />
          <div className="relative animate-logo-glow">
            <div className="glass-capsule w-[88px] h-[88px] rounded-[1.6rem] flex items-center justify-center">
              <AppLogo size={56} />
            </div>
          </div>
        </div>

        {/* Security badge */}
        <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full">
          <Shield className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-primary">اتصال آمن ومشفّر</span>
        </div>

        {/* Spinner */}
        <div className="w-10 h-10 border-3 border-muted border-t-primary rounded-full animate-spin" />

        {/* Rotating trust messages */}
        <div className="space-y-3 min-h-[80px] flex flex-col items-center justify-center">
          <div className="flex items-center gap-2 transition-all duration-300" key={messageIndex}>
            {messages[messageIndex].icon}
            <p className="text-xl font-black text-foreground leading-relaxed animate-fade-in">
              {messages[messageIndex].text}
            </p>
          </div>
          <p className="text-sm text-muted-foreground font-bold">
            جارٍ تحضير تجربتك...
          </p>
        </div>

        {/* Trust indicators */}
        <div className="flex items-center gap-4 mt-2">
          {[Lock, Shield, CheckCircle].map((Icon, i) => (
            <div key={i} className="flex flex-col items-center gap-1 opacity-60">
              <Icon className="w-4 h-4 text-muted-foreground" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WelcomeSplash;
