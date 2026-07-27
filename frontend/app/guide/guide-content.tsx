'use client';

import Link from 'next/link';
import { Locale, useI18n } from '../../lib/i18n';

type GuideCopy = {
  navLabel: string;
  checkout: string;
  eyebrow: string;
  title: string;
  lead: string;
  walkthrough: string;
  viewWalkthrough: string;
  preloaded: string;
  stripeMode: string;
  sqliteWal: string;
  liveFlow: string;
  ready: string;
  selectProducts: string;
  catalogVariants: string;
  previewPrice: string;
  backendCalculation: string;
  paySecurely: string;
  qrOrStripe: string;
  paymentStatus: string;
  confirmedWebhook: string;
  screenRecording: string;
  seeCompleteFlow: string;
  recordingDescription: string;
  watchWalkthrough: string;
  openRecordedFlow: string;
  watchVideo: string;
  recordingComingSoon: string;
  recordingHint: string;
  whatDemonstrated: string;
  designedAround: string;
  projectNotes: string;
  notesTitle: string;
  notesBody: string;
  github: string;
  idempotency: string;
  protectedCheckout: string;
  footer: string;
  features: readonly [string, string, string][];
};

const guideCopy: Record<Locale, GuideCopy> = {
  en: {
    navLabel: 'Project guide navigation', checkout: 'Open live checkout', eyebrow: 'Project guide',
    title: 'Checkout built for the pace of an expo booth.',
    lead: 'A focused, reliable payment flow for turning a product selection into a confirmed order in seconds.',
    walkthrough: 'View walkthrough', viewWalkthrough: 'View walkthrough', preloaded: '75 products preloaded', stripeMode: 'Stripe test mode', sqliteWal: 'SQLite WAL',
    liveFlow: 'Live flow', ready: 'Ready', selectProducts: 'Select products', catalogVariants: 'Catalog and variants',
    previewPrice: 'Preview price', backendCalculation: 'Backend calculation', paySecurely: 'Pay securely', qrOrStripe: 'QR or Stripe Checkout',
    paymentStatus: 'Payment status', confirmedWebhook: 'Confirmed by webhook', screenRecording: 'Screen recording',
    seeCompleteFlow: 'See the complete flow.',
    recordingDescription: 'The five-minute walkthrough covers product selection, a blonde item, discount pricing, Stripe test payment, and the paid-status update.',
    watchWalkthrough: 'Watch the assignment walkthrough', openRecordedFlow: 'Open the recorded end-to-end checkout flow', watchVideo: 'Watch video',
    recordingComingSoon: 'Screen recording coming soon', recordingHint: 'Set NEXT_PUBLIC_GUIDE_VIDEO_URL after uploading the five-minute walkthrough.',
    whatDemonstrated: 'What is demonstrated', designedAround: 'Designed around reliable checkout.', projectNotes: 'Project notes',
    notesTitle: 'Simple on the surface. Deliberate underneath.',
    notesBody: 'USD is the Stripe payment amount. CNY is shown as a reference from the supplied price list, not as an exchange-rate conversion. The application is designed for one SQLite-backed deployment with provider calls outside database transactions.',
    github: 'GitHub repository', idempotency: 'Payment idempotency design', protectedCheckout: 'Protected live checkout', footer: 'Expo booth checkout · Project guide',
    features: [
      ['01', 'Backend-authoritative pricing', 'The browser requests previews, but the backend calculates and stores the amount paid.'],
      ['02', 'Safe payment retries', 'Client idempotency keys, short transactions, leases, and stable provider keys protect duplicate clicks.'],
      ['03', 'Webhook-confirmed status', 'Signed Stripe webhooks confirm payment and reject mismatched amounts, currencies, and links.'],
      ['04', 'Booth-ready workflow', 'Search the preloaded catalog, add normal or blonde items, show discounts, scan a QR code, and print an invoice.'],
    ],
  },
  'zh-CN': {
    navLabel: '项目指南导航', checkout: '打开在线结账', eyebrow: '项目指南', title: '为展会柜台节奏打造的结账流程。',
    lead: '从选择商品到确认订单，只需几秒钟的专注、可靠支付流程。', walkthrough: '查看演示', viewWalkthrough: '查看演示', preloaded: '已预加载 75 个产品', stripeMode: 'Stripe 测试模式', sqliteWal: 'SQLite WAL',
    liveFlow: '在线流程', ready: '就绪', selectProducts: '选择商品', catalogVariants: '目录和变体', previewPrice: '预览价格', backendCalculation: '后台计算', paySecurely: '安全支付', qrOrStripe: '二维码或 Stripe Checkout', paymentStatus: '支付状态', confirmedWebhook: 'Webhook 已确认',
    screenRecording: '屏幕录制', seeCompleteFlow: '查看完整流程。', recordingDescription: '五分钟演示包括商品选择、金发款商品、折扣价格、Stripe 测试支付和已支付状态更新。', watchWalkthrough: '观看作业演示', openRecordedFlow: '打开完整结账录制', watchVideo: '观看视频', recordingComingSoon: '屏幕录制即将提供', recordingHint: '上传五分钟演示后，设置 NEXT_PUBLIC_GUIDE_VIDEO_URL。',
    whatDemonstrated: '演示内容', designedAround: '围绕可靠结账而设计。', projectNotes: '项目说明', notesTitle: '表面简单，底层严谨。', notesBody: 'USD 是 Stripe 的支付金额。CNY 是供应价格表中的参考价，不是汇率换算。应用设计为单个 SQLite 部署，且支付服务调用在数据库事务之外执行。', github: 'GitHub 仓库', idempotency: '支付幂等设计', protectedCheckout: '受保护的在线结账', footer: '展会柜台结账 · 项目指南',
    features: [
      ['01', '后台权威定价', '浏览器请求价格预览，但最终支付金额由后台计算并保存。'],
      ['02', '安全支付重试', '客户端幂等键、短事务、租约和稳定的服务商键可避免重复点击。'],
      ['03', 'Webhook 确认状态', '签名 Stripe webhook 确认支付，并拒绝金额、货币或链接不匹配。'],
      ['04', '适合展会柜台', '搜索预加载目录，添加普通或金发款，显示折扣，扫描二维码并打印发票。'],
    ],
  },
  ru: {
    navLabel: 'Навигация по руководству', checkout: 'Открыть оплату', eyebrow: 'Руководство проекта', title: 'Оплата в темпе выставочного стенда.',
    lead: 'Сосредоточенный и надёжный процесс, превращающий выбор товара в подтверждённый заказ за секунды.', walkthrough: 'Посмотреть обзор', viewWalkthrough: 'Посмотреть обзор', preloaded: 'Загружено 75 товаров', stripeMode: 'Тестовый режим Stripe', sqliteWal: 'SQLite WAL',
    liveFlow: 'Рабочий процесс', ready: 'Готово', selectProducts: 'Выбрать товары', catalogVariants: 'Каталог и варианты', previewPrice: 'Предпросмотр цены', backendCalculation: 'Расчёт сервером', paySecurely: 'Безопасная оплата', qrOrStripe: 'QR или Stripe Checkout', paymentStatus: 'Статус оплаты', confirmedWebhook: 'Подтверждено webhook',
    screenRecording: 'Запись экрана', seeCompleteFlow: 'Посмотрите весь процесс.', recordingDescription: 'Пятиминутный обзор показывает выбор товара, блонд, скидку, тестовую оплату Stripe и обновление статуса.', watchWalkthrough: 'Посмотреть демонстрацию', openRecordedFlow: 'Открыть запись полного процесса', watchVideo: 'Смотреть видео', recordingComingSoon: 'Запись экрана скоро появится', recordingHint: 'После загрузки записи задайте NEXT_PUBLIC_GUIDE_VIDEO_URL.',
    whatDemonstrated: 'Что показано', designedAround: 'Надёжная оплата — в центре дизайна.', projectNotes: 'Примечания проекта', notesTitle: 'Просто снаружи. Продуманно внутри.', notesBody: 'USD — сумма платежа Stripe. CNY показывается как справочная цена из предоставленного прайс-листа, а не как конвертация валюты. Приложение рассчитано на один экземпляр SQLite, а вызовы платёжного провайдера выполняются вне транзакций базы данных.', github: 'Репозиторий GitHub', idempotency: 'Дизайн идемпотентности платежей', protectedCheckout: 'Защищённая оплата', footer: 'Оплата на стенде · Руководство проекта',
    features: [
      ['01', 'Цена определяется сервером', 'Браузер запрашивает предпросмотр, но сервер рассчитывает и сохраняет оплачиваемую сумму.'],
      ['02', 'Безопасные повторы оплаты', 'Ключи идемпотентности, короткие транзакции, аренды и стабильные ключи провайдера защищают от повторных кликов.'],
      ['03', 'Статус подтверждает webhook', 'Подписанные Stripe webhook подтверждают оплату и отклоняют неверные сумму, валюту или ссылку.'],
      ['04', 'Для работы на стенде', 'Поиск в каталоге, обычные и блонд-товары, скидки, QR-код и печать счёта.'],
    ],
  },
  my: {
    navLabel: 'ပရောဂျက်လမ်းညွှန် မီနူး', checkout: 'တိုက်ရိုက် ငွေရှင်းခြင်းကို ဖွင့်ရန်', eyebrow: 'ပရောဂျက်လမ်းညွှန်', title: 'ပြပွဲကောင်တာအတွက် မြန်ဆန်သော ငွေရှင်းစနစ်။',
    lead: 'ကုန်ပစ္စည်းရွေးချယ်မှုမှ အတည်ပြုအော်ဒါအထိ စက္ကန့်အနည်းငယ်အတွင်း ယုံကြည်စိတ်ချရသော ငွေပေးချေမှုစနစ်။', walkthrough: 'လမ်းညွှန်ကြည့်ရန်', viewWalkthrough: 'လမ်းညွှန်ကြည့်ရန်', preloaded: 'ကုန်ပစ္စည်း ၇၅ ခု ကြိုတင်ထည့်ထားသည်', stripeMode: 'Stripe စမ်းသပ်မှုမုဒ်', sqliteWal: 'SQLite WAL',
    liveFlow: 'လက်ရှိလုပ်ဆောင်မှု', ready: 'အသင့်ဖြစ်သည်', selectProducts: 'ကုန်ပစ္စည်းရွေးရန်', catalogVariants: 'စာရင်းနှင့် အမျိုးအစားများ', previewPrice: 'စျေးနှုန်း ကြိုတင်ကြည့်ရန်', backendCalculation: 'နောက်ခံစနစ်က တွက်ချက်သည်', paySecurely: 'လုံခြုံစွာ ပေးချေရန်', qrOrStripe: 'QR သို့မဟုတ် Stripe Checkout', paymentStatus: 'ငွေပေးချေမှုအခြေအနေ', confirmedWebhook: 'Webhook ဖြင့် အတည်ပြုသည်',
    screenRecording: 'မျက်နှာပြင်မှတ်တမ်း', seeCompleteFlow: 'လုပ်ဆောင်မှုအပြည့်အစုံကို ကြည့်ပါ။', recordingDescription: 'ငါးမိနစ် လမ်းညွှန်တွင် ကုန်ပစ္စည်းရွေးချယ်ခြင်း၊ Blonde ပစ္စည်း၊ လျှော့စျေး၊ Stripe စမ်းသပ်ပေးချေမှုနှင့် ပေးချေပြီးအခြေအနေ ပြောင်းလဲမှုတို့ ပါဝင်သည်။', watchWalkthrough: 'တာဝန်ပေးစာ လမ်းညွှန်ကို ကြည့်ရန်', openRecordedFlow: 'ငွေရှင်းလုပ်ဆောင်မှု မှတ်တမ်းကို ဖွင့်ရန်', watchVideo: 'ဗီဒီယိုကြည့်ရန်', recordingComingSoon: 'မျက်နှာပြင်မှတ်တမ်း မကြာမီရရှိမည်', recordingHint: 'ငါးမိနစ် လမ်းညွှန်ဗီဒီယို တင်ပြီးနောက် NEXT_PUBLIC_GUIDE_VIDEO_URL ကို သတ်မှတ်ပါ။',
    whatDemonstrated: 'ပြသထားသောအရာများ', designedAround: 'ယုံကြည်စိတ်ချရသော ငွေရှင်းမှုအတွက် ဒီဇိုင်းပြုလုပ်ထားသည်။', projectNotes: 'ပရောဂျက်မှတ်စုများ', notesTitle: 'အပြင်ပန်း ရိုးရှင်းပြီး အတွင်းပိုင်း စနစ်တကျ။', notesBody: 'USD သည် Stripe ငွေပေးချေမှု ပမာဏဖြစ်သည်။ CNY သည် ပေးထားသော စျေးနှုန်းစာရင်းမှ ရည်ညွှန်းစျေးနှုန်းဖြစ်ပြီး ငွေလဲနှုန်းဖြင့် တွက်ချက်ခြင်းမဟုတ်ပါ။ အက်ပလီကေးရှင်းကို SQLite တစ်ခုတည်းဖြင့် အသုံးပြုရန် ဒီဇိုင်းပြုလုပ်ထားပြီး ငွေပေးချေမှုဝန်ဆောင်မှု ခေါ်ဆိုမှုများကို ဒေတာဘေ့စ် transaction အပြင်တွင် လုပ်ဆောင်သည်။', github: 'GitHub repository', idempotency: 'ငွေပေးချေမှု idempotency ဒီဇိုင်း', protectedCheckout: 'ကာကွယ်ထားသော တိုက်ရိုက်ငွေရှင်းမှု', footer: 'ပြပွဲကောင်တာ ငွေရှင်းခြင်း · ပရောဂျက်လမ်းညွှန်',
    features: [
      ['01', 'နောက်ခံစနစ်က စျေးနှုန်းကို အတည်ပြုသည်', 'Browser က ကြိုတင်ကြည့်ရှုရန် တောင်းဆိုသော်လည်း ပေးချေရမည့်ပမာဏကို နောက်ခံစနစ်က တွက်ချက်သိမ်းဆည်းသည်။'],
      ['02', 'လုံခြုံသော ငွေပေးချေမှု ပြန်ကြိုးစားခြင်း', 'Idempotency key၊ တိုတောင်းသော transaction၊ lease နှင့် provider key များက ထပ်ခါတလဲလဲနှိပ်ခြင်းကို ကာကွယ်သည်။'],
      ['03', 'Webhook ဖြင့် အခြေအနေအတည်ပြုခြင်း', 'Stripe webhook လက်မှတ်ဖြင့် ငွေပေးချေမှုကို အတည်ပြုပြီး မကိုက်ညီသော ပမာဏ၊ ငွေကြေးနှင့် လင့်ခ်များကို ငြင်းပယ်သည်။'],
      ['04', 'ပြပွဲကောင်တာအတွက် အသင့်', 'ကြိုတင်ထည့်ထားသောစာရင်းကို ရှာဖွေခြင်း၊ ပုံမှန် သို့မဟုတ် Blonde ထည့်ခြင်း၊ လျှော့စျေးပြခြင်း၊ QR ဖတ်ခြင်းနှင့် ဘောင်ချာပုံနှိပ်ခြင်း။'],
    ],
  },
};

