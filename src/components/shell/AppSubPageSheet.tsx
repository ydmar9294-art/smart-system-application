import React from 'react';
import { Drawer, DrawerContent, DrawerOverlay, DrawerPortal } from '@/components/ui/drawer';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

/**
 * Generic full-height bottom sheet used to host secondary tabs (settings sub-pages).
 * Mirrors the Owner SubPageSheet visual language.
 */
const AppSubPageSheet: React.FC<Props> = ({ open, onClose, title, children }) => {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const BackIcon = isRtl ? ChevronRight : ChevronLeft;

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerPortal>
        <DrawerOverlay />
        <DrawerContent className="!h-[92vh] !mt-0 !rounded-t-[24px] border-t border-border bg-background flex flex-col">
          <div
            className="flex-shrink-0 flex items-center gap-2 px-3 py-3 border-b border-border"
            dir={isRtl ? 'rtl' : 'ltr'}
            style={{ paddingTop: '8px' }}
          >
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-muted active:scale-90 transition-all"
              aria-label="back"
            >
              <BackIcon className="w-6 h-6 text-foreground" />
            </button>
            <h2 className="text-base font-bold text-foreground flex-1 text-center pe-10">
              {title}
            </h2>
          </div>
          <div
            className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-3"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            {children}
          </div>
        </DrawerContent>
      </DrawerPortal>
    </Drawer>
  );
};

export default AppSubPageSheet;
