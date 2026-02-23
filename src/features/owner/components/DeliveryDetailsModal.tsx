/**
 * DeliveryDetailsModal — uses clean HTML generation (no DOM.innerHTML).
 */
import React, { useState, useEffect } from 'react';
import { Truck, Package, Calendar, User, Hash, Loader2, Printer, FileDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import FullScreenModal from '@/components/ui/FullScreenModal';
import { escapeHtml, escapeNumber } from '@/lib/htmlEscape';

interface DeliveryItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
}

interface DeliveryDetailsModalProps {
  deliveryId: string;
  distributorName: string;
  createdAt: number;
  notes?: string;
  onClose: () => void;
}

function buildDeliveryHtml(params: {
  orgName: string;
  invoiceNumber: string;
  deliveryDate: Date;
  distributorName: string;
  items: DeliveryItem[];
  notes?: string;
}): string {
  const { orgName, invoiceNumber, deliveryDate, distributorName, items, notes } = params;
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>فاتورة تسليم - ${escapeHtml(invoiceNumber)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; width: 80mm; padding: 5mm; font-size: 12px; line-height: 1.4; }
    @media print { body { width: 80mm; } }
  </style>
</head>
<body>
  <div style="text-align:center;margin-bottom:10px;border-bottom:1px dashed #000;padding-bottom:10px;">
    <div style="font-size:16px;font-weight:bold;">${escapeHtml(orgName || 'اسم المنشأة')}</div>
  </div>
  <div style="font-size:14px;font-weight:bold;margin:10px 0;text-align:center;">فاتورة تسليم بضاعة</div>
  <div style="display:flex;justify-content:space-between;font-size:11px;margin:3px 0;">
    <span>رقم الفاتورة:</span><span>${escapeHtml(invoiceNumber)}</span>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:11px;margin:3px 0;">
    <span>التاريخ:</span><span>${escapeHtml(deliveryDate.toLocaleDateString('ar-SA'))}</span>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:11px;margin:3px 0;">
    <span>الوقت:</span><span>${escapeHtml(deliveryDate.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }))}</span>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:11px;margin:3px 0;">
    <span>الموزع:</span><span>${escapeHtml(distributorName)}</span>
  </div>
  <div style="margin:10px 0;border-top:1px dashed #000;border-bottom:1px dashed #000;padding:10px 0;">
    <table style="width:100%;border-collapse:collapse;font-size:10px;">
      <thead>
        <tr style="font-weight:bold;font-size:9px;color:#555;border-bottom:1px dashed #ccc;">
          <th style="text-align:right;padding:3px 2px;">الصنف</th>
          <th style="text-align:center;padding:3px 2px;">الكمية</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => `
          <tr>
            <td style="text-align:right;padding:3px 2px;">${escapeHtml(item.product_name)}</td>
            <td style="text-align:center;padding:3px 2px;font-weight:bold;">${escapeNumber(item.quantity)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  <div style="font-size:14px;font-weight:bold;text-align:center;margin:10px 0;">
    إجمالي القطع: ${escapeNumber(totalItems)}
  </div>
  ${notes ? `<div style="margin-top:10px;padding-top:10px;border-top:1px dashed #000;font-size:10px;color:#555;">ملاحظات: ${escapeHtml(notes)}</div>` : ''}
  <div style="text-align:center;font-size:10px;color:#555;margin-top:15px;border-top:1px dashed #000;padding-top:10px;">
    <p>شكراً لتعاملكم معنا</p>
    <p style="margin-top:3px;">Smart Sales System</p>
  </div>
</body>
</html>`;
}

