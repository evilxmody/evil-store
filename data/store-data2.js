/* تعديل البيانات:
  1) غيّر اسم المتجر/العملة/واتساب من STORE_CONFIG
  2) عدّل المنتجات من STORE_PRODUCTS (الاسم/السعر/الصور/التصنيف)
  3) الصور: ضع ملفاتك داخل assets/store ثم حدّث المسار هنا
*/

window.STORE_CONFIG = {
  name: "متجر جاهز",
  tagline: "شكل شيك وتعديل سهل",
  title: "المنتجات",
  locale: "ar-EG",
  currency: "EGP",
  whatsappPhone: "+201096817968",
  whatsappLink: "https://wa.me/qr/T2ANGVAQ6YPDK1",
  adminPassword: "312007",
  shipping: {
    flatFee: 55,
    freeOver: 1200
  }
};

window.STORE_PRODUCTS = [
  {
    id: "gift-box",
    name: "بوكس هدايا صغير",
    sku: "GBX-001",
    stock: 24,
    price: 399,
    compareAt: 450,
    category: "هدايا",
    badge: "خصم",
    images: ["assets/store/product-01.svg", "assets/store/product-02.svg"],
    description: "بوكس بسيط ومرتب للهدايا. تقدر تغيّر الصور والوصف والسعر بسهولة.",
    highlights: ["تغليف مرتب", "مناسب للهدايا", "خامات ممتازة"],
    specs: [
      { label: "الخامة", value: "كرتون مقوى" },
      { label: "المقاس", value: "صغير" },
      { label: "الاستخدام", value: "هدايا" }
    ]
  },
  {
    id: "scented-candle",
    name: "شمعة عطرية",
    sku: "CND-014",
    stock: 10,
    price: 229,
    category: "عناية",
    badge: "جديد",
    images: ["assets/store/product-02.webp", "assets/store/product-03.jpg"],
    description: "شمعة بروائح هادئة. استخدم صورك بدل الصور الافتراضية.",
    highlights: ["رائحة هادية", "مناسبة للغرف", "إحساس رايق"],
    specs: [
      { label: "الوزن", value: "150g" },
      { label: "النوع", value: "عطرية" }
    ]
  },
  {
    id: "bracelet",
    name: "سوار ستانلس",
    sku: "BRC-220",
    stock: 18,
    price: 169,
    category: "اكسسوارات",
    images: ["assets/store/product-03.svg", "assets/store/product-04.svg"],
    description: "سوار بسيط مناسب للهدايا.",
    highlights: ["ستانلس", "شكل أنيق", "خفيف"],
    specs: [{ label: "الخامة", value: "ستانلس" }]
  },
  {
    id: "notebook",
    name: "دفتر ملاحظات",
    sku: "NTB-031",
    stock: 40,
    price: 149,
    category: "مستلزمات",
    images: ["assets/store/product-04.svg", "assets/store/product-05.svg"],
    description: "دفتر بأغلفة ناعمة. عدّل التفاصيل من ملف البيانات.",
    highlights: ["ورق نضيف", "غلاف شيك", "خفيف"],
    specs: [
      { label: "عدد الصفحات", value: "80" },
      { label: "المقاس", value: "A5" }
    ]
  },
  {
    id: "tshirt",
    name: "تيشيرت قطن",
    sku: "TSH-110",
    stock: 15,
    price: 349,
    category: "ملابس",
    images: ["assets/store/product-05.svg", "assets/store/product-06.svg"],
    description: "تيشيرت مريح للاستخدام اليومي.",
    highlights: ["قطن 100%", "مريح", "ستايل بسيط"],
    specs: [{ label: "الخامة", value: "قطن" }]
  },
  {
    id: "perfume",
    name: "عطر جيب",
    sku: "PRF-008",
    stock: 30,
    price: 199,
    compareAt: 240,
    category: "عناية",
    badge: "عرض",
    images: ["assets/store/product-06.svg", "assets/store/product-01.svg"],
    description: "حجم صغير وسهل الحمل.",
    highlights: ["حجم صغير", "مناسب للسفر", "سهل الاستخدام"],
    specs: [{ label: "الحجم", value: "30ml" }]
  },
  {
    id: "mug",
    name: "مج حراري",
    sku: "MUG-090",
    stock: 12,
    price: 279,
    category: "هدايا",
    images: ["assets/store/product-01.svg", "assets/store/product-03.svg"],
    description: "مج مناسب كهديّة.",
    highlights: ["شكل شيك", "مناسب للهدايا"],
    specs: [{ label: "السعة", value: "350ml" }]
  },
  {
    id: "keychain",
    name: "ميدالية مفاتيح",
    sku: "KEY-501",
    stock: 60,
    price: 99,
    category: "اكسسوارات",
    images: ["assets/store/product-02.svg", "assets/store/product-04.svg"],
    description: "ميدالية خفيفة وشكلها جميل.",
    highlights: ["خفيفة", "متينة", "شكل جميل"],
    specs: [{ label: "النوع", value: "ميدالية" }]
  }
];
