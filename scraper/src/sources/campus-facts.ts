// Hand-curated campus facts per Kaplan UK partner.
//
// Kaplan partner pages do not expose a structured per-campus dataset (campuses
// are described inline in prose, with no consistent markup). Rather than try
// to NLP-parse that prose, we keep a hand-curated dictionary here — keyed by
// university slug — and rely on the StudyRoom team to update it when a uni
// reorganizes campuses. This module is part of the scraper pipeline so the
// data lives next to the rest of the per-uni truth, not in a separate seed
// script.

export interface CampusFact {
  title: string;
  sub: string;
  text: string;
  // Optional override for the campus card photo. When unset, `buildCampuses`
  // in cli.ts falls back to a cycling per-uni gallery photo (`/photos/{slug}/N.jpg`).
  img?: string;
}

const CAMPUS_FACTS: Record<string, CampusFact[]> = {
  'asu-london': [
    {
      title: 'ASU London Center',
      sub: 'Центр Лондона',
      text: 'Единая локация в Холборне — историческом юридическом районе, в шаговой доступности от Британского музея, UCL и метро Chancery Lane. Современные аудитории и лаборатории Arizona State University в самом центре города.',
    },
  ],
  bournemouth: [
    {
      title: 'Talbot Campus',
      sub: 'Главный кампус',
      text: 'Основная учебная площадка в 4 км от центра Борнмута — библиотека 24/7, спортивный центр, студенческие резиденции и зелёная территория с прудами и тропами для прогулок.',
    },
    {
      title: 'Lansdowne Campus',
      sub: 'Городской кампус',
      text: 'Расположен в деловом центре Борнмута рядом с пляжем и магистратом — здесь учатся студенты бизнес-школы, медиа, дизайна и сестринских специальностей. Удобное транспортное сообщение с Talbot.',
    },
  ],
  'city-london': [
    {
      title: 'Northampton Square',
      sub: 'Главный кампус',
      text: 'Центральный кампус в районе Кларкенуэлл, в 10 минутах от метро Angel и финансового района Сити. Здесь сосредоточены бизнес-школа Bayes, школы права, искусств и социальных наук.',
    },
    {
      title: 'West Smithfield',
      sub: 'Медицина и сестринское дело',
      text: 'Бывший кампус St George’s после слияния 2024 года — медицинская школа, сестринские и фельдшерские программы, клинические практики при больнице St Bartholomew’s в самом Сити.',
    },
  ],
  cranfield: [
    {
      title: 'Cranfield Campus',
      sub: 'Главный кампус',
      text: 'Уникальный постдипломный кампус в Бедфордшире с собственным аэродромом и взлётно-посадочной полосой — здесь Cranfield School of Aerospace, Transport & Manufacturing проводит практические занятия на реальных самолётах. Час на поезде от Лондона.',
    },
  ],
  'nottingham-trent': [
    {
      title: 'City Campus',
      sub: 'Центр города',
      text: 'Главный кампус в самом центре Ноттингема — историческое здание Newton & Arkwright Building рядом с вокзалом и развлекательным районом Hockley. Сюда же относится Сонкс-арт-кампус и юридическая школа.',
    },
    {
      title: 'Clifton Campus',
      sub: 'Загородный кампус',
      text: 'Зелёный кампус в 5 км к юго-западу от центра — здесь располагаются естественные науки, образование, спорт, психология. Большие спортивные сооружения и студенческие резиденции.',
    },
    {
      title: 'Brackenhurst Campus',
      sub: 'Сельское хозяйство',
      text: '200-гектарный учебный фермерский кампус в Саутвелле — программы по агрономии, ветеринарной медицине, зоотехнии, экологии и землепользованию. Собственная ферма, конюшни и питомники.',
    },
  ],
  'queen-mary-london': [
    {
      title: 'Mile End',
      sub: 'Главный кампус',
      text: 'Основной кампус в Ист-Энде — единственный полноценный кампусный университет в центре Лондона. Канал Regent’s, библиотека, спортивный центр и студенческое общежитие в 15 минутах от центра.',
    },
    {
      title: 'Whitechapel',
      sub: 'Медицинская школа',
      text: 'Кампус Barts and The London School of Medicine and Dentistry — клинические дисциплины при больнице Royal London Hospital. Один из старейших медицинских кампусов Великобритании.',
    },
    {
      title: 'Charterhouse Square',
      sub: 'Медицина (последипломное)',
      text: 'Историческое здание XVI века в Сити для последипломных программ медицинской школы и исследовательских лабораторий Wolfson Institute of Preventive Medicine.',
    },
    {
      title: 'Lincoln’s Inn Fields',
      sub: 'Право',
      text: 'Школа права в самом сердце правового района Лондона, рядом с Королевским судом и юридическим обществом — даёт студентам прямой доступ к практике и мастер-классам ведущих барристеров.',
    },
  ],
  birmingham: [
    {
      title: 'Edgbaston Campus',
      sub: 'Главный кампус',
      text: 'Один из самых красивых университетских кампусов Великобритании — 110-метровая башня Joseph Chamberlain Memorial Clock Tower (Old Joe), собственная железнодорожная станция University, ботанические сады, художественный музей Barber Institute и большой кампусный парк.',
    },
    {
      title: 'Dubai Campus',
      sub: 'Международный',
      text: 'Кампус в Dubai International Academic City с теми же дипломами Birmingham — программы по бизнесу, инженерии, информатике, образованию. Альтернатива для региональных студентов, желающих остаться ближе к дому.',
    },
  ],
  brighton: [
    {
      title: 'Moulsecoomb',
      sub: 'Главный кампус',
      text: 'Основной учебный кампус с современной библиотекой Aldrich, спортивным комплексом и большинством факультетов — инженерия, информатика, бизнес, естественные науки. В 10 минутах от центра Брайтона.',
    },
    {
      title: 'Falmer',
      sub: 'Гуманитарные и педагогика',
      text: 'Кампус на границе South Downs National Park — здесь учатся будущие учителя, психологи, журналисты и социологи. Знаменит модернистской архитектурой Sir Basil Spence и природным окружением.',
    },
    {
      title: 'City Campus',
      sub: 'Дизайн и искусства',
      text: 'Кампус в самом центре Брайтона — школа архитектуры, дизайна, моды, медиа и изобразительных искусств. Тесная связь с креативными индустриями города.',
    },
  ],
  bristol: [
    {
      title: 'Tyndall’s Park / Clifton',
      sub: 'Главный кампус',
      text: 'Историческое сердце университета в престижном районе Clifton — Wills Memorial Building в неоготическом стиле, школы права, медицины, инженерии, искусств. Шаговая доступность к Clifton Suspension Bridge и центру.',
    },
    {
      title: 'Langford Campus',
      sub: 'Ветеринария',
      text: 'Кампус в 19 км к юго-западу от центра — Школа ветеринарных наук, собственный учебный госпиталь для мелких животных, лошадей и сельскохозяйственных животных. Один из ведущих в Великобритании.',
    },
  ],
  essex: [
    {
      title: 'Colchester Campus',
      sub: 'Главный кампус',
      text: 'Основной кампус-парк в Уивенхо рядом с Колчестером — характерные брутализм-башни-резиденции 1960-х, искусственное озеро, библиотека Albert Sloman, театр Lakeside и центральная площадь со студенческими сервисами.',
    },
    {
      title: 'Southend Campus',
      sub: 'Бизнес и здравоохранение',
      text: 'Современный кампус в центре Саутенда-он-Си рядом с морем — здесь бизнес-школа Essex Business School, сестринские программы, физиотерапия и социальная работа. Прямой поезд до Лондона.',
    },
    {
      title: 'Loughton (East 15)',
      sub: 'Актёрское искусство',
      text: 'Кампус East 15 Acting School в северо-восточном Лондоне — одна из ведущих театральных школ Великобритании. Программы по актёрскому мастерству, постановке, технологиям сцены и драматургии.',
    },
  ],
  glasgow: [
    {
      title: 'Gilmorehill (Main Campus)',
      sub: 'Главный кампус',
      text: 'Знаменитый неоготический Main Building с башней работы George Gilbert Scott — сердце университета в West End Глазго, среди парков Kelvingrove и Botanic Gardens. Здесь школы права, искусств, инженерии и большинства факультетов.',
    },
    {
      title: 'Garscube Campus',
      sub: 'Биомедицина и спорт',
      text: 'Кампус в 6 км к северу от центра — Школа ветеринарной медицины, медицинские исследовательские центры, кафедра общественного здравоохранения и крупнейший университетский спортивный комплекс Шотландии.',
    },
    {
      title: 'Dumfries Campus',
      sub: 'Региональный',
      text: 'Совместный кампус с University of the West of Scotland в Дамфрисе на юге Шотландии — программы по экологии, культурному наследию, бизнесу и образованию. Уникальная атмосфера небольшого городка.',
    },
  ],
  liverpool: [
    {
      title: 'Liverpool Main Campus',
      sub: 'Главный кампус',
      text: 'Компактный городской кампус в центре Ливерпуля — между двумя соборами и доками Albert Dock. Знаменитое здание Victoria Building (родоначальник термина «red brick university»), школы медицины, инженерии и искусств.',
    },
    {
      title: 'London Campus',
      sub: 'Бизнес и менеджмент',
      text: 'Постдипломный кампус в Финсбери, Лондон — программы Management School (MBA, финансы, аналитика). Полноценный диплом Ливерпуля с возможностью учиться в столице Великобритании.',
    },
    {
      title: 'Suzhou (XJTLU)',
      sub: 'Совместный с Китаем',
      text: 'Xi’an Jiaotong-Liverpool University — совместный кампус с китайским университетом в городе Сучжоу. Студенты получают двойные дипломы (Ливерпуль + XJTLU) с возможностью провести год обмена в Великобритании.',
    },
  ],
  nottingham: [
    {
      title: 'University Park',
      sub: 'Главный кампус',
      text: 'Один из крупнейших и красивейших кампусов-парков в Европе — 121 гектар озёр, лугов, георгианских зданий и трёхсотлетнего дерева. Часовая башня Trent Building, библиотека Hallward и большинство факультетов.',
    },
    {
      title: 'Jubilee Campus',
      sub: 'Бизнес и IT',
      text: 'Современный кампус 1999 года с архитектурой Michael Hopkins — Nottingham Business School, школа компьютерных наук, School of Education. Известен экологичной архитектурой и большим искусственным озером.',
    },
    {
      title: 'Sutton Bonington',
      sub: 'Агрономия и ветеринария',
      text: 'Сельскохозяйственный кампус в 19 км к юго-западу — School of Biosciences и Школа ветеринарной медицины. Собственная учебная ферма, лаборатории молекулярной биологии и большое студенческое сообщество.',
    },
    {
      title: 'Royal Derby',
      sub: 'Клиническая медицина',
      text: 'Клинический кампус при Royal Derby Hospital — здесь медики Ноттингема проходят последние два года клинического обучения. Прямой доступ к госпиталю на 1200 коек и специализированным центрам.',
    },
  ],
  westminster: [
    {
      title: 'Regent Campus',
      sub: 'Центр Лондона',
      text: 'Главное здание на Regent Street, в шаговой доступности от Oxford Circus и Piccadilly — Westminster Business School, юридическая школа, социальные науки. Историческое здание University of Westminster с 1838 года.',
    },
    {
      title: 'Cavendish Campus',
      sub: 'Естественные науки',
      text: 'Кампус рядом с Oxford Street — школа компьютерных наук, инженерии, биомедицины и психологии. Современные лаборатории и тесная связь с лондонской tech-сценой.',
    },
    {
      title: 'Marylebone Campus',
      sub: 'Архитектура и бизнес',
      text: 'Историческое здание у Marylebone Road — Westminster School of Architecture and Cities, Westminster Business School и Faculty of Education. В двух шагах от Hyde Park.',
    },
    {
      title: 'Harrow Campus',
      sub: 'Медиа и искусство',
      text: 'Кампус в северном Лондоне — School of Media and Communication, школа искусств, журналистика, кино, ТВ и музыкальная индустрия. Профессиональные студии и постпродакшен-лаборатории.',
    },
  ],
  york: [
    {
      title: 'Heslington West',
      sub: 'Главный кампус',
      text: 'Исторический кампус-парк 1960-х годов с искусственным озером в центре — гуманитарные и социальные науки, отдельные коллегии для студентов по британской традиции. Узнаваемая модернистская архитектура.',
    },
    {
      title: 'Heslington East',
      sub: 'Расширение',
      text: 'Современный кампус 2010-х — школа менеджмента, юридическая школа, кино и театр, новые лаборатории. Соединён с Heslington West пешеходным мостом через A64.',
    },
    {
      title: 'King’s Manor',
      sub: 'Центр города',
      text: 'Средневековое здание в самом центре Йорка рядом с собором — здесь располагаются отделения археологии, истории искусств и Centre for Medieval Studies. Атмосфера живой истории.',
    },
  ],
  'uwe-bristol': [
    {
      title: 'Frenchay Campus',
      sub: 'Главный кампус',
      text: 'Основной кампус UWE с библиотекой 24/7, новым центром Bristol Business School, спортивным комплексом Centre for Sport и большими студенческими резиденциями. В 10 минутах от центра Бристоля.',
    },
    {
      title: 'Glenside Campus',
      sub: 'Здравоохранение',
      text: 'Кампус медицинских и социальных наук — программы для медсестёр, физиотерапевтов, акушеров, специалистов общественного здоровья. Имеет учебный госпиталь и тесные связи с NHS.',
    },
    {
      title: 'Bower Ashton',
      sub: 'Искусства и дизайн',
      text: 'Кампус Bristol School of Art and Design — изобразительные искусства, мода, фотография, графический дизайн, иллюстрация. Студии, мастерские, выставочные пространства.',
    },
    {
      title: 'City Campus',
      sub: 'Музыка и медиа',
      text: 'Кампус в центре Бристоля — звукорежиссура, музыкальная индустрия, медиа-продакшен. Имеет профессиональные студии звукозаписи и проекционные залы.',
    },
  ],
  alberta: [
    {
      title: 'North Campus (Edmonton)',
      sub: 'Главный кампус',
      text: 'Основной кампус U of A в самом центре Эдмонтона — историческое здание Convocation Hall, библиотека Cameron, спортивный комплекс Van Vliet Centre, музей и галерея. Большинство факультетов сосредоточены здесь.',
    },
    {
      title: 'South Campus',
      sub: 'Спорт и сельское хозяйство',
      text: 'Кампус в южной части Эдмонтона — программы сельскохозяйственных, природных и спортивных наук, экспериментальные фермы и лаборатории. Большие резиденции Pinecrest и Tamarack.',
    },
    {
      title: 'Campus Saint-Jean',
      sub: 'Франкоязычный',
      text: 'Единственный франкоязычный университетский кампус в западной Канаде — программы преподавания, бизнеса и наук на французском языке. Расположен в старом французском квартале Эдмонтона La Cité Francophone.',
    },
    {
      title: 'Augustana Campus (Camrose)',
      sub: 'Региональный',
      text: 'Небольшой кампус в 90 км к юго-востоку от Эдмонтона в городе Камроз — гуманитарные и социальные науки, тесная атмосфера и доступное жильё (Hoyme, Ravine Complex). Идеально для тех, кто предпочитает спокойную среду.',
    },
  ],
  victoria: [
    {
      title: 'Main Campus (Gordon Head)',
      sub: 'Главный кампус',
      text: 'Единый кампус UVic в районе Gordon Head на острове Ванкувер — окружён лесом и в 15 минутах от океана. Здесь все факультеты, библиотека McPherson, спорткомплекс CARSA и студенческие резиденции, включая новые здания Cheko’nien House и Sngequ House.',
      img: '/photos/victoria/campuses/main-gordon-head.jpg',
    },
    {
      title: 'Downtown Victoria',
      sub: 'Бизнес и право (центр)',
      text: 'Постдипломные программы Peter B. Gustavson School of Business и юридической школы проходят также в зданиях в центре Виктории — рядом с гаванью и Парламентом BC. Удобно для летних бизнес-программ.',
      img: '/photos/victoria/campuses/downtown.jpg',
    },
  ],

  'arizona-state': [
    {
      title: 'Tempe Campus',
      sub: 'Главный кампус',
      text: 'Крупнейший кампус ASU в Тампе, Аризона — более 50,000 студентов. Здесь Sun Devil Stadium, библиотека Hayden, основные программы бакалавриата (Engineering, Business, Liberal Arts, Sciences). Активная студенческая жизнь, тёплый климат круглый год.',
    },
    {
      title: 'Downtown Phoenix Campus',
      sub: 'Здоровье, журналистика, право',
      text: 'Городской кампус в центре Феникса — Walter Cronkite School of Journalism, College of Health Solutions, Sandra Day O’Connor College of Law, College of Public Service. Прямой Light Rail до Tempe.',
    },
    {
      title: 'West Valley Campus',
      sub: 'Glendale, гуманитарные науки',
      text: 'Кампус в Глендейле, Аризона — гуманитарные и интердисциплинарные программы. Открытое озеро, меньше студентов, более тесное сообщество. New College of Interdisciplinary Arts and Sciences.',
    },
    {
      title: 'Polytechnic Campus',
      sub: 'Mesa, прикладные технологии',
      text: 'Кампус в Месе — прикладные технологии, инженерия, авиация (Ira A. Fulton Schools of Engineering). Hands-on labs, теплицы, авиационная база. Для тех, кто хочет практический фокус.',
    },
  ],

  pace: [
    {
      title: 'NYC Campus (Lower Manhattan)',
      sub: 'Финансовый район Манхэттена',
      text: 'Городской кампус в самом сердце Нью-Йорка — One Pace Plaza у Brooklyn Bridge. Здесь Lubin School of Business, Dyson College, Pace Law School. Доступ к Wall Street, технологическим компаниям, медиа.',
    },
    {
      title: 'Westchester Campus (Pleasantville)',
      sub: 'Пригородный кампус',
      text: 'Зелёный кампус в Pleasantville, 30 миль к северу от Манхэттена — 200 акров, традиционная атмосфера колледжа. Общежития, столовая, спортивные команды Pace Setters. Прямой поезд Metro-North до NYC.',
    },
  ],

  simmons: [
    {
      title: 'Academic Campus (Fenway)',
      sub: 'Главный кампус (Boston)',
      text: 'Главный академический кампус в районе Fenway — рядом с Бостонским симфоническим, MFA, Fenway Park (Red Sox). Здесь все лекционные корпуса, библиотека Beatley, лаборатории, столовая. 2 мили от центра Бостона.',
    },
    {
      title: 'Residence Campus',
      sub: 'Жилая зона',
      text: 'Закрытая жилая зона из 9 общежитий вокруг частного quadrangle — отдельно от академического кампуса, 5 минут пешком. 24-часовая охрана, фитнес, lounges. Создана как защищённое сообщество для первокурсниц.',
    },
  ],

  uconn: [
    {
      title: 'Storrs Main Campus',
      sub: 'Главный кампус',
      text: 'Главный кампус UConn в северо-восточном Коннектикуте — 4,400 акров, 700+ зданий. Husky basketball, Center for Science Discovery. Все бакалаврские программы и большинство магистратуры. Между Boston и NYC.',
    },
    {
      title: 'Stamford Campus',
      sub: 'Бизнес и цифровые технологии',
      text: 'Городской кампус в центре Стамфорда, 35 миль от NYC — программы Business, Digital Media & Design, Financial Technology. Карьерные связи с Уолл-стрит и медиа-индустрией.',
    },
    {
      title: 'Hartford Campus',
      sub: 'Столица штата',
      text: 'Кампус в Хартфорде — Public Policy, Political Science, Social Work, Communication. Рядом с законодательным собранием Коннектикута, страховыми компаниями и культурной зоной.',
    },
    {
      title: 'Avery Point Campus',
      sub: 'Прибрежные науки',
      text: 'Кампус на берегу Long Island Sound в Гротоне — Marine Sciences, Coastal Studies. Исследовательский флот, океанографические лаборатории. Уникальная локация для морских специальностей.',
    },
  ],

  oregon: [
    {
      title: 'Eugene Main Campus',
      sub: 'Главный кампус',
      text: 'Главный кампус в Юджине, Орегон — 295 акров парковой зоны на реке Willamette. Knight Library, Autzen Stadium (Ducks football), Jaqua Center. Все бакалаврские программы. Зелёный, дождливый, идеален для outdoor-активностей.',
    },
    {
      title: 'Portland Campus',
      sub: 'Постдипломный кампус',
      text: 'Кампус в White Stag Block в центре Портленда — программы Architecture, Product Design, Sports Marketing, MBA. Карьерные связи с Nike, Intel, Wieden+Kennedy.',
    },
  ],

  adelaide: [
    {
      title: 'North Terrace City Campus',
      sub: 'Главный кампус',
      text: 'Главный кампус в самом центре Аделаиды на North Terrace — здания XIX века, парки, музеи рядом. Здесь Humanities, Sciences, Business, Engineering. Шаговая доступность от площадей, кафе, городского транспорта.',
    },
    {
      title: 'Waite Campus (Urrbrae)',
      sub: 'Сельское хозяйство и виноделие',
      text: 'Кампус в 8 км от центра — один из крупнейших исследовательских центров аграрных наук в Южном полушарии. Здесь виноделие, агрономия, биология растений, экология. Виноградники прямо на территории.',
    },
    {
      title: 'Roseworthy Campus',
      sub: 'Ветеринария и агрономия',
      text: 'Кампус в 50 км к северу от Аделаиды — единственная в Южной Австралии ветеринарная школа. Также животноводство, селекционное растениеводство. Roseworthy Residential College предлагает catered проживание прямо на месте.',
    },
  ],

  murdoch: [
    {
      title: 'Perth South Street Campus',
      sub: 'Главный кампус',
      text: 'Главный кампус в южном Перте — 227 гектаров с природным заповедником. Ветеринарная клиника, теле- и радиостудии (Curtin Stadium и Murdoch Media), солнечная электростанция. Murdoch railway station прямо на кампусе.',
    },
    {
      title: 'Mandurah Campus',
      sub: 'Региональный кампус',
      text: 'Региональный кампус в 70 км к югу от Перта — социальные науки, медсестринское дело, образование. Меньшее сообщество студентов, идеален для тех, кто предпочитает прибрежную атмосферу.',
    },
  ],

  'newcastle-au': [
    {
      title: 'Callaghan Campus',
      sub: 'Главный кампус',
      text: 'Главный кампус в Callaghan, Новый Южный Уэльс — 140 гектаров эвкалиптовых лесов, в 12 км от центра Ньюкасла. Большинство бакалаврских и постдипломных программ, on-campus жильё, библиотека Auchmuty, спортивный центр.',
    },
    {
      title: 'NUspace City Campus',
      sub: 'Городской кампус',
      text: 'Современный городской кампус в центре Ньюкасла (Hunter Street) — программы Business, Law, Design, Creative Industries. Прямая связь с Callaghan через светопоезд.',
    },
    {
      title: 'Ourimbah Campus',
      sub: 'Central Coast',
      text: 'Кампус на полпути между Сиднеем и Ньюкаслом — программы Nursing, Education, Business, Communication. Природное окружение и небольшое студенческое сообщество.',
    },
    {
      title: 'Sydney Central Campus',
      sub: 'Постдипломный кампус',
      text: 'Кампус в Sydney CBD (Charles Street) для постдипломных программ Business, Health, Education. Удобно для работающих профессионалов.',
    },
  ],

  massey: [
    {
      title: 'Auckland Campus (Albany)',
      sub: 'Главный кампус для иностранных студентов',
      text: 'Современный кампус Massey в северном пригороде Окленда (Albany) — программы Business, Aviation, Sciences, Design. 14,000+ студентов, новые корпуса, рядом с торговым центром Westfield Albany.',
    },
    {
      title: 'Manawatū Campus (Palmerston North)',
      sub: 'Исторический главный кампус',
      text: 'Главный исторический кампус Massey в Палмерстон-Норт — крупнейший по площади. Здесь сельское хозяйство, ветеринария (одна из 2 в Новой Зеландии), авиация, food science, образование.',
    },
    {
      title: 'Wellington Campus',
      sub: 'Креативные искусства',
      text: 'Кампус в столице Новой Зеландии — College of Creative Arts (Toi Rauwhārangi): design, music, fine arts, communication. В здании бывшей Dominion Museum, рядом с правительственными зданиями.',
    },
  ],
};

export function getCampusFacts(slug: string): CampusFact[] {
  return CAMPUS_FACTS[slug] ?? [];
}

export function listCampusSlugs(): string[] {
  return Object.keys(CAMPUS_FACTS).sort();
}
