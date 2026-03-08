const ar = {
  // ==========================================
  // COMMON
  // ==========================================
  common: {
    currency: 'ل.س',
    appName: 'النظام الذكي',
    appSubtitle: '● الخاص بإدارة البيع و التوزيع ●',
    logout: 'تسجيل الخروج',
    cancel: 'إلغاء',
    close: 'إغلاق',
    save: 'حفظ',
    confirm: 'تأكيد',
    delete: 'حذف',
    edit: 'تعديل',
    add: 'إضافة',
    search: 'بحث',
    loading: 'جاري التحميل...',
    retry: 'إعادة المحاولة',
    back: 'رجوع',
    next: 'التالي',
    yes: 'نعم',
    no: 'لا',
    or: 'أو',
    all: 'الكل',
    none: 'بدون',
    noData: 'لا توجد بيانات',
    error: 'حدث خطأ',
    success: 'تم بنجاح',
    refresh: 'تحديث',
    copy: 'نسخ',
    copied: 'تم النسخ',
    piece: 'قطعة',
    product: 'منتج',
    customer: 'زبون',
    today: 'اليوم',
    date: 'التاريخ',
    amount: 'المبلغ',
    total: 'الإجمالي',
    remaining: 'المتبقي',
    paid: 'المدفوع',
    balance: 'الرصيد',
    name: 'الاسم',
    phone: 'الهاتف',
    location: 'الموقع',
    notes: 'ملاحظات',
    status: 'الحالة',
    active: 'نشط',
    inactive: 'معطّل',
    pending: 'معلق',
    completed: 'مكتمل',
    cash: 'نقداً',
    credit: 'آجل',
    local: 'محلي',
    savedLocally: 'محفوظة محلياً',
    syncPending: 'ستتم المزامنة عند عودة الإنترنت',
    offline: 'غير متصل بالإنترنت',
    operationsPendingSync: 'عملية بانتظار المزامنة',
    supportTeam: 'فريق الدعم',
    secureLogin: 'تسجيل دخول آمن ومشفر',
    secureEncrypted: 'اتصال آمن ومشفّر',
    details: 'التفاصيل',
    print: 'طباعة',
    filterByDate: 'فلترة بالتاريخ',
    filterOptions: 'خيارات الفلترة',
    showCancelled: 'إظهار الملغاة',
    operationCount: 'عدد العمليات',
    returnOperation: 'عملية إرجاع',
    noSupplier: 'بدون مورد',
    unspecified: 'غير محدد',
    cancelledReason: 'سبب الإلغاء',
    items: 'الأصناف',
  },

  // ==========================================
  // SETTINGS
  // ==========================================
  settings: {
    title: 'الإعدادات',
    language: 'اللغة',
    languageArabic: 'العربية',
    languageEnglish: 'English',
    languageSystem: 'لغة النظام',
    selectLanguage: 'اختر اللغة',
    privacyPolicy: 'سياسة الخصوصية',
    termsOfService: 'شروط الاستخدام',
    currentLanguage: 'اللغة الحالية',
  },

  // ==========================================
  // AUTH
  // ==========================================
  auth: {
    welcome: 'مرحباً بك',
    loginSubtitle: 'سجل دخولك بالبريد الإلكتروني وكلمة المرور',
    googleSignIn: 'تسجيل الدخول عبر Google',
    googleSigningIn: 'جارٍ تسجيل الدخول...',
    googleReturning: 'جارٍ العودة من Google...',
    googleSuccess: 'تم تسجيل الدخول ✓',
    guestLogin: 'دخول كزائر',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    confirmPassword: 'تأكيد كلمة المرور',
    login: 'تسجيل الدخول',
    signUp: 'إنشاء حساب جديد',
    forgotPassword: 'نسيت كلمة المرور؟',
    hasAccount: 'لديك حساب بالفعل؟ تسجيل الدخول',
    noAccount: 'ليس لديك حساب؟ إنشاء حساب جديد',
    resetPassword: 'استعادة كلمة المرور',
    resetPasswordDesc: 'أدخل بريدك الإلكتروني وسنرسل لك رابط الاستعادة',
    sendResetLink: 'إرسال رابط الاستعادة',
    resetLinkSent: 'تم إرسال رابط الاستعادة',
    resetLinkSentDesc: 'تم إرسال رابط استعادة كلمة المرور إلى',
    checkInbox: 'يرجى فتح بريدك الإلكتروني.',
    backToLogin: 'العودة لتسجيل الدخول',
    accountCreated: 'تم إنشاء الحساب بنجاح',
    accountCreatedDesc: 'يمكنك الآن تسجيل الدخول باستخدام بريدك الإلكتروني وكلمة المرور.',
    loginNow: 'تسجيل الدخول الآن',
    cancelAndLogout: 'إلغاء وتسجيل الخروج',
    takingLonger: 'يستغرق الأمر وقتاً أطول من المعتاد...',
    accessDenied: 'تم رفض الوصول',
    errorOccurred: 'حدث خطأ',
    enterEmail: 'يرجى إدخال البريد الإلكتروني',
    enterPassword: 'يرجى إدخال كلمة المرور',
    passwordMin6: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
    passwordsMismatch: 'كلمات المرور غير متطابقة',
    invalidCredentials: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
    emailNotConfirmed: 'يرجى تأكيد البريد الإلكتروني أولاً. تحقق من صندوق الوارد',
    emailAlreadyRegistered: 'هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول',
    invalidEmail: 'صيغة البريد الإلكتروني غير صحيحة',
    invalidPassword: 'يرجى إدخال كلمة مرور صالحة',
    rateLimited: 'محاولات كثيرة. يرجى الانتظار قليلاً',
    unexpectedError: 'حدث خطأ غير متوقع',
    googleAuthFailed: 'فشل تسجيل الدخول بجوجل. يرجى المحاولة مرة أخرى',
    emailNotFound: 'الإيميل غير موجود',
    verificationError: 'حدث خطأ أثناء التحقق',
    phaseReturning: 'جارٍ تسجيل الدخول...',
    phaseValidating: 'جارٍ التحقق من الترخيص...',
    phaseChecking: 'جارٍ التحقق من حالة الحساب...',
    verifyTimeout: 'استغرق التحقق وقتاً طويلاً. يرجى المحاولة مرة أخرى.',
    secure: 'آمن',
    accurate: 'دقيق',
    fast: 'سريع',
    enterEmailFirst: 'يرجى إدخال البريد الإلكتروني أولاً',
    profileCheckError: 'حدث خطأ في التحقق من الحساب',
  },

  // ==========================================
  // LICENSE ACTIVATION
  // ==========================================
  activation: {
    title: 'تفعيل الحساب',
    subtitle: 'أدخل كود التفعيل الخاص بك للبدء',
    activationCode: 'كود التفعيل',
    placeholder: 'XXXX-XXXX أو EMP-XXXX',
    orgCode: 'كود منشأة',
    orgCodeDesc: 'سيتم تفعيلك كمالك للمنشأة',
    empCode: 'كود موظف',
    empCodeDesc: 'سيتم تفعيلك كموظف في المنشأة',
    codeLabel: 'كود التفعيل',
    codeDesc: 'أدخل الكود للمتابعة',
    activateAccount: 'تفعيل الحساب',
    activating: 'جارٍ التفعيل...',
    enterCode: 'يرجى إدخال كود التفعيل',
    activationFailed: 'فشل في تفعيل الحساب',
    licenseFailed: 'فشل في تفعيل الترخيص',
    failed: 'فشل في التفعيل',
    payViaShamcash: 'الدفع عبر شام كاش',
    importantNote: 'ملاحظة هامة',
    paymentNote: 'الاشتراك لن يتم تفعيله تلقائياً. بعد الدفع، تواصل مع فريق الدعم لتأكيد الدفع يدوياً.',
    awaitingConfirmation: 'بانتظار تأكيد الدفع من الإدارة',
    paymentAddress: 'عنوان الدفع:',
    contactFinanceSupport: 'تواصل مع الدعم المالي (واتساب)',
    orgCodeFormat: 'كود المنشأة:',
    empCodeFormat: 'كود الموظف:',
  },

  // ==========================================
  // GUEST MODE
  // ==========================================
  guest: {
    previewMode: 'وضع المعاينة',
    selectRole: 'اختر الدور لاستعراض الواجهة',
    dashboardPreview: 'معاينة لوحة التحكم',
    readOnlyNote: 'وضع المعاينة للقراءة فقط — جميع العمليات معطّلة',
    exitPreview: 'خروج من المعاينة',
    likeSystem: 'أعجبك النظام؟',
    promoText: 'للحصول على الوصول الكامل، تواصل مع الشركة لحجز ترخيص تجريبي وجلسة شخصية لتحديد احتياجاتك.',
    contactWhatsapp: 'تواصل عبر واتساب',
    previewBanner: 'وضع المعاينة —',
  },

  // ==========================================
  // ROLES
  // ==========================================
  roles: {
    owner: 'المالك',
    salesManager: 'مدير المبيعات',
    accountant: 'المحاسب',
    warehouseKeeper: 'أمين المستودع',
    fieldAgent: 'الموزع الميداني',
    developer: 'المطور',
  },

  // ==========================================
  // OWNER DASHBOARD
  // ==========================================
  owner: {
    dashboard: 'لوحة الإدارة',
    tabs: {
      home: 'الرئيسية',
      team: 'الفريق',
      customers: 'الزبائن',
      finance: 'المالية',
      performance: 'الأداء',
      backup: 'النسخ الاحتياطي',
      subscription: 'الاشتراك',
      legal: 'القانونية',
    },
    todaySales: 'مبيعات اليوم',
    totalSales: 'إجمالي المبيعات',
    todayCollections: 'تحصيلات اليوم',
    addEmployee: 'إضافة موظف جديد',
    activationCodeCreated: 'تم إنشاء كود التفعيل',
    employeeActivationCode: 'كود تفعيل الموظف:',
    employeeName: 'اسم الموظف',
    employeePhone: 'رقم الهاتف',
    employeeType: 'نوع الموظف',
    generateCode: 'توليد كود التفعيل',
    copyCode: 'نسخ الكود',
    pendingCodes: 'أكواد تفعيل معلقة',
    activatedCodes: 'أكواد مفعّلة',
    activated: 'مفعّل ✓',
    activatedAt: 'تم التفعيل:',
    noEmployees: 'لا يوجد موظفين',
    deactivateEmployee: 'إيقاف الموظف',
    reactivateEmployee: 'إعادة التنشيط',
    deletionRequests: 'طلبات حذف الحسابات',
    salesManagerType: 'مدير مبيعات',
    accountantType: 'محاسب مالي',
    warehouseKeeperType: 'أمين مستودع',
    fieldAgentType: 'موزع ميداني',
    quickStats: 'نظرة سريعة',
    totalCustomers: 'العملاء',
    totalProducts: 'المنتجات',
    totalEmployees: 'الموظفين',
    cashLabel: 'نقدي',
    creditLabel: 'آجل',
  },

  // ==========================================
  // FINANCE TAB (Owner)
  // ==========================================
  finance: {
    weeklySales: 'مبيعات الأسبوع',
    collections: 'التحصيلات',
    totalDebts: 'إجمالي الذمم',
    returns: 'المرتجعات',
    discountAnalytics: 'تحليلات الخصومات',
    totalDiscounts: 'إجمالي الخصومات',
    cashDiscounts: 'خصومات نقدي',
    creditDiscounts: 'خصومات آجل',
    topDiscountCustomers: '🏆 أكثر الزبائن حصولاً على خصم',
    smartRecommendation: '💡 توصية ذكية',
    cashDiscountsHighInsight: 'الخصومات تتركز على المبيعات النقدية. فكر في تقليلها لتحسين هامش الربح.',
    creditDiscountsHighInsight: 'الخصومات على المبيعات الآجلة أعلى. راجع سياسة الخصم للبيع بالآجل.',
    customerHighDiscountWarning: ' ⚠️ الزبون "{{name}}" يحصل على أكثر من 30% من إجمالي الخصومات.',
    weeklyComparison: 'مقارنة أسبوعية',
    sales: 'المبيعات',
    invoiceCount: 'عدد الفواتير',
    systemSummary: 'ملخص النظام',
    weekInvoices: 'فواتير الأسبوع',
    collectionOps: 'عمليات تحصيل',
    debtCustomers: 'زبائن بذمم',
    lowStockProducts: 'منتجات منخفضة',
    topCustomersByVolume: 'أعلى الزبائن حجماً',
    thisWeek: 'هذا الأسبوع',
    lastWeek: 'السابق',
  },

  // ==========================================
  // ACCOUNTANT DASHBOARD
  // ==========================================
  accountant: {
    dashboard: 'لوحة المحاسب',
    subtitle: 'إدارة العمليات المالية',
    tabs: {
      sales: 'المبيعات',
      purchases: 'المشتريات',
      collections: 'التحصيلات',
      debts: 'الديون',
      reports: 'التقارير',
      salesReturns: 'مرتجع بيع',
      purchaseReturns: 'مرتجع شراء',
    },
    // Sales Invoices Tab
    searchByCustomer: 'بحث بالعميل...',
    statusAll: 'الكل',
    statusPaid: 'مدفوعة',
    statusPartial: 'جزئي',
    statusCredit: 'آجل',
    statusVoided: 'ملغاة',
    totalLabel: 'الإجمالي',
    collectedLabel: 'المحصّل',
    remainingLabel: 'المتبقي',
    paidLabel: 'المدفوع',
    invoiceDetails: 'تفاصيل الفاتورة',
    printInvoice: 'طباعة الفاتورة',
    customerLabel: 'العميل',
    dateLabel: 'التاريخ',
    subtotalBeforeDiscount: 'المجموع قبل الخصم',
    discountLabel: 'الخصم',
    voidedInvoice: 'فاتورة ملغاة',
    noInvoices: 'لا توجد فواتير',
    // Purchases Tab
    searchByProductOrSupplier: 'بحث بالمنتج أو المورد...',
    totalPurchases: 'إجمالي المشتريات',
    noPurchases: 'لا توجد مشتريات',
    // Collections Tab
    totalCollections: 'إجمالي التحصيلات',
    noCollections: 'لا توجد تحصيلات',
    cancelled: 'ملغى',
    done: 'تم',
    // Sales Returns Tab
    searchByCustomerReturns: 'بحث بالعميل...',
    totalSalesReturns: 'إجمالي مرتجعات المبيعات',
    noSalesReturns: 'لا توجد مرتجعات مبيعات',
    // Purchase Returns Tab
    searchBySupplier: 'بحث بالمورد...',
    totalPurchaseReturns: 'إجمالي مرتجعات المشتريات',
    noPurchaseReturns: 'لا توجد مرتجعات مشتريات',
    // Debts Tab
    totalCustomerDebts: 'إجمالي ديون العملاء',
    customersWithDebts: 'عميل لديهم ديون مستحقة',
    searchCustomer: 'بحث عن عميل...',
    sortByDebt: 'الأعلى ديناً',
    sortByName: 'الاسم',
    noDebts: 'لا يوجد عملاء بديون مستحقة',
  },

  // ==========================================
  // REPORTS TAB
  // ==========================================
  reports: {
    netSales: 'صافي المبيعات',
    netPurchases: 'صافي المشتريات',
    totalDiscounts: 'إجمالي الخصومات',
    revenueImpact: 'التأثير على الإيرادات',
    profitLoss: 'الربح / الخسارة',
    salesCost: 'تكلفة المبيعات',
    inventoryValue: 'قيمة المخزون',
    purchases: 'المشتريات',
    collections: 'التحصيلات',
    debts: 'الديون',
    currentInventoryValue: 'قيمة المخزون الحالي',
    mainWarehouse: 'المخزن الرئيسي',
    distributorWarehouses: 'مخازن الموزعين',
    financialSummary: 'ملخص الحركة المالية',
    totalSales: 'إجمالي المبيعات',
    salesCostLabel: 'تكلفة المبيعات',
    salesReturns: 'مرتجعات المبيعات',
    totalPurchases: 'إجمالي المشتريات',
    purchaseReturns: 'مرتجعات المشتريات',
  },

  // ==========================================
  // SALES MANAGER DASHBOARD
  // ==========================================
  salesManager: {
    dashboard: 'إدارة المبيعات',
    tabs: {
      home: 'الرئيسية',
      team: 'الفريق',
      kpi: 'الأداء',
      sales: 'المبيعات',
    },
    todaySalesTotal: 'إجمالي المبيعات اليوم',
    invoiceCount: 'عدد الفواتير',
    recentSales: 'آخر المبيعات',
    addEmployee: 'إضافة موظف',
    addEmployeeFailed: 'فشل إنشاء الموظف. تحقق من عدم تجاوز الحد الأقصى للموظفين النشطين.',
    discountAnalytics: 'تحليلات الخصومات',
    totalDiscounts: 'إجمالي الخصومات',
    avgDiscountPct: 'متوسط نسبة الخصم',
    cashDiscounts: 'خصومات نقدي',
    creditDiscounts: 'خصومات آجل',
    cashDiscountsHigher: 'الخصومات أعلى في المبيعات النقدية',
    creditDiscountsHigher: 'الخصومات أعلى في المبيعات الآجلة',
    teamStats: 'إحصائيات الفريق',
    distributors: 'الموزعين',
    warehouseKeepers: 'أمناء المستودع',
    customerStats: 'إحصائيات الزبائن',
    debtors: 'ذمم مدينة',
    discount: 'خصم',
  },

  // ==========================================
  // WAREHOUSE DASHBOARD
  // ==========================================
  warehouse: {
    dashboard: 'إدارة المخزون',
    tabs: {
      home: 'الرئيسية',
      inventory: 'المخزون',
      prices: 'الأسعار',
      deliveries: 'التسليم',
      movements: 'الحركات',
      purchases: 'المشتريات',
      returns: 'المرتجعات',
    },
    totalProducts: 'إجمالي المنتجات',
    totalStock: 'إجمالي المخزون',
    todayActivity: 'نشاط اليوم',
    todayDeliveries: 'تسليمات اليوم',
    todayPurchases: 'مشتريات اليوم',
    lowStockProducts: 'منتجات قاربت على النفاد',
    recentDeliveries: 'آخر التسليمات',
    noDeliveries: 'لا توجد تسليمات',
    searchProduct: 'بحث عن منتج...',
    editPrices: 'تعديل أسعار:',
    costPrice: 'سعر التكلفة',
    salePrice: 'سعر البيع',
    consumerPrice: 'سعر المستهلك',
    savePrices: 'حفظ الأسعار',
    cost: 'التكلفة',
    sale: 'البيع',
    consumer: 'المستهلك',
    unit: 'وحدة',
  },

  // ==========================================
  // DISTRIBUTOR DASHBOARD
  // ==========================================
  distributor: {
    dashboard: 'لوحة الموزع',
    subtitle: 'إدارة المبيعات الميدانية',
    tabs: {
      inventory: 'مخزني',
      newSale: 'فاتورة',
      collections: 'تحصيل',
      customers: 'الزبائن',
      history: 'السجل',
      returns: 'مرتجع بيع',
    },
    selectedCustomer: 'الزبون المحدد للعمليات',
    selectCustomer: 'اختر زبون من القائمة',
    cancelSelection: 'إلغاء',
    chooseCustomer: 'اختر الزبون',
    addNewCustomer: 'إضافة زبون جديد',
    searchCustomer: 'بحث...',
    noCustomers: 'لا يوجد زبائن',
    addCustomerToStart: 'قم بإضافة زبون جديد للبدء',
    customerName: 'اسم الزبون',
    customerPhone: 'رقم الهاتف',
    customerLocation: 'موقع الزبون',
    addCustomer: 'إضافة الزبون',
    adding: 'جاري الإضافة...',
    enterCustomerName: 'يرجى إدخال اسم الزبون',
    enterCustomerPhone: 'يرجى إدخال رقم الهاتف',
    invalidPhone: 'رقم الهاتف غير صالح',
    enterCustomerLocation: 'يرجى إدخال موقع الزبون',
    customerAdded: 'تم إضافة الزبون بنجاح',
    customerAddedOffline: 'تم حفظ الزبون محلياً — ستتم المزامنة عند عودة الإنترنت',
    customerAddFailed: 'فشل إضافة الزبون',
  },

  // ==========================================
  // OFFLINE SYNC
  // ==========================================
  offlineSync: {
    offlineMode: 'وضع عدم الاتصال — العمليات محفوظة محلياً',
    syncing: 'جارٍ المزامنة...',
    failedOps: '{{count}} عملية فشلت في المزامنة',
    pendingOps: '{{count}} عملية بانتظار المزامنة',
    autoSync: 'ستتم المزامنة تلقائياً',
    syncOnReconnect: 'ستتم المزامنة عند عودة الإنترنت',
    retryAll: 'إعادة المحاولة',
    syncNow: 'مزامنة الآن',
    operationsLog: 'سجل العمليات',
    saleInvoice: 'فاتورة بيع',
    collection: 'تحصيل',
    returnOp: 'مرتجع',
    warehouseTransfer: 'نقل مستودع',
    addCustomerOp: 'إضافة زبون',
    statusDone: 'تمت',
    statusFailed: 'فشلت',
    statusSyncing: 'مزامنة',
    statusPending: 'بانتظار',
    retry: 'إعادة المحاولة',
  },

  // ==========================================
  // INVOICE / SALE
  // ==========================================
  invoice: {
    requiredItems: 'الأصناف المطلوبة',
    addItem: 'إضافة مادة',
    emptyCart: 'السلة فارغة',
    paymentType: 'نوع الدفع',
    cashPayment: '💵 نقداً',
    creditPayment: '📝 آجل',
    discount: 'الخصم (اختياري)',
    noDiscount: 'بدون',
    percentageDiscount: 'نسبة',
    fixedDiscount: 'مبلغ',
    discountPercentPlaceholder: 'نسبة الخصم %',
    discountFixedPlaceholder: 'قيمة الخصم',
    subtotal: 'المجموع قبل الخصم',
    discountAmount: 'الخصم',
    netTotal: 'الإجمالي الصافي',
    confirmInvoice: 'تأكيد الفاتورة',
    saving: 'جارٍ الحفظ...',
    invoiceCreated: 'تم إنشاء الفاتورة بنجاح',
    invoiceCreatedOffline: 'تم حفظ الفاتورة — ستتم المزامنة عند عودة الإنترنت',
    invoiceError: 'حدث خطأ أثناء حفظ الفاتورة',
    selectCustomerFirst: 'يرجى اختيار زبون من القائمة أعلاه',
    chooseItem: 'اختر المادة',
    invoiceHistory: 'سجل الفواتير',
    searchInvoice: 'بحث بالعميل أو رقم الفاتورة...',
    noInvoices: 'لا توجد فواتير',
    invoicesAppearHere: 'سيظهر هنا سجل فواتيرك عند إنشائها',
    loadingHistory: 'جارٍ تحميل السجل...',
    sale: 'بيع',
    return: 'مرتجع',
    collection: 'قبض',
    document: 'مستند',
    sales: 'مبيعات',
    returns: 'مرتجعات',
    collections: 'تحصيلات',
    invoiceCreatedSuccess: 'تم إنشاء الفاتورة بنجاح!',
  },

  // ==========================================
  // COLLECTION
  // ==========================================
  collectionTab: {
    enterAmount: 'إدخال مبلغ التحصيل',
    documentReceipt: 'توثيق سند القبض',
    collecting: 'جارٍ التحصيل...',
    selectInvoice: 'اختر الفاتورة:',
    searchCustomer: 'بحث بالعميل...',
    noUnpaidInvoices: 'لا توجد فواتير مستحقة',
    collectionSuccess: 'تم التحصيل بنجاح!',
    collectedSuccess: 'تم التحصيل بنجاح',
    collectedOffline: 'تم حفظ التحصيل — ستتم المزامنة عند عودة الإنترنت',
    enterValidAmount: 'يرجى إدخال مبلغ صحيح',
    amountExceedsRemaining: 'المبلغ أكبر من المتبقي',
    collectionError: 'حدث خطأ أثناء التحصيل',
    totalAmount: 'الإجمالي',
  },

  // ==========================================
  // DEBTS
  // ==========================================
  debts: {
    totalFieldDebts: 'إجمالي الذمم الميدانية:',
    customersWithDebts: 'زبون لديهم ذمم',
    searchCustomer: 'بحث عن زبون...',
    noDebts: 'لا يوجد زبائن بذمم مستحقة',
    unpaidInvoices: 'الفواتير المستحقة',
    clickToRefresh: 'انقر للتحديث',
    from: 'من',
  },

  // ==========================================
  // RETURNS
  // ==========================================
  returns: {
    invoice: 'الفاتورة',
    selectInvoice: 'اختر فاتورة',
    clickToSelectInvoice: 'اضغط لاختيار فاتورة للإرجاع',
    returnedItems: 'الأصناف المرتجعة',
    addItem: 'إضافة مادة',
    noItemsAdded: 'لم تتم إضافة أصناف للمرتجع',
    clickAddItem: 'اضغط "إضافة مادة" لاختيار الأصناف',
    returnReason: 'سبب الإرجاع (اختياري)',
    returnReasonPlaceholder: 'أدخل سبب الإرجاع...',
    confirmReturn: 'تأكيد المرتجع',
    processing: 'جارٍ الحفظ...',
    returnCreated: 'تم إنشاء المرتجع بنجاح',
    returnCreatedOffline: 'تم حفظ المرتجع — ستتم المزامنة عند عودة الإنترنت',
    returnCreatedSuccess: 'تم إنشاء المرتجع بنجاح!',
    returnError: 'حدث خطأ أثناء إنشاء المرتجع',
    maxQuantity: 'الحد الأقصى:',
    chooseProduct: 'اختر المادة للإرجاع',
  },

  // ==========================================
  // INVENTORY
  // ==========================================
  inventory: {
    myInventory: 'مخزني',
    items: 'صنف',
    pieces: 'قطعة',
    returnToWarehouse: 'إرجاع مواد إلى المستودع الرئيسي',
    confirmReturnToWarehouse: 'تأكيد الإرجاع للمستودع الرئيسي',
    returnWarning: 'سيتم نقل المواد التالية من مخزنك إلى المستودع الرئيسي. هذه العملية لا يمكن التراجع عنها.',
    totalPieces: 'إجمالي القطع',
    confirmReturnBtn: 'تأكيد الإرجاع',
    transferring: 'جارٍ التحويل...',
    returnSuccess: 'تم إرجاع المواد إلى المستودع الرئيسي بنجاح',
    returnSuccessOffline: 'تم حفظ العملية — ستتم المزامنة عند عودة الإنترنت',
    noItems: 'لا توجد مواد في مخزنك',
    noItemsDesc: 'سيتم إضافة المواد تلقائياً عند استلامها من صاحب المنشأة',
  },

  // ==========================================
  // LICENSE / SUBSCRIPTION
  // ==========================================
  license: {
    expired: 'انتهى اشتراكك',
    suspended: 'الاشتراك موقوف مؤقتاً',
    expiredMessage: 'لقد انتهت مدة اشتراكك في النظام. يرجى التواصل مع المطور لتجديد الاشتراك.',
    suspendedMessage: 'يرجى التواصل مع المطور لتسوية المستحقات وإعادة تفعيل الاشتراك.',
    autoCheck: 'سيتم التحقق تلقائياً من حالة الترخيص كل 30 ثانية',
    checkLicense: 'تحقق من حالة الترخيص',
    checking: 'جارٍ التحقق...',
    welcomeBack: 'مرحباً بعودتك! 🎉',
    reactivated: 'تم إعادة تفعيل حسابك بنجاح. شكراً لثقتك.',
    contactWhatsapp: 'تواصل عبر واتساب',
    callFinance: 'اتصل بالإدارة المالية',
  },

  // ==========================================
  // ACCOUNT STATUS
  // ==========================================
  accountStatus: {
    suspended: 'الحساب معلّق',
    suspendedMessage: 'تم تعليق حسابك أو منشأتك. تواصل مع المسؤول لمعرفة التفاصيل.',
    profileSuspended: 'تم تعطيل حسابك. تواصل مع مديرك لإعادة التفعيل.',
    licenseSuspended: 'تم تعليق ترخيص المنشأة. تواصل مع المطور.',
    licenseExpired: 'انتهت صلاحية ترخيص المنشأة. تواصل مع المطور.',
    recheck: 'إعادة التحقق',
    recheckChecking: 'جارٍ التحقق...',
    noInternet: 'غير متصل بالإنترنت',
    recheckNote: 'إذا تم إعادة تفعيل حسابك، اضغط "إعادة التحقق" للاستمرار.',
  },

  // ==========================================
  // CONSENT
  // ==========================================
  consent: {
    welcomeTitle: 'مرحباً بك في Smart System',
    welcomeDesc: 'قبل المتابعة، يرجى مراجعة والموافقة على سياسة الخصوصية وشروط الاستخدام',
    privacyTitle: 'سياسة الخصوصية',
    privacyDesc: 'كيف نجمع ونحمي بياناتك',
    termsTitle: 'شروط الاستخدام',
    termsDesc: 'قواعد وأحكام استخدام التطبيق',
    agreeText: 'قرأت وأوافق على',
    agreePrivacy: 'سياسة الخصوصية',
    agreeTerms: 'شروط الاستخدام',
    agreeAnd: 'و',
    savingConsent: 'جاري الحفظ...',
    agreeAndContinue: 'موافق ومتابعة',
  },

  // ==========================================
  // UPDATE MODAL
  // ==========================================
  update: {
    forceRequired: 'تحديث إجباري مطلوب',
    forceMessage: 'يجب تحديث التطبيق للمتابعة. الإصدار الحالي',
    notSupported: 'لم يعد مدعوماً.',
    newVersion: 'الإصدار الجديد:',
    updateNow: 'تحديث الآن',
    newUpdateAvailable: 'تحديث جديد متاح',
    versionAvailable: 'متاح للتحميل',
    update: 'تحديث',
    later: 'لاحقاً',
  },

  // ==========================================
  // LOGOUT
  // ==========================================
  logoutScreen: {
    thankYou: 'نشكرك لثقتك بنا 🤍',
    seeYouSoon: 'نتطلع لرؤيتك قريباً',
  },

  // ==========================================
  // WELCOME SPLASH
  // ==========================================
  welcomeSplash: {
    msg1: 'أهلاً بك! حسابك آمن معنا',
    msg2: 'بياناتك محمية بالكامل',
    msg3: 'تجربة موثوقة ومريحة بانتظارك',
    preparing: 'جارٍ تحضير تجربتك...',
  },

  // ==========================================
  // ACCOUNT DELETION
  // ==========================================
  deletion: {
    requestDeletion: 'طلب حذف الحساب',
    pendingReview: 'طلب حذف حسابك قيد المراجعة',
    rejected: 'تم رفض طلب حذف حسابك',
    rejectedReason: 'السبب:',
    submitNew: 'تقديم طلب جديد',
    title: 'طلب حذف الحساب',
    description: 'سيتم إرسال طلب حذف حسابك إلى المسؤول المباشر للمراجعة والموافقة. لا يتم الحذف مباشرة.',
    reasonLabel: 'سبب الحذف (اختياري)',
    reasonPlaceholder: 'اكتب سبب طلب حذف حسابك...',
    submitting: 'جاري الإرسال...',
    submitRequest: 'تقديم طلب الحذف',
  },

  // ==========================================
  // ORG DELETION
  // ==========================================
  orgDeletion: {
    title: 'طلب حذف المنشأة',
    pendingTitle: 'طلب حذف المنشأة',
    pendingDate: 'تم تقديم طلب حذف المنشأة بتاريخ',
    pendingStatus: 'الحالة: قيد المراجعة من قبل فريق الدعم',
    reason: 'السبب:',
    approvedNote: 'تمت الموافقة على طلبك. سيتم تنفيذ الحذف قريباً.',
    requestButton: 'طلب حذف المنشأة',
    confirmTitle: 'طلب حذف المنشأة',
    confirmDesc: 'سيتم حذف منشأتك',
    confirmDescEnd: 'نهائياً مع جميع البيانات والسجلات.',
    irreversible: '⚠️ لا يمكن التراجع عن هذا الإجراء بعد الموافقة والتنفيذ.',
    reasonLabel: 'سبب الحذف (اختياري)',
    reasonPlaceholder: 'لماذا تريد حذف المنشأة؟',
    typeOrgName: 'اكتب اسم المنشأة',
    typeOrgNameConfirm: 'للتأكيد *',
    confirmButton: 'تأكيد طلب الحذف',
    submittingButton: 'جاري الإرسال...',
    errorPrefix: 'خطأ: ',
  },

  // ==========================================
  // BACKUP
  // ==========================================
  backup: {
    title: 'النسخ الاحتياطي وتصدير البيانات',
    generateBackup: 'توليد نسخة احتياطية كاملة',
    exportPdf: 'تصدير PDF',
    exportExcel: 'تصدير Excel',
    customers: 'الزبائن',
    invoices: 'الفواتير',
    collections: 'التحصيلات',
    activityLog: 'سجل النشاط',
  },

  // ==========================================
  // NOTIFICATIONS
  // ==========================================
  notifications: {
    title: 'مركز التنبيهات',
    noNotifications: 'لا توجد تنبيهات',
    markRead: 'قراءة الكل',
    outOfStock: 'نفاد المخزون',
    lowStock: 'مخزون منخفض',
    dueInvoice: 'فاتورة مستحقة',
    outOfStockDesc: 'نفد من المخزون',
    lowStockDesc: 'متبقي',
    now: 'الآن',
    minutesAgo: 'منذ {{count}} دقيقة',
    hoursAgo: 'منذ {{count}} ساعة',
    daysAgo: 'منذ {{count}} يوم',
    outLabel: 'نفاد',
    lowLabel: 'منخفض',
    dueLabel: 'مستحق',
  },

  // ==========================================
  // STOCK MOVEMENTS
  // ==========================================
  stockMovements: {
    transfer: 'تحويل',
    sale: 'بيع',
    return: 'مرتجع مبيعات',
    purchase: 'شراء',
    adjustment: 'تعديل',
    delivery: 'تسليم',
    all: 'الكل',
    noMovements: 'لا توجد حركات مخزنية',
    fromCentral: 'المستودع الرئيسي',
    fromDistributor: 'مخزن الموزع',
    toCustomer: 'العميل',
    by: 'بواسطة:',
  },
};

export default ar;
