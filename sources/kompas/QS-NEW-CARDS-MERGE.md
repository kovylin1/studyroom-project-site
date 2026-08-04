# Сведение офсайта с QS — 2026-08-04

Собрано `scraper/kompas-merge-offsite.mjs`. Цена — от QS (`campusLevelStated`),
срок — со страницы курса офсайта либо из названия строки QS, город — за человеком.
Черновики: `sources/kompas/newcards/*.draft.json`. **В живой каталог ничего не записано.**

## Числа

| Вуз | QS строк (после отсева дублей) | Страниц офсайта | Пар | Со сроком | В черновике | Кейсов | Страниц офсайта без пары |
|---|---:|---:|---:|---:|---:|---:|---:|
| Falmouth University | 124 → 98 | 102 | 97 | 96 | 93 | 48 | 47 |
| University of Worcester | 212 → 201 | 262 | 135 | 108 | 108 | 102 | 135 |
| Peking University HSBC Business School | 2 → 2 | 2 | 2 | 2 | 2 | 2 | 0 |
| MPW | 4 → 4 | 6 | 4 | 2 | 2 | 2 | 4 |
| ILAC — International Language Academy of Canada | 1 → 1 | 2 | 1 | 0 | 0 | 1 | 1 |

Разделы (`kind: "hub"`) в сведение не брались: falmouth-university 18, university-of-worcester 1, peking-university-hsbc-business-school 0, mpw 0, ilac-international-language-academy-of-canada 0.

## Кейсы оператору

| Вид | Сколько |
|---|---:|
| нет пары на офсайте | 67 |
| срок под вопросом (вариант курса) | 43 |
| нет срока | 31 |
| одна страница у нескольких строк QS | 10 |
| две страницы с одинаковым счётом | 2 |
| цена взята с офсайта, проверить единицу | 2 |

Полный список — `sources/kompas/newcards/cases.json`.

## Falmouth University

**срок под вопросом (вариант курса) — 43**

- Animation BA (Hons) with Integrated Foundation — взят срок 3, варианты: foundation — улика: «3 years / 4 years»
- Animation BA (Hons) with professional placement — взят срок 3, варианты: placement — улика: «3 years / 4 years»
- Costume Design for Film & Television BA (Hons) with Integrated Foundation — взят срок 3, варианты: foundation — улика: «3 years / 4 years»
- Costume Design for Film & Television BA (Hons) with professional placement — взят срок 3, варианты: placement — улика: «3 years / 4 years»
- Creative Events Management BA (Hons) with professional placement — взят срок 3, варианты: placement — улика: «3 years / 4 years»
- Drawing BA (Hons) with Integrated Foundation — взят срок 3, варианты: foundation — улика: «3 years / 4 years»
- Drawing BA (Hons) with professional placement — взят срок 3, варианты: placement — улика: «3 years / 4 years»
- Fine Arts BA (Hons) with Integrated Foundation — взят срок 3, варианты: foundation — улика: «3 years / 4 years»
- Fine Arts BA (Hons) with professional placement — взят срок 3, варианты: placement — улика: «3 years / 4 years»
- Fashion Photography BA (Hons) with professional placement — взят срок 3, варианты: placement — улика: «3 years / 4 years»
- Fashion Styling & Art Direction BA (Hons) with Integrated Foundation — взят срок 3, варианты: foundation — улика: «3 years / 4 years»
- Fashion Styling & Art Direction BA (Hons) with professional placement — взят срок 3, варианты: placement — улика: «3 years / 4 years»
- …ещё 31, см. cases.json

**нет пары на офсайте — 1**

- Media & Public Relations BA (Hons) — лучший счёт 0.40 < 0.8 — ближайшая страница: Media & Communication BA(Hons) (0.40) https://www.falmouth.ac.uk/study/undergraduate/media-communication

**нет срока — 1**

- Marketing MSc — срока нет ни на странице, ни в названии строки QS

**одна страница у нескольких строк QS — 3**

- Game Animation BA (Hons) three year degree / Games Animation BA (Hons) — строки различаются только написанием названия — цены: 19950 GBP
- Game Animation BA (Hons) with Integrated Foundation / Games Animation BA (Hons) with Integrated Foundation — строки различаются только написанием названия — цены: 19950 GBP
- Game Animation BA (Hons) with professional placement / Games Animation BA (Hons) with professional placement — строки различаются только написанием названия — цены: 19950 GBP

