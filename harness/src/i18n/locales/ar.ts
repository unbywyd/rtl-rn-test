import type { Dict } from '../locales';

// Arabic exists to test a same-direction switch (he -> ar must NOT restart).
const ar: Dict = {
  appTitle: 'اختبار RTL',
  screens: {
    baseline: 'الأساس',
    doubleFlip: 'انعكاس مزدوج',
    textAlign: 'محاذاة النص',
    inputs: 'حقول الإدخال',
    numbers: 'الأرقام',
    logical: 'الخصائص المنطقية',
    direction: 'الاتجاه',
    shadows: 'الظلال',
    language: 'اللغة',
  },
  correct: 'صحيح',
  wrong: 'خطأ',
  label: 'تسمية',
  placeholderName: 'أدخل الاسم',
  placeholderPhone: '+972 54-123-4567',
  placeholderEmail: 'name@example.com',
  currentLanguage: 'اللغة الحالية',
  restartNeeded: 'إعادة التشغيل مطلوبة',
  sampleSentence: 'هذه جملة نموذجية بالعربية',
};

export default ar;
