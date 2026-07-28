'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Locale = 'en' | 'zh-CN' | 'ru' | 'my';

const LOCALE_KEY = 'hair-expo-locale';

const en = {
  language: 'Language',
  english: 'English',
  chinese: '中文',
  russian: 'Русский',
  burmese: 'မြန်မာ',
  boothCheckout: 'Booth checkout',
  projectGuide: 'Project guide',
  projectGuideHint: 'Read the project walkthrough and payment-safety notes.',
  openGuide: 'View guide',
  checkingSession: 'Checking booth session…',
  enterPasscode: 'Enter booth passcode',
  expoTeamOnly: 'This tool is for the expo team.',
  passcode: 'Passcode',
  unlock: 'Unlock',
  online: 'Online',
  offlineCartSaved: 'Offline — cart saved',
  orders: 'Orders',
  buildOrder: 'Build an order in seconds',
  catalog: 'Catalog',
  catalogHint: 'Search by SKU, line, product type, or length.',
  productsCount: '{{count}} products',
  searchCatalog: 'Search SKU or product…',
  standard: 'standard',
  weightNotSupplied: 'weight not supplied',
  addNormal: 'Add normal',
  addBlonde: 'Add blonde +30%',
  cart: 'Cart ({{count}})',
  cartJump: 'Cart',
  reorderCartHint: 'Reorder loaded — tap Cart to review.',
  backendAuthoritative: 'Backend prices are authoritative.',
  newOrder: 'New order',
  paymentLinkCreated: 'Payment link created. Start a new order to change this cart.',
  addProduct: 'Add a product to begin.',
  normal: 'Normal',
  blonde: 'Blonde +30%',
  remove: 'Remove',
  expoDiscount: 'Expo discount (10%)',
  customer: 'Customer',
  clearCustomer: 'Clear',
  name: 'Name',
  phoneContact: 'Phone / WeChat / email',
  optional: 'Optional',
  previewBackendPrice: 'Preview backend price',
  createPaymentLink: 'Create Payment Link',
  creating: 'Creating…',
  paidStartNewOrder: 'Paid — Start new order',
  retryPaymentLink: 'Retry payment link',
  weight: 'Weight',
  subtotal: 'Subtotal',
  total: 'Total',
  discount: 'Discount',
  usdTotal: 'USD total',
  cnyReference: 'CNY reference',
  openStripeCheckout: 'Open Stripe Checkout',
  refreshPaymentStatus: 'Refresh payment status',
  statusConfirmedWebhook: 'Status is confirmed by the backend webhook.',
  loadingOrders: 'Loading orders…',
  noMatchingOrders: 'No matching orders.',
  paidOrdersDefault: 'Paid orders are shown by default.',
  paidOnly: 'Paid only',
  allOrders: 'All orders',
  reload: 'Reload',
  close: 'Close',
  soldOrders: 'Sold orders',
  paidTotal: 'Paid total: {{amount}}',
  walkIn: 'Walk-in',
  refreshStatus: 'Refresh status',
  printPdf: 'Print / PDF',
  backToCheckout: 'Back to checkout',
  payment: 'Payment',
  paid: 'Paid',
  pending: 'Pending',
  reviewRequired: 'Review required',
  volumeDiscount: 'Volume discount',
  orderStatus: 'Order status',
  loadingOrderStatus: 'Loading order status…',
  paymentConfirmed: 'Payment confirmed',
  paymentPending: 'Payment pending',
  statusPolling: 'This page checks the backend every few seconds for the Stripe webhook update.',
  viewOrders: 'View orders',
  invoiceReceipt: 'Invoice / receipt',
  generated: 'Generated {{date}}',
  customerDetailsUnavailable: 'Order details are unavailable.',
  invoiceCustomer: 'Customer',
  invoiceItems: 'Items',
  invoiceProduct: 'Product',
  invoiceQuantity: 'Qty',
  invoiceAmount: 'Amount',
  invoiceSurcharge: 'Surcharge',
  invoiceTotal: 'Total: {{amount}}',
  errorInvalidPasscode: 'The passcode is incorrect.',
  errorNotFound: 'The requested record was not found.',
  errorConflict: 'This checkout is already being processed. Please refresh its status.',
  errorProvider: 'The payment provider did not complete the request. Please retry safely.',
  errorPopup: 'Allow pop-ups to print the invoice.',
  errorQuantityLimit: 'The order exceeds the current checkout limit. Please contact the booth team.',
  status: 'Status',
  pendingOnly: 'Pending only',
  fromDate: 'From date',
  toDate: 'To date',
  clearDates: 'Clear dates',
  viewOrder: 'View order',
  items: 'Items',
  paymentLink: 'Payment link',
  paymentLinkExpiresIn: 'Payment link expires in {{time}}',
  paymentLinkExpired: 'Payment QR expired',
  paymentLinkExpiredHint: 'This unpaid payment link is no longer available. Create a new order to issue a fresh link.',
  paymentLinkUnavailable: 'Payment link unavailable',
  createNewOrderFromThis: 'Create new order from this',
  reorder: 'Reorder',
  searchCustomer: 'Search customer name',
  creatingOrder: 'Creating order…',
  errorDateRange: 'Choose a valid date range.',
  errorGeneric: 'Something went wrong. Please try again.',
} as const;