**Страницы офсайта без пары — 47** (примеры): Acting BA(Hons), Architectural Design & Technology BA(Hons), Architecture BA(Hons), Business & Marketing BSc(Hons) (Online), Combined Arts: Creativity BA(Hons), Commercial Photography BA(Hons), Creative Computing BSc(Hons)/BA(Hons), Creative Music Technology BA(Hons), Creative Writing BA(Hons), Creative Writing BA(Hons) (Online), Dance & Choreography BA(Hons), Documentary & Editorial Photography BA(Hons)

## University of Worcester

**нет пары на офсайте — 66**

- ACCOUNTING and FINANCE DIPHE — лучший счёт 0.67 < 0.8 — ближайшая страница: Accounting and Finance (0.67) https://www.worc.ac.uk/courses/accounting-and-finance-ba-hons
- BA DIGITAL BUSINESS (HONS) — лучший счёт 0.50 < 0.8 — ближайшая страница: Business and Marketing (0.50) https://www.worc.ac.uk/courses/business-marketing-ba-hons
- BSc BUSINESS PSYCHOLOGY (HONS) — лучший счёт 0.67 < 0.8 — ближайшая страница: Psychology (0.67) https://www.worc.ac.uk/courses/psychology-bsc-hons
- MARKETING — лучший счёт 0.50 < 0.8 — ближайшая страница: Business and Marketing (0.50) https://www.worc.ac.uk/courses/business-marketing-ba-hons
- ENGLISH LITERATURE AND THEATRE — лучший счёт 0.67 < 0.8 — ближайшая страница: English Literature (0.67) https://www.worc.ac.uk/courses/english-literature-ba-hons
- THEATRE — лучший счёт 0.50 < 0.8 — ближайшая страница: Musical Theatre (0.50) https://www.worc.ac.uk/courses/musical-theatre-ba-with-millennium-performing-arts-hons
- BSc DATA SCIENCE (HONS) — лучший счёт 0.50 < 0.8 — ближайшая страница: Computer Science (0.50) https://www.worc.ac.uk/courses/computer-science-bsc-hons
- COMPUTING FOUNDATION YEAR — лучший счёт 0.20 < 0.8 — ближайшая страница: Geography with International Year Abroad (0.20) https://www.worc.ac.uk/courses/geography-with-international-year-abroad-bsc-hons
- BA CRIMINOLOGY with FORENSIC PSYCHOLOGY (HONS) — лучший счёт 0.75 < 0.8 — ближайшая страница: Criminology with Forensic Psychology (0.75) https://www.worc.ac.uk/courses/criminology-with-forensic-psychology
- BA EARLY CHILDHOOD in SOCIETY (HONS) — лучший счёт 0.67 < 0.8 — ближайшая страница: Early Childhood (0.67) https://www.worc.ac.uk/courses/early-childhood-in-society-graduate-practitioner-ba-hons
- BA INTEGRATIVE COUNSELLING (HONS) TOP-UP DEGREE — лучший счёт 0.28 < 0.8 — ближайшая страница: Counselling (0.28) https://www.worc.ac.uk/courses/counselling-msc
- BA PRIMARY INITIAL TEACHER EDUCATION (with QTS) (HONS) — лучший счёт 0.67 < 0.8 — ближайшая страница: Primary Education (0.67) https://www.worc.ac.uk/courses/primary-education-with-qts-ba-hons
- …ещё 54, см. cases.json

**нет срока — 27**

- BA ANIMATION and GAME ART (HONS) — срока нет ни на странице, ни в названии строки QS
- MTHEATRE TOURING THEATRE — срока нет ни на странице, ни в названии строки QS
- BA/BSc EDUCATION STUDIES and PSYCHOLOGY (HONS) — срока нет ни на странице, ни в названии строки QS
- CELTA — срока нет ни на странице, ни в названии строки QS
- HISTORY MRES — срока нет ни на странице, ни в названии строки QS
- LEADING CULTURE CHANGE in SAFEGUARDING PGCERT — срока нет ни на странице, ни в названии строки QS
- LEARNING AND TEACHING in HIGHER EDUCATION (PGCLTHE) — срока нет ни на странице, ни в названии строки QS
- MPHIL/PHD HISTORY — срока нет ни на странице, ни в названии строки QS
- MPHIL/PHD LAW — срока нет ни на странице, ни в названии строки QS
- MPHIL/PHD PSYCHOLOGY — срока нет ни на странице, ни в названии строки QS
- MPHIL/PHD SOCIOLOGY — срока нет ни на странице, ни в названии строки QS
- SOCIOLOGY MRES — срока нет ни на странице, ни в названии строки QS
- …ещё 15, см. cases.json

