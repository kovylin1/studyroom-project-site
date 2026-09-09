# КОМПАС — очередь заведения карточек по QS

**Решение владельца 2026-08-20.** Служебные записи портала удалить; школы оставить —
со школами тоже партнёримся; всё, что портал отмечает партнёром, заводим на сайт.

Источник — 46 записей QS с вердиктом `absent` без подсказки (`qs-unlinked.json`).
Машинная выжимка — `newcards-queue.json`.

| Судьба | Записей | Программ |
|---|---:|---:|
| Удалить — служебные записи портала | 2 | 40 |
| Привязать к живой карточке — не заведение | 6 | 481 |
| Завести карточку | 38 | 797 |

## Удалить (решение 2026-08-20)

- **Indian Internal Applications** [India] — 38 программ. Не учебное заведение.
- **Testing December - Testing purpose** [Ukraine] — 2 программ. Не учебное заведение.

## Привязать к живым карточкам — 481 программа за одно движение

Вердикт `absent` по ним ошибочен: карточка есть и никем не занята. Это баг разбора привязки,
не пробел каталога. Дешевле и крупнее всего остального в очереди.

| Программ | Запись QS | Карточка |
|---:|---|---|
| 352 | University of the West of England (UWE) | `uwe-bristol` |
| 67 | SRH Universities (India) | `srh-germany` |
| 32 | Luiss University - Libera Università Internazionale degli Studi Sociali Guido Carli | `luiss` |
| 15 | Glion | `glion-switzerland` |
| 11 | UCL Centre for Languages & International Education | `ucl` |
| 4 | CESI School of Engineering | `cesi` |

## Завести — 38 записей, 797 программ

### University — 11 записей, 683 программ

| Программ | Вуз | Страна | Уровни | Цена за год у QS | Состояние |
|---:|---|---|---|---|---|
| 124 | Falmouth University | United Kingdom | Bachelors, Masters | £19,950.00 — £17,950.00 | черновик готов |
| 113 | University of Worcester (Undergraduate) | United Kingdom | Bachelors | £17,400.00 — £16,200.00 | черновик готов |
| 107 | Kwantlen Polytechnic University | Canada | Bachelors | CA$23,666.00 — CA$14,400.00 | **заблокировано: длительности нет нигде** |
| 99 | University of Worcester (Postgraduate) | United Kingdom | Masters, PhD | £17,400.00 — £16,200.00 | черновик готов |
| 85 | Marshall University | United States | Bachelors, Masters | US$60,000.00 — US$10,000.00 | **заблокировано: длительности нет нигде** |
| 68 | Mercy University | United States | Bachelors, Masters, Pathway | US$38,340.00 — US$12,814.00 | **заблокировано: длительности нет нигде** |
| 44 | Northumbria University London campus (QAHE) | United Kingdom | Bachelors, Masters | £22,000.00 — £1,625.00 | нужен обход офсайта |
| 23 | American University of Ras Al Khaimah (AURAK) | United Arab Emirates | Bachelors, Masters | AED 65,200.00 — AED 16,410.00 | нужен обход офсайта |
| 14 | Westminster International University in Tashkent | Uzbekistan | Bachelors, Masters | US$6,400.00 — US$4,600.00 | нужен обход офсайта |
| 4 | University of Tasmania, Melbourne Campus | Australia | Bachelors, Masters | A$35,950.00 — A$32,950.00 | нужен обход офсайта |
| 2 | Peking University HSBC Business School | China | Masters | £29,500.00 — £29,500.00 | черновик готов |

### Pathway — 20 записей, 98 программ