export type MessageKey = keyof typeof en;
type MessageSet = Partial<Record<MessageKey, string>>;

const orderFlowTranslations: Record<Exclude<Locale, 'en'>, MessageSet> = {
  'zh-CN': {
    status: '\u72b6\u6001', pendingOnly: '\u4ec5\u5f85\u4ed8', fromDate: '\u5f00\u59cb\u65e5\u671f', toDate: '\u7ed3\u675f\u65e5\u671f', clearDates: '\u6e05\u9664\u65e5\u671f', viewOrder: '\u67e5\u770b\u8ba2\u5355', items: '\u5546\u54c1', paymentLink: '\u652f\u4ed8\u94fe\u63a5', paymentLinkExpired: '\u652f\u4ed8\u4e8c\u7ef4\u7801\u5df2\u8fc7\u671f', paymentLinkExpiredHint: '\u6b64\u672a\u652f\u4ed8\u652f\u4ed8\u94fe\u63a5\u5df2\u5931\u6548\u3002\u8bf7\u57fa\u4e8e\u6b64\u8ba2\u5355\u521b\u5efa\u65b0\u8ba2\u5355\u3002', paymentLinkUnavailable: '\u652f\u4ed8\u94fe\u63a5\u4e0d\u53ef\u7528', createNewOrderFromThis: '\u57fa\u4e8e\u6b64\u8ba2\u5355\u521b\u5efa\u65b0\u8ba2\u5355', reorder: '\u518d\u6b21\u4e0b\u5355', searchCustomer: '\u641c\u7d22\u5ba2\u6237\u59d3\u540d', creatingOrder: '\u6b63\u5728\u521b\u5efa\u8ba2\u5355\u2026', errorDateRange: '\u8bf7\u9009\u62e9\u6709\u6548\u7684\u65e5\u671f\u8303\u56f4\u3002',
  },
  ru: {
    status: 'Статус', pendingOnly: 'Только ожидающие', fromDate: 'Дата от', toDate: 'Дата до', clearDates: 'Очистить даты', viewOrder: 'Открыть заказ', items: 'Товары', paymentLink: 'Ссылка на оплату', paymentLinkExpired: 'QR-код оплаты истёк', paymentLinkExpiredHint: 'Эта неоплаченная ссылка больше недоступна. Создайте новый заказ для новой ссылки.', paymentLinkUnavailable: 'Ссылка на оплату недоступна', createNewOrderFromThis: 'Создать новый заказ из этого', reorder: 'Повторить заказ', searchCustomer: 'Поиск по имени клиента', creatingOrder: 'Создание заказа…', errorDateRange: 'Выберите корректный диапазон дат.',
  },
  my: {
    status: 'Status', pendingOnly: 'Pending only', fromDate: 'From date', toDate: 'To date', clearDates: 'Clear dates', viewOrder: 'View order', items: 'Items', paymentLink: 'Payment link', paymentLinkExpired: 'Payment QR expired', paymentLinkExpiredHint: 'This unpaid payment link is no longer available. Create a new order to issue a fresh link.', paymentLinkUnavailable: 'Payment link unavailable', createNewOrderFromThis: 'Create new order from this', reorder: 'Reorder', searchCustomer: 'Search customer name', creatingOrder: 'Creating order…', errorDateRange: 'Choose a valid date range.',
  },
};

