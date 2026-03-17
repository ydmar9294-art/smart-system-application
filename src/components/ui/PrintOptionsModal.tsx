/**
 * PrintOptionsModal — Let user choose between A4 and POS print formats
 */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Printer, FileText, Smartphone, Loader2 } from 'lucide-react';
import { isBluetoothPrintAvailable } from '@/lib/bluetoothPrintService';

interface PrintOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPrintA4: () => void;
  onPrintPOS: () => void;
  isPrinting?: boolean;
}

const PrintOptionsModal: React.FC<PrintOptionsModalProps> = ({
  isOpen,
  onClose,
  onPrintA4,
  onPrintPOS,
  isPrinting = false,
}) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const btAvailable = isBluetoothPrintAvailable();

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-md flex items-center justify-center p-6"
      dir={isRtl ? 'rtl' : 'ltr'}
      onClick={onClose}
    >
      <div
        className="bg-card w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-border space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
            <Printer className="w-5 h-5 text-primary" />
            {t('print.chooseFormat')}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-3">
          {/* A4 Print */}
          <button
            onClick={onPrintA4}
            disabled={isPrinting}
            className="w-full flex items-center gap-4 p-4 bg-blue-500/10 rounded-2xl hover:bg-blue-500/20 transition-all active:scale-95 disabled:opacity-50"
          >
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-start">
              <p className="font-bold text-foreground">{t('print.a4Format')}</p>
              <p className="text-xs text-muted-foreground">{t('print.a4Description')}</p>
            </div>
          </button>

          {/* POS Print */}
          <button
            onClick={onPrintPOS}
            disabled={isPrinting || !btAvailable}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all active:scale-95 ${
              btAvailable
                ? 'bg-emerald-500/10 hover:bg-emerald-500/20'
                : 'bg-muted opacity-50 cursor-not-allowed'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              btAvailable ? 'bg-emerald-500/20' : 'bg-muted'
            }`}>
              {isPrinting ? (
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              ) : (
                <Smartphone className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              )}
            </div>
            <div className="text-start">
              <p className="font-bold text-foreground">{t('print.posFormat')}</p>
              <p className="text-xs text-muted-foreground">
                {btAvailable ? t('print.posDescription') : t('print.posUnavailable')}
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PrintOptionsModal;
