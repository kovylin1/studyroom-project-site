# Применение цен QS

Источник: `sources/kompas/qs-fee-basis-map.json`. Пишется только разряд `annual` —
сайт подписывает любое число из `tuition.byProgram` как цену за год (`card.perYear`).
Режим: **перезапись существующих цен**.

| Показатель | Значение |
|---|---:|
| extracts | 512 |
| extractsLinked | 507 |
| cardsTouched | 411 |
| written | 21923 |
| wholeTerm | 340 |
| keptExisting | 0 |
| overwritten | 21880 |
| skippedBucket | 1433 |
| skippedCurrency | 1100 |
| skippedNoMatch | 10402 |
| skippedNoCard | 0 |

## Не записано

| Причина | Штук |
|---|---:|
| `no-match` | 10402 |
| `bucket` | 1433 |
| `currency-conflict` | 1081 |
| `currency-unsupported` | 19 |

Подробности: `qs-fees-apply-cases.json`, откат: `qs-fees-apply-backup.json`.