const myCartVocabulary = {
  reorderCartHint: 'Reorder loaded — tap Cart to review.',
  offlineCartSaved: 'အော့ဖ်လိုင်း — ဈေးခြင်းကို သိမ်းဆည်းထားသည်',
  cart: 'ဈေးခြင်း ({{count}})',
  paymentLinkCreated: 'ငွေပေးချေမှုလင့်ခ် ဖန်တီးပြီးပါပြီ။ ဤဈေးခြင်းကို ပြောင်းလဲရန် အော်ဒါအသစ် စတင်ပါ။',
} as const;

const messages: Record<Locale, MessageSet> = {
  en,
  'zh-CN': {
    ...orderFlowTranslations['zh-CN'],
    paymentLinkExpiresIn: '\u652f\u4ed8\u94fe\u63a5\u5c06\u5728 {{time}} \u540e\u8fc7\u671f',
    cartJump: '购物车',
    reorderCartHint: '重新下单内容已加载 — 点击“购物车”查看。',
    projectGuide: '项目指南',
    projectGuideHint: '查看项目流程和支付安全说明。',
    openGuide: '查看指南',
    burmese: 'မြန်မာ',
    invoiceSurcharge: '附加费',
    errorQuantityLimit: '订单超过当前结账数量限制，请联系展会工作人员。',
    language: '语言', english: 'English', chinese: '中文', russian: 'Русский', boothCheckout: '展会结账', checkingSession: '正在检查展会会话…', enterPasscode: '输入展会密码', expoTeamOnly: '此工具供展会工作人员使用。', passcode: '密码', unlock: '解锁', online: '在线', offlineCartSaved: '离线 — 购物车已保存', orders: '订单', buildOrder: '快速创建订单', catalog: '商品目录', catalogHint: '按 SKU、系列、产品类型或长度搜索。', productsCount: '{{count}} 个产品', searchCatalog: '搜索 SKU 或产品…', standard: '标准', weightNotSupplied: '未提供重量', addNormal: '添加普通款', addBlonde: '添加金发款 +30%', cart: '购物车（{{count}}）', backendAuthoritative: '最终价格以后台为准。', newOrder: '新订单', paymentLinkCreated: '支付链接已创建。如需修改购物车，请开始新订单。', addProduct: '请添加产品。', normal: '普通款', blonde: '金发款 +30%', remove: '删除', expoDiscount: '展会折扣（10%）', customer: '客户', clearCustomer: '清除', name: '姓名', phoneContact: '电话 / 微信 / 邮箱', optional: '可选', previewBackendPrice: '预览后台价格', createPaymentLink: '创建支付链接', creating: '创建中…', paidStartNewOrder: '已支付 — 开始新订单', retryPaymentLink: '重试支付链接', weight: '重量', subtotal: '小计', total: '总计', discount: '折扣', usdTotal: '美元总计', cnyReference: '人民币参考价', openStripeCheckout: '打开 Stripe 结账页', refreshPaymentStatus: '刷新支付状态', statusConfirmedWebhook: '支付状态由后台 webhook 确认。', loadingOrders: '正在加载订单…', noMatchingOrders: '没有匹配的订单。', paidOrdersDefault: '默认显示已支付订单。', paidOnly: '仅已支付', allOrders: '全部订单', reload: '重新加载', close: '关闭', soldOrders: '已售订单', paidTotal: '已支付总额：{{amount}}', walkIn: '散客', refreshStatus: '刷新状态', printPdf: '打印 / PDF', backToCheckout: '返回结账', payment: '支付', paid: '已支付', pending: '待支付', reviewRequired: '需要复核', volumeDiscount: '批量折扣', orderStatus: '订单状态', loadingOrderStatus: '正在加载订单状态…', paymentConfirmed: '支付已确认', paymentPending: '等待支付', statusPolling: '此页面每隔几秒检查后台 webhook 更新。', viewOrders: '查看订单', invoiceReceipt: '发票 / 收据', generated: '生成时间：{{date}}', customerDetailsUnavailable: '订单详情不可用。', invoiceCustomer: '客户', invoiceItems: '商品', invoiceProduct: '产品', invoiceQuantity: '数量', invoiceAmount: '金额', invoiceTotal: '总计：{{amount}}', errorInvalidPasscode: '密码不正确。', errorNotFound: '找不到请求的记录。', errorConflict: '此结账正在处理中。请刷新状态。', errorProvider: '支付服务未完成请求。可以安全重试。', errorPopup: '请允许弹出窗口以打印发票。', errorGeneric: '发生错误，请重试。',
  },
  ru: {
    ...orderFlowTranslations.ru,
    paymentLinkExpiresIn: '\u0421\u0441\u044b\u043b\u043a\u0430 \u043d\u0430 \u043e\u043f\u043b\u0430\u0442\u0443 \u0438\u0441\u0442\u0435\u043a\u0430\u0435\u0442 \u0447\u0435\u0440\u0435\u0437 {{time}}',
    cartJump: 'Корзина',
    reorderCartHint: 'Повторный заказ загружен — нажмите «Корзина», чтобы проверить.',
    projectGuide: 'Руководство проекта',
    projectGuideHint: 'Ознакомьтесь с процессом и мерами безопасности платежей.',
    openGuide: 'Открыть руководство',
    burmese: 'မြန်မာ',
    invoiceSurcharge: 'Доплата',
    errorQuantityLimit: 'Заказ превышает текущий лимит оформления. Обратитесь к сотруднику стенда.',
    language: 'Язык', english: 'English', chinese: '中文', russian: 'Русский', boothCheckout: 'Оплата на стенде', checkingSession: 'Проверка сессии стенда…', enterPasscode: 'Введите пароль стенда', expoTeamOnly: 'Инструмент предназначен для команды выставки.', passcode: 'Пароль', unlock: 'Войти', online: 'Онлайн', offlineCartSaved: 'Офлайн — корзина сохранена', orders: 'Заказы', buildOrder: 'Создайте заказ за несколько секунд', catalog: 'Каталог', catalogHint: 'Поиск по SKU, линии, типу товара или длине.', productsCount: '{{count}} товаров', searchCatalog: 'Поиск SKU или товара…', standard: 'обычный', weightNotSupplied: 'вес не указан', addNormal: 'Добавить обычный', addBlonde: 'Добавить блонд +30%', cart: 'Корзина ({{count}})', backendAuthoritative: 'Итоговая цена определяется сервером.', newOrder: 'Новый заказ', paymentLinkCreated: 'Ссылка на оплату создана. Чтобы изменить корзину, начните новый заказ.', addProduct: 'Добавьте товар, чтобы начать.', normal: 'Обычный', blonde: 'Блонд +30%', remove: 'Удалить', expoDiscount: 'Скидка выставки (10%)', customer: 'Клиент', clearCustomer: 'Очистить', name: 'Имя', phoneContact: 'Телефон / WeChat / email', optional: 'Необязательно', previewBackendPrice: 'Предпросмотр цены сервера', createPaymentLink: 'Создать ссылку на оплату', creating: 'Создание…', paidStartNewOrder: 'Оплачено — новый заказ', retryPaymentLink: 'Повторить создание ссылки', weight: 'Вес', subtotal: 'Подытог', total: 'Итого', discount: 'Скидка', usdTotal: 'Итого в USD', cnyReference: 'Справочная цена CNY', openStripeCheckout: 'Открыть Stripe Checkout', refreshPaymentStatus: 'Обновить статус оплаты', statusConfirmedWebhook: 'Статус подтверждается серверным webhook.', loadingOrders: 'Загрузка заказов…', noMatchingOrders: 'Подходящих заказов нет.', paidOrdersDefault: 'По умолчанию показаны оплаченные заказы.', paidOnly: 'Только оплаченные', allOrders: 'Все заказы', reload: 'Обновить', close: 'Закрыть', soldOrders: 'Проданные заказы', paidTotal: 'Оплачено всего: {{amount}}', walkIn: 'Разовый клиент', refreshStatus: 'Обновить статус', printPdf: 'Печать / PDF', backToCheckout: 'Вернуться к оплате', payment: 'Оплата', paid: 'Оплачено', pending: 'Ожидание', reviewRequired: 'Требуется проверка', volumeDiscount: 'Оптовая скидка', orderStatus: 'Статус заказа', loadingOrderStatus: 'Загрузка статуса заказа…', paymentConfirmed: 'Оплата подтверждена', paymentPending: 'Ожидание оплаты', statusPolling: 'Эта страница проверяет обновление webhook каждые несколько секунд.', viewOrders: 'Посмотреть заказы', invoiceReceipt: 'Счёт / квитанция', generated: 'Создано: {{date}}', customerDetailsUnavailable: 'Детали заказа недоступны.', invoiceCustomer: 'Клиент', invoiceItems: 'Товары', invoiceProduct: 'Товар', invoiceQuantity: 'Кол-во', invoiceAmount: 'Сумма', invoiceTotal: 'Итого: {{amount}}', errorInvalidPasscode: 'Неверный пароль.', errorNotFound: 'Запрошенная запись не найдена.', errorConflict: 'Этот заказ уже обрабатывается. Обновите его статус.', errorProvider: 'Платёжный сервис не завершил запрос. Повторить безопасно.', errorPopup: 'Разрешите всплывающие окна для печати счёта.', errorGeneric: 'Произошла ошибка. Попробуйте ещё раз.',
  },
  my: {
    ...orderFlowTranslations.my,
    paymentLinkExpiresIn: '\u1004\u103d\u1031\u1015\u1031\u1038\u1001\u103b\u1031\u1019\u103e\u102f\u101c\u1004\u1037\u103a\u1001\u103a \u101e\u1000\u103a\u1010\u1019\u103a\u1038\u1000\u102f\u1014\u103a\u101b\u1014\u103a {{time}}',
    cartJump: 'လှည်း',
    projectGuide: 'ပရောဂျက်လမ်းညွှန်',
    projectGuideHint: 'ပရောဂျက်လုပ်ဆောင်မှုနှင့် ငွေပေးချေမှုလုံခြုံရေး မှတ်စုများကို ကြည့်ပါ။',
    openGuide: 'လမ်းညွှန်ကြည့်ရန်',
    errorQuantityLimit: 'အော်ဒါသည် လက်ရှိငွေရှင်းမှုကန့်သတ်ချက်ထက် ကျော်လွန်နေပါသည်။ ပြခန်းဝန်ထမ်းထံ ဆက်သွယ်ပါ။',
    invoiceSurcharge: 'အပိုကြေး',
    language: 'ဘာသာစကား', english: 'English', chinese: '中文', russian: 'Русский', burmese: 'မြန်မာ', boothCheckout: 'ပြခန်းငွေရှင်းခြင်း', checkingSession: 'ပြခန်း session ကို စစ်ဆေးနေသည်…', enterPasscode: 'ပြခန်း passcode ထည့်ပါ', expoTeamOnly: 'ဤကိရိယာကို ပြပွဲအဖွဲ့အတွက် အသုံးပြုပါသည်။', passcode: 'Passcode', unlock: 'ဖွင့်ရန်', online: 'အွန်လိုင်း', offlineCartSaved: 'အော့ဖ်လိုင်း — လှည်းကို သိမ်းဆည်းထားသည်', orders: 'အော်ဒါများ', buildOrder: 'စက္ကန့်အနည်းငယ်အတွင်း အော်ဒါဖန်တီးပါ', catalog: 'ကုန်ပစ္စည်းစာရင်း', catalogHint: 'SKU၊ လိုင်း၊ ကုန်ပစ္စည်းအမျိုးအစား သို့မဟုတ် အလျားဖြင့် ရှာဖွေပါ။', productsCount: 'ကုန်ပစ္စည်း {{count}} ခု', searchCatalog: 'SKU သို့မဟုတ် ကုန်ပစ္စည်း ရှာဖွေရန်…', standard: 'ပုံမှန်', weightNotSupplied: 'အလေးချိန် မထည့်ထားပါ', addNormal: 'ပုံမှန် ထည့်ရန်', addBlonde: 'Blonde ထည့်ရန် +30%', cart: 'လှည်း ({{count}})', backendAuthoritative: 'နောက်ခံစနစ်၏ စျေးနှုန်းကို အတည်ပြုစျေးနှုန်းအဖြစ် အသုံးပြုသည်။', newOrder: 'အော်ဒါအသစ်', paymentLinkCreated: 'ငွေပေးချေမှုလင့်ခ် ဖန်တီးပြီးပါပြီ။ ဤလှည်းကို ပြောင်းလဲရန် အော်ဒါအသစ် စတင်ပါ။', addProduct: 'စတင်ရန် ကုန်ပစ္စည်းတစ်ခု ထည့်ပါ။', normal: 'ပုံမှန်', blonde: 'Blonde +30%', remove: 'ဖယ်ရှားရန်', expoDiscount: 'ပြပွဲလျှော့စျေး (10%)', customer: 'ဖောက်သည်', clearCustomer: 'ရှင်းလင်းရန်', name: 'အမည်', phoneContact: 'ဖုန်း / WeChat / email', optional: 'မဖြစ်မနေ မဟုတ်ပါ', previewBackendPrice: 'နောက်ခံစနစ်စျေးနှုန်း ကြိုတင်ကြည့်ရန်', createPaymentLink: 'ငွေပေးချေမှုလင့်ခ် ဖန်တီးရန်', creating: 'ဖန်တီးနေသည်…', paidStartNewOrder: 'ငွေပေးချေပြီး — အော်ဒါအသစ် စတင်ရန်', retryPaymentLink: 'ငွေပေးချေမှုလင့်ခ် ပြန်ကြိုးစားရန်', weight: 'အလေးချိန်', subtotal: 'ကြားစုစုပေါင်း', total: 'စုစုပေါင်း', discount: 'လျှော့စျေး', usdTotal: 'USD စုစုပေါင်း', cnyReference: 'CNY ရည်ညွှန်းစျေးနှုန်း', openStripeCheckout: 'Stripe ငွေရှင်းခြင်းကို ဖွင့်ရန်', refreshPaymentStatus: 'ငွေပေးချေမှုအခြေအနေ ပြန်စစ်ရန်', statusConfirmedWebhook: 'အခြေအနေကို နောက်ခံစနစ် webhook က အတည်ပြုသည်။', loadingOrders: 'အော်ဒါများ ဖတ်နေသည်…', noMatchingOrders: 'ကိုက်ညီသော အော်ဒါမရှိပါ။', paidOrdersDefault: 'ပုံမှန်အားဖြင့် ငွေပေးချေပြီးသော အော်ဒါများကို ပြသည်။', paidOnly: 'ငွေပေးချေပြီးသာ', allOrders: 'အော်ဒါအားလုံး', reload: 'ပြန်ဖတ်ရန်', close: 'ပိတ်ရန်', soldOrders: 'ရောင်းပြီးသော အော်ဒါများ', paidTotal: 'ငွေပေးချေပြီး စုစုပေါင်း: {{amount}}', walkIn: 'လာရောက်ဝယ်ယူသူ', refreshStatus: 'အခြေအနေ ပြန်စစ်ရန်', printPdf: 'ပုံနှိပ် / PDF', backToCheckout: 'ငွေရှင်းခြင်းသို့ ပြန်ရန်', payment: 'ငွေပေးချေမှု', paid: 'ငွေပေးချေပြီး', pending: 'စောင့်ဆိုင်းနေသည်', reviewRequired: 'ပြန်လည်စစ်ဆေးရန် လိုအပ်သည်', volumeDiscount: 'အမြောက်အမြားလျှော့စျေး', orderStatus: 'အော်ဒါအခြေအနေ', loadingOrderStatus: 'အော်ဒါအခြေအနေ ဖတ်နေသည်…', paymentConfirmed: 'ငွေပေးချေမှု အတည်ပြုပြီး', paymentPending: 'ငွေပေးချေမှု စောင့်ဆိုင်းနေသည်', statusPolling: 'Stripe webhook အပ်ဒိတ်ကို ဤစာမျက်နှာက စက္ကန့်အနည်းငယ်တိုင်း နောက်ခံစနစ်တွင် စစ်ဆေးသည်။', viewOrders: 'အော်ဒါများ ကြည့်ရန်', invoiceReceipt: 'ဘောင်ချာ / ပြေစာ', generated: 'ဖန်တီးသည့်အချိန်: {{date}}', customerDetailsUnavailable: 'အော်ဒါအသေးစိတ်အချက်အလက် မရနိုင်ပါ။', invoiceCustomer: 'ဖောက်သည်', invoiceItems: 'ပစ္စည်းများ', invoiceProduct: 'ကုန်ပစ္စည်း', invoiceQuantity: 'အရေအတွက်', invoiceAmount: 'ပမာဏ', invoiceTotal: 'စုစုပေါင်း: {{amount}}', errorInvalidPasscode: 'Passcode မမှန်ပါ။', errorNotFound: 'တောင်းဆိုထားသော မှတ်တမ်းကို မတွေ့ပါ။', errorConflict: 'ဤငွေရှင်းမှုကို လုပ်ဆောင်နေပါသည်။ အခြေအနေကို ပြန်စစ်ပါ။', errorProvider: 'ငွေပေးချေမှုဝန်ဆောင်မှုက တောင်းဆိုချက်ကို မပြီးဆုံးနိုင်ပါ။ လုံခြုံစွာ ပြန်ကြိုးစားနိုင်ပါသည်။', errorPopup: 'ဘောင်ချာကို ပုံနှိပ်ရန် pop-up များကို ခွင့်ပြုပါ။', errorGeneric: 'အမှားတစ်ခု ဖြစ်ပွားပါသည်။ ထပ်မံကြိုးစားပါ။',
  },
};

