// One-shot seed for accommodation + campuses on every uni JSON in
// site/src/content/universities/. Campus info uses public-knowledge campus
// names per Kaplan UK partner. Accommodation uses a uniform 3-tier template
// (en-suite hall / studio / shared apartment) with [TBD] prices and photos —
// Stage 11 scraper extension will replace these with real Kaplan data.

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_DIR = resolve(__dirname, '../site/src/content/universities');

// Public-knowledge campus data per Kaplan UK partner.
// title = official campus / building name; sub = short tag; text = location/role.
const CAMPUSES_BY_SLUG = {
  'asu-london': [
    { title: 'ASU London Center', sub: 'Центр Лондона', text: 'Кампус в Холборне — единая локация в самом центре города, шаговая доступность к Британскому музею и UCL.' },
  ],
  bournemouth: [
    { title: 'Talbot Campus', sub: 'Главный кампус', text: 'Основная учебная площадка с библиотекой, спортивным центром и студенческими общежитиями.' },
    { title: 'Lansdowne Campus', sub: 'Городской кампус', text: 'Расположен в деловом центре Борнмута — здесь учатся бизнес и медиа.' },
  ],
  'city-london': [
    { title: 'Northampton Square', sub: 'Главный кампус', text: 'Центральный кампус в Излингтоне рядом с финансовым районом Сити.' },
    { title: 'West Smithfield', sub: 'Медицина', text: 'Бывший кампус St George’s после слияния 2024 года — медицинская школа и сестринские программы.' },
  ],
  cranfield: [
    { title: 'Cranfield Campus', sub: 'Главный кампус', text: 'Постдипломный кампус в Бедфордшире с собственным аэродромом — уникальная инфраструктура для аэрокосмических и инженерных программ.' },
  ],
  'nottingham-trent': [
    { title: 'City Campus', sub: 'Центр города', text: 'Главный кампус в центре Ноттингема, в шаговой доступности от вокзала и развлекательного района.' },
    { title: 'Clifton Campus', sub: 'Загородный кампус', text: 'Зелёный кампус в 5 км от центра — здесь науки, образование и спортивные программы.' },
    { title: 'Brackenhurst Campus', sub: 'Сельское хозяйство', text: '200-гектарный учебный фермерский кампус — программы в области экологии, ветеринарии и зоотехнии.' },
  ],
  'queen-mary-london': [
    { title: 'Mile End', sub: 'Главный кампус', text: 'Основной кампус в East London — единственный полноценный кампусный университет в центре столицы.' },
    { title: 'Whitechapel', sub: 'Медицинская школа', text: 'Кампус Barts and The London — клинические дисциплины при больнице Royal London.' },
    { title: 'Charterhouse Square', sub: 'Медицина', text: 'Историческое здание в Сити для последипломных программ медицинской школы.' },
    { title: 'Lincoln’s Inn Fields', sub: 'Право', text: 'Юридическая школа в самом сердце правового района Лондона.' },
  ],
  birmingham: [
    { title: 'Edgbaston Campus', sub: 'Главный кампус', text: 'Один из самых красивых кампусов Великобритании — собственный поезд-станция, башня Чемберлен и большой парк.' },
    { title: 'Dubai Campus', sub: 'Международный', text: 'Кампус в Dubai International Academic City — те же дипломы Birmingham для региональных студентов.' },
  ],
  brighton: [
    { title: 'Moulsecoomb', sub: 'Главный кампус', text: 'Основной учебный кампус с современной библиотекой и спортивным комплексом.' },
    { title: 'Falmer', sub: 'Гуманитарные', text: 'Кампус для гуманитарных и социальных программ на границе с South Downs.' },
    { title: 'City Campus', sub: 'Центр Брайтона', text: 'Кампус в центре города для дизайна, медиа и архитектуры.' },
  ],
  bristol: [
    { title: 'Tyndall’s Park / Clifton', sub: 'Главный кампус', text: 'Исторический район в центре Бристоля — здесь сосредоточены факультеты и Wills Memorial Building.' },
    { title: 'Langford Campus', sub: 'Ветеринария', text: 'Кампус в 19 км от центра — Школа ветеринарных наук и собственный учебный госпиталь.' },
  ],
  essex: [
    { title: 'Colchester Campus', sub: 'Главный кампус', text: 'Основной кампус-парк в Уивенхо рядом с Колчестером — характерные башни-резиденции и озеро.' },
    { title: 'Southend Campus', sub: 'Бизнес и медицина', text: 'Современный кампус в центре Саутенда-он-Си — бизнес-школа и сестринские программы.' },
    { title: 'Loughton (East 15)', sub: 'Актёрское искусство', text: 'Кампус East 15 Acting School — одна из ведущих театральных школ Великобритании.' },
  ],
  glasgow: [
    { title: 'Gilmorehill (Main Campus)', sub: 'Главный кампус', text: 'Знаменитый неоготический Main Building с башней — сердце университета в West End Глазго.' },
    { title: 'Garscube Campus', sub: 'Биомедицина', text: 'Кампус в 6 км к северу — школа ветеринарии, медицинские исследования и спортивный комплекс.' },
    { title: 'Dumfries Campus', sub: 'Региональный', text: 'Совместный кампус в Дамфрисе — программы по бизнесу и наукам об окружающей среде.' },
  ],
  liverpool: [
    { title: 'Liverpool Main Campus', sub: 'Главный кампус', text: 'Компактный городской кампус в центре Ливерпуля рядом с собором и Albert Dock.' },
    { title: 'London Campus', sub: 'Бизнес', text: 'Постдипломный кампус в Финсбери для программ Management School.' },
    { title: 'Suzhou (XJTLU)', sub: 'Китай', text: 'Совместный кампус с Xi’an Jiaotong-Liverpool University — дипломы двух университетов.' },
  ],
  nottingham: [
    { title: 'University Park', sub: 'Главный кампус', text: 'Один из крупнейших кампусов-парков в Европе — 121 гектар озёр, лугов и георгианских зданий.' },
    { title: 'Jubilee Campus', sub: 'Бизнес и IT', text: 'Современный кампус с архитектурой Майкла Хопкинса — Business School и Computer Science.' },
    { title: 'Sutton Bonington', sub: 'Агрономия и ветеринария', text: 'Сельскохозяйственный кампус в 19 км — школа биологических наук и ветеринарной медицины.' },
    { title: 'Royal Derby', sub: 'Медицина', text: 'Клинический кампус при Royal Derby Hospital — финальные клинические годы медиков.' },
  ],
  westminster: [
    { title: 'Regent Campus', sub: 'Центр Лондона', text: 'Главное здание на Regent Street — бизнес, право и социальные науки.' },
    { title: 'Cavendish Campus', sub: 'Естественные науки', text: 'Кампус рядом с Oxford Street — компьютерные науки, инженерия, биомедицина.' },
    { title: 'Marylebone Campus', sub: 'Архитектура', text: 'Школа архитектуры и Westminster Business School — историческое здание у Marylebone Road.' },
    { title: 'Harrow Campus', sub: 'Медиа и искусство', text: 'Кампус в северном Лондоне — журналистика, кино, дизайн, телевидение.' },
  ],
  york: [
    { title: 'Heslington West', sub: 'Главный кампус', text: 'Исторический кампус-парк с озером — гуманитарные и социальные науки.' },
    { title: 'Heslington East', sub: 'Расширение', text: 'Современный кампус 2010-х — менеджмент, право, кино и театр, юридическая школа.' },
    { title: 'King’s Manor', sub: 'Центр города', text: 'Средневековый кампус в центре Йорка — археология и история искусств.' },
  ],
  'uwe-bristol': [
    { title: 'Frenchay Campus', sub: 'Главный кампус', text: 'Основной кампус с библиотекой 24/7, спортивным центром и студенческими общежитиями.' },
    { title: 'Glenside Campus', sub: 'Здравоохранение', text: 'Кампус медицинских и социальных наук — медсёстры, физиотерапия, занятость в здравоохранении.' },
    { title: 'Bower Ashton', sub: 'Искусства и дизайн', text: 'Кампус Bristol School of Art and Design — изобразительные искусства, мода, фотография.' },
    { title: 'City Campus', sub: 'Музыка и медиа', text: 'Кампус в центре Бристоля — звукорежиссура, музыкальная индустрия, медиа.' },
  ],
};