**две страницы с одинаковым счётом — 2**

- BA MEDIA & FILM STUDIES and SCREENWRITING (HONS)
- BA MEDIA & FILM STUDIES and SOCIOLOGY (HONS)

**одна страница у нескольких строк QS — 7**

- MPHIL/PHD LAW / MPhil/Phd LAW — у строк РАЗНАЯ цена — какая верна, решает человек — цены: 14700 GBP / 17400 GBP
- MPHIL/PHD PSYCHOLOGY / MPhil/Phd PSYCHOLOGY — у строк РАЗНАЯ цена — какая верна, решает человек — цены: 14700 GBP / 17400 GBP
- MPHIL/PHD SOCIOLOGY / MPhil/Phd SOCIOLOGY — у строк РАЗНАЯ цена — какая верна, решает человек — цены: 14700 GBP / 17400 GBP
- MPHIL/PHD ART AND DESIGN / MPhil/Phd ART and DESIGN — у строк РАЗНАЯ цена — какая верна, решает человек — цены: 14700 GBP / 17400 GBP
- MPHIL/PHD DRAMA AND PERFORMANCE / MPhil/Phd DRAMA and PERFORMANCE — у строк РАЗНАЯ цена — какая верна, решает человек — цены: 14700 GBP / 17400 GBP
- MPHIL/PHD ENGLISH LITERATURE AND LANGUAGE / MPhil/Phd ENGLISH LITERATURE and LANGUAGE — у строк РАЗНАЯ цена — какая верна, решает человек — цены: 14700 GBP / 17400 GBP
- MPHIL/PHD COMPUTING / Mphil/Phd COMPUTING — у строк РАЗНАЯ цена — какая верна, решает человек — цены: 14700 GBP / 17400 GBP

**Страницы офсайта без пары — 135** (примеры): Professional Development, Medicine (Graduate Entry), Circus Arts and Physical Theatre, Computer Science, Cricket Coaching and Management, Criminology and Psychology, Criminology with Forensic Psychology, Degree in Professional Policing, Dental Technology, Diagnostic Radiography, Diagnostic Radiography, Diploma in Teaching (Further Education & Skills) (DiT) UNDERGRADUATE Explore our Further Education & Skills Teaching Dip

## Peking University HSBC Business School

**цена взята с офсайта, проверить единицу — 2**

- Cross-Border MA in Finance — 29500 GBP — за всю программу (2 года): год 1 Оксфордшир £23 000 + год 2 Шэньчжэнь £6 500. У QS в шапке: Max: £29,500.00 Min: £29,500.00. Число 272 895 — та же сумма в юанях (курс ~9.25). Если поле хранит цену ЗА ГОД, ставить 14 750.
- Cross-Border MA Management — 29500 GBP — за всю программу (2 года): год 1 Оксфордшир £23 000 + год 2 Шэньчжэнь £6 500. У QS в шапке: Max: £29,500.00 Min: £29,500.00. Число 272 895 — та же сумма в юанях (курс ~9.25). Если поле хранит цену ЗА ГОД, ставить 14 750.

## MPW

**нет срока — 2**

- GCSE Subjects — срока нет ни на странице, ни в названии строки QS — улика: «TIONS » MPW LONDON » COURSES » GCSE MPW London – GCSE & IGCSE MPW London offers one year GCSE courses and two year GCSE »
- GCSE Subjects — срока нет ни на странице, ни в названии строки QS — улика: «TIONS » MPW LONDON » COURSES » GCSE MPW London – GCSE & IGCSE MPW London offers one year GCSE courses and two year GCSE »

**Страницы офсайта без пары — 4** (примеры): A Level — MPW Birmingham, GCSE — MPW Birmingham, A Level — MPW Cambridge, GCSE — MPW Cambridge

## ILAC — International Language Academy of Canada

**нет срока — 1**

- Young Adults 15 - 18 University Pathway Program — срока нет ни на странице, ни в названии строки QS — улика: «The estimated length of your program will be: High-advanced (Level 14–15) 8–12 weeks Advanced (Level 12–13) 12–20 weeks »

**Страницы офсайта без пары — 1** (примеры): University Pathway Program

