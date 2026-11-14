export type Locale = 'en-US' | 'de-DE' | 'ar-AE';

export interface CheckoutCopy {
  heading: string;
  subtotal: string;
  shipping: string;
  freeShipping: string;
  tax: string;
  discount: (code: string) => string;
  total: string;
  quantity: (count: number) => string;
  pay: string;
  secure: string;
}

export const CURRENCY: Record<Locale, string> = {
  'en-US': 'USD',
  'de-DE': 'EUR',
  'ar-AE': 'AED',
};

/** Right-to-left locales mirror the whole layout. */
export const DIRECTION: Record<Locale, 'ltr' | 'rtl'> = {
  'en-US': 'ltr',
  'de-DE': 'ltr',
  'ar-AE': 'rtl',
};

export const COPY: Record<Locale, CheckoutCopy> = {
  'en-US': {
    heading: 'Order summary',
    subtotal: 'Subtotal',
    shipping: 'Shipping',
    freeShipping: 'Free',
    tax: 'Estimated tax',
    discount: (code) => `Promo code ${code}`,
    total: 'Total',
    quantity: (count) => `Qty ${count}`,
    pay: 'Pay now',
    secure: 'Payments are encrypted and processed securely.',
  },
  'de-DE': {
    heading: 'Zusammenfassung der Bestellung',
    subtotal: 'Zwischensumme',
    shipping: 'Versandkosten',
    freeShipping: 'Kostenlos',
    tax: 'Voraussichtliche Umsatzsteuer',
    discount: (code) => `Gutscheincode ${code}`,
    total: 'Gesamtsumme',
    quantity: (count) => `Menge ${count}`,
    pay: 'Jetzt kostenpflichtig bestellen',
    secure: 'Zahlungen werden verschlüsselt und sicher verarbeitet.',
  },
  'ar-AE': {
    heading: 'ملخص الطلب',
    subtotal: 'المجموع الفرعي',
    shipping: 'الشحن',
    freeShipping: 'مجاني',
    tax: 'الضريبة التقديرية',
    discount: (code) => `رمز الخصم ${code}`,
    total: 'الإجمالي',
    quantity: (count) => `الكمية ${count}`,
    pay: 'ادفع الآن',
    secure: 'يتم تشفير المدفوعات ومعالجتها بشكل آمن.',
  },
};
