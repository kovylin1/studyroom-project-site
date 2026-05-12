// Hand-curated Russian translations of the Kaplan partner page "About this
// university" copy. Keyed by registry slug. Merged into the University record
// by `buildDescription` in cli.ts.
//
// Translation conventions:
// - Narrative paragraphs: fully translated.
// - Faculty / program / direction names ("Engineering", "Arts and Humanities"):
//   kept English (per StudyRoom landing convention).
// - Brand / source names (Times Higher Education, Complete University Guide,
//   QS, Russell Group, Kaplan International College, etc.): kept English.
// - University long names: case-by-case. "University of Glasgow" mid-sentence
//   reads as "Университет Глазго"; institutional brand references like
//   "Queen Mary University of London", "ASU London" stay English.
// - Ordinal rankings: "5th in the UK" -> "5-е место в Великобритании".
//   "Joint Nth..." -> "Совместное N-е место...". "Top N in the world" ->
//   "Топ-N в мире". "#N in Canada" -> "№N в Канаде".

export interface DescriptionTranslation {
  paragraphsRu?: string[];
  keyFactsRu?: string[];
}

const TRANSLATIONS: Record<string, DescriptionTranslation> = {
  alberta: {
    paragraphsRu: [
      'Университет Альберты (U of A) — университет мирового масштаба с международной репутацией академического превосходства и исключительной трудоустраиваемостью выпускников.',
      'Через программу U of A Year One Foundation вы можете перейти сразу на второй курс бакалавриата, не теряя времени на пути к выпуску.',
      'Расположенный в Эдмонтоне — столице провинции Альберта, U of A является ведущим канадским университетом с впечатляющим послужным списком по трудоустройству и успеху выпускников.',
      'Дружное сообщество из тысяч иностранных студентов рядом с центром Эдмонтона — стремительно растущего города. Огромный современный кампус и приветливая студенческая среда делают U of A идеальным местом для учёбы и роста.',
    ],
    keyFactsRu: [
      'Топ-150 в мире (QS World Rankings by Subject 2025)',
      '№1 в Канаде (Shanghai Global Rankings of Academic Subjects 2025)',
      '№4 в Канаде (Shanghai Global Rankings of Academic Subjects 2025)',
      'Топ-250 в мире (QS World University Rankings by Subject 2025)',
      '№3 в Канаде (U.S. News & World Report Best Global Universities 2025–26)',
      '№4 в Канаде (U.S. News & World Report Best Global Universities 2025–26)',
      'Топ-200 в мире (QS World University Rankings by Subject 2025)',
      'Топ-75 в мире (Shanghai Global Rankings of Academic Subjects 2025)',
    ],
  },

  'asu-london': {
    paragraphsRu: [
      'Удвойте карьерные перспективы и получите две степени в двух странах — всего за четыре года.',
      'Arizona State University занимает 1-е место в США по инновациям.',
      'Получите степень бакалавра в ASU London в Великобритании, а затем магистра в Arizona State University в США — всего за четыре года.',
      'В ASU London вы приобретёте важные карьерные навыки через практическое обучение и реальный опыт работы.',
    ],
  },

  birmingham: {
    paragraphsRu: [
      'Высокорейтинговый «red brick»-университет мирового уровня в сердце Англии. University of Birmingham имеет отличную репутацию у работодателей.',
      'University of Birmingham занимает высокие позиции по широкому спектру предметов — вы сможете прийти к своей идеальной программе.',
      'Бирмингем — второй по величине город Великобритании. Огромное многообразие культур, кухонь и фестивалей со всего мира делают завязывание связей здесь лёгким.',
      'Имея более 100 лет академического превосходства, University of Birmingham — место, где вы можете построить будущее со степенью, которую уважают работодатели.',
    ],
    keyFactsRu: [
      '12-е место в Великобритании (Guardian University Guide 2026)',
      '17-е место в Великобритании (Complete University Guide 2026)',
      '15-е место в Великобритании (Complete University Guide 2026)',
      '13-е место в Великобритании (Times and Sunday Times Good University Guide 2026)',
      '12-е место в Великобритании (Complete University Guide 2026)',
      '4-е место в Великобритании (Complete University Guide 2026)',
      '20-е место в Великобритании (Times and Sunday Times Good University Guide 2026)',
      '15-е место в Великобритании (Times and Sunday Times Good University Guide 2026)',
    ],
  },

  bournemouth: {
    paragraphsRu: [
      'Расположенный на южном побережье Англии в живом приморском городе, BU предлагает международный взгляд на образование и отличные возможности для получения отраслевого опыта во время учёбы.',
      'BU предлагает множество программ для старта карьерного пути, в том числе аккредитованных профессиональными ассоциациями.',
      'Борнмут — идеальное место для творческих умов. Это центр совместного обучения и обмена идеями.',
      'Будучи одним из ведущих современных университетов Великобритании, Bournemouth University поощряет инновации и учит студентов применять их в карьере.',
    ],
    keyFactsRu: [
      '19-е место в Великобритании (Complete University Guide 2026)',
      '31-е место в Великобритании (Guardian University Guide 2026)',
      '30-е место в Великобритании (Complete University Guide 2026)',
      '19-е место в Великобритании (Times and Sunday Times Good University Guide 2026)',
      '16-е место в Великобритании (Complete University Guide 2026)',
      '22-е место в Великобритании (Complete University Guide 2026)',
      '20-е место в Великобритании (Guardian University Guide 2026)',
      '20-е место в Великобритании (Complete University Guide 2026)',
    ],
  },

  brighton: {
    paragraphsRu: [
      'Развивайте навыки и уверенность через практическое обучение в этом нацеленном на карьеру университете в дружелюбном приморском городе.',
      'Brighton превосходно справляется со многими предметами — учитесь по любимой специальности с уверенностью в качестве образования.',
      'Совместное 7-е место в Великобритании по эффективности преподавания (Guardian University Guide 2026)',
      'Совместное 12-е место в Великобритании по перспективам трудоустройства выпускников (Guardian University Guide 2026)',
    ],
    keyFactsRu: [
      '4-е место в Великобритании (Guardian University Guide 2026)',
    ],
  },

  bristol: {
    paragraphsRu: [
      'Основанный в 1876 году, University of Bristol — университет с богатой историей академических достижений и отличной репутацией у работодателей.',
      'University of Bristol занимает высокие места во многих областях — выбирайте предмет, который соответствует вашим целям.',
      'Бристоль — современный город на юго-западе Англии. Здесь вы присоединитесь к дружелюбному сообществу, полному возможностей.',
      'Стремительно растущий технологический хаб, где базируются стартапы и крупные компании.',
    ],
    keyFactsRu: [
      '20-е место в Великобритании (Complete University Guide 2026)',
      '8-е место в Великобритании (Complete University Guide 2026)',
      '12-е место в Великобритании (Complete University Guide 2026)',
      '6-е место в Великобритании (Complete University Guide 2026)',
      '18-е место в Великобритании (Complete University Guide 2026)',
      '10-е место в Великобритании (Complete University Guide 2026)',
      '7-е место в Великобритании (Guardian University Guide 2026)',
    ],
  },

  'city-london': {
    paragraphsRu: [
      'Качественное преподавание и инфраструктура в одном из крупнейших университетов Лондона. Вы получите выгоду от отличных индустриальных связей City St George’s.',
      'Новый маршрут International Year One ведёт к инженерным программам City St George’s, University of London! Начало — весна 2025 года.',
      'City St George’s, University of London предлагает качественные программы по широкому ряду предметов — следуйте за своей страстью с уверенностью, что это приведёт к отличной карьере.',
      'Готовы найти программу в City St George’s, University of London?',
    ],
  },

  cranfield: {
    paragraphsRu: [
      'Cranfield — исключительно постдипломный британский университет, предлагающий ведущие в мире исследовательские объекты и современнейшие технологии.',
      'Cranfield University специализируется на программах в области менеджмента и технологий, давая постдипломное образование, способное продвинуть вашу карьеру.',
      'Cranfield расположен в спокойной части Англии, где иностранные студенты могут сосредоточиться на учёбе и стать частью процветающего академического сообщества.',
      'Вы присоединитесь к тем, кто хочет видеть картину в целом и находить решения глобальных вызовов.',
    ],
  },

  essex: {
    paragraphsRu: [
      'Прогрессивная, живая международная среда. University of Essex предлагает качественное преподавание на красивом кампусе недалеко от Лондона.',
      'University of Essex занимает высокие позиции во многих предметах, открывая возможность углубиться в любимое направление.',
      'Essex предлагает лучшее из двух миров: красивую сельскую местность, побережье и города в шаговой доступности от Лондона.',
      'Если вы хотите учиться в University of Essex, но пока не соответствуете вступительным требованиям, вы можете пройти подготовительный курс в нашем International College на кампусе и затем перейти в университет.',
    ],
    keyFactsRu: [
      'Совместное 31-е место в Великобритании (QS World University Rankings by Subject 2026)',
      'Совместное 22-е место в Великобритании (Times Higher Education World University Rankings by Subject 2026)',
      'Совместное 16-е место в Великобритании по эффективности преподавания (Guardian University Guide 2026)',
      '11-е место в Великобритании (Guardian University Guide 2026)',
      'Совместное 23-е место в Великобритании (Times Higher Education World University Rankings by Subject 2026)',
      '18-е место в Великобритании (Guardian University Guide 2026)',
      '13-е место в Великобритании (Guardian University Guide 2026)',
      '12-е место в Великобритании (Guardian University Guide 2026)',
    ],
  },

  glasgow: {
    paragraphsRu: [
      'Имея более 550 лет истории, University of Glasgow в Шотландии — один из старейших и наиболее уважаемых университетов Великобритании.',
      'University of Glasgow — один из ведущих по многим предметам, поэтому вы сможете подобрать программу, соответствующую вашим целям и интересам.',
      'Глазго — крупнейший город Шотландии. Его живая атмосфера и дружелюбные жители заставят почувствовать себя как дома с первой минуты.',
      'Здесь поощряют инновационное мышление, ведущее к прогрессу.',
    ],
    keyFactsRu: [
      '5-е место в Великобритании (Times and Sunday Times Good University Guide 2025)',
      '19-е место в Великобритании (Complete University Guide 2026)',
      '12-е место в Великобритании (Guardian University Guide 2026)',
      '9-е место в Великобритании (Times and Sunday Times Good University Guide 2026)',
      '11-е место в Великобритании (Times and Sunday Times Good University Guide 2026)',
      '2-е место в Великобритании (Times and Sunday Times Good University Guide 2026)',
      '14-е место в Великобритании (Times and Sunday Times Good University Guide 2026)',
      '7-е место в Великобритании (Times and Sunday Times Good University Guide 2026)',
    ],
  },

  liverpool: {
    paragraphsRu: [
      'Высокорейтинговый университет с живым кампусом в центре города и преподаванием мирового уровня от ведущих экспертов. Liverpool известен академическим превосходством.',
      'Новая ускоренная программа обучения! Изучайте IYO in Law в Kaplan International College London и переходите сразу на 2-й курс программы University of Liverpool.',
      'Liverpool пользуется высокой репутацией по многим направлениям — вы получите образование, которое впечатлит работодателей.',
      'Университет перенял международное и культурное разнообразие самого города. Liverpool процветает благодаря мультикультурному сообществу.',
    ],
    keyFactsRu: [
      '8-е место в Великобритании (Complete University Guide 2026)',
      '10-е место в Великобритании (Guardian University Guide 2026)',
      '13-е место в Великобритании (Guardian University Guide 2026)',
      '9-е место в Великобритании (Complete University Guide 2026)',
      '10-е место в Великобритании (Complete University Guide 2026)',
      '16-е место в Великобритании (Guardian University Guide 2026)',
      'Совместное 13-е место в Великобритании (Times and Sunday Times Good University Guide 2026)',
      'Совместное 12-е место в Великобритании (Times and Sunday Times Good University Guide 2026)',
      '6-е место в Великобритании (Times and Sunday Times Good University Guide 2026)',
      '6-е место в Великобритании (Guardian University Guide 2026)',
    ],
  },

  'nottingham-trent': {
    paragraphsRu: [
      'Выдающееся преподавание, опыт работы и практические навыки встроены в каждую программу — Nottingham Trent University идеальное место для подготовки к карьере.',
      'THE Awards 2017; The Guardian Awards 2019; The Times and Sunday Times 2018 и 2023; Whatuni Student Choice Awards 2023.',
      'Nottingham Trent University (NTU) предлагает широкий выбор программ, чтобы вы могли подобрать вариант, соответствующий вашим целям.',
      'Ноттингем — дружелюбный и общительный город. Здесь всегда есть чем заняться, и всё рядом — добраться легко.',
    ],
    keyFactsRu: [
      '18-е место в Великобритании (Complete University Guide 2026)',
      '24-е место в Великобритании (Complete University Guide 2026)',
      '35-е место в Великобритании (Complete University Guide 2026)',
      '18-е место в Великобритании (Guardian University Guide 2026)',
      '28-е место в Великобритании (Guardian University Guide 2026)',
      'Совместное 25-е место в Великобритании (QS World University Rankings by Subject 2026)',
    ],
  },

  nottingham: {
    paragraphsRu: [
      'Расположенный на красивом, отмеченном наградами кампусе, University of Nottingham входит в элитную Russell Group и принимает большое международное студенческое сообщество.',
      'University of Nottingham имеет впечатляющие позиции во многих предметных областях — выбирайте программу, соответствующую вашим целям.',
      'Ноттингем — образцовый современный британский город: полный истории, но с мультикультурным населением.',
      'Если вы хотите учиться в University of Nottingham, но пока не соответствуете вступительным требованиям, вы можете пройти подготовительный курс в International College in Nottingham, расположенном рядом с кампусом University Park.',
    ],
    keyFactsRu: [
      '18-е место в Великобритании (Complete University Guide 2026)',
      '11-е место в Великобритании (Guardian University Guide 2026)',
      '8-е место в Великобритании (Complete University Guide 2026)',
      '14-е место в Великобритании (Times and Sunday Times University Guide 2026)',
      '15-е место в Великобритании (Complete University Guide 2026)',
      '11-е место в Великобритании (Complete University Guide 2026)',
      '17-е место в Великобритании (Times and Sunday Times Good University Guide 2026)',
      '19-е место в Великобритании (Complete University Guide 2026)',
    ],
  },

  'queen-mary-london': {
    paragraphsRu: [
      'Разнообразное студенческое сообщество и мирового уровня исследования в сердце Лондона. Queen Mary известен академическим превосходством.',
      'NEW: изучайте IYO in Engineering и переходите сразу на 2-й курс соответствующей программы.',
      'Queen Mary University of London имеет отличные позиции в разнообразных предметных областях — выбирайте то, что любите.',
      'Одна из немногих бизнес-школ в мире с аккредитацией AACSB.',
    ],
    keyFactsRu: [
      '13-е место в Великобритании по влиянию исследований (Research Excellence Framework 2021)',
    ],
  },

  'uwe-bristol': {
    paragraphsRu: [
      'Современнейшая инфраструктура отраслевого уровня и качественное преподавание в одном из лучших городов Великобритании. Студенты UWE Bristol также получают отличные возможности трудоустройства.',
      'Бристоль назван в PwC 2024 Good Growth for Cities Index.',
      'UWE Bristol предлагает превосходное преподавание по широкому спектру программ, давая мощный старт карьере.',
      'Бристоль — захватывающий портовый город, известный своей арт-сценой и богатой культурой, с культовыми достопримечательностями, стильными барами и множеством возможностей для исследования.',
    ],
    keyFactsRu: [
      '11-е место в Великобритании (Guardian University Guide 2026)',
      '5-е место в Великобритании (Guardian University Guide 2026)',
      'Совместное 19-е место в Великобритании (Times and Sunday Times Good University Guide 2026)',
      '10-е место в Великобритании (Complete University Guide 2026)',
      '21-е место в Великобритании (Guardian University Guide 2026)',
      '6-е место в Великобритании (Guardian University Guide 2026)',
    ],
  },

  victoria: {
    paragraphsRu: [
      'UVic — научно-ориентированный и прогрессивный государственный университет, фокусирующийся на устойчивом развитии, инклюзивности и карьерном успехе. Расположенный на тихоокеанском побережье, он является одной из скрытых жемчужин Канады.',
      'Расположен в Виктории — столице провинции Британская Колумбия.',
      'UVic — ведущий канадский университет по подготовке студентов к карьере, создающий впечатляющие профессиональные возможности.',
      'Инклюзивное сообщество на экологичном кампусе в одном из лучших малых городов мира. Один из самых хорошо охраняемых секретов Канады, UVic — поистине исключительное место для жизни, учёбы и роста.',
    ],
    keyFactsRu: [
      'Топ-175 в мире (Times Higher Education World University Rankings by Subject 2025)',
      'Топ-150 в мире (Times Higher Education World University Rankings by Subject 2025)',
      'Топ-75 в мире (Shanghai Academic Ranking of World Universities 2025)',
      '№35 в мире (Shanghai Academic Ranking of World Universities 2025)',
      'Топ-20 в Канаде (Maclean’s University Rankings 2025)',
      'Топ-10 в Канаде (Maclean’s University Rankings 2025)',
      'Топ-250 в мире (Times Higher Education World University Rankings by Subject 2025)',
      'Топ-20 в Канаде (Maclean’s University Rankings 2024)',
      '№6 в Канаде (U.S. News Best Global Universities 2025–26)',
      '№1 в Канаде (U.S. News Best Global Universities 2025–26)',
    ],
  },

  westminster: {
    paragraphsRu: [
      'Гостеприимный университет с сильным международным студенческим сообществом и индустриальными связями. Живите и учитесь в Лондоне — одном из самых захватывающих городов мира.',
      'University of Westminster занимает высокие позиции по широкому ряду предметов — выбирайте подходящую программу.',
      'Лондонский университет, известный интернациональным разнообразием и поддерживающим сообществом. Принимает студентов со всего мира на свои кампусы в центре города.',
      'Westminster признан за высокий уровень преподавания и исследования мирового уровня.',
    ],
    keyFactsRu: [
      '33-е место в Великобритании по удовлетворённости студентов (Complete University Guide 2026)',
      '15-е место в Великобритании по удовлетворённости студентов (Complete University Guide 2026)',
      '26-е место в Великобритании (Guardian University Guide 2026)',
      '32-е место в Великобритании (Guardian University Guide 2025)',
      '30-е место в Великобритании (Guardian University Guide 2026)',
      '6-е место в Великобритании по удовлетворённости обратной связью (Guardian University Guide 2026)',
    ],
  },

  york: {
    paragraphsRu: [
      'Выдающееся преподавание и инфраструктура в красивом историческом городе. York — престижный исследовательский университет с сильным международным студенческим сообществом.',
      'University of York преуспевает во многих предметных областях — изучайте любимое направление с отличной степенью.',
      'Йорк — процветающий город на севере Англии, где студенты со всего мира могут стать частью знаменитого дружелюбного местного сообщества.',
      'York — идеальный выбор для пытливых умов, желающих расширять границы и внедрять инновации.',
    ],
    keyFactsRu: [
      '22-е место в Великобритании (Complete University Guide 2026)',
      '17-е место в Великобритании (Complete University Guide 2026)',
      '18-е место в Великобритании (Complete University Guide 2026)',
      '30-е место в Великобритании (Complete University Guide 2026)',
      '8-е место в Великобритании (Complete University Guide 2026)',
      '16-е место в Великобритании (Complete University Guide 2026)',
      '11-е место в Великобритании (Complete University Guide 2026)',
      '23-е место в Великобритании (Guardian University Guide 2026)',
    ],
  },
};

export function getDescriptionTranslation(slug: string): DescriptionTranslation {
  return TRANSLATIONS[slug] ?? {};
}