const guideLanguageLabels = {
  en: { label: 'Language', english: 'English', chinese: '中文', russian: 'Русский' },
  'zh-CN': { label: '语言', english: 'English', chinese: '中文', russian: 'Русский' },
  ru: { label: 'Язык', english: 'English', chinese: '中文', russian: 'Русский' },
} as const;

function GuideLanguageSwitcher({ locale, setLocale }: { locale: Locale; setLocale: (locale: Locale) => void }) {
  const selectedLocale = locale === 'my' ? 'en' : locale;
  const labels = guideLanguageLabels[selectedLocale];
  return <label className="language-switcher"><span>{labels.label}</span><select aria-label={labels.label} value={selectedLocale} onChange={(event) => setLocale(event.target.value as Locale)}><option value="en">{labels.english}</option><option value="zh-CN">{labels.chinese}</option><option value="ru">{labels.russian}</option></select></label>;
}

type GuideContentProps = { checkoutUrl: string; videoUrl: string };

export default function GuideContent({ checkoutUrl, videoUrl }: GuideContentProps) {
  const { locale, setLocale } = useI18n();
  const selectedLocale = locale === 'my' ? 'en' : locale;
  const text = guideCopy[selectedLocale];

  return (
    <main className="demo-shell">
      <nav className="demo-nav" aria-label={text.navLabel}>
        <Link className="demo-brand" href="/guide">
          <span className="demo-brand-mark">TH</span>
          <span><strong>TRUNOV HAIR</strong><small>Expo checkout</small></span>
        </Link>
        <GuideLanguageSwitcher locale={locale} setLocale={setLocale} />
      </nav>

      <section className="demo-hero">
        <div className="demo-hero-copy">
          <p className="demo-eyebrow"><span className="demo-dot" /> {text.eyebrow}</p>
          <h1>{text.title}</h1>
          <p className="demo-lead">{text.lead}</p>
          <div className="demo-actions"><a className="button demo-button" href={checkoutUrl}>{text.checkout} <span aria-hidden="true">→</span></a><a className="demo-text-link" href="#recording">{text.walkthrough} <span aria-hidden="true">↓</span></a></div>
          <div className="demo-proof-row"><span>{text.preloaded}</span><span>{text.stripeMode}</span><span>{text.sqliteWal}</span></div>
        </div>
        <div className="demo-hero-card" aria-label={text.liveFlow}>
          <div className="demo-card-topline"><span>{text.liveFlow}</span><span className="demo-status-pill">{text.ready}</span></div>
          <div className="demo-flow-step demo-flow-done"><span>01</span><div><strong>{text.selectProducts}</strong><small>{text.catalogVariants}</small></div><b aria-hidden="true">✓</b></div>
          <div className="demo-flow-line" />
          <div className="demo-flow-step demo-flow-done"><span>02</span><div><strong>{text.previewPrice}</strong><small>{text.backendCalculation}</small></div><b aria-hidden="true">✓</b></div>
          <div className="demo-flow-line" />
          <div className="demo-flow-step demo-flow-active"><span>03</span><div><strong>{text.paySecurely}</strong><small>{text.qrOrStripe}</small></div><b aria-hidden="true">→</b></div>
          <div className="demo-card-total"><small>{text.paymentStatus}</small><strong>{text.confirmedWebhook}</strong></div>
        </div>
      </section>

      <section className="demo-video-section" id="recording">
        <div className="demo-section-heading"><p className="demo-eyebrow">{text.screenRecording}</p><h2>{text.seeCompleteFlow}</h2><p>{text.recordingDescription}</p></div>
        {videoUrl ? <div className="demo-video-ready"><div className="demo-play-icon">▶</div><div><strong>{text.watchWalkthrough}</strong><span>{text.openRecordedFlow}</span></div><a className="button secondary" href={videoUrl} target="_blank" rel="noreferrer">{text.watchVideo} →</a></div> : <div className="demo-video-placeholder" aria-label={text.screenRecording}><div className="demo-placeholder-icon">▶</div><strong>{text.recordingComingSoon}</strong><span>{text.recordingHint}</span></div>}
      </section>

      <section className="demo-features-section"><div className="demo-section-heading compact"><p className="demo-eyebrow">{text.whatDemonstrated}</p><h2>{text.designedAround}</h2></div><div className="demo-feature-grid">{text.features.map(([number, title, description]) => <article className="demo-feature" key={number}><span className="demo-feature-number">{number}</span><h3>{title}</h3><p>{description}</p></article>)}</div></section>

      <section className="demo-deliverables"><div><p className="demo-eyebrow">{text.projectNotes}</p><h2>{text.notesTitle}</h2><p>{text.notesBody}</p></div><div className="demo-links"><a href="https://github.com/next-n/Hair-Expo" target="_blank" rel="noreferrer">{text.github} <span>→</span></a><a href="https://github.com/next-n/Hair-Expo/blob/main/docs/hair-expo-payment-idempotency.pdf" target="_blank" rel="noreferrer">{text.idempotency} <span>→</span></a><a href={checkoutUrl}>{text.protectedCheckout} <span>→</span></a></div></section>

      <footer className="demo-footer"><span>TRUNOV HAIR</span><span>{text.footer}</span></footer>
    </main>
  );
}
