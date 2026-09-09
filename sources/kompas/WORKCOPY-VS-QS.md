# Рабочая копия против выгрузок QS

Сверка без сети: локальные выгрузки `sources/kompas/extracts/qs` (сбор 15.08)
против `sources/kompas/catalog-work`.

| Показатель | Значение |
|---|---:|
| extractsLinked | 507 |
| qsPricesTotal | 34858 |
| matchExact | 17863 |
| matchOwnCurrency | 553 |
| matchVariants | 210 |
| priceDiffers | 68 |
| currencyDiffers | 69 |
| basisDiffers | 1 |
| qsProgramMissingInCard | 11256 |
| qsPriceNotWritten | 808 |
| catalogPriceNotInQs | 65731 |
| orphanCurrencyMark | 0 |
| priceForUnknownProgram | 0 |

## Расхождения

| Вид | Штук |
|---|---:|
| `currency-differs` | 69 |
| `price-differs` | 68 |
| `variants-missing` | 23 |
| `basis-differs` | 1 |

Подробности: `workcopy-vs-qs.json`.
