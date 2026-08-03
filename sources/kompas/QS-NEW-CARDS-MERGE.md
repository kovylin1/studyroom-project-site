# Сведение офсайта с QS — 2026-08-03

Собрано `scraper/kompas-merge-offsite.mjs`. Цена — от QS (`campusLevelStated`),
срок — со страницы курса офсайта либо из названия строки QS, город — за человеком.
Черновики: `sources/kompas/newcards/*.draft.json`. **В живой каталог ничего не записано.**

## Числа

| Вуз | QS строк (после отсева дублей) | Страниц офсайта | Пар | Со сроком | В черновике | Кейсов | Страниц офсайта без пары |
|---|---:|---:|---:|---:|---:|---:|---:|
| Falmouth University | 124 → 98 | 102 | 97 | 96 | 93 | 48 | 47 |
| University of Worcester | 212 → 201 | 245 | 106 | 94 | 94 | 127 | 141 |
| Peking University HSBC Business School | 2 → 2 | 2 | 2 | 2 | 2 | 2 | 0 |
| MPW | 4 → 4 | 6 | 4 | 2 | 2 | 4 | 4 |
| ILAC — International Language Academy of Canada | 1 → 1 | 2 | 1 | 0 | 0 | 1 | 1 |

Разделы (`kind: "hub"`) в сведение не брались: falmouth-university 18, university-of-worcester 1, peking-university-hsbc-business-school 0, mpw 0, ilac-international-language-academy-of-canada 0.

## Кейсы оператору

| Вид | Сколько |
|---|---:|
| нет пары на офсайте | 96 |
| срок под вопросом (вариант курса) | 43 |
| нет уровня | 19 |
| нет срока | 16 |
| одна страница у нескольких строк QS | 4 |
| две страницы с одинаковым счётом | 2 |
| цена без валюты | 2 |

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

**нет пары на офсайте — 95**

- ACCOUNTING and FINANCE DIPHE — лучший счёт 0.00 < 0.8 — ближайшая страница: Professional Development (0.00) https://www.worcester.ac.uk/courses/postgraduate-professional-development
- BA ACCOUNTING and FINANCE (HONS) — лучший счёт 0.25 < 0.8 — ближайшая страница: Filmmaking (0.25) https://www.worc.ac.uk/courses/filmmaking-ba-hons
- BA BUSINESS and FINANCE (HONS) — лучший счёт 0.50 < 0.8 — ближайшая страница: Business and Marketing (0.50) https://www.worc.ac.uk/courses/business-marketing-ba-hons
- BA BUSINESS and HUMAN RESOURCE MANAGEMENT (HONS) — лучший счёт 0.60 < 0.8 — ближайшая страница: Business Management (0.60) https://www.worc.ac.uk/courses/business-management-ba-hons
- BA DIGITAL BUSINESS (HONS) — лучший счёт 0.50 < 0.8 — ближайшая страница: Business and Marketing (0.50) https://www.worc.ac.uk/courses/business-marketing-ba-hons
- BSc BUSINESS PSYCHOLOGY (HONS) — лучший счёт 0.67 < 0.8 — ближайшая страница: Psychology (0.67) https://www.worc.ac.uk/courses/psychology-bsc-hons
- MARKETING — лучший счёт 0.50 < 0.8 — ближайшая страница: Business and Marketing (0.50) https://www.worc.ac.uk/courses/business-marketing-ba-hons
- ANIMATION (JOINT HONOURS) — лучший счёт 0.33 < 0.8 — ближайшая страница: Screenwriting (0.33) https://www.worc.ac.uk/courses/screenwriting-joint-honours
- BA ANIMATION and FILMMAKING (HONS) — лучший счёт 0.67 < 0.8 — ближайшая страница: Filmmaking (0.67) https://www.worc.ac.uk/courses/filmmaking-ba-hons
- BA ANIMATION and GAME ART (HONS) — лучший счёт 0.75 < 0.8 — ближайшая страница: Game Art (0.75) https://www.worc.ac.uk/courses/game-art-ba-hons
- BA ANIMATION and GRAPHIC DESIGN (HONS) — лучший счёт 0.75 < 0.8 — ближайшая страница: Graphic Design (0.75) https://www.worc.ac.uk/courses/graphic-design-ba-hons
- BA ANIMATION and ILLUSTRATION (HONS) — лучший счёт 0.67 < 0.8 — ближайшая страница: Illustration (0.67) https://www.worc.ac.uk/courses/illustration-ba-hons
- …ещё 83, см. cases.json

**две страницы с одинаковым счётом — 2**

- BA MEDIA & FILM STUDIES and SCREENWRITING (HONS)
- BA MEDIA & FILM STUDIES and SOCIOLOGY (HONS)

**нет срока — 12**

