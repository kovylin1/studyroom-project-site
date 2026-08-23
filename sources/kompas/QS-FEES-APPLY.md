# Применение цен QS

Источник: `sources/kompas/qs-fee-basis-map.json`. Пишется только разряд `annual` —
сайт подписывает любое число из `tuition.byProgram` как цену за год (`card.perYear`).
Режим: заполняются только пустые места, существующие цены не трогаются.

| Показатель | Значение |
|---|---:|
| extracts | 512 |
| extractsLinked | 505 |
| cardsTouched | 332 |
| written | 14600 |
| keptExisting | 6932 |
| overwritten | 0 |
| skippedBucket | 2044 |
| skippedCurrency | 1152 |
| skippedNoMatch | 10119 |
| skippedNoCard | 0 |

## Не записано

| Причина | Штук |
|---|---:|
| `no-match` | 10119 |
| `fee-mismatch` | 3384 |
| `bucket` | 2044 |
| `currency-conflict` | 920 |
| `currency-unsupported` | 232 |

Подробности: `qs-fees-apply-cases.json`, откат: `qs-fees-apply-backup.json`.
