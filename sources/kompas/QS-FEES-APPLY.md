# Применение цен QS

Источник: `sources/kompas/qs-fee-basis-map.json`. Пишется только разряд `annual` —
сайт подписывает любое число из `tuition.byProgram` как цену за год (`card.perYear`).
Режим: **перезапись существующих цен**.

| Показатель | Значение |
|---|---:|
| extracts | 512 |
| extractsLinked | 505 |
| cardsTouched | 407 |
| written | 21872 |
| wholeTerm | 340 |
| keptExisting | 0 |
| overwritten | 21872 |
| skippedBucket | 1433 |
| skippedCurrency | 1202 |
| skippedNoMatch | 10340 |
| skippedNoCard | 0 |

## Не записано

| Причина | Штук |
|---|---:|
| `no-match` | 10340 |
| `bucket` | 1433 |
| `currency-conflict` | 928 |
| `currency-unsupported` | 274 |

Подробности: `qs-fees-apply-cases.json`, откат: `qs-fees-apply-backup.json`.
