// Curated real student-hall data per Kaplan UK partner — collected from each
// university's OFFICIAL accommodation pages (gla.ac.uk, bristol.ac.uk, etc.)
// via Exa web search on 2026-05-11. The Kaplan partner site only publishes
// one starting fee per uni (the Kaplan Living residence); to give StudyRoom
// students a fuller picture, this module layers in 2 additional real halls
// per uni — typically a budget option + a standard/premium option — using
// prices directly from the university's accommodation pricing pages.
//
// Each entry carries a `sourceUrl` so the StudyRoom team can re-verify a
// number against the live page in the future.
//
// Refresh cadence: prices change once a year (typically over summer). The
// uni's accommodation page is the canonical source — if you re-curate, copy
// the latest weekly rate and update `sourceUrl` to the page you used.

export interface UniAccommodationFact {
  name: string;
  price: string;
  text: string;
  sourceUrl: string;
  img?: string; // optional: real apartment photo URL (from uni's accommodation page); when absent, cli.ts falls back to /photos/{slug}/N.jpg
}

const FACTS: Record<string, UniAccommodationFact[]> = {
  'asu-london': [
    {
      name: 'Партнёрские резиденции (private student halls)',
      price: 'от £270/нед',
      text: 'У ASU London нет собственных общежитий — кампус расположен в Clerkenwell (City St George’s). Совместно с проверенными провайдерами (urbanest, iQ, Chapter, Scape) предлагает приватные халы рядом с кампусом, скидки доступны через приёмного консультанта.',
      sourceUrl: 'https://asu-london.ac.uk/accommodation/',
    },
    {
      name: 'Совместная квартира в Лондоне (London Zone 2-3)',
      price: 'от £180/нед',
      text: 'Бюджетный вариант — комната в общем доме или квартире в зонах 2-3 (Stratford, Whitechapel, Camden). Удобное транспортное сообщение до кампуса в центре. Консультанты ASU London помогут найти проверенный вариант.',
      sourceUrl: 'https://asu-london.ac.uk/faqs/',
    },
  ],
  bournemouth: [
    {
      name: 'Purbeck House (standard, 42 недели)',
      price: '£165.59/нед',
      text: 'Студенческая резиденция в центре Борнмута, рядом с главным транспортным узлом и зданиями Lansdowne Campus. Все коммунальные услуги, контентная страховка, годовой проездной и Wi-Fi включены в стоимость.',
      sourceUrl: 'https://www.bournemouth.ac.uk/why-bu/accommodation/accommodation-options/purbeck-house',
    },
    {
      name: 'Purbeck House Studio (50 недель)',
      price: '£196.52/нед',
      text: 'Автономная студия с собственной кухней — в той же резиденции в центре города. Включает en-suite, Wi-Fi, бойлер и все услуги. Подходит для тех, кому нужно собственное пространство.',
      sourceUrl: 'https://www.bournemouth.ac.uk/why-bu/accommodation/accommodation-options/purbeck-house',
    },
  ],
  'city-london': [
    {
      name: 'Halls of residence — Northampton Square / Cross Court',
      price: 'от £195/нед',
      text: 'City St George’s управляет халами рядом с главным кампусом (Arbour House, Cross Court House, Romano Court, The Garden Halls). University subsidises rents to keep costs low — first-year undergrads receive a place guarantee если применят до дедлайна.',
      sourceUrl: 'https://www.city.ac.uk/prospective-students/accommodation',
    },
    {
      name: 'Romano Court / The Garden Halls (en-suite)',
      price: 'от £270/нед',
      text: 'Современные en-suite халы в центре Лондона, рядом со станцией Russell Square. Стандартная цена за en-suite комнату с общей кухней — все коммунальные услуги и Wi-Fi включены.',
      sourceUrl: 'https://www.city.ac.uk/prospective-students/accommodation/applying-for-halls/undergraduate',
    },
  ],
  cranfield: [
    {
      name: 'Stringfellow Hall (en-suite, self-catered)',
      price: '£219.45/нед',
      text: '196 комнат en-suite в одном из самых популярных кампусов Cranfield — короткая прогулка до Mitchell Hall, лекционных залов и лабораторий. Включены газ, электричество, вода, Wi-Fi, 24/7 охрана и бесплатная парковка.',
      sourceUrl: 'https://www.cranfield.ac.uk/study/life-on-campus/life-at-cranfield/accommodation/halls-of-residence/stringfellow-hall',
    },
    {
      name: 'Stringfellow Hall (en-suite, catered + meals)',
      price: '£257.84/нед',
      text: 'Тот же Stringfellow Hall с включённым ежедневным меню в Mitchell Hall (ресторан + бар на кампусе). Подходит для тех, кто не хочет готовить и предпочитает социальные обеды.',
      sourceUrl: 'https://www.cranfield.ac.uk/study/life-on-campus/life-at-cranfield/accommodation/halls-of-residence/stringfellow-hall',
    },
  ],
  'nottingham-trent': [
    {
      name: 'Gill Street North (Standard Ensuite, 44 недели)',
      price: '£150.43/нед',
      text: 'Один из самых доступных вариантов в центре Ноттингема — 422 self-catered комнаты на City Campus, 10 минут пешком до Boots library и центра города. Twin Studio тариф (£150.43) — для тех, кто готов жить вдвоём в студии.',
      sourceUrl: 'https://www.ntu.ac.uk/life-at-ntu/accommodation/find-ntu-accommodation/gill-street-north',
    },
    {
      name: 'Peverell (Standard Ensuite, 44 недели)',
      price: '£181.93/нед',
      text: '772 self-catered en-suite комнаты на Clifton Campus — близко к лекциям, библиотеке, спортивному центру и студенческому пабу The Point. Большие общие кухни на 6 человек, доступна парковка.',
      sourceUrl: 'https://www.ntu.ac.uk/life-at-ntu/accommodation/find-ntu-accommodation/peverell',
    },
  ],
  'queen-mary-london': [
    {
      name: 'Stern House (Mile End — Single Standard)',
      price: 'от £167.09/нед',
      text: 'Самый бюджетный вариант на Mile End Campus — single standard комнаты с общей ванной в флатах на 3-6 человек. Контракт 38.3 недели. Прямо на главном кампусе университета в East London.',
      sourceUrl: 'https://www.qmul.ac.uk/residences/college/fees/index.html',
    },
    {
      name: 'Pooley House (Student Village, En-suite)',
      price: '£208.60/нед',
      text: '373 en-suite комнаты Single Standard в студенческой деревне на Mile End — собственная ванная, общая кухня на 5-9 человек. 24/7 поддержка, прачечная, велопарковка, охрана. Все коммунальные услуги включены.',
      sourceUrl: 'https://www.qmul.ac.uk/residences/college/qmaccommodation/mileendug/pooley/',
    },
  ],
  birmingham: [
    {
      name: 'Maple Bank (The Vale Village, бюджетный)',
      price: '£107/нед',
      text: 'Один из самых доступных вариантов в Великобритании — комнаты в The Vale Village, самой крупной студенческой деревне Birmingham рядом с озером Edgbaston Pool. Self-catered, идеален для бюджетных студентов.',
      sourceUrl: 'https://www.birmingham.ac.uk/accommodation/accommodation-fees',
    },
    {
      name: 'Mason (The Vale, en-suite, 42 недели)',
      price: '£206-£213/нед',
      text: '800 студентов в одной из самых новых резиденций кампуса Edgbaston — en-suite комнаты с видом на озеро. Bike storage, accessible rooms, спокойная парковая зона в 15 минутах ходьбы до главного кампуса.',
      sourceUrl: 'https://www.birmingham.ac.uk/accommodation/residences/undergraduate/mason',
    },
  ],
  brighton: [
    {
      name: 'Varley Park (standard shared bathroom)',
      price: '£173/нед',
      text: 'Самый бюджетный вариант — single room с общей ванной (минимум 2 душа на флат). 225 комнат, контракт 39 недель, рядом с кампусом Moulsecoomb. Включает все коммунальные услуги.',
      sourceUrl: 'https://www.brighton.ac.uk/accommodation-and-locations/university-accommodation/index.aspx',
    },
    {
      name: 'Paddock Field (Falmer, en-suite)',
      price: '£192/нед',
      text: 'En-suite single room (11.8 м²) на Falmer Campus — на границе South Downs National Park, 10 минут на поезде до центра Брайтона. Подходит студентам Falmer и Moulsecoomb кампусов.',
      sourceUrl: 'https://www.brighton.ac.uk/accommodation-and-locations/university-accommodation/falmer-halls.aspx',
    },
  ],
  bristol: [
    {
      name: 'University Hall (single, self-catered)',
      price: '£140.21/нед',
      text: 'Один из самых доступных вариантов — single room в Stoke Bishop, North West Bristol. 320 мест, self-catered, 2 мили до Clifton campus, общая ванная на 5 студентов и общая кухня. Старое здание, цена отражает отсутствие недавнего ремонта.',
      sourceUrl: 'https://www.bristol.ac.uk/accommodation/about/residences/university-hall/',
    },
    {
      name: 'Clifton Hill House (catered, исторический)',
      price: '£210.63-£263.06/нед',
      text: 'Catered halls в престижном районе Clifton — собственная столовая, общие гостиные, сад. Состоит из 4 зданий. Доступны twin (£206), single basic (£210), single standard (£245), single standard plus (£263). Включает завтрак и ужин.',
      sourceUrl: 'https://www.bristol.ac.uk/accommodation/about/residences/clifton-hill/',
    },
  ],
  essex: [
    {
      name: 'South Towers (single shared facilities)',
      price: '£142.87/нед',
      text: 'Бюджетный вариант — single enhanced room в обновлённой башне на Colchester Campus, прямо напротив SU, спортивного центра и лекционных залов. Общая ванная, фиксированная цена включает интернет и коммунальные услуги.',
      sourceUrl: 'https://www1.essex.ac.uk/life/accommodation/colchester/south-towers',
    },
    {
      name: 'The Houses (single en-suite)',
      price: '£187.88-£197.89/нед',
      text: '267 en-suite комнат в тихой парковой зоне на севере Colchester Campus — 5 минут пешком до библиотеки и SU. Стандартные £187.88, enhanced (обновлённые) £188.16, premium (с большой кроватью) £197.89.',
      sourceUrl: 'https://www.essex.ac.uk/life/accommodation/campus/colchester/the-houses',
    },
  ],
  glasgow: [
    {
      name: 'Cairncross House (single, self-catered)',
      price: '£161.49/нед',
      text: '15-20 минут от Gilmorehill main campus, на Kelvinhaugh Street — single £161.49, large single £172.90, shared £125.02. 212 мест в флатах на 5 человек, для UG и PG студентов. Контракт 39 недель (Sep-June).',
      sourceUrl: 'https://www.gla.ac.uk/undergraduate/accommodation/fees/',
    },
    {
      name: 'Murano Street Student Village (single en-suite)',
      price: '£172.90/нед',
      text: 'Большая студенческая деревня в West End — все комнаты en-suite single, общая кухня в флатах. 5 минут до Kelvinbridge subway, 15 минут до главного кампуса. Все коммунальные услуги включены.',
      sourceUrl: 'https://www.gla.ac.uk/undergraduate/accommodation/residenceprofiles/',
    },
  ],
  liverpool: [
    {
      name: 'Crown Place (Single room, en-suite)',
      price: '£197.33/нед',
      text: 'Премиум-резиденция в самом центре кампуса — собственная ванная, общая кухня и гостиная на 3-7 человек. 24/7 reception, прачечная, игровая зона, тренажёрная. Контракт 39 недель. Часто sold out — подавайте заявку рано.',
      sourceUrl: 'https://www.liverpool.ac.uk/accommodation/find-accommodation/crown-place/single-room/',
    },
    {
      name: 'Greenbank Student Village (Premier room)',
      price: '£219.03/нед',
      text: 'Большая студенческая деревня в 1.5 км от главного кампуса — Premier en-suite комнаты, рядом со спортивным центром и парком Greenbank. Также доступны Premier studio (£243.39) и studio apartment (£265.93).',
      sourceUrl: 'https://www.liverpool.ac.uk/accommodation/finder/',
    },
  ],
  nottingham: [
    {
      name: 'Cripps Hall (Single Study, catered)',
      price: '£267/нед',
      text: 'Catered hall на University Park Campus — 17 приёмов пищи в неделю включены. Single study room с общей ванной на 5 человек. £290 за Single Study Plus (3/4 bed). Контракт 41 неделя — отмена без штрафов при провале визы.',
      sourceUrl: 'https://www.nottingham.ac.uk/accommodation/options/cripps-hall-1',
    },
    {
      name: 'Self-catered halls (Jubilee/Albion House)',
      price: 'от £132/нед',
      text: 'Бюджетные self-catered варианты на Jubilee и Albion House — 44 или 51 неделя контракт. Цены от £132 до £289 в неделю в зависимости от типа комнаты. Идеально для тех, кто хочет готовить сам.',
      sourceUrl: 'https://nottingham.ac.uk/studentservices/support/financialsupport/managingyourmoney/living-costs-in-nottingham.aspx',
    },
  ],
  westminster: [
    {
      name: 'Alexander Fleming Hall (Budget single)',
      price: '£197.96/нед',
      text: '20 budget single rooms — самый доступный вариант University of Westminster, в Hoxton (N1). 38 недель контракт, общая ванная, ванная в коридоре. Открыто для first-year UG в центральных лондонских кампусах.',
      sourceUrl: 'https://www.westminster.ac.uk/study/accommodation/alexander-fleming-hall',
    },
    {
      name: 'Alexander Fleming Hall (Standard single)',
      price: '£219.94/нед',
      text: '166 стандартных single rooms — следующая ступень после budget. Адрес 3 Hoxton Market, N1 6HG. Прямой автобус до Regent Campus. Цена за 2026-27, контракт 38 недель.',
      sourceUrl: 'https://www.westminster.ac.uk/study/accommodation/alexander-fleming-hall',
    },
  ],
  york: [
    {
      name: 'Halifax College (shared bathroom)',
      price: '£149/нед',
      text: 'Один из самых доступных колледжей University of York на Campus West — self-catered, shared bathroom (St Lawrence flats). 40 недель контракт. Также доступен Halifax single en-suite по £176-£211/нед.',
      sourceUrl: 'https://www.york.ac.uk/study/accommodation/rooms-prices/halifax/',
    },
    {
      name: 'Constantine College (ensuite, Campus East)',
      price: '£231/нед',
      text: '620 комнат на Campus East — ensuite со встроенной кухней, three-quarter bed, недельный обед включён в стоимость (Piazza Building). 44 недели контракт. Близко к Sports Village и retail park.',
      sourceUrl: 'https://www.york.ac.uk/study/accommodation/rooms-prices/constantine/',
    },
  ],
  'uwe-bristol': [
    {
      name: 'Wallscourt Park (shared bathroom)',
      price: '£144.10/нед',
      text: 'Самый бюджетный вариант UWE — таунхаусы и флаты на Frenchay Campus, в нескольких минутах от библиотеки 24/7 и Centre for Sport. Общая ванная, 42 недели контракт. Также доступны en-suite (£205.86) и studio (£280.36).',
      sourceUrl: 'https://www.uwe.ac.uk/life/accommodation/frenchay-campus/wallscourt-park',
    },
    {
      name: 'Student Village (en-suite standard)',
      price: '£221.24/нед',
      text: 'Главная студенческая деревня UWE на Frenchay — почти 2000 студентов в 4 дворах (Brecon, Cotswold, Mendip, Quantock). En-suite комнаты в 5-6-местных флатах с общей кухней. Superior en-suite £233.65/нед.',
      sourceUrl: 'https://www.uwe.ac.uk/life/accommodation/frenchay-campus/student-village',
    },
  ],
  alberta: [
    {
      name: 'Lister Residence (Classic Towers)',
      price: 'от CA$1,033/мес',
      text: 'Главная резиденция для первокурсников на North Campus — обновлённые башни Anthony Henday, Henry Kelsey и Alexander Mackenzie. Двухместные комнаты, столовая с meal plan включён в стоимость, тренажёрка, музыкальная комната, learning centre. 8-месячный контракт.',
      sourceUrl: 'https://www.ualberta.ca/en/residence/our-residences/lister-residence.html',
    },
    {
      name: 'HUB / Peter Lougheed Hall (en-suite)',
      price: 'от CA$1,335/мес',
      text: 'Современные одноместные комнаты с полу-приватной ванной в Peter Lougheed Hall и квартиры-студии в HUB Mall на North Campus. Включены коммунальные услуги, интернет, страховка. Для тех, кто хочет больше уединения.',
      sourceUrl: 'https://www.ualberta.ca/residence/our-residences/unit-types.html',
    },
    {
      name: 'Augustana Campus (Camrose)',
      price: 'от CA$532/мес',
      text: 'Самый доступный вариант — Hoyme Complex и Ravine Complex на кампусе Augustana в Камрозе, 90 км от Эдмонтона. Маленькое сообщество, лесной кампус, цены значительно ниже основного кампуса. 4-8-месячные контракты.',
      sourceUrl: 'https://www.ualberta.ca/en/residence/our-residences/index.html',
    },
  ],
  victoria: [
    {
      name: 'Cluster: 4-bedroom unit',
      price: 'CA$9,653/год',
      text: 'Самый бюджетный вариант UVic — отдельная спальня в полностью оборудованной квартире на 4 студентов: полная кухня, гостиная, 2 ванных. Включены отопление, горячая вода, электричество и интернет. 8-месячный контракт (сентябрь–апрель).',
      sourceUrl: 'https://www.uvic.ca/residence/future-residents/fees/index.php',
    },
    {
      name: 'Dormitory: Single room (meal plan)',
      price: 'CA$15,785/год',
      text: 'Одноместная комната в общежитии Cheko’nien House или Sngequ House (новые здания) с включённым стандартным meal plan — завтрак, обед, ужин в столовой кампуса. Идеально для первокурсников, хотят сосредоточиться на учёбе.',
      sourceUrl: 'https://www.uvic.ca/residence/future-residents/fees/schedule/index.php',
    },
    {
      name: 'One-bedroom Apartment',
      price: 'CA$12,105/год',
      text: 'Автономная однокомнатная квартира — собственная спальня, кухня, ванная. Подходит для постдипломных или семейных студентов. Можно докупить tax-exempt meal plan отдельно. 8-месячный контракт.',
      sourceUrl: 'https://www.uvic.ca/residence/future-residents/fees/index.php',
    },
  ],
};

export function getUniAccommodationFacts(slug: string): UniAccommodationFact[] {
  return FACTS[slug] ?? [];
}