messages.my = { ...messages.my, ...myCartVocabulary };

type I18nContextValue = { locale: Locale; setLocale: (locale: Locale) => void; t: (key: MessageKey, values?: Record<string, string | number>) => string };
const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(value: string, values?: Record<string, string | number>): string {
  if (!values) return value;
  return value.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(values[key] ?? ''));
}

export function message(locale: Locale, key: MessageKey, values?: Record<string, string | number>): string {
  return interpolate(messages[locale][key] ?? messages.en[key] ?? key, values);
}

export function localizeError(error: unknown, t: I18nContextValue['t']): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  if (/passcode|unauthorized/i.test(raw)) return t('errorInvalidPasscode');
  if (/not found/i.test(raw)) return t('errorNotFound');
  if (/date range/i.test(raw)) return t('errorDateRange');
  if (/quantity|checkout must contain|order must contain|items must contain|outside the allowed range/i.test(raw)) return t('errorQuantityLimit');
  if (/conflict|already processing|already completed/i.test(raw)) return t('errorConflict');
  if (/provider|stripe|payment link/i.test(raw)) return t('errorProvider');
  if (/pop-up|popup/i.test(raw)) return t('errorPopup');
  return raw || t('errorGeneric');
}

export function formatMinor(minor: number | null | undefined, currency: string, locale: Locale): string {
  if (minor === null || minor === undefined) return '—';
  return new Intl.NumberFormat(locale, { style: 'currency', currency: currency.toUpperCase(), minimumFractionDigits: 2 }).format(minor / 100);
}

export function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export function I18nProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const saved = localStorage.getItem(LOCALE_KEY) as Locale | null;
    const browser = navigator.language.toLowerCase();
    const detected: Locale = saved === 'en' || saved === 'zh-CN' || saved === 'ru' || saved === 'my'
      ? saved
      : browser.startsWith('zh') ? 'zh-CN' : browser.startsWith('ru') ? 'ru' : browser.startsWith('my') ? 'my' : 'en';
    setLocaleState(detected);
  }, []);

  useEffect(() => {
    localStorage.setItem(LOCALE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => setLocaleState(next), []);
  const t = useCallback((key: MessageKey, values?: Record<string, string | number>) => message(locale, key, values), [locale]);
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used within I18nProvider');
  return value;
}

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return <label className="language-switcher"><span>{t('language')}</span><select aria-label={t('language')} value={locale} onChange={(event) => setLocale(event.target.value as Locale)}><option value="en">{t('english')}</option><option value="zh-CN">{t('chinese')}</option><option value="ru">{t('russian')}</option><option value="my">{t('burmese')}</option></select></label>;
}
