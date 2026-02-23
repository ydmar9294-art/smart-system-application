import React, { useState } from 'react';
import { 
  Wallet, 
  Search, 
  FileText,
  Check,
  Loader2,
  X,
  AlertCircle,
  DollarSign,
  Printer
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { supabase } from '@/integrations/supabase/client';
import InvoicePrint from './InvoicePrint';

interface CollectionTabProps {
  selectedCustomer: import('@/types').Customer | null;
}

const CollectionTab: React.FC<CollectionTabProps> = ({ selectedCustomer }) => {
  const { sales, refreshAllData } = useApp();
  const [selectedSaleId, setSelectedSaleId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [searchSale, setSearchSale] = useState('');
  
  // Print state
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [lastCollectionData, setLastCollectionData] = useState<{
    id: string;
    customerName: string;
    amount: number;
    notes?: string;
  } | null>(null);

  // Filter sales with remaining balance
  const unpaidSales = sales.filter(s => !s.isVoided && Number(s.remaining) > 0);
  
  const filteredSales = unpaidSales.filter(s =>
    s.customerName.toLowerCase().includes(searchSale.toLowerCase())
  );

  const selectedSale = sales.find(s => s.id === selectedSaleId);

  const handleCollect = async () => {
    if (!selectedSaleId || !amount) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('يرجى إدخال مبلغ صحيح');
      return;
    }

    if (selectedSale && numAmount > Number(selectedSale.remaining)) {
      setError('المبلغ أكبر من المتبقي');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { error: rpcError } = await supabase.rpc('add_collection_rpc', {
        p_sale_id: selectedSaleId,
        p_amount: numAmount,
        p_notes: notes || null
      });

      if (rpcError) throw rpcError;

      // Store collection data for printing
      setLastCollectionData({
        id: crypto.randomUUID(),
        customerName: selectedSale?.customerName || '',
        amount: numAmount,
        notes: notes || undefined
      });

      setSelectedSaleId('');
      setAmount('');
      setNotes('');
      setSuccess(true);
      setShowPrintModal(true); // Show print modal after success
      await refreshAllData();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء التحصيل');
    } finally {
      setLoading(false);
    }
  };

  const closePrintModal = () => {
    setShowPrintModal(false);
    setSuccess(false);
    setLastCollectionData(null);
  };

  const handleQuickAmount = (value: number) => {
    const currentAmount = parseFloat(amount) || 0;
    setAmount((currentAmount + value).toString());
  };

  const quickAmounts = [1000, 5000, 10000, 25000, 50000, 100000];

  return (
    <div className="p-5 space-y-5">
      {/* Print Modal */}
      {showPrintModal && lastCollectionData && (
        <InvoicePrint
          invoiceType="collection"
          invoiceId={lastCollectionData.id}
          customerName={lastCollectionData.customerName}
          date={new Date()}
          grandTotal={lastCollectionData.amount}
          notes={lastCollectionData.notes}
          onClose={closePrintModal}
        />
      )}

      {/* Success Message */}
      {success && !showPrintModal && (
        <div className="bg-emerald-50 text-emerald-600 p-4 rounded-2xl flex items-center gap-2 border border-emerald-200">
          <Check className="w-5 h-5" />
          <span className="font-bold">تم التحصيل بنجاح!</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center gap-2 border border-red-200">
          <AlertCircle className="w-5 h-5" />
          <span className="font-bold">{error}</span>
        </div>
      )}

      {/* Amount Input Section - Larger & More Spacious */}
      <div className="bg-muted rounded-3xl p-5 md:p-6">
        <p className="text-muted-foreground text-center font-bold mb-4">إدخال مبلغ التحصيل</p>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full text-center text-4xl md:text-5xl font-black text-foreground bg-transparent border-none outline-none py-6"
          dir="ltr"
        />
        
        {/* Quick Amount Buttons - Larger Touch Targets */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          {quickAmounts.map((value) => (
            <button
              key={value}
              onClick={() => handleQuickAmount(value)}
              className="py-4 bg-card rounded-xl font-bold text-foreground hover:bg-card/80 transition-colors border border-border active:scale-[0.97] text-base"
            >
              +{value.toLocaleString('ar-SA')}
            </button>
          ))}
        </div>
      </div>

      {/* Submit Button - Larger */}
      <button
        onClick={handleCollect}
        disabled={loading || !amount || !selectedSaleId}
        className="w-full bg-emerald-100 text-emerald-700 font-black py-5 md:py-6 rounded-2xl flex items-center justify-center gap-3 disabled:opacity-50 hover:bg-emerald-200 transition-all active:scale-[0.98] text-lg"
      >
        {loading ? (
          <>
            <Loader2 className="w-6 h-6 animate-spin" />
            جارٍ التحصيل...
          </>
        ) : (
          <>
            <DollarSign className="w-6 h-6" />
            توثيق سند القبض
          </>
        )}
      </button>

      {/* Sale Selection - Improved */}
      {!selectedSale && (
        <div className="space-y-4">
          <p className="text-muted-foreground font-bold">اختر الفاتورة:</p>
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="بحث بالعميل..."
              value={searchSale}
              onChange={(e) => setSearchSale(e.target.value)}
              className="w-full bg-muted border-none rounded-2xl px-12 py-4 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-base"
            />
          </div>
          
          {unpaidSales.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wallet className="w-16 h-16 mx-auto mb-3 opacity-30" />
              <p className="font-bold text-lg">لا توجد فواتير مستحقة</p>
            </div>
          ) : (
            <div className="max-h-[35vh] overflow-y-auto space-y-2 rounded-2xl">
              {filteredSales.map((sale) => (
                <button
                  key={sale.id}
                  onClick={() => setSelectedSaleId(sale.id)}
                  className="w-full text-start p-4 md:p-5 bg-muted rounded-2xl hover:bg-muted/80 transition-colors active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-foreground">{sale.customerName}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date(sale.timestamp).toLocaleDateString('ar-SA')}
                      </p>
                    </div>
                    <div className="text-end">
                      <p className="font-black text-orange-500 text-lg">
                        {Number(sale.remaining).toLocaleString('ar-SA')} ل.س
                      </p>
                      <p className="text-xs text-muted-foreground">متبقي</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selected Sale Info - Improved */}
      {selectedSale && (
        <div className="bg-muted rounded-2xl p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-primary" />
              <span className="font-bold text-lg">{selectedSale.customerName}</span>
            </div>
            <button
              onClick={() => {
                setSelectedSaleId('');
                setAmount('');
              }}
              className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-card rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">الإجمالي</p>
              <p className="font-black text-foreground text-lg">
                {Number(selectedSale.grandTotal).toLocaleString('ar-SA')}
              </p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">المدفوع</p>
              <p className="font-black text-emerald-600 text-lg">
                {Number(selectedSale.paidAmount).toLocaleString('ar-SA')}
              </p>
            </div>
            <div className="bg-orange-50 rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">المتبقي</p>
              <p className="font-black text-orange-500 text-lg">
                {Number(selectedSale.remaining).toLocaleString('ar-SA')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollectionTab;