| Программ | Вуз | Страна | Уровни | Цена за год у QS | Состояние |
|---:|---|---|---|---|---|
| 14 | OnCampus Aston – Foundation | United Kingdom | Pathway | £18,738.00 — £16,562.00 | нужен обход офсайта |
| 12 | Swinburne University - Foundation | Australia | Pathway | A$28,461.00 — A$22,742.00 | нужен обход офсайта |
| 7 | University of Tasmania International Pathway College | Australia | Pathway | A$19,759.00 — A$17,099.00 | нужен обход офсайта |
| 7 | University of the West of England, Bristol International College (UWE Bristol) - Foundation | United Kingdom | Pathway | £27,688.50 — £16,891.20 | нужен обход офсайта |
| 7 | University of York International Pathway College - Foundation | United Kingdom | Pathway | £18,744.00 — £16,890.00 | нужен обход офсайта |
| 6 | Northumbria University London campus (QAHE) | United Kingdom | English Course, Pathway | £16,500.00 — £6,750.00 | нужен обход офсайта |
| 6 | OnCampus Hull - Foundation | United Kingdom | Pathway | £21,820.00 — £14,119.00 | нужен обход офсайта |
| 6 | OnCampus Southampton - Pathway | United Kingdom | Pathway | £20,526.00 — £19,519.00 | нужен обход офсайта |
| 5 | University Bridge | United States | Pathway | US$30,550.00 — US$25,450.00 | нужен обход офсайта |
| 4 | INTO Manchester in partnership with Manchester Metropolitan University | United Kingdom | Pathway | £19,650.00 — £19,650.00 | нужен обход офсайта |
| 4 | On Campus Ireland | Ireland | Pathway | €20,450.00 — €16,330.00 | нужен обход офсайта |
| 4 | OnCampus Sunderland - Foundation | United Kingdom | Pathway | £18,955.00 — £12,949.00 | нужен обход офсайта |
| 3 | The Hague University of Applied Science - Foundation | Netherlands | English Course, Pathway | €12,441.00 — €9,206.00 | нужен обход офсайта |
| 3 | ICN International College Paris | France | Pathway | €24,000.00 — €8,800.00 | нужен обход офсайта |
| 2 | Charles Darwin University International College | Australia | Pathway | A$26,599.00 — A$19,759.00 | нужен обход офсайта |
| 2 | Oxford International Education Group (English Schools) | United Kingdom | Pathway | £250.00 — £250.00 | нужен обход офсайта |
| 2 | Oxford International Education Group (IELTS & TESOL) | United Kingdom | Pathway | £250.00 — £250.00 | нужен обход офсайта |
| 2 | University of Lethbridge International College Calgary (Foundation) | Canada | Pathway | CA$22,369.00 — CA$19,500.00 | нужен обход офсайта |
| 1 | Oxford International Education Group (Junior) | United Kingdom | Pathway | £250.00 — £250.00 | нужен обход офсайта |
| 1 | TEDI - London | United Kingdom | Pathway | £24,500.00 — £14,700.00 | нужен обход офсайта |

### High School — 7 записей, 16 программ

| Программ | Вуз | Страна | Уровни | Цена за год у QS | Состояние |
|---:|---|---|---|---|---|
| 4 | MPW | United Kingdom | High School | £28,519.00 — £28,519.00 | черновик готов |
| 3 | Anglican Schools Commission (ASC)- Western Australia, Victoria and New South Wales | Australia | High School | A$28,856.00 — A$20,612.00 | нужен обход офсайта |
| 3 | Wycombe Abbey International School, Bangkok | Thailand | High School | THB 1,276,000.00 — THB 701,800.00 | нужен обход офсайта |
| 2 | Wycombe Abbey International School | China | English Course, High School | CN¥220,000.00 — CN¥110,000.00 | нужен обход офсайта |
| 2 | Wycombe Abbey International School, Hong kong | Hong Kong | High School | HK$218,000.00 — HK$188,000.00 | нужен обход офсайта |
| 1 | ILAC International Language Academy of Canada | Canada | High School | CA$15,935.00 — CA$11,686.00 | черновик готов |
| 1 | St. James Catholic Middle School | United States | High School | US$74,800.00 — US$74,800.00 | нужен обход офсайта |
