# Рабочая копия против выгрузок QS

Сверка без сети: локальные выгрузки `sources/kompas/extracts/qs` (сбор 15.08)
против `sources/kompas/catalog-work`.

| Показатель | Значение |
|---|---:|
| extractsLinked | 507 |
| qsPricesTotal | 34858 |
| matchExact | 21222 |
| matchOwnCurrency | 655 |
| priceDiffers | 848 |
| currencyDiffers | 69 |
| basisDiffers | 0 |
| qsProgramMissingInCard | 11256 |
| qsPriceNotWritten | 808 |
| catalogPriceNotInQs | 65731 |
| orphanCurrencyMark | 0 |
| priceForUnknownProgram | 0 |

## Расхождения

| Вид | Штук |
|---|---:|
| `price-differs` | 848 |
| `currency-differs` | 69 |

Подробности: `workcopy-vs-qs.json`.