const DeliveryDetailsModal: React.FC<DeliveryDetailsModalProps> = ({
  deliveryId,
  distributorName,
  createdAt,
  notes,
  onClose,
}) => {
  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [orgName, setOrgName] = useState('');
  const [printing, setPrinting] = useState(false);

  const invoiceNumber = deliveryId.substring(0, 8).toUpperCase();
  const deliveryDate = new Date(createdAt);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [itemsRes, userRes] = await Promise.all([
          supabase.from('delivery_items').select('*').eq('delivery_id', deliveryId).order('created_at', { ascending: true }),
          supabase.auth.getUser(),
        ]);

        if (itemsRes.error) throw itemsRes.error;
        setItems(itemsRes.data || []);

        if (userRes.data?.user) {
          const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', userRes.data.user.id).single();
          if (profile?.organization_id) {
            const { data: org } = await supabase.from('organizations').select('name').eq('id', profile.organization_id).single();
            if (org) setOrgName(org.name);
          }
        }
      } catch (err: unknown) {
        console.error('[DeliveryDetailsModal] fetch error:', err);
        setError('حدث خطأ في تحميل تفاصيل الفاتورة');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [deliveryId]);

  const handlePrint = async () => {
    if (printing || items.length === 0) return;
    setPrinting(true);
    try {
      const html = buildDeliveryHtml({ orgName, invoiceNumber, deliveryDate, distributorName, items, notes });
      const { printHTML } = await import('@/lib/printService');
      await printHTML(html, 'فاتورة تسليم');
    } catch (err) {
      console.error('[DeliveryDetailsModal] Print failed:', err);
    } finally {
      setPrinting(false);
    }
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <FullScreenModal
      isOpen={true}
      onClose={onClose}
      title="تفاصيل فاتورة التسليم"
      icon={<Truck size={24} />}
      headerColor="primary"
      footer={
        !loading && items.length > 0 ? (
          <div className="space-y-3">
            <button
              onClick={handlePrint}
              disabled={printing}
              className="w-full bg-primary text-primary-foreground font-black py-5 rounded-2xl flex items-center justify-center gap-3 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-60"
            >
              {printing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Printer className="w-6 h-6" />}
              {printing ? 'جارٍ الطباعة...' : 'طباعة فاتورة التسليم'}
            </button>
            <button
              onClick={handlePrint}
              disabled={printing}
              className="w-full bg-muted text-foreground font-black py-5 rounded-2xl flex items-center justify-center gap-3 hover:bg-muted/80 transition-all active:scale-[0.98] disabled:opacity-60"
            >
              <FileDown className="w-6 h-6" /> تصدير كـ PDF
            </button>
          </div>
        ) : undefined
      }
    >
      {/* Invoice Info */}
      <div className="bg-muted/50 rounded-2xl p-5 space-y-4 mb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Hash size={16} />
            <span className="text-xs font-bold">رقم الفاتورة</span>
          </div>
          <span className="font-black text-foreground">{invoiceNumber}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <User size={16} />
            <span className="text-xs font-bold">الموزع</span>
          </div>
          <span className="font-bold text-foreground">{distributorName}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar size={16} />
            <span className="text-xs font-bold">تاريخ التسليم</span>
          </div>
          <span className="font-bold text-foreground">
            {deliveryDate.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Package size={16} />
            <span className="text-xs font-bold">إجمالي القطع</span>
          </div>
          <span className="font-black text-primary text-lg">{totalItems}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
          <p className="text-muted-foreground font-bold">جارٍ التحميل...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-destructive font-bold">{error}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground font-bold">لا توجد أصناف</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-3">
            قائمة الأصناف ({items.length} صنف)
          </h3>
          {items.map((item, index) => (
            <div key={item.id} className="bg-muted rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center text-xs font-black text-primary">
                  {index + 1}
                </div>
                <span className="font-bold text-foreground">{item.product_name}</span>
              </div>
              <div className="bg-primary/10 text-primary px-3 py-1 rounded-full font-black text-sm">
                {item.quantity} قطعة
              </div>
            </div>
          ))}
        </div>
      )}

      {notes && (
        <div className="mt-5 p-5 bg-muted/30 rounded-2xl">
          <p className="text-xs font-black text-muted-foreground uppercase mb-2">ملاحظات</p>
          <p className="text-sm text-foreground bg-muted p-3 rounded-xl">{notes}</p>
        </div>
      )}
    </FullScreenModal>
  );
};

export default DeliveryDetailsModal;
