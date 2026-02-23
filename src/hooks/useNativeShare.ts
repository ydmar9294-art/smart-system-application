import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

export const useNativeShare = () => {
  const share = async (options: {
    title: string;
    text: string;
    url?: string;
    dialogTitle?: string;
  }) => {
    if (!Capacitor.isNativePlatform()) {
      if (navigator.share) {
        await navigator.share(options);
      } else {
        await navigator.clipboard.writeText(`${options.title}\n${options.text}`);
        alert('تم النسخ إلى الحافظة');
      }
      return;
    }

    try {
      await Share.share({
        title: options.title,
        text: options.text,
        url: options.url,
        dialogTitle: options.dialogTitle || 'مشاركة'
      });
    } catch (error: any) {
      if (error.message !== 'User cancelled') {
        console.error('Share error:', error);
      }
    }
  };

  const shareInvoice = async (invoiceData: {
    customerName: string;
    total: number;
    items: string;
  }) => {
    const text = `فاتورة - ${invoiceData.customerName}\nالمجموع: ${invoiceData.total}\n${invoiceData.items}`;
    await share({
      title: 'فاتورة مبيعات',
      text,
      dialogTitle: 'مشاركة الفاتورة'
    });
  };

  return { share, shareInvoice };
};