// Uniform accommodation template applied to every uni.
// Real prices/photos come from the scraper extension (Stage 11).
function makeAccommodation(uniName) {
  return [
    {
      name: 'En-suite комната в студенческом общежитии',
      price: '[TBD: £/нед]',
      text: `Одноместная комната с собственной ванной, общая кухня на 4–8 человек. Партнёрское жильё рядом с кампусом ${uniName}.`,
    },
    {
      name: 'Студия с собственной кухней',
      price: '[TBD: £/нед]',
      text: 'Полностью автономная студия — кровать, рабочая зона, кухня и санузел в одном пространстве. Подходит тем, кто ценит уединение.',
    },
    {
      name: 'Совместная квартира',
      price: '[TBD: £/нед]',
      text: 'Квартира на 2–3 студентов с общими гостиной и кухней — самый бюджетный вариант, отлично подходит для общения и обмена опытом.',
    },
  ];
}

async function main() {
  const files = await readdir(CATALOG_DIR);
  let updated = 0;
  let skipped = 0;
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const path = resolve(CATALOG_DIR, f);
    const raw = await readFile(path, 'utf8');
    const doc = JSON.parse(raw);
    const slug = doc.slug;
    const campuses = CAMPUSES_BY_SLUG[slug];
    if (!campuses) {
      console.log(`[skip] ${slug}: no campus data in CAMPUSES_BY_SLUG`);
      skipped++;
      continue;
    }
    doc.accommodation = makeAccommodation(doc.name);
    doc.campuses = campuses;
    await writeFile(path, JSON.stringify(doc, null, 2) + '\n', 'utf8');
    console.log(`[ok]   ${slug}: ${doc.campuses.length} campuses, ${doc.accommodation.length} accommodation`);
    updated++;
  }
  console.log(`\nDone: ${updated} updated, ${skipped} skipped`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
