export const locales = ['ja', 'en', 'es', 'zh', 'ko'] as const;
export type Locale = (typeof locales)[number];

export const localeInfo: Record<Locale, {
  tag: string;
  label: string;
  short: string;
  dateLocale: string;
  ogLocale: string;
}> = {
  ja: { tag: 'ja', label: '日本語', short: 'JA', dateLocale: 'ja-JP', ogLocale: 'ja_JP' },
  en: { tag: 'en', label: 'English', short: 'EN', dateLocale: 'en-US', ogLocale: 'en_US' },
  es: { tag: 'es', label: 'Español', short: 'ES', dateLocale: 'es-ES', ogLocale: 'es_ES' },
  zh: { tag: 'zh-CN', label: '中文', short: '中文', dateLocale: 'zh-CN', ogLocale: 'zh_CN' },
  ko: { tag: 'ko', label: '한국어', short: '한국어', dateLocale: 'ko-KR', ogLocale: 'ko_KR' }
};

export const publicLocales = ['en', 'es', 'zh', 'ko'] as const;

export function isLocale(value: string | undefined): value is Locale {
  return Boolean(value && (locales as readonly string[]).includes(value));
}

export function localizedPath(locale: Locale, path = '/') {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (locale === 'ja') return normalized;
  if (normalized === '/') return `/${locale}/`;
  return `/${locale}${normalized}`;
}

