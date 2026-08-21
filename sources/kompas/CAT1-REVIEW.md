# Категория 1 — что осталось решить владельцу

**Дата:** 2026-08-21. Прогон `scraper/kompas-qs-relink-cat1.mjs --apply`.
Живой каталог не менялся: правилось только поле `catalogSlug` в `sources/kompas/extracts/qs`.
Откат — `sources/kompas/qs-relink-cat1-backup.json`.

## Что изменилось

| | Было (21.08 утро) | Стало |
|---|---:|---:|
| Выгрузок QS привязано к карточкам | 401 | **465** |
| Не привязано | 111 | **45** |
| Программ в непривязанных | 2925 | **1294** |
| Помечено «не учебное заведение» | 0 | 2 |

Закрыто 64 выгрузки / 1591 программа, из них:

- **27 по слагу** — карточки, заведённые 20.08. Привязка просто не была прописана:
  Falmouth 124, Kwantlen 107, Marshall 85, Mercy 68, Northumbria QAHE 44, AURAK 23,
  OnCampus Aston 14, Westminster Tashkent 14, Swinburne Foundation 12 и далее.
- **37 по явной таблице** — тот же вуз, но имя у QS длиннее или короче каталожного.
  Сюда вошёл весь разряд «надёжно» из отчёта 02.08 (задача **1.6 закрыта**):
  Cardenal Herrera 46, NABA 29+9, RIT Dubai 18+8, Cretin-Derham 12, Queen Mary Malta 1, RCSI 1.
  И крупное сверх него: Worcester UG 113 + PG 99, UCAM 101, Wollongong Malaysia KDU 78,
  Marangoni Milan 71, APU Malaysia 64, Thompson Rivers 64, San Pablo CEU 57, FIU 46,
  Abat Oliba 44, Queens College CUNY 38, NYIT 29+27.
- **Одна ловушка обезврежена:** выгрузка `global-banking-school` совпадала по слагу с
  карточкой `global-banking-school` (Лондон), но у QS это Мальта. Ушла на `gbs-malta`.
  Скрипт сверяет страну и без этой сверки подмешал бы мальтийские программы в лондонскую карточку.
- **Выведены из сверки:** «Indian Internal Applications» (38) и «Testing December» (2) —
  разделы интерфейса портала, помечены `notAnInstitution` по решению 20.08.

**Главный вывод по категории 1:** формулировка «есть у агрегатора, нет в каталоге» была
неверной. Карточка почти всегда есть — не было привязки. Реально заводить новое нужно
двенадцати вузам из списка ниже, а не тридцати трём.

**Что это НЕ делает:** привязка не переносит программы в карточку. Она чинит сверку —
кейсы `kompas_no_extract` и `kompas_qs_link` (задачи 2.2 и 1.8) должны схлопнуться на
следующем прогоне сверки. Добор самих программ — отдельное движение (задача 1.9).

---

# Решения, которые нужны от тебя

## A. Новая карточка — кандидата в каталоге нет (12 записей, 550 программ)

Разбор 02.08 подставил им похожие карточки, но это **разные заведения**.
Привязывать нельзя, иначе в чужую карточку уедут чужие программы.

| Программ | Запись QS | Страна | Что подставлял разбор | Почему не оно |
|---:|---|---|---|---|
| 274 | University of Auckland | Новая Зеландия | `auckland-institute-of-studies` | AIS — частный институт, к университету отношения не имеет |
| 109 | Ara Institute of Canterbury | Новая Зеландия | `canterbury-nz` (University of Canterbury) | политех против университета, разные заведения |
| 75 | Seattle University | США | `north-seattle-college` | частный университет против общественного колледжа |
| 21 | DLD College London | Великобритания | `abbey-dld-london` (7 прог) | одна группа Abbey DLD, но школы разные |
| 18 | Mediadesign University of Applied Sciences | Германия | `fresenius-university-of-applied-sciences` | однофамильцы по типу «университет прикладных наук» |
| 14 | Victoria University | Австралия | — | `victoria` в каталоге — это University of Victoria, **Канада** |
| 12 | University of Delaware — Lerner College of Business & Economics | США | — | карточки нет вовсе |
| 10 | The American Business School of Paris | Франция | `american-kogod` | Kogod — это Вашингтон |
| 8 | University of Auckland (Foundation) | Новая Зеландия | `auckland-institute-of-studies` | подготовительное отделение того же University of Auckland |
| 5 | LCI Melbourne (Undergraduate) | Австралия | `the-university-of-melbourne` | LCI — сеть дизайн-школ, есть `lci-barcelona` |
| 4 | Dublin International Study Centre | Ирландия* | `leeds-isc` | ISC в Дублине, не в Лидсе |
| 0 | Durham College | Канада | `durham` | `durham` — Durham University, Англия. Программ 0, можно просто закрыть |