- MTHEATRE TOURING THEATRE — срока нет ни на странице, ни в названии строки QS
- BA/BSc EDUCATION STUDIES and PSYCHOLOGY (HONS) — срока нет ни на странице, ни в названии строки QS
- CELTA — срока нет ни на странице, ни в названии строки QS
- HISTORY MRES — срока нет ни на странице, ни в названии строки QS
- LEADING CULTURE CHANGE in SAFEGUARDING PGCERT — срока нет ни на странице, ни в названии строки QS
- LEARNING AND TEACHING in HIGHER EDUCATION (PGCLTHE) — срока нет ни на странице, ни в названии строки QS
- SOCIOLOGY MRES — срока нет ни на странице, ни в названии строки QS
- FILM MRES — срока нет ни на странице, ни в названии строки QS
- MA CREATIVE MEDIA — срока нет ни на странице, ни в названии строки QS
- MEDIA and CULTURE MRES — срока нет ни на странице, ни в названии строки QS
- MPHIL/PHD ENGLISH LITERATURE AND LANGUAGE — срока нет ни на странице, ни в названии строки QS
- MPhil/Phd ENGLISH LITERATURE and LANGUAGE — срока нет ни на странице, ни в названии строки QS

**одна страница у нескольких строк QS — 1**

- MPHIL/PHD ENGLISH LITERATURE AND LANGUAGE / MPhil/Phd ENGLISH LITERATURE and LANGUAGE — у строк РАЗНАЯ цена — какая верна, решает человек — цены: 14700 GBP / 17400 GBP

**нет уровня — 17**

- GRAPHIC DESIGN — уровень не отдали ни QS, ни страница курса; схема его требует
- SCREENWRITING (JOINT HONOURS) — уровень не отдали ни QS, ни страница курса; схема его требует
- PGCE - PRIMARY EDUCATION with SENDI (QTS) — уровень не отдали ни QS, ни страница курса; схема его требует
- PGCE - PRIMARY with PE — уровень не отдали ни QS, ни страница курса; схема его требует
- PGCE - SECONDARY — уровень не отдали ни QS, ни страница курса; схема его требует
- PGCE - SECONDARY - GEOGRAPHY — уровень не отдали ни QS, ни страница курса; схема его требует
- PGCE - SECONDARY - HISTORY — уровень не отдали ни QS, ни страница курса; схема его требует
- PGCE - SECONDARY - MODERN LANGUAGES — уровень не отдали ни QS, ни страница курса; схема его требует
- PGCE - SECONDARY - PSYCHOLOGY — уровень не отдали ни QS, ни страница курса; схема его требует
- PGCE - SECONDARY - RELIGIOUS EDUCATION — уровень не отдали ни QS, ни страница курса; схема его требует
- PGCE - SECONDARY - MATHEMATICS — уровень не отдали ни QS, ни страница курса; схема его требует
- PGCE - SECONDARY - SCIENCE: BIOLOGY — уровень не отдали ни QS, ни страница курса; схема его требует
- …ещё 5, см. cases.json

**Страницы офсайта без пары — 141** (примеры): Professional Development, Medicine (Graduate Entry), Circus Arts and Physical Theatre, Computer Science, Cricket Coaching and Management, Criminology and Psychology, Criminology, Criminology with Forensic Psychology, Degree in Professional Policing, Dental Technology, Diagnostic Radiography, Diagnostic Radiography

## Peking University HSBC Business School

**цена без валюты — 2**

- Cross-Border MA in Finance — у QS в шапке вуза: Max: £29,500.00 Min: £29,500.00
- Cross-Border MA Management — у QS в шапке вуза: Max: £29,500.00 Min: £29,500.00

## MPW

**нет срока — 2**

- GCSE Subjects — срока нет ни на странице, ни в названии строки QS — улика: «TIONS » MPW LONDON » COURSES » GCSE MPW London – GCSE & IGCSE MPW London offers one year GCSE courses and two year GCSE »
- GCSE Subjects — срока нет ни на странице, ни в названии строки QS — улика: «TIONS » MPW LONDON » COURSES » GCSE MPW London – GCSE & IGCSE MPW London offers one year GCSE courses and two year GCSE »

**нет уровня — 2**

- 1 year A Level — уровень не отдали ни QS, ни страница курса; схема его требует
- 2 year A Level — уровень не отдали ни QS, ни страница курса; схема его требует

**Страницы офсайта без пары — 4** (примеры): A Level — MPW Birmingham, GCSE — MPW Birmingham, A Level — MPW Cambridge, GCSE — MPW Cambridge

## ILAC — International Language Academy of Canada

**нет срока — 1**

- Young Adults 15 - 18 University Pathway Program — срока нет ни на странице, ни в названии строки QS — улика: «The estimated length of your program will be: High-advanced (Level 14–15) 8–12 weeks Advanced (Level 12–13) 12–20 weeks »

**Страницы офсайта без пары — 1** (примеры): University Pathway Program

