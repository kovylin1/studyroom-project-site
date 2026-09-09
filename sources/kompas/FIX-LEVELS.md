# Уровень программы против её названия — правка перед 3.1

Скрипт `scraper/kompas-fix-levels.mjs`, карта квалификаций — `scraper/lib/program-level.mjs`.
Каталог: `site/src/content/universities`. Режим: **запись**.
Снято 2026-08-23 15:31 UTC.

Правится уровень, только когда название называет ровно одну квалификацию.

## Исправлено

| Было → стало | Программ |
|---|---:|
| bachelor → master | 110 |
| master → bachelor | 40 |
| bachelor → phd | 23 |
| **всего** | **173** |

Карточек затронуто: 40, файлов переписано: 40.

### bachelor → master — 110

| Карточка | Программа |
|---|---|
| `adelphi` | MANon- Certification Educational Technology |
| `auburn` | MSCE Cybersecurity Engineering |
| `auburn` | MAM Information Systems Management |
| `auburn` | MAM Neuroscience |
| `auburn` | MSCE Biosystems Engineering – Wireless Engineering Software Option |
| `auburn` | MSCE Apparel Merchandising, Design & Production Management – Apparel Design & Production M |
| `auburn` | MSCE Building Science |
| `auburn` | MAM Laboratory Sciences |
| `auburn` | MSCE Spanish International Trade Theatre – Design/Technology |
| `auburn` | MAM Applied Mathematics – Non-thesis program |
| `auburn` | MAM General Social Science Education/History |
| `auburn` | MAM Food Science |
| `auburn` | MSCE French |
| `auburn` | MAM Art History |
| `auburn` | MSCE Animal Sciences – Equine Option |
| `birmingham` | MAEd Educational Leadership |
| `california-baptist-university` | MSCS Computer Science |
| `cardiff` | MScD Orthodontics |
| `cleveland-state` | MSCE- Structures and Foundations |
| `cleveland-state` | MSCE- Environmental |
| `cleveland-state` | MSCE- Transportation |
| `cleveland-state` | MSCE - Water Resources |
| `college-de-paris` | Mastere in Start-up Management & E-commerce (Digital College) |
| `college-de-paris` | Mastere in Business Development (Ecole Conte) |
| `college-de-paris` | Mastere in International Marketing (College de Paris) |
| … | ещё 85 |

### master → bachelor — 40

| Карточка | Программа |
|---|---|
| `alberta` | BCom, Accounting |
| `alberta` | BCom, Business Economics and Law |
| `alberta` | BCom, Business Studies |
| `alberta` | BCom, Business Technology Management |
| `alberta` | BCom, Entrepreneurship and Innovation |
| `alberta` | BCom, Finance |
| `alberta` | BCom, Human Resources Management |
| `alberta` | BCom, International Business |
| `alberta` | BCom, Marketing |
| `alberta` | BCom, Operations Management |
| `alberta` | BCom, Strategic Management and Organization |
| `arizona-state` | BAE Educational Studies |
| `arizona-state` | BAE Elementary Education |
| `arizona-state` | BAE Secondary Education (Biological Sciences) |
| `arizona-state` | BAE Secondary Education (English) |
| `arizona-state` | BAE Secondary Education (History) |
| `arizona-state` | BAE Secondary Education (Mathematics) |
| `arizona-state` | BAS Applied Science (Project Management) (Transfer Only) |
| `arizona-state` | BAE Elementary Multilingual Education |
| `arizona-state` | BAE Early Childhood Education |
| `arizona-state` | BAS Applied Science (Applied Leadership) (Transfer Only) |
| `arizona-state` | BAE Secondary Education |
| `arizona-state` | BAE Special Education |
| `arizona-state` | BAE Physical Education |
| `arizona-state` | BAE Middle Grades Education |
| … | ещё 15 |

### bachelor → phd — 23

| Карточка | Программа |
|---|---|
| `apu-malaysia` | Doctor of Business Administration (DBA) |
| `de-montfort-dubai` | DBA Doctor of Business Administration |
| `into-stirling-uni` | Doctor of Education (EdD) |
| `kent-state-university` | Ph.D. Biological Sciences Cell Biology and Molecular Genetics |
| `lancashire` | DBA Doctor of Business Administration |
| `london-met` | DBA Doctor of Business Administration |
| `northumbria` | DBA Doctor of Business Administration |
| `oregon-state` | EDD Education |
| `oregon-state` | EDD Education (Online) |
| `sofia-university` | DBA Doctor of Business Administration |
| `sp-jain-school-of-global-management-dubai` | Why SP Jain's DBA |
| `tamucc` | EdD in Educational Leadership |
| `university-of-huddersfield` | EdD Doctor of Education |
| `university-of-la-verne` | DBA Doctor of Business Administration |
| `university-of-la-verne` | EdD Organizational Leadership |
| `westcliff-university` | DBA Doctor of Business Administration - Applied Computer Science |
| `westcliff-university` | DBA Doctor of Business Administration - Cybersecurity |
| `westcliff-university` | DBA Doctor of Business Administration - Strategic Leadership for the 21st Century |
| `westcliff-university` | DBA Doctor of Business Administration - Business Intelligence & Data Analytics |
| `westcliff-university` | DBA Doctor of Business Administration - Information Technology Management |
| `westcliff-university` | DBA Doctor of Business Administration - Web Development & Applications Management |
| `westcliff-university` | EdD Doctor of Education in Leadership, Curriculum, and Instruction - Leadership |
| `westcliff-university` | DBA Doctor of Business Administration |

## Не тронуто: название называет две квалификации

Таких программ 0. Это совместные и сквозные программы, ошибки в данных здесь нет;
гейт их тоже перестал считать ошибкой, потому что читает ту же карту.

| Карточка | Программа | Уровень | Названо |
|---|---|---|---|

## Спорное, на глаз владельцу

JD (Juris Doctor) — профессиональная степень, которой в схеме каталога нет.
По названию это докторат, поэтому записан `phd`. Затронуто программ: 0.
