# QS, 24 «новых вуза» — отсев перед заведением карточек

**Дата:** 2026-08-03 · каталог не тронут · карточек не заведено.

Прошлая передача называла 24 записи QS новыми вузами (1118 программ) и ставила
задачу собрать по ним город и длительность с офсайтов (вариант Б). Просмотр
списка глазами и сверка с каталогом показали: **новых вузов там 7, а не 24.**

Разбор поднят скриптами (только чтение):
`scraper/kompas-qs-newcards-probe.mjs`, `scraper/kompas-qs-newcards-rematch.mjs`,
`scraper/kompas-qs-newcards-sites.mjs`.

---

## Почему список был неверен

Разряд «карточки нет вовсе» брался из `sources/kompas/qs-unlinked.json`. По всем
24 записям там стоит `verdict: absent` **и ни одной подсказки-кандидата**. При этом
`uwe-bristol`, `luiss`, `glion-switzerland`, `cesi`, `ucl`, `asu-london` в каталоге
есть и ни одной записью QS не заняты. То есть это не «вуза нет», а разборщик привязки
не выдал кандидата: имена расходятся сильнее, чем он терпит
(«University of the West of England (UWE)» против карточки «UWE Bristol»).

**Урок:** `verdict: absent` без подсказок — это «разборщик промолчал», а не
«карточки нет». Тот же класс бага, что даёт 123 кейса `kompas_no_extract`.

---

## 1. Заводить карточку — 7 вузов, 612 программ

| Запись QS | Программ | Страна | Офсайт (проверен: 200 + имя на странице) | Город, подсказка |
|---|---:|---|---|---|
| Falmouth University | 124 | UK | `falmouth.ac.uk` | Falmouth (Cornwall) |
| University of Worcester (UG + PG) | 212 | UK | `worcester.ac.uk` | Worcester |
| Kwantlen Polytechnic University | 107 | Canada | `kpu.ca` | Surrey, BC |
| Marshall University | 85 | US | `marshall.edu` | Huntington, WV |
| Mercy University | 68 | US | `mercy.edu` | Dobbs Ferry, NY |
| Westminster International University in Tashkent | 14 | Uzbekistan | `wiut.uz` | Ташкент |
| Peking University HSBC Business School | 2 | China | `english.phbs.pku.edu.cn` | Shenzhen |

Город в таблице — **подсказка** (Wikidata P131 + адрес в подвале офсайта), в каталог
из неё ничего не пишется: в карточку город идёт только со страницы вуза.
Worcester приходит двумя записями портала на одну карточку — сводить объединением (урок QS-5).

Оговорки:
- **Peking University HSBC Business School** — это бизнес-школа Пекинского университета,
  а самого ПУ в каталоге нет. Формально это отделение без головной карточки, а не вуз.
  Заводить отдельной карточкой или ждать головную — решает владелец.
- **Mercy University** — два кампуса (Dobbs Ferry и Манхэттен), город карточки нужно выбрать.

## 2. Не новые вузы — карточка уже есть, нужна привязка (6 записей, 481 программа)

| Запись QS | Программ | Карточка каталога | Что это |
|---|---:|---|---|
| University of the West of England (UWE) | 352 | `uwe-bristol` — UWE Bristol (130 программ) | тот же вуз |
| SRH Universities (India) | 67 | 5 карточек `srh-*` | сводная запись сети SRH под индийский рынок |
| Luiss University - Libera Università… | 32 | `luiss` — Luiss Guido Carli University (52) | тот же вуз |
| Glion | 15 | `glion-switzerland` — Glion IHE (30) | тот же вуз |
| UCL Centre for Languages & International Education | 11 | `ucl` (965) | подразделение UCL |
| CESI School of Engineering | 4 | `cesi` — CESI École d'Ingénieurs (78) | тот же вуз |

Отдельно: **TEDI - London** (1 программа, провайдер Kaplan) — `tedi-london.ac.uk`
сегодня отдаёт 200 и **редиректит на `asu-london.ac.uk`**. В каталоге эта карточка
уже есть — `asu-london`, 29 программ, те же курсы (Global Design Engineering,
Engineering with AI, Mechatronics). Тоже привязка, не заведение.

Итого привязок: **7 записей, 482 программы**. Это отдельная задача — не заведение
карточек, а сведение цен и программ с уже живыми карточками через панель.

## 3. Не вузы — на подтверждение владельцу (10 записей, 25 программ)

| Запись QS | Программ | Что это |
|---|---:|---|
| Testing December - Testing purpose | 2 | тестовая запись портала QS (описание «Test»). Заводить нельзя |
| St. James Catholic Middle School | 1 | средняя школа (по описанию — Amerigo Los Angeles Middle School) |
| Wycombe Abbey International School (Китай) | 2 | школа |
| Wycombe Abbey International School, Bangkok | 3 | школа |
| Wycombe Abbey International School, Hong Kong | 2 | школа |
| University Bridge | 5 | программа перевода в вуз через two-year colleges, не вуз |
| On Campus Ireland | 4 | pathway-провайдер без головного вуза |
| MPW | 4 | группа колледжей A-level (Лондон, Бирмингем, Кембридж) |
| ILAC International Language Academy of Canada | 1 | языковая школа |

**Два последних — не однозначный мусор.** В каталоге уже живут ровно такие же
заведения: `abbey-cambridge`, `abbey-manchester`, `abbey-dld-london` (колледжи A-level)
и `language-studies-international` (языковая школа). Если планка каталога такая,
MPW и ILAC под неё проходят. Прошу решения владельца: держим их или нет.

Первые восемь — заводить не предлагаю.

---

## Что дальше

1. Владелец подтверждает списки 2 и 3.
2. По семи вузам из списка 1 — замер разметки офсайта (в работе), потом разборщик
   города и длительности. Длительность, которой на странице курса нет, **не выводится
   из уровня** — заводится кейсом в `/manager` (решение владельца от 2026-08-03).
3. Список 2 — отдельной задачей на привязку, объёмом он больше заведения:
   482 программы против 612.
