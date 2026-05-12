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
      img: '/photos/asu-london/accommodation-cards/private-halls.jpg',
      sourceUrl: 'https://asu-london.ac.uk/accommodation/',
    },
    {
      name: 'Совместная квартира в Лондоне (London Zone 2-3)',
      price: 'от £180/нед',
      text: 'Бюджетный вариант — комната в общем доме или квартире в зонах 2-3 (Stratford, Whitechapel, Camden). Удобное транспортное сообщение до кампуса в центре. Консультанты ASU London помогут найти проверенный вариант.',
      img: '/photos/asu-london/accommodation-cards/shared-flat.jpg',
      sourceUrl: 'https://asu-london.ac.uk/faqs/',
    },
  ],
  bournemouth: [
    {
      name: 'Purbeck House (standard, 42 недели)',
      price: '£165.59/нед',
      text: 'Студенческая резиденция в центре Борнмута, рядом с главным транспортным узлом и зданиями Lansdowne Campus. Все коммунальные услуги, контентная страховка, годовой проездной и Wi-Fi включены в стоимость.',
      img: '/photos/bournemouth/accommodation-cards/purbeck-standard.jpg',
      sourceUrl: 'https://www.bournemouth.ac.uk/why-bu/accommodation/accommodation-options/purbeck-house',
    },
    {
      name: 'Purbeck House Studio (50 недель)',
      price: '£196.52/нед',
      text: 'Автономная студия с собственной кухней — в той же резиденции в центре города. Включает en-suite, Wi-Fi, бойлер и все услуги. Подходит для тех, кому нужно собственное пространство.',
      img: '/photos/bournemouth/accommodation-cards/purbeck-studio.jpg',
      sourceUrl: 'https://www.bournemouth.ac.uk/why-bu/accommodation/accommodation-options/purbeck-house',
    },
  ],
  'city-london': [
    {
      name: 'Halls of residence — Northampton Square / Cross Court',
      price: 'от £195/нед',
      text: 'City St George’s управляет халами рядом с главным кампусом (Arbour House, Cross Court House, Romano Court, The Garden Halls). University subsidises rents to keep costs low — first-year undergrads receive a place guarantee если применят до дедлайна.',
      img: '/photos/city-london/accommodation-cards/private-halls.jpg',
      sourceUrl: 'https://www.city.ac.uk/prospective-students/accommodation',
    },
    {
      name: 'Romano Court / The Garden Halls (en-suite)',
      price: 'от £270/нед',
      text: 'Современные en-suite халы в центре Лондона, рядом со станцией Russell Square. Стандартная цена за en-suite комнату с общей кухней — все коммунальные услуги и Wi-Fi включены.',
      img: '/photos/city-london/accommodation-cards/shared-flat.jpg',
      sourceUrl: 'https://www.city.ac.uk/prospective-students/accommodation/applying-for-halls/undergraduate',
    },
  ],
  cranfield: [
    {
      name: 'Stringfellow Hall (en-suite, self-catered)',
      price: '£219.45/нед',
      text: '196 комнат en-suite в одном из самых популярных кампусов Cranfield — короткая прогулка до Mitchell Hall, лекционных залов и лабораторий. Включены газ, электричество, вода, Wi-Fi, 24/7 охрана и бесплатная парковка.',
      img: '/photos/cranfield/accommodation-cards/stringfellow-self-catered.jpg',
      sourceUrl: 'https://www.cranfield.ac.uk/study/life-on-campus/life-at-cranfield/accommodation/halls-of-residence/stringfellow-hall',
    },
    {
      name: 'Stringfellow Hall (en-suite, catered + meals)',
      price: '£257.84/нед',
      text: 'Тот же Stringfellow Hall с включённым ежедневным меню в Mitchell Hall (ресторан + бар на кампусе). Подходит для тех, кто не хочет готовить и предпочитает социальные обеды.',
      img: '/photos/cranfield/accommodation-cards/stringfellow-catered.jpg',
      sourceUrl: 'https://www.cranfield.ac.uk/study/life-on-campus/life-at-cranfield/accommodation/halls-of-residence/stringfellow-hall',
    },
  ],
  'nottingham-trent': [
    {
      name: 'Gill Street North (Standard Ensuite, 44 недели)',
      price: '£150.43/нед',
      text: 'Один из самых доступных вариантов в центре Ноттингема — 422 self-catered комнаты на City Campus, 10 минут пешком до Boots library и центра города. Twin Studio тариф (£150.43) — для тех, кто готов жить вдвоём в студии.',
      img: '/photos/nottingham-trent/accommodation-cards/gill-street-north.jpg',
      sourceUrl: 'https://www.ntu.ac.uk/life-at-ntu/accommodation/find-ntu-accommodation/gill-street-north',
    },
    {
      name: 'Peverell (Standard Ensuite, 44 недели)',
      price: '£181.93/нед',
      text: '772 self-catered en-suite комнаты на Clifton Campus — близко к лекциям, библиотеке, спортивному центру и студенческому пабу The Point. Большие общие кухни на 6 человек, доступна парковка.',
      img: '/photos/nottingham-trent/accommodation-cards/peverell.jpg',
      sourceUrl: 'https://www.ntu.ac.uk/life-at-ntu/accommodation/find-ntu-accommodation/peverell',
    },
  ],
  'queen-mary-london': [
    {
      name: 'Stern House (Mile End — Single Standard)',
      price: 'от £167.09/нед',
      text: 'Самый бюджетный вариант на Mile End Campus — single standard комнаты с общей ванной в флатах на 3-6 человек. Контракт 38.3 недели. Прямо на главном кампусе университета в East London.',
      img: '/photos/queen-mary-london/accommodation-cards/private-halls.jpg',
      sourceUrl: 'https://www.qmul.ac.uk/residences/college/fees/index.html',
    },
    {
      name: 'Pooley House (Student Village, En-suite)',
      price: '£208.60/нед',
      text: '373 en-suite комнаты Single Standard в студенческой деревне на Mile End — собственная ванная, общая кухня на 5-9 человек. 24/7 поддержка, прачечная, велопарковка, охрана. Все коммунальные услуги включены.',
      img: '/photos/queen-mary-london/accommodation-cards/shared-flat.jpg',
      sourceUrl: 'https://www.qmul.ac.uk/residences/college/qmaccommodation/mileendug/pooley/',
    },
  ],
  birmingham: [
    {
      name: 'Maple Bank (The Vale Village, бюджетный)',
      price: '£107/нед',
      text: 'Один из самых доступных вариантов в Великобритании — комнаты в The Vale Village, самой крупной студенческой деревне Birmingham рядом с озером Edgbaston Pool. Self-catered, идеален для бюджетных студентов.',
      img: '/photos/birmingham/accommodation-cards/maple-bank.jpg',
      sourceUrl: 'https://www.birmingham.ac.uk/accommodation/accommodation-fees',
    },
    {
      name: 'Mason (The Vale, en-suite, 42 недели)',
      price: '£206-£213/нед',
      text: '800 студентов в одной из самых новых резиденций кампуса Edgbaston — en-suite комнаты с видом на озеро. Bike storage, accessible rooms, спокойная парковая зона в 15 минутах ходьбы до главного кампуса.',
      img: '/photos/birmingham/accommodation-cards/mason.jpg',
      sourceUrl: 'https://www.birmingham.ac.uk/accommodation/residences/undergraduate/mason',
    },
  ],
  brighton: [
    {
      name: 'Varley Park (standard shared bathroom)',
      price: '£173/нед',
      text: 'Самый бюджетный вариант — single room с общей ванной (минимум 2 душа на флат). 225 комнат, контракт 39 недель, рядом с кампусом Moulsecoomb. Включает все коммунальные услуги.',
      img: '/photos/brighton/accommodation-cards/varley-park.jpg',
      sourceUrl: 'https://www.brighton.ac.uk/accommodation-and-locations/university-accommodation/index.aspx',
    },
    {
      name: 'Paddock Field (Falmer, en-suite)',
      price: '£192/нед',
      text: 'En-suite single room (11.8 м²) на Falmer Campus — на границе South Downs National Park, 10 минут на поезде до центра Брайтона. Подходит студентам Falmer и Moulsecoomb кампусов.',
      img: '/photos/brighton/accommodation-cards/paddock-field.jpg',
      sourceUrl: 'https://www.brighton.ac.uk/accommodation-and-locations/university-accommodation/falmer-halls.aspx',
    },
  ],
  bristol: [
    {
      name: 'University Hall (single, self-catered)',
      price: '£140.21/нед',
      text: 'Один из самых доступных вариантов — single room в Stoke Bishop, North West Bristol. 320 мест, self-catered, 2 мили до Clifton campus, общая ванная на 5 студентов и общая кухня. Старое здание, цена отражает отсутствие недавнего ремонта.',
      img: '/photos/bristol/accommodation-cards/university-hall.jpg',
      sourceUrl: 'https://www.bristol.ac.uk/accommodation/about/residences/university-hall/',
    },
    {
      name: 'Clifton Hill House (catered, исторический)',
      price: '£210.63-£263.06/нед',
      text: 'Catered halls в престижном районе Clifton — собственная столовая, общие гостиные, сад. Состоит из 4 зданий. Доступны twin (£206), single basic (£210), single standard (£245), single standard plus (£263). Включает завтрак и ужин.',
      img: '/photos/bristol/accommodation-cards/clifton-hill-house.jpg',
      sourceUrl: 'https://www.bristol.ac.uk/accommodation/about/residences/clifton-hill/',
    },
  ],
  essex: [
    {
      name: 'South Towers (single shared facilities)',
      price: '£142.87/нед',
      text: 'Бюджетный вариант — single enhanced room в обновлённой башне на Colchester Campus, прямо напротив SU, спортивного центра и лекционных залов. Общая ванная, фиксированная цена включает интернет и коммунальные услуги.',
      img: '/photos/essex/accommodation-cards/south-towers.jpg',
      sourceUrl: 'https://www1.essex.ac.uk/life/accommodation/colchester/south-towers',
    },
    {
      name: 'The Houses (single en-suite)',
      price: '£187.88-£197.89/нед',
      text: '267 en-suite комнат в тихой парковой зоне на севере Colchester Campus — 5 минут пешком до библиотеки и SU. Стандартные £187.88, enhanced (обновлённые) £188.16, premium (с большой кроватью) £197.89.',
      img: '/photos/essex/accommodation-cards/the-houses.jpg',
      sourceUrl: 'https://www.essex.ac.uk/life/accommodation/campus/colchester/the-houses',
    },
  ],
  glasgow: [
    {
      name: 'Cairncross House (single, self-catered)',
      price: '£161.49/нед',
      text: '15-20 минут от Gilmorehill main campus, на Kelvinhaugh Street — single £161.49, large single £172.90, shared £125.02. 212 мест в флатах на 5 человек, для UG и PG студентов. Контракт 39 недель (Sep-June).',
      img: '/photos/glasgow/accommodation-cards/cairncross-house.jpg',
      sourceUrl: 'https://www.gla.ac.uk/undergraduate/accommodation/fees/',
    },
    {
      name: 'Murano Street Student Village (single en-suite)',
      price: '£172.90/нед',
      text: 'Большая студенческая деревня в West End — все комнаты en-suite single, общая кухня в флатах. 5 минут до Kelvinbridge subway, 15 минут до главного кампуса. Все коммунальные услуги включены.',
      img: '/photos/glasgow/accommodation-cards/murano-street.jpg',
      sourceUrl: 'https://www.gla.ac.uk/undergraduate/accommodation/residenceprofiles/',
    },
  ],
  liverpool: [
    {
      name: 'Crown Place (Single room, en-suite)',
      price: '£197.33/нед',
      text: 'Премиум-резиденция в самом центре кампуса — собственная ванная, общая кухня и гостиная на 3-7 человек. 24/7 reception, прачечная, игровая зона, тренажёрная. Контракт 39 недель. Часто sold out — подавайте заявку рано.',
      img: '/photos/liverpool/accommodation-cards/crown-place.jpg',
      sourceUrl: 'https://www.liverpool.ac.uk/accommodation/find-accommodation/crown-place/single-room/',
    },
    {
      name: 'Greenbank Student Village (Premier room)',
      price: '£219.03/нед',
      text: 'Большая студенческая деревня в 1.5 км от главного кампуса — Premier en-suite комнаты, рядом со спортивным центром и парком Greenbank. Также доступны Premier studio (£243.39) и studio apartment (£265.93).',
      img: '/photos/liverpool/accommodation-cards/greenbank.jpg',
      sourceUrl: 'https://www.liverpool.ac.uk/accommodation/finder/',
    },
  ],
  nottingham: [
    {
      name: 'Cripps Hall (Single Study, catered)',
      price: '£267/нед',
      text: 'Catered hall на University Park Campus — 17 приёмов пищи в неделю включены. Single study room с общей ванной на 5 человек. £290 за Single Study Plus (3/4 bed). Контракт 41 неделя — отмена без штрафов при провале визы.',
      img: '/photos/nottingham/accommodation-cards/cripps-hall.jpg',
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
      img: '/photos/westminster/accommodation-cards/alexander-fleming-budget.jpg',
      sourceUrl: 'https://www.westminster.ac.uk/study/accommodation/alexander-fleming-hall',
    },
    {
      name: 'Alexander Fleming Hall (Standard single)',
      price: '£219.94/нед',
      text: '166 стандартных single rooms — следующая ступень после budget. Адрес 3 Hoxton Market, N1 6HG. Прямой автобус до Regent Campus. Цена за 2026-27, контракт 38 недель.',
      img: '/photos/westminster/accommodation-cards/alexander-fleming-standard.jpg',
      sourceUrl: 'https://www.westminster.ac.uk/study/accommodation/alexander-fleming-hall',
    },
  ],
  york: [
    {
      name: 'Halifax College (shared bathroom)',
      price: '£149/нед',
      text: 'Один из самых доступных колледжей University of York на Campus West — self-catered, shared bathroom (St Lawrence flats). 40 недель контракт. Также доступен Halifax single en-suite по £176-£211/нед.',
      img: '/photos/york/accommodation-cards/halifax.jpg',
      sourceUrl: 'https://www.york.ac.uk/study/accommodation/rooms-prices/halifax/',
    },
    {
      name: 'Constantine College (ensuite, Campus East)',
      price: '£231/нед',
      text: '620 комнат на Campus East — ensuite со встроенной кухней, three-quarter bed, недельный обед включён в стоимость (Piazza Building). 44 недели контракт. Близко к Sports Village и retail park.',
      img: '/photos/york/accommodation-cards/constantine.jpg',
      sourceUrl: 'https://www.york.ac.uk/study/accommodation/rooms-prices/constantine/',
    },
  ],
  'uwe-bristol': [
    {
      name: 'Wallscourt Park (shared bathroom)',
      price: '£144.10/нед',
      text: 'Самый бюджетный вариант UWE — таунхаусы и флаты на Frenchay Campus, в нескольких минутах от библиотеки 24/7 и Centre for Sport. Общая ванная, 42 недели контракт. Также доступны en-suite (£205.86) и studio (£280.36).',
      img: '/photos/uwe-bristol/accommodation-cards/wallscourt-park.jpg',
      sourceUrl: 'https://www.uwe.ac.uk/life/accommodation/frenchay-campus/wallscourt-park',
    },
    {
      name: 'Student Village (en-suite standard)',
      price: '£221.24/нед',
      text: 'Главная студенческая деревня UWE на Frenchay — почти 2000 студентов в 4 дворах (Brecon, Cotswold, Mendip, Quantock). En-suite комнаты в 5-6-местных флатах с общей кухней. Superior en-suite £233.65/нед.',
      img: '/photos/uwe-bristol/accommodation-cards/student-village.jpg',
      sourceUrl: 'https://www.uwe.ac.uk/life/accommodation/frenchay-campus/student-village',
    },
  ],
  alberta: [
    {
      img: '/photos/alberta/accommodation-cards/lister.jpg',
      name: 'Lister Residence (Classic Towers)',
      price: 'от CA$1,033/мес',
      text: 'Главная резиденция для первокурсников на North Campus — обновлённые башни Anthony Henday, Henry Kelsey и Alexander Mackenzie. Двухместные комнаты, столовая с meal plan включён в стоимость, тренажёрка, музыкальная комната, learning centre. 8-месячный контракт.',
      sourceUrl: 'https://www.ualberta.ca/en/residence/our-residences/lister-residence.html',
    },
    {
      img: '/photos/alberta/accommodation-cards/peter-lougheed.jpg',
      name: 'HUB / Peter Lougheed Hall (en-suite)',
      price: 'от CA$1,335/мес',
      text: 'Современные одноместные комнаты с полу-приватной ванной в Peter Lougheed Hall и квартиры-студии в HUB Mall на North Campus. Включены коммунальные услуги, интернет, страховка. Для тех, кто хочет больше уединения.',
      sourceUrl: 'https://www.ualberta.ca/residence/our-residences/unit-types.html',
    },
    {
      img: '/photos/alberta/accommodation-cards/augustana.jpg',
      name: 'Augustana Campus (Camrose)',
      price: 'от CA$532/мес',
      text: 'Самый доступный вариант — Hoyme Complex и Ravine Complex на кампусе Augustana в Камрозе, 90 км от Эдмонтона. Маленькое сообщество, лесной кампус, цены значительно ниже основного кампуса. 4-8-месячные контракты.',
      sourceUrl: 'https://www.ualberta.ca/en/residence/our-residences/index.html',
    },
  ],
  victoria: [
    {
      img: '/photos/victoria/accommodation-cards/cluster.jpg',
      name: 'Cluster: 4-bedroom unit',
      price: 'CA$9,653/год',
      text: 'Самый бюджетный вариант UVic — отдельная спальня в полностью оборудованной квартире на 4 студентов: полная кухня, гостиная, 2 ванных. Включены отопление, горячая вода, электричество и интернет. 8-месячный контракт (сентябрь–апрель).',
      sourceUrl: 'https://www.uvic.ca/residence/future-residents/fees/index.php',
    },
    {
      img: '/photos/victoria/accommodation-cards/dormitory.jpg',
      name: 'Dormitory: Single room (meal plan)',
      price: 'CA$15,785/год',
      text: 'Одноместная комната в общежитии Cheko’nien House или Sngequ House (новые здания) с включённым стандартным meal plan — завтрак, обед, ужин в столовой кампуса. Идеально для первокурсников, хотят сосредоточиться на учёбе.',
      sourceUrl: 'https://www.uvic.ca/residence/future-residents/fees/schedule/index.php',
    },
    {
      img: '/photos/victoria/accommodation-cards/apartment.jpg',
      name: 'One-bedroom Apartment',
      price: 'CA$12,105/год',
      text: 'Автономная однокомнатная квартира — собственная спальня, кухня, ванная. Подходит для постдипломных или семейных студентов. Можно докупить tax-exempt meal plan отдельно. 8-месячный контракт.',
      sourceUrl: 'https://www.uvic.ca/residence/future-residents/fees/index.php',
    },
  ],

  'arizona-state': [
    {
      img: '/photos/arizona-state/accommodation-cards/manzanita.jpg',
      name: 'Manzanita Hall (Tempe, freshman co-ed)',
      price: 'от $13,836/год',
      text: 'Главное общежитие первокурсников Tempe campus — двухместные комнаты, тематические floors (College of Liberal Arts and Sciences residential community). Lounges, prac.area, столовая рядом. Тёплый климат — почти круглый год без отопления.',
      sourceUrl: 'https://housing.asu.edu/housing-communities/residential-colleges/manzanita-hall',
    },
    {
      img: '/photos/arizona-state/accommodation-cards/vista-del-sol.jpg',
      name: 'Vista Del Sol (Tempe, upperclassmen)',
      price: 'от $15,000/год',
      text: 'Apartment-style жильё для старшекурсников Tempe campus — 4-bedroom flats, собственная кухня и ванная. Современные корпуса, бассейн, фитнес. В шаговой доступности от учебных зданий.',
      sourceUrl: 'https://housing.asu.edu/housing-communities/upperclass/vista-del-sol',
    },
    {
      img: '/photos/arizona-state/accommodation-cards/new-residence.jpg',
      name: 'Tempe’s New Residence Hall',
      price: 'от $14,500/год',
      text: 'Новейшая резиденция Tempe campus — открыта в 2024, современные комнаты, study lounges, кафе на первом этаже. Включает все коммунальные и meal plan от $5,950.',
      sourceUrl: 'https://housing.asu.edu/tempes-new-residence-hall',
    },
  ],

  pace: [
    {
      img: '/photos/pace/accommodation-cards/33-beekman.jpg',
      name: '33 Beekman (NYC)',
      price: 'от $17,600/год',
      text: 'Самое высокое студенческое общежитие в мире — 34 этажа в Lower Manhattan с панорамными видами на Brooklyn Bridge и Wall Street. Suite-style комнаты на 7-10 человек, fitness center, общие lounges. 5 минут пешком до главного корпуса Pace NYC.',
      sourceUrl: 'https://www.pace.edu/housing/residence-halls/33-beekman',
    },
    {
      img: '/photos/pace/accommodation-cards/182-broadway.jpg',
      name: '182 Broadway (NYC)',
      price: 'от $18,000/год',
      text: 'Современная резиденция в Financial District — double и triple rooms, study lounges, общие кухни на каждом этаже. 24/7 security, прачечная, в 3 минутах от One Pace Plaza.',
      sourceUrl: 'https://www.pace.edu/housing/residence-halls',
    },
    {
      img: '/photos/pace/accommodation-cards/alumni-hall.jpg',
      name: 'Alumni Hall (Pleasantville, freshman)',
      price: 'от $12,660/год',
      text: 'Главное общежитие первокурсников Westchester campus — 527 студентов, 4 этажа. Двух- и трёхместные suite-style комнаты, две учебные аудитории на месте, столовая, lounges, First Year Interest Groups. Прямой Metro-North до NYC за 45 минут.',
      sourceUrl: 'https://www.pace.edu/housing/residence-halls/alumni-hall',
    },
  ],

  simmons: [
    {
      name: 'Dix Hall / Morse Hall / Simmons Hall (first-year)',
      price: 'от $18,146/год (с meal plan)',
      text: 'Резиденции первокурсников на закрытом Residence Campus — двухместные комнаты, shared bathroom, free laundry, lounges. 5 минут пешком до Academic Campus. 24-часовая охрана, медцентр, фитнес рядом.',
      sourceUrl: 'https://www.simmons.edu/student-life/living-campus/residence-halls',
    },
    {
      name: 'Smith Hall / Arnold Hall (upperclassmen)',
      price: 'от $18,146/год (с meal plan)',
      text: 'Резиденции для juniors и seniors — больше singles, тише атмосфера, общие кухни на этажах. Smith — для старшеклассников, Arnold — для juniors/seniors. Все включено: интернет, прачечная, охрана.',
      sourceUrl: 'https://www.simmons.edu/student-life/living-campus/residence-halls/residence-hall-room-types',
    },
    {
      name: 'North Hall (Arts & Activism Community)',
      price: 'от $18,146/год (с meal plan)',
      text: 'Тематическое общежитие для студентов искусств и социального активизма — Living-Learning Community. Совместные проекты, гостевые лекторы, ателье на месте.',
      sourceUrl: 'https://www.simmons.edu/student-life/living-campus/residence-halls',
    },
  ],

  uconn: [
    {
      name: 'Towers Residence Halls (Storrs, first-year)',
      price: 'от $14,428/год',
      text: 'Главный комплекс жилья для первокурсников на Storrs campus — несколько высоких башен с doubles и singles. Гарантировано для всех first-year. Общие кухни, lounges, study rooms на этажах.',
      sourceUrl: 'https://campushousing.uconn.edu/residence-halls/areas-and-buildings/',
    },
    {
      name: 'Hilltop Apartments (Storrs, upperclassmen)',
      price: 'от $16,500/год',
      text: 'Apartment-style жильё для старшекурсников — 4-bedroom flats с собственной кухней и ванной. На холме над основным кампусом, тише, более независимая жизнь.',
      sourceUrl: 'https://campushousing.uconn.edu/residence-halls/',
    },
    {
      name: 'Stamford Campus housing',
      price: 'от $15,270/год',
      text: 'Жильё для студентов Stamford campus — современное городское здание рядом с UConn Stamford. Городская атмосфера, шаговая доступность от метро.',
      sourceUrl: 'https://stamford.uconn.edu/student-life/housing/',
    },
  ],

  oregon: [
    {
      img: '/photos/oregon/accommodation-cards/global-scholars.jpg',
      name: 'Global Scholars Hall (Eugene)',
      price: 'от $15,504/год',
      text: 'Тематическое общежитие для иностранных студентов — modern singles & doubles, language partner programs, faculty-in-residence. В 5 минутах от Knight Library. Идеальное место для первого года в США.',
      sourceUrl: 'https://housing.uoregon.edu/halls',
    },
    {
      img: '/photos/oregon/accommodation-cards/kalapuya.jpg',
      name: 'Kalapuya Ilihi (Eugene, LLC)',
      price: 'от $12,207/год',
      text: 'Living Learning Community с фокусом на Native American Studies и устойчивом развитии. Двух- и трёхместные комнаты, study lounges, gardens. Открыто всем студентам.',
      sourceUrl: 'https://housing.uoregon.edu/halls',
    },
    {
      img: '/photos/oregon/accommodation-cards/earl-carson.jpg',
      name: 'Earl Hall / Carson Hall (classic)',
      price: 'от $12,016/год',
      text: 'Классические dormitory-style halls — double/triple rooms, shared bathroom, общая столовая на первом этаже. Самый бюджетный вариант on-campus.',
      sourceUrl: 'https://housing.uoregon.edu/halls',
    },
  ],

  adelaide: [
    {
      name: 'Roseworthy Residential College',
      price: 'от AU$300/неделя',
      text: 'Catered residential college прямо на Roseworthy campus (50 км к северу от центра) — single furnished rooms, ежедневные приёмы пищи в столовой. Только для студентов Roseworthy (ветеринария, агрономия). 41 неделя контракт.',
      sourceUrl: 'https://www.adelaide.edu.au/accommodation/university-managed-student-accommodation/roseworthy-residential-college',
    },
    {
      name: 'University-managed apartments (North Terrace)',
      price: 'от AU$280/неделя',
      text: 'Self-catered apartments рядом с main City Campus на North Terrace — single и shared options. Шаговая доступность от учебных корпусов, центра Аделаиды, общественного транспорта.',
      sourceUrl: 'https://adelaideuni.edu.au/life-at-adelaide/accommodation/student-accommodation/university-managed-student-accommodation/',
    },
    {
      name: 'Partner residences (UniLodge, Yugo, Iglu)',
      price: 'от AU$250/неделя',
      text: 'Партнёрские студенческие резиденции в центре Аделаиды — UniLodge on Light Square, Yugo Adelaide City, Iglu Adelaide. Современные studio и shared apartments, все коммунальные включены.',
      sourceUrl: 'https://www.adelaide.edu.au/accommodation/',
    },
  ],

  murdoch: [
    {
      img: '/photos/murdoch/accommodation-cards/village.jpg',
      name: 'Murdoch University Village',
      price: 'от AU$250/неделя',
      text: 'Главное студенческое поселение прямо на South Street campus — 800+ мест, en-suite комнаты и 1-bedroom apartments. Бассейн, BBQ, gym, study rooms. 500 м от учебных корпусов. Управляется Campus Living Villages.',
      sourceUrl: 'https://campuslivingvillages.com/australia/perth/murdoch-university-village/',
    },
    {
      img: '/photos/murdoch/accommodation-cards/village-room.jpg',
      name: 'Off-campus shared apartments (Perth)',
      price: 'от AU$180/неделя',
      text: 'Бюджетный вариант — комната в общей квартире в южных пригородах Перта (Murdoch, Bull Creek, Leeming). 10-20 минут на автобусе до кампуса. Используйте поиск Murdoch Accommodation Service.',
      sourceUrl: 'https://www.murdoch.edu.au/study/international-students/life-in-perth/accommodation',
    },
  ],

  'newcastle-au': [
    {
      name: 'Edwards Hall (Callaghan, catered)',
      price: 'от AU$320/неделя',
      text: 'Самый старый и крупный hall — 400 резидентов, catered dormitory-style + self-catered units на 5 человек. Бассейн, BBQ, common rooms с pool и foosball. Сильная традиция студенческих сообществ.',
      sourceUrl: 'https://www.newcastle.edu.au/campus-life/accommodation/on-campus-accommodation/where-can-i-live/edwards-hall',
    },
    {
      name: 'Barahineban (Callaghan, self-contained)',
      price: 'от AU$340/неделя',
      text: '96 self-contained studio apartments — fully furnished, single/twin/double конфигурации, self-catered. Для всех уровней обучения, особенно для аспирантов и couples.',
      sourceUrl: 'https://www.newcastle.edu.au/campus-life/accommodation/on-campus-accommodation/where-can-i-live/barahineban',
    },
    {
      name: 'Evatt House (Callaghan, dormitory)',
      price: 'от AU$280/неделя',
      text: 'Бюджетный catered dormitory на Callaghan — single rooms с общей ванной, столовая на месте. Для первокурсников, ищущих традиционный hall experience.',
      sourceUrl: 'https://www.newcastle.edu.au/campus-life/accommodation/on-campus-accommodation/where-can-i-live',
    },
  ],

  massey: [
    {
      img: '/photos/massey/accommodation-cards/pukeko-tui-weka.jpg',
      name: 'Te Ōhanga Village — Pūkeko/Tūī/Weka (catered)',
      price: 'от NZ$13,000/год',
      text: 'Catered halls на Auckland (Albany) campus — для первокурсников 17-25 лет. Single rooms, ежедневные приёмы пищи, RA-программа, активная социальная жизнь. Идеально для первого года в новой стране.',
      sourceUrl: 'https://www.massey.ac.nz/student-life/accommodation/halls-of-residence-apartments-and-studio-units/auckland-halls-of-residence-apartments-and-studio-units/p%C5%ABkeko-tui-and-weka-halls-on-auckland-campus/',
    },
    {
      img: '/photos/massey/accommodation-cards/matipo-titoki.jpg',
      name: 'Matipo/Titoki apartments (self-catered)',
      price: 'от NZ$11,000/год',
      text: 'Self-catered, fully furnished apartments для старшекурсников 21-30 лет — собственная кухня, общая гостиная на 4-6 человек. Больше независимости и тишины.',
      sourceUrl: 'https://www.massey.ac.nz/student-life/accommodation/halls-of-residence-apartments-and-studio-units/auckland-halls-of-residence-apartments-and-studio-units/matipo-titoki-and-t%C4%81nekaha-apartments-auckland-campus/',
    },
    {
      img: '/photos/massey/accommodation-cards/tanekaha-studio.jpg',
      name: 'Tānekaha studio units (постдипломные)',
      price: 'от NZ$15,000/год',
      text: 'Self-contained studio units с собственной мини-кухней и ванной — для аспирантов 25-30 лет и семейных пар. Максимум приватности.',
      sourceUrl: 'https://www.massey.ac.nz/student-life/accommodation/halls-of-residence-apartments-and-studio-units/auckland-halls-of-residence-apartments-and-studio-units/t%C4%81nekaha-studio-units-auckland-campus/',
    },
  ],
};

export function getUniAccommodationFacts(slug: string): UniAccommodationFact[] {
  return FACTS[slug] ?? [];
}