export const copy: Record<Locale, {
  defaultDescription: string;
  navNotes: string;
  navAbout: string;
  viewAll: string;
  archive: string;
  profileEyebrow: string;
  aboutSummary1: string;
  aboutSummary2: string;
  profileLine1: string;
  profileLine2: string;
  profileLine3: string;
  externalSites: string;
  newsletterEyebrow: string;
  newsletterTitle: string;
  newsletterBody: string;
  emailPlaceholder: string;
  subscribe: string;
}> = {
  ja: {
    defaultDescription: 'AI、映像、健康、アプリ、旅、コーヒー、出版。分野ではなく、実際に見て、作って、試したことを記録する。これは情報を量産するブログではなく、岩松正浩の一次情報を長期保存するためのフィールドノートです。',
    navNotes: 'NOTES', navAbout: 'ABOUT', viewAll: 'VIEW ALL →', archive: 'Archive', profileEyebrow: 'Profile / Official Archive',
    aboutSummary1: '映像制作を軸に、AI、自動化、アプリ開発、出版、音楽、ヘルスケアへ。活動領域が変わっても、原点は「自分で確かめる」ことです。',
    aboutSummary2: 'NOMAD FIELDは、その過程を企業やSNSではなく、自分の名前のドメインに残すための場所です。',
    profileLine1: '岩松正浩。株式会社ストロボファクトリー代表取締役。映像業界で24年以上、企業映像、番組、ミュージックビデオ、eラーニング、ライブ配信などの制作に携わってきました。',
    profileLine2: '現在は映像制作を起点に、AI・業務自動化、iOSアプリ開発、出版、音楽、ヘルスケア、オンライン教育などへ活動領域を広げ、企画から制作、運用まで自ら行っています。',
    profileLine3: 'NOMAD FIELDは、これらを肩書きや事業ごとに分断せず、一人の人間が実際に見て、作って、試した記録として残すための公式アーカイブです。',
    externalSites: 'External sites', newsletterEyebrow: 'Newsletter', newsletterTitle: 'NEW NOTES,\nDIRECT.',
    newsletterBody: 'AI時代のデジタルスキル、ヘルスケア、クリエイティブ。\n自分の人生は自分で設計する「BODY」「LIFE」「CULTURE」の交差点のカルチャーメールマガジン。毎週金曜日にお届けしています。',
    emailPlaceholder: 'Email address', subscribe: 'SUBSCRIBE →'
  },
  en: {
    defaultDescription: 'AI, video, health, apps, travel, coffee, and publishing. NOMAD FIELD is Masahiro Iwamatsu’s first-person archive of what he has actually seen, built, tested, and learned.',
    navNotes: 'NOTES', navAbout: 'ABOUT', viewAll: 'VIEW ALL →', archive: 'Archive', profileEyebrow: 'Profile / Official Archive',
    aboutSummary1: 'Starting from video production, my work now spans AI, automation, app development, publishing, music, and healthcare. Whatever the field, the starting point is the same: verify it for myself.',
    aboutSummary2: 'NOMAD FIELD is where I preserve that process on a domain under my own name, rather than leaving it only to companies or social platforms.',
    profileLine1: 'Masahiro Iwamatsu, Representative Director of Strobofactory Inc. For more than 24 years, he has worked in video production across corporate films, television programs, music videos, e-learning, and live streaming.',
    profileLine2: 'Today, starting from video production, his work extends into AI and business automation, iOS app development, publishing, music, healthcare, and online education, covering planning, production, and operation.',
    profileLine3: 'NOMAD FIELD is his official archive: not a collection divided by title or business, but a record of what one person has actually seen, made, and tested.',
    externalSites: 'External sites', newsletterEyebrow: 'Newsletter', newsletterTitle: 'NEW NOTES,\nDIRECT.',
    newsletterBody: 'Digital skills for the AI era, healthcare, and creativity.\nA culture newsletter at the intersection of BODY, LIFE, and CULTURE for people who want to design their own lives. Delivered every Friday.',
    emailPlaceholder: 'Email address', subscribe: 'SUBSCRIBE →'
  },
  es: {
    defaultDescription: 'IA, video, salud, apps, viajes, café y publicaciones. NOMAD FIELD es el archivo en primera persona de Masahiro Iwamatsu sobre lo que realmente ha visto, creado, probado y aprendido.',
    navNotes: 'NOTAS', navAbout: 'SOBRE MÍ', viewAll: 'VER TODO →', archive: 'Archivo', profileEyebrow: 'Perfil / Archivo oficial',
    aboutSummary1: 'Partiendo de la producción audiovisual, mi trabajo se ha ampliado a la IA, la automatización, el desarrollo de apps, la edición, la música y la salud. Cambie el campo que cambie, el punto de partida es el mismo: comprobarlo por mí mismo.',
    aboutSummary2: 'NOMAD FIELD es el lugar donde conservo ese proceso en un dominio con mi propio nombre, en vez de dejarlo únicamente en empresas o redes sociales.',
    profileLine1: 'Masahiro Iwamatsu, director representante de Strobofactory Inc. Lleva más de 24 años trabajando en producción audiovisual: videos corporativos, programas de televisión, videoclips, e-learning y retransmisiones en directo.',
    profileLine2: 'Actualmente amplía su actividad desde el audiovisual hacia la IA y la automatización empresarial, el desarrollo de apps iOS, la edición, la música, la salud y la educación online, cubriendo desde la planificación hasta la producción y la operación.',
    profileLine3: 'NOMAD FIELD es su archivo oficial: no separa la actividad por cargos o negocios, sino que conserva lo que una sola persona ha visto, creado y probado realmente.',
    externalSites: 'Sitios externos', newsletterEyebrow: 'Newsletter', newsletterTitle: 'NEW NOTES,\nDIRECT.',
    newsletterBody: 'Competencias digitales para la era de la IA, salud y creatividad.\nUn newsletter cultural en la intersección de BODY, LIFE y CULTURE para quienes quieren diseñar su propia vida. Cada viernes.',
    emailPlaceholder: 'Correo electrónico', subscribe: 'SUSCRIBIRME →'
  },
  zh: {
    defaultDescription: 'AI、影像、健康、应用、旅行、咖啡与出版。NOMAD FIELD 是岩松正浩关于亲眼所见、亲手制作、实际测试与学习过程的一手记录档案。',
    navNotes: '文章', navAbout: '关于', viewAll: '查看全部 →', archive: '档案', profileEyebrow: '个人资料 / 官方档案',
    aboutSummary1: '以影像制作为起点，我的工作延伸到 AI、自动化、应用开发、出版、音乐和健康领域。无论领域如何变化，出发点始终一样：亲自确认。',
    aboutSummary2: 'NOMAD FIELD 是我把这些过程保存在自己姓名域名下的地方，而不是只留在公司或社交平台中。',
    profileLine1: '岩松正浩，株式会社 Strobofactory 代表董事。拥有 24 年以上影像行业经验，参与企业影像、电视节目、音乐视频、在线学习和直播等制作。',
    profileLine2: '目前以影像制作为基础，将活动扩展到 AI 与业务自动化、iOS 应用开发、出版、音乐、健康和在线教育，并亲自参与策划、制作与运营。',
    profileLine3: 'NOMAD FIELD 是他的官方档案：不按职位或业务切割，而是作为一个人实际看过、做过、试过的记录保存下来。',
    externalSites: '外部网站', newsletterEyebrow: '邮件通讯', newsletterTitle: 'NEW NOTES,\nDIRECT.',
    newsletterBody: 'AI 时代的数字技能、健康与创意。\n一份位于 BODY、LIFE、CULTURE 交汇点的文化邮件通讯，面向希望自己设计人生的人。每周五发送。',
    emailPlaceholder: '电子邮箱', subscribe: '订阅 →'
  },
  ko: {
    defaultDescription: 'AI, 영상, 건강, 앱, 여행, 커피, 출판. NOMAD FIELD는 이와마츠 마사히로가 직접 보고, 만들고, 시험하고, 배운 것을 남기는 1차 기록 아카이브입니다.',
    navNotes: '노트', navAbout: '소개', viewAll: '전체 보기 →', archive: '아카이브', profileEyebrow: '프로필 / 공식 아카이브',
    aboutSummary1: '영상 제작을 중심으로 AI, 자동화, 앱 개발, 출판, 음악, 헬스케어까지 활동 영역을 넓혀 왔습니다. 분야가 달라져도 출발점은 같습니다. 직접 확인하는 것입니다.',
    aboutSummary2: 'NOMAD FIELD는 그 과정을 회사나 SNS에만 두지 않고, 제 이름의 도메인에 남기기 위한 공간입니다.',
    profileLine1: '이와마츠 마사히로. 주식회사 Strobofactory 대표이사. 24년 이상 영상 업계에서 기업 영상, 방송 프로그램, 뮤직비디오, e러닝, 라이브 스트리밍 등의 제작에 참여해 왔습니다.',
    profileLine2: '현재는 영상 제작을 출발점으로 AI·업무 자동화, iOS 앱 개발, 출판, 음악, 헬스케어, 온라인 교육까지 영역을 넓혀 기획부터 제작, 운영까지 직접 진행하고 있습니다.',
    profileLine3: 'NOMAD FIELD는 이를 직함이나 사업별로 나누지 않고, 한 사람이 실제로 보고, 만들고, 시험한 기록으로 남기는 공식 아카이브입니다.',
    externalSites: '외부 사이트', newsletterEyebrow: '뉴스레터', newsletterTitle: 'NEW NOTES,\nDIRECT.',
    newsletterBody: 'AI 시대의 디지털 스킬, 헬스케어, 크리에이티브.\n자신의 삶을 직접 설계하는 사람을 위한 BODY, LIFE, CULTURE의 교차점에 있는 컬처 뉴스레터입니다. 매주 금요일 발행합니다.',
    emailPlaceholder: '이메일 주소', subscribe: '구독 →'
  }
};
