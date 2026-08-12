/**
 * قواعد إدخال المواد الذكية (Smart product entry rules)
 * مصدر واحد لقواعد الصنف والترميز والعبوة، تُستخدم في كل واجهات المخزون.
 */
import type { Product } from '@/types';

export interface ProductRuleInput {
  name: string;
  category: string;
  unit: string;
  unitsPerPack: number;
  allowPackSales: boolean;
  allowPieceSales: boolean;
  pricingUnit: 'PIECE' | 'PACK';
  basePrice: number;
  packPrice: number;
  consumerPrice: number;
  packConsumerPrice: number;
  stock: number;
  minStock: number;
}

export type RuleErrors = Partial<Record<keyof ProductRuleInput | 'sales', string>>;

/** ترميز تلقائي للمادة: أول حروف الصنف + بصمة الاسم + عدد القطع بالطرد */
export const buildProductCode = (category: string, name: string, unitsPerPack: number): string => {
  const clean = (s: string) => (s || '').trim().replace(/\s+/g, '');
  const catPart = clean(category).slice(0, 3).toUpperCase() || 'GEN';
  const nameSrc = clean(name);
  let hash = 0;
  for (let i = 0; i < nameSrc.length; i++) hash = (hash * 31 + nameSrc.charCodeAt(i)) % 100000;
  const namePart = String(hash).padStart(5, '0');
  return `${catPart}-${namePart}-P${Math.max(1, unitsPerPack)}`;
};

/** التحقق الكامل من قواعد المادة */
export const validateProductRules = (input: ProductRuleInput): RuleErrors => {
  const e: RuleErrors = {};

  if (!input.name || input.name.trim().length < 2) e.name = 'اسم المادة مطلوب (حرفان على الأقل)';
  if (!input.category || input.category.trim().length < 2) e.category = 'الصنف مطلوب لتصنيف المادة وترميزها';
  if (!input.unit || input.unit.trim().length < 1) e.unit = 'وحدة القياس مطلوبة';

  if (!Number.isInteger(input.unitsPerPack) || input.unitsPerPack < 1) {
    e.unitsPerPack = 'عدد القطع داخل الطرد يجب أن يكون رقماً صحيحاً ≥ 1';
  }
  if (!input.allowPackSales && !input.allowPieceSales) {
    e.sales = 'يجب السماح بالبيع بالقطعة أو بالطرد على الأقل';
  }
  if (input.allowPackSales && input.unitsPerPack < 2) {
    e.unitsPerPack = 'لتفعيل البيع بالطرد يجب أن يحتوي الطرد على قطعتين فأكثر';
  }
  if (input.pricingUnit === 'PACK' && input.unitsPerPack < 2) {
    e.unitsPerPack = 'لا يمكن التسعير بالطرد إلا إذا احتوى الطرد على قطعتين فأكثر';
  }

  if (input.pricingUnit === 'PIECE' && !(input.basePrice > 0)) {
    e.basePrice = 'سعر بيع القطعة يجب أن يكون أكبر من صفر';
  }
  if (input.pricingUnit === 'PACK' && !(input.packPrice > 0)) {
    e.packPrice = 'سعر بيع الطرد يجب أن يكون أكبر من صفر';
  }
  if (input.consumerPrice < 0 || input.packConsumerPrice < 0) {
    e.consumerPrice = 'سعر المستهلك لا يمكن أن يكون سالباً';
  }

  if (!Number.isInteger(input.stock) || input.stock < 0) e.stock = 'المخزون يجب أن يكون رقماً صحيحاً غير سالب';
  if (!Number.isInteger(input.minStock) || input.minStock < 0) e.minStock = 'الحد الأدنى يجب أن يكون رقماً صحيحاً غير سالب';

  return e;
};

export const hasRuleErrors = (errors: RuleErrors) => Object.keys(errors).length > 0;

/** تحويل (طرد + قطعة) إلى إجمالي القطع */
export const toPieces = (packQty: number, pieceQty: number, unitsPerPack: number) =>
  Math.max(0, Math.trunc(packQty)) * Math.max(1, unitsPerPack) + Math.max(0, Math.trunc(pieceQty));

/** تفكيك إجمالي القطع إلى طرود وقطع */
export const fromPieces = (pieces: number, unitsPerPack: number) => {
  const upp = Math.max(1, unitsPerPack);
  return { pack: Math.floor(pieces / upp), piece: pieces % upp };
};

export interface PackPieceValidationResult {
  ok: boolean;
  error?: string;
  pieces: number;
}

/**
 * قاعدة موحدة: يُمنع أي تسليم أو بيع أو شراء بدون ضبط الطرد والقطعة بشكل صحيح.
 */
export const validatePackPieceEntry = (
  product: Pick<Product, 'unitsPerPack' | 'allowPackSales' | 'allowPieceSales' | 'name'> | undefined,
  packQty: number,
  pieceQty: number,
  availablePieces?: number,
): PackPieceValidationResult => {
  if (!product) return { ok: false, error: 'يجب اختيار المادة أولاً', pieces: 0 };

  const upp = Math.max(1, product.unitsPerPack ?? 1);
  const pack = Math.trunc(packQty || 0);
  const piece = Math.trunc(pieceQty || 0);

  if (pack < 0 || piece < 0) return { ok: false, error: 'الكميات لا يمكن أن تكون سالبة', pieces: 0 };
  if (pack === 0 && piece === 0) return { ok: false, error: 'أدخل عدد الطرود أو عدد القطع (لا يمكن ترك الكمية صفراً)', pieces: 0 };
  if (pack > 0 && upp < 2) return { ok: false, error: 'هذه المادة غير معبأة بطرود، أدخل الكمية بالقطعة', pieces: 0 };
  if (piece >= upp && upp > 1) {
    return { ok: false, error: `عدد القطع يجب أن يكون أقل من ${upp} — حوّل الفائض إلى طرود`, pieces: 0 };
  }

  const pieces = toPieces(pack, piece, upp);
  if (typeof availablePieces === 'number' && pieces > availablePieces) {
    const avail = fromPieces(availablePieces, upp);
    return {
      ok: false,
      error: `الكمية تتجاوز المتوفر (${avail.pack > 0 ? `${avail.pack} طرد ` : ''}${avail.piece} قطعة)`,
      pieces: 0,
    };
  }

  return { ok: true, pieces };
};

/** عرض نصي موحد للكمية بالطرد والقطعة */
export const formatPackPiece = (pieces: number, unitsPerPack: number): string => {
  const upp = Math.max(1, unitsPerPack);
  if (upp === 1) return `${pieces} قطعة`;
  const { pack, piece } = fromPieces(pieces, upp);
  const parts: string[] = [];
  if (pack > 0) parts.push(`${pack} طرد`);
  if (piece > 0) parts.push(`${piece} قطعة`);
  return parts.length ? parts.join(' + ') : '0 قطعة';
};
