import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Send, Loader2, MessageCircle } from 'lucide-react';
import { createPortal } from 'react-dom';
import { supabase } from '@/integrations/supabase/client';
import AppLogo from '@/components/ui/AppLogo';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const AIAssistantModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages]);
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage: Message = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error(t('aiAssistant.loginRequired'));

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) throw new Error(t('aiAssistant.sessionExpired'));
        if (response.status === 429) throw new Error(t('aiAssistant.rateLimited'));
        if (response.status === 402) throw new Error(t('aiAssistant.addCredits'));
        throw new Error(t('aiAssistant.connectionError'));
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6).trim();
              if (jsonStr === '[DONE]') continue;
              try {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  assistantContent += content;
                  setMessages(prev => {
                    const last = prev[prev.length - 1];
                    if (last?.role === 'assistant') {
                      return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                    }
                    return [...prev, { role: 'assistant', content: assistantContent }];
                  });
                }
              } catch { /* ignore */ }
            }
          }
        }
      }
    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: error.message || t('aiAssistant.unexpectedError') }]);
    } finally { setIsLoading(false); }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99999 }} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-card w-full max-w-sm h-[70vh] rounded-3xl flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center overflow-hidden">
              <AppLogo size={32} />
            </div>
            <div>
              <h3 className="font-bold text-base">{t('aiAssistant.title')}</h3>
              <p className="text-xs text-white/70">{t('aiAssistant.subtitle')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors" type="button">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-background">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="w-14 h-14 bg-purple-100 dark:bg-purple-900/30 rounded-2xl mx-auto mb-3 flex items-center justify-center">
                <MessageCircle className="w-7 h-7 text-purple-500" />
              </div>
              <p className="text-gray-600 dark:text-foreground font-bold mb-1 text-sm">{t('aiAssistant.welcome')}</p>
              <p className="text-gray-400 dark:text-muted-foreground text-xs">{t('aiAssistant.howCanHelp')}</p>
            </div>
          )}
          {messages.map((msg, index) => (
            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                msg.role === 'user'
                  ? 'bg-purple-600 text-white rounded-tr-sm'
                  : 'bg-white dark:bg-card text-gray-800 dark:text-foreground shadow-sm rounded-tl-sm border'
              }`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex justify-end">
              <div className="bg-white dark:bg-card text-gray-800 p-3 rounded-2xl shadow-sm rounded-tl-sm border">
                <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 bg-white dark:bg-card border-t shrink-0">
          <div className="flex gap-2">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress} placeholder={t('aiAssistant.placeholder')}
              className="flex-1 bg-gray-100 dark:bg-muted rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/30"
              disabled={isLoading} />
            <button onClick={sendMessage} disabled={!input.trim() || isLoading}
              className="w-11 h-11 bg-purple-600 text-white rounded-xl flex items-center justify-center disabled:opacity-50 hover:bg-purple-700 transition-colors shrink-0" type="button">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

const AIAssistant: React.FC<{ className?: string }> = ({ className }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}
        className={`p-0.5 rounded-lg overflow-hidden transition-all active:scale-95 ${className || ''}`}
        title={t('aiAssistant.title')} type="button">
        <AppLogo size={32} />
      </button>
      <AIAssistantModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};

export default AIAssistant;