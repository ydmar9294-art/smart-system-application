import React, { useEffect, useRef, useState } from 'react';

/**
 * NumberInput — حقل رقمي لا يعرض رقماً ثابتاً (مثل 0) داخل الحقل.
 * القيمة الافتراضية تظهر كعلامة مائية (placeholder) فقط، فيبدأ المستخدم
 * الكتابة مباشرة دون الحاجة لمسح الرقم الموجود.
 */
interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number;
  onValueChange: (n: number) => void;
  /** السماح بالكسور العشرية */
  decimal?: boolean;
  /** القيمة التي تُعتبر "فارغة" فتظهر كعلامة مائية (افتراضياً 0) */
  emptyValue?: number;
}

const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onValueChange,
  decimal = false,
  emptyValue = 0,
  placeholder,
  inputMode,
  ...rest
}) => {
  const [text, setText] = useState<string>(value === emptyValue ? '' : String(value));
  const focused = useRef(false);

  // مزامنة القيمة الخارجية (إعادة تعيين النموذج مثلاً) دون إزعاج المستخدم أثناء الكتابة
  useEffect(() => {
    if (focused.current) return;
    const parsed = text === '' ? emptyValue : Number(text);
    if (parsed !== value) setText(value === emptyValue ? '' : String(value));
  }, [value, emptyValue]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (raw: string) => {
    const cleaned = decimal
      ? raw.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1')
      : raw.replace(/\D/g, '');
    setText(cleaned);
    if (cleaned === '' || cleaned === '.') {
      onValueChange(emptyValue);
      return;
    }
    const n = Number(cleaned);
    if (!Number.isNaN(n)) onValueChange(n);
  };

  return (
    <input
      {...rest}
      type="text"
      inputMode={inputMode ?? (decimal ? 'decimal' : 'numeric')}
      value={text}
      placeholder={placeholder ?? String(emptyValue)}
      onFocus={(e) => { focused.current = true; rest.onFocus?.(e); }}
      onBlur={(e) => { focused.current = false; rest.onBlur?.(e); }}
      onChange={(e) => handleChange(e.target.value)}
    />
  );
};

export default NumberInput;
