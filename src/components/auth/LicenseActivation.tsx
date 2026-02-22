import React, { useState, useEffect } from 'react';
import { Key, Building2, User, Loader2, CheckCircle2, AlertCircle, Sparkles, Copy, Wallet, LogOut, MessageCircle, Clock, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface LicenseActivationProps {
  userId: string;
  email: string;
  fullName: string;
  onSuccess: () => void;
  onLogout: () => void;
}

const SHAMCASH_ADDRESS = 'efd5411a5f29e0cdb279363de2dd62b3';
const WHATSAPP_NUMBER = '963947744162';

const LicenseActivation: React.FC<LicenseActivationProps> = ({ 
  userId, 
  email, 
  fullName,
  onSuccess,
  onLogout
}) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [codeType, setCodeType] = useState<'unknown' | 'org' | 'employee'>('unknown');
  const [showPayment, setShowPayment] = useState(false);
  const [copiedPayment, setCopiedPayment] = useState(false);

  const handleCopyPayment = () => {
    navigator.clipboard.writeText(SHAMCASH_ADDRESS);
    setCopiedPayment(true);
    setTimeout(() => setCopiedPayment(false), 2000);
  };

  const handleContactSupport = () => {
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
      'مرحباً، قمت بدفع رسوم التفعيل عبر شام كاش وأريد تفعيل الترخيص. البريد الإلكتروني: ' + email
    )}`, '_blank');
  };

  // Auto-detect code type
  useEffect(() => {
    const trimmedCode = code.trim().toUpperCase();
    if (trimmedCode.startsWith('EMP-')) {
      setCodeType('employee');
    } else if (trimmedCode.length >= 4) {
      setCodeType('org');
    } else {
      setCodeType('unknown');
    }
  }, [code]);

  const handleActivation = async () => {
    setError('');

    if (!code.trim()) {
      setError('يرجى إدخال كود التفعيل');
      return;
    }

    setLoading(true);

    try {
      const trimmedCode = code.trim().toUpperCase();
      
      // Determine activation type based on code format
      if (trimmedCode.startsWith('EMP-')) {
        // Employee activation
        const { data, error: rpcError } = await supabase.rpc('activate_employee_oauth', {
          p_user_id: userId,
          p_google_id: userId,
          p_email: email,
          p_full_name: fullName,
          p_activation_code: trimmedCode
        });

        if (rpcError) throw rpcError;
        
        const result = data as { success: boolean; error?: string; message?: string };
        
        if (!result.success) {
          setError(result.message || 'فشل في تفعيل الحساب');
          return;
        }
      } else {
        // Organization license activation
        const { data, error: rpcError } = await supabase.rpc('activate_license_oauth', {
          p_user_id: userId,
          p_google_id: userId,
          p_email: email,
          p_full_name: fullName,
          p_license_key: trimmedCode
        });

        if (rpcError) throw rpcError;
        
        const result = data as { success: boolean; error?: string; message?: string };
        
        if (!result.success) {
          setError(result.message || 'فشل في تفعيل الترخيص');
          return;
        }
      }
      
      onSuccess();
    } catch (err: any) {
      console.error('[LicenseActivation] Error:', err);
      setError(err.message || 'فشل في التفعيل');
    } finally {
      setLoading(false);
    }
  };

  const getCodeTypeInfo = () => {
    switch (codeType) {
      case 'org':
        return {
          icon: Building2,
          label: 'كود منشأة',
          description: 'سيتم تفعيلك كمالك للمنشأة',
          color: 'text-primary',
          bgColor: 'bg-primary/10',
          borderColor: 'border-primary/30',
          glowColor: 'shadow-primary/20'
        };
      case 'employee':
        return {
          icon: User,
          label: 'كود موظف',
          description: 'سيتم تفعيلك كموظف في المنشأة',
          color: 'text-success',
          bgColor: 'bg-success/10',
          borderColor: 'border-success/30',
          glowColor: 'shadow-success/20'
        };
      default:
        return {
          icon: Key,
          label: 'كود التفعيل',
          description: 'أدخل الكود للمتابعة',
          color: 'text-muted-foreground',
          bgColor: 'bg-muted',
          borderColor: 'border-border',
          glowColor: ''
        };
    }
  };

  const typeInfo = getCodeTypeInfo();
  const TypeIcon = typeInfo.icon;

  return (
    <div className="space-y-5">
      {/* User Info */}
      <div className="flex items-center justify-between bg-muted/50 p-4 rounded-2xl border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-bold text-foreground text-sm">{fullName || email}</p>
            <p className="text-xs text-muted-foreground">{email}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="p-2 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          title="تسجيل الخروج"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Header */}
      <div className="text-center space-y-2 pb-2">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-3">
          <Sparkles className="w-7 h-7 text-primary" />
        </div>
        <h3 className="text-lg font-black text-foreground">تفعيل الحساب</h3>
        <p className="text-xs text-muted-foreground">أدخل كود التفعيل الخاص بك للبدء</p>
      </div>

      {/* Activation Code */}
      <div className="space-y-3">
        <label className="text-sm font-bold text-foreground flex items-center gap-2">
          <Key className="w-4 h-4 text-primary" />
          كود التفعيل
        </label>
        <div className="relative">
          <input
            type="text"
            placeholder="XXXX-XXXX أو EMP-XXXX"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            disabled={loading}
            className={`input-field text-center tracking-[0.3em] font-mono text-lg transition-all duration-300 ${
              codeType !== 'unknown' 
                ? `${typeInfo.bgColor} border-2 ${typeInfo.borderColor} shadow-lg ${typeInfo.glowColor}` 
                : 'bg-muted'
            }`}
            dir="ltr"
          />
        </div>
        
        {/* Code Type Indicator with Animation */}
        <div className={`overflow-hidden transition-all duration-500 ease-out ${code.length > 0 ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className={`flex items-center gap-3 p-4 rounded-2xl ${typeInfo.bgColor} border ${typeInfo.borderColor} transition-all duration-300`}>
            <div className={`w-10 h-10 rounded-xl ${typeInfo.bgColor} flex items-center justify-center`}>
              <TypeIcon className={`w-5 h-5 ${typeInfo.color}`} />
            </div>
            <div className="flex-1">
              <p className={`text-sm font-black ${typeInfo.color}`}>{typeInfo.label}</p>
              <p className="text-[11px] text-muted-foreground">{typeInfo.description}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-destructive/10 text-destructive rounded-2xl border border-destructive/20 animate-in slide-in-from-top duration-300">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleActivation}
        disabled={loading || !code}
        className="w-full py-5 bg-foreground text-background rounded-2xl font-black text-base flex items-center justify-center gap-3 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 shadow-xl shadow-foreground/10 hover:shadow-2xl hover:shadow-foreground/20"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            جارٍ التفعيل...
          </>
        ) : (
          <>
            <CheckCircle2 className="w-5 h-5" />
            تفعيل الحساب
          </>
        )}
      </button>

      {/* ShamCash Payment Section */}
      <div className="pt-2 space-y-3">
        <button
          onClick={() => setShowPayment(!showPayment)}
          className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95"
        >
          <Wallet className="w-5 h-5" />
          الدفع عبر شام كاش
        </button>
        
        {showPayment && (
          <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-2xl border border-green-200 dark:border-green-800 space-y-4 animate-in slide-in-from-top duration-300">
            {/* Important Notice */}
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 rounded-xl">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-amber-800 dark:text-amber-200 text-xs mb-0.5">ملاحظة هامة</h4>
                  <p className="text-amber-700 dark:text-amber-300 text-[10px] leading-relaxed">
                    الاشتراك لن يتم تفعيله تلقائياً. بعد الدفع، تواصل مع فريق الدعم لتأكيد الدفع يدوياً.
                  </p>
                </div>
              </div>
            </div>

            {/* Pending Status */}
            <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-blue-700 dark:text-blue-300 font-bold">بانتظار تأكيد الدفع من الإدارة</span>
            </div>

            {/* Payment Address */}
            <div className="space-y-1">
              <p className="text-center text-xs text-gray-600 dark:text-gray-300 font-medium">عنوان الدفع:</p>
              <div 
                onClick={handleCopyPayment}
                className="bg-white dark:bg-gray-800 p-3 rounded-xl flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-green-200 dark:border-green-700"
              >
                <span className="font-mono text-sm text-gray-800 dark:text-gray-200 tracking-wide" dir="ltr">{SHAMCASH_ADDRESS}</span>
                {copiedPayment ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                ) : (
                  <Copy className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}
              </div>
            </div>

            {/* WhatsApp Contact Button */}
            <button 
              onClick={handleContactSupport}
              className="w-full py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-95"
            >
              <MessageCircle className="w-4 h-4" />
              تواصل مع الدعم المالي (واتساب)
            </button>
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="text-center space-y-1 pt-2">
        <p className="text-[11px] text-muted-foreground">
          <span className="font-bold">كود المنشأة:</span> XXXX-XXXX
        </p>
        <p className="text-[11px] text-muted-foreground">
          <span className="font-bold">كود الموظف:</span> EMP-XXXX-XXXX
        </p>
      </div>
    </div>
  );
};

export default LicenseActivation;