\* у QS страна проставлена как United Kingdom — похоже, брак разметки портала.

**Вопрос:** заводим все двенадцать? По ним нет ни города, ни срока обучения — QS их не
отдаёт. Город возьмём из Wikidata (сработало для 24 из 30 карточек 20.08), срок пойдёт
как «уточняется» по правилу 1.4.

## B. Кампус той же сети — своя карточка или головная? (9 записей, 130 программ)

Головная карточка есть, у QS это другая площадка в другой стране.

| Программ | Запись QS | Страна | Головная карточка |
|---:|---|---|---|
| 31 | EU Business School (Spain) | Испания | `eu-business-school` (Женева), есть ещё `-germany` и `-switzerland` |
| 25 | Arden University (Hybrid) | Германия | `arden` (Ковентри) |
| 19 | Istituto Marangoni Paris | Франция | `marangoni-milan`, `marangoni-london` |
| 18 | Kaplan International College Adelaide | Австралия | `kaplan-international-college` (Лондон), `kaplan-anz` (Брисбен) |
| 15 | University of Stirling (UAE) | ОАЭ | **дубль:** `stirling-rak` (RAK, 20 прог) и `university-of-stirling-ras-al-khaimah` (Дубай, 8 прог) |
| 10 | Istituto Marangoni Dubai | ОАЭ | `marangoni-milan` |
| 6 | University of Strathclyde, Bahrain | Бахрейн | `strathclyde` (Глазго) |
| 4 | Oxford International Education Group (North America Pathway) | Канада | `oxford-international`, `oxford-international-college` |
| 2 | Istituto Marangoni — Foundation | Италия | `marangoni-milan` |

**Вопрос:** каталог уже ведёт кампусы отдельными карточками (`eu-business-school-germany`,
`heriot-watt-dubai`, `wollongong-malaysia`). Продолжаем так же — заводим девять карточек?
Отдельно: у Стирлинга в ОАЭ **два дубля**, их надо слить, это задача 2.6.

## C. Подготовительное отделение при вузе — куда цеплять? (16 записей, 509 программ)

Самый спорный разряд. У QS это отдельная запись, в каталоге — либо карточка вуза,
либо карточка pathway-центра. Правило нужно одно на всех.

| Программ | Запись QS | Кандидат | Комментарий |
|---:|---|---|---|
| 239 | University of Oklahoma | `into-oklahoma` (24 прог) | это запись **самого вуза**, а карточка — INTO-центра при нём |
| 110 | Stony Brook University (Undergraduate) | `into-stony-brook` (127 прог) | то же самое |
| 69 | University of Essex (Online) (CertHE & Postgraduate) | `essex` (872 прог) | Essex Online — отдельный онлайн-провайдер |
| 16 | Brunel University London — Foundation | `brunel` | foundation при вузе |
| 11 | University of Essex (Online) (Undergraduate) | `essex` | |
| 10 | Royal Holloway University of London ISC | `royal-holloway-direct-entry` (3 прог) | есть ещё `royal-holloway` |
| 8 | INTO Manchester in partnership with The University of Manchester | `into-manchester` (118 прог) | а карточка `into-manchester-in-partnership-with-manchester-metropolitan-university` заведена 20.08 — рядом два разных партнёрства одного центра |
| 7 | On Campus Paris | `college-de-paris` | OnCampus работает при Collège de Paris |
| 7 | SAIBT — University of South Australia | `australia-institute-of-business-and-technology` | это **не** AIBT, а Navitas при UniSA |
| 6 | Glasgow International College — Foundation | `glasgow` / `ifg` | Kaplan-центр при Университете Глазго |
| 6 | OnCampus London South Bank — Foundation | `london-south-bank` | |
| 6 | OnCampus Loughborough (Foundation) | `loughborough-university` | |
| 5 | University of Essex (Online) (Postgraduate) | `essex` | |
| 4 | The University of Winnipeg Collegiate | `winnipeg` | Collegiate — школа при университете, не вуз |
| 3 | University of Bristol International Foundation | `bristol` / `ifg` | |
| 2 | Kaplan International Languages | `kaplan-international-college` | языковые курсы, не вуз |

