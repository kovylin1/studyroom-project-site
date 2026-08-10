# Разбор кейсов сверки — итог

Кейсов в `diff-review.json`: **1361**. С решением: **464** (этим прогоном 0, раньше 464). Осталось за человеком или за отдельным исполнителем: **897**.

## Закрыто

| Разряд → решение | Кейсов |
|---|---:|
| kompas_programs_extra → resolved | 318 |
| kompas_fee_absent → ignore | 130 |
| kompas_fee_currency → ignore | 12 |
| kompas_fee_mismatch → update | 3 |
| kompas_source_empty → ignore | 1 |

## Не закрыто — почему

| Разряд | Причина | Кейсов |
|---|---|---:|
| kompas_no_extract | выгрузка источника не села на карточку — баг привязки, диагноз в QS-UNLINKED-REPORT.md | 123 |
| kompas_programs_missing | добор программ с агрегатора (P2) — механический шаг, но он меняет живой каталог | 274 |
| kompas_programs_extra | метка catalog-only на карточке не проставлена — нужен повторный прогон P1 (при нём QS был заблокирован) | 113 |
| kompas_fee_mismatch | цена источника кампусная (campusLevelStated), прецедент 29.07 её не покрывает | 323 |
| kompas_campus_missing | добор кампусов с источника — механический шаг, меняет живой каталог | 57 |
| kompas_fee_currency | вуз появился после сбора QS и ручным разбором валюты (P0.4) не покрыт | 6 |
| kompas_fee_mismatch_rest | цена источника кампусная (campusLevelStated), прецедент 29.07 её не покрывает | 1 |
