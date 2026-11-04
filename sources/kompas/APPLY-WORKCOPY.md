# 3.1 — перенос рабочей копии в живой каталог

Скрипт `scraper/kompas-apply-workcopy.mjs`. Режим: **запись**.
Выбор: карточки по списку, всего 12.
Снято 2026-11-04 10:26 UTC.

| Что | Карточек |
|---|---:|
| Заведено новых | 0 |
| Обновлено | 11 |
| Уже совпадало | 0 |
| Не перенесено (нарушили бы гейт) | 1 |

Откат: `node scraper/kompas-apply-workcopy.mjs --rollback=backups/live_pre-3.1_2026-11-04-10-26`

## Не перенесено

| Карточка | Почему |
|---|---|
| `heriot-watt-dubai` | уровень «phd» против названия «Postgraduate research» (master) |

## Обновлены

`american-university-of-ras-al-khaimah-aurak`, `burgundy-school-of-business`, `demiroglu-bilim-university`, `domus-academy`, `ibs-budapest`, `inti-international-university`, `sp-jain-school-of-global-management-dubai`, `srh-haarlem-university-of-applied-sciences`, `srh-hochschule-berlin`, `webster-university`, `woosong-university`