**Вопрос — выбери одно правило:**
1. **Вливать в вуз.** Оклахома и Стони-Брук доедут целиком (349 программ), но
   pathway-программы перемешаются с основными.
2. **Заводить карточку центра.** Чище на витрине, но Оклахома и Стони-Брук останутся
   каждая с двумя карточками — одна почти пустая.
3. **По случаю:** записи самого вуза (Оклахома, Стони-Брук, Essex Online) — в карточку
   вуза; чистые pathway-центры (OnCampus, Glasgow IC, SAIBT) — своей карточкой.
   **Рекомендую этот.**

## D. SRH Universities — 84 программы, четыре карточки-кандидата

| Карточка | Имя | Город | Программ |
|---|---|---|---:|
| `srh-germany` | SRH International College | Берлин | 82 |
| `srh-international-college` | SRH International College | Хайдельберг | 18 |
| `srh-hochschule-berlin` | SRH Hochschule Berlin | Берлин | 80 |
| `srh-university` | SRH University of Applied Sciences Heidelberg | Хайдельберг | 11 |

Первые две носят **одно и то же имя** в разных городах — это похоже на дубль (задача 2.6).
Плюс 20.08 к `srh-germany` уже привязана выгрузка «SRH Universities (India)» на 67 программ.

**Вопрос:** сначала разобрать дубль, потом привязывать. Куда идут 84 программы записи
«SRH Universities» — в `srh-germany` или в `srh-hochschule-berlin`?

## E. Ждут города — 6 карточек, 21 программа (задача 1.5, без изменений)

Wikidata не помогла, QS города не отдаёт. Назови город — заведутся одним прогоном
`node scraper/kompas-newcards-build.mjs --apply`.

| Карточка | Программ | Почему не нашлось |
|---|---:|---|
| `university-of-tasmania-international-pathway-college` | 7 | Wikidata отдаёт штат «Tasmania». Кампусы UTAS — Хобарт и Лонсестон |
| `university-bridge` | 5 | Wikidata нашла мост в Саскачеване |
| `on-campus-ireland` | 4 | сущности в Wikidata нет; OnCampus в Ирландии — Дублин |
| `oxford-international-education-group-english-schools` | 2 | шесть площадок в трёх странах, головной офис в Оксфорде |
| `oxford-international-education-group-ielts-and-tesol` | 2 | то же |
| `oxford-international-education-group-junior` | 1 | то же |

Мои догадки в третьей колонке — именно догадки, поэтому и не применены. Подтверди или поправь.

## F. Пустые — 1 запись

`American Collegiate, Washington DC` — 0 программ. Карточка `american-collegiate-la`
занята лос-анджелесской записью. Заводить пустую карточку смысла нет; предлагаю
пометить как «нет программ у источника» и забыть.

---

# Что дальше по категории 1

- **1.6 — закрыто.** Разряд «надёжно» применён целиком.
- **1.7 / 1.8** — то, что осталось, разобрано выше по разрядам A–D. Ответы на четыре
  вопроса закрывают обе задачи разом.
- **1.9 (добор 207 программ) и 1.10 (хвосты по ценам и срокам)** — не трогались.
- **1.11 Пекинский университет** — не трогался, нужен свой сбор с `pku.edu.cn`.
- **Прогнать сверку** после привязки: 64 новых связи должны снять часть кейсов
  `kompas_no_extract` (задача 2.2) и `kompas_qs_link` (1.8).
