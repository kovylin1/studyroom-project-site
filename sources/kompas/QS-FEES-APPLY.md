# Применение цен QS

Источник: `sources/kompas/qs-fee-basis-map.json`. Пишется только разряд `annual` —
сайт подписывает любое число из `tuition.byProgram` как цену за год (`card.perYear`).
Режим: заполняются только пустые места, существующие цены не трогаются.

| Показатель | Значение |
|---|---:|
| extracts | 512 |
| extractsLinked | 505 |
| cardsTouched | 15 |
| written | 56 |
| wholeTerm | 56 |
| keptExisting | 21816 |
| overwritten | 0 |
| skippedBucket | 1433 |
| skippedCurrency | 1202 |
| skippedNoMatch | 10340 |
| skippedNoCard | 0 |

## Не записано

| Причина | Штук |
|---|---:|
| `no-match` | 10340 |
| `fee-mismatch` | 3530 |
| `bucket` | 1433 |
| `currency-conflict` | 928 |
| `currency-unsupported` | 274 |

Подробности: `qs-fees-apply-cases.json`, откат: `qs-fees-apply-backup.json`.
