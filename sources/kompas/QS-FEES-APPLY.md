# Применение цен QS

Источник: `sources/kompas/qs-fee-basis-map.json`. Пишется только разряд `annual` —
сайт подписывает любое число из `tuition.byProgram` как цену за год (`card.perYear`).
Режим: **перезапись существующих цен**.

| Показатель | Значение |
|---|---:|
| extracts | 512 |
| extractsLinked | 507 |
| cardsTouched | 434 |
| written | 18586 |
| wholeTerm | 201 |
| keptExisting | 0 |
| overwritten | 18586 |
| programCurrency | 489 |
| variantPrograms | 215 |
| variantSums | 440 |
| skippedBucket | 1433 |
| skippedCurrency | 166 |
| skippedNoMatch | 10750 |
| skippedNoCard | 0 |

## Не записано

| Причина | Штук |
|---|---:|
| `no-match` | 10750 |
| `bucket` | 1433 |
| `currency-foreign-quote` | 147 |
| `currency-unsupported` | 19 |

Подробности: `qs-fees-apply-cases.json`, откат: `qs-fees-apply-backup.json`.
