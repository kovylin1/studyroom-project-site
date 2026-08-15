# Разбор кейсов сверки — итог

Кейсов в `diff-review.json`: **1485**. С решением: **743** (этим прогоном 42, раньше 701). Осталось за человеком или за отдельным исполнителем: **742**.

## Закрыто

| Разряд → решение | Кейсов |
|---|---:|
| kompas_programs_extra → resolved | 310 |
| kompas_fee_absent → ignore | 271 |
| kompas_no_extract → ignore | 91 |
| kompas_campus_missing → ignore | 42 |
| kompas_fee_currency → ignore | 18 |
| kompas_fee_mismatch → update | 10 |
| kompas_source_empty → ignore | 1 |

## Не закрыто — почему

| Разряд | Причина | Кейсов |
|---|---|---:|
| kompas_no_extract | выгрузка источника не села на карточку — баг привязки, диагноз в QS-UNLINKED-REPORT.md | 36 |
| kompas_no_extract | выгрузка QS на эту карточку похожа, но привязка не подтверждена — кейс kompas_qs_link | 23 |
| kompas_programs_missing | добор программ с агрегатора (P2) — механический шаг, но он меняет живой каталог | 207 |
| kompas_programs_extra | метка catalog-only на карточке не проставлена — нужен повторный прогон P1 (при нём QS был заблокирован) | 129 |
| kompas_fee_mismatch | цена источника кампусная (campusLevelStated), прецедент 29.07 её не покрывает | 342 |
| kompas_campus_missing | добор кампусов по этому вузу не прогонялся | 4 |
| kompas_fee_mismatch_rest | цена источника кампусная (campusLevelStated), прецедент 29.07 её не покрывает | 1 |
