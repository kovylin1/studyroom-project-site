# Edvoy: что осталось разобрать

Заведено 23.08.2026. Владелец: «сохрани их, потом разберу» — задача 3.20 в PLAN.md.
Черновики выгрузок лежат в `sources/kompas/extracts/edvoy-newcards/`, кейсы — во вкладке
КОМПАС в /manager (`edvoy-newcards-review.json`).

## 1. Нет города — 10 вузов, 25 программ

Источник города не назвал, Wikidata сущности не знает. Правило владельца: город
не выдумываем, поэтому карточка не заводится. Нужен город от человека.

| Вуз | Страна | Программ | Страница у источника |
|---|---|---:|---|
| Ecole de Management Applique | France | 9 | https://edge.edvoy.com/institutions/ecole-de-management-applique |
| Lincoln University College | Malaysia | 7 | https://edge.edvoy.com/institutions/lincoln-university-college |
| CBS University of Applied Sciences | Germany | 2 | https://edge.edvoy.com/institutions/cbs-university-of-applied-sciences |
| ALFA University College (AUC) | Malaysia | 1 | https://edge.edvoy.com/institutions/alfa-university-college-auc |
| European Global Institute of Innovation and Technology | Malta | 1 | https://edge.edvoy.com/institutions/european-global-institute-of-innovation-and-technology |
| MJM Graphic Design | France | 1 | https://edge.edvoy.com/institutions/mjm-graphic-design |
| Rome Business School | Italy | 1 | https://edge.edvoy.com/institutions/rome-business-school |
| The International University of Logistics and Transport | Poland | 1 | https://edge.edvoy.com/institutions/the-international-university-of-logistics-and-transport |
| The University of waterloo | Canada | 1 | https://edge.edvoy.com/institutions/the-university-of-waterloo |
| Widener University | United States | 1 | https://edge.edvoy.com/institutions/widener-university |

Rome Business School Wikidata на самом деле знает (Рим) — на прогоне 23.08 запрос
не дошёл из-за отказов. Следующий прогон `kompas-edvoy-city-wikidata.mjs` подхватит сам.

## 2. Карточек-близнецов по две — 3 вуза

Выгрузку некуда привязать: под вуз подходят две карточки сразу, и матчер
справедливо отказывается выбирать. Нужно решение, какая главная, — и слияние.

| Вуз у источника | Карточки | Программ у источника |
|---|---|---:|
| Royal Holloway University of London | `royal-holloway-direct-entry`, `royal-holloway` | 321 |
| University of Victoria | `uvic`, `victoria` | 88 |
| Long Island University Brooklyn | `liu-brooklyn`, `long-island-university-brooklyn-direct-entry` | 66 |

## 3. Однофамильцы — 1

Карточка с тем же именем есть, но в другой стране. Привязывать нельзя.

| Вуз у источника | Страна | Похожая карточка |
|---|---|---|
| Lincoln University College | Malaysia | `lincoln-nz` |

## 4. Усохшая выдача — 54 вузов

Отдельный список: `EDVOY-SHRUNK.md`. Между 22.07 и 23.08 edvoy перестал отдавать
программы у 54 вузов (5605 → 198). Выгрузки не переписаны,
в копии лежат июльские данные. Решение владельца: не трогать, вернуться отдельно.

## 5. Города языковых сетей

KAPLAN English, EC English, Kings Education и подобные сети получили город одного
филиала — то, что стоит у источника в `address.city`. Сети многогородние; если такие
карточки поедут на сайт, город стоит перепроверить. Владелец принял к сведению 23.08.

## 6. Stafford House

Привязан к карточке `stafford-house` до того, как в сборщик добавили сверку страны:
у карточки United Kingdom, у выгрузки edvoy Germany. Имя и сеть те же — проверить глазами.
