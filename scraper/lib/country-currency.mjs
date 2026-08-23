// country-currency.mjs — какая валюта ожидается у карточки по стране вуза.
//
// Карта жила двумя копиями (audit-catalog.mjs и fix-catalog.mjs): одна проверяет,
// вторая чинит. Разъедься они — гейт начнёт требовать одно, а фиксер писать другое.
// Держим одну.
//
// Это НЕ курсы валют и не справочник стран: только те страны, где у каталога
// одна очевидная валюта обучения. Страны с несколькими валютами и офшорные
// кампусы (ОАЭ, Малайзия, Сингапур, Швейцария) сюда намеренно не входят —
// там валюта живёт при программе (program.tuitionCurrency, КОМПАС 3.5-a).
export const COUNTRY_CURRENCY = {
  'United Kingdom': 'GBP', 'UK': 'GBP', 'England': 'GBP', 'Scotland': 'GBP', 'Wales': 'GBP',
  'United States': 'USD', 'USA': 'USD',
  'Canada': 'CAD', 'Australia': 'AUD', 'New Zealand': 'NZD', 'Kazakhstan': 'KZT',
  'Germany': 'EUR', 'France': 'EUR', 'Netherlands': 'EUR', 'Spain': 'EUR', 'Italy': 'EUR',
  'Ireland': 'EUR', 'Austria': 'EUR', 'Belgium': 'EUR', 'Finland': 'EUR', 'Malta': 'EUR',
};

export const expectedCurrency = (country) => COUNTRY_CURRENCY[country] ?? null;

// Местная валюта страны — ШИРЕ, чем карта гейта: сюда входят и страны офшорных
// кампусов. Гейт по ней ничего не требует (у карточки в ОАЭ может стоять USD, а
// местная валюта жить при программе), она нужна там, где валюту надо чем-то
// заполнить: у карточки без единой цены поле всё равно обязано быть по схеме.
export const LOCAL_CURRENCY = {
  ...COUNTRY_CURRENCY,
  'United Arab Emirates': 'AED', Malaysia: 'MYR', Singapore: 'SGD', Switzerland: 'CHF',
  Bahrain: 'BHD', China: 'CNY', 'Hong Kong': 'HKD', Thailand: 'THB',
  Portugal: 'EUR', Greece: 'EUR', Cyprus: 'EUR', Latvia: 'EUR', Lithuania: 'EUR',
  Estonia: 'EUR', Slovakia: 'EUR', Slovenia: 'EUR', Croatia: 'EUR', Luxembourg: 'EUR',
};

// Валюты, которые принимает схема каталога (site/src/schema/university.ts).
// Значения вне списка zod отвергает на сборке сайта — включая null.
export const SCHEMA_CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'KZT', 'RUB', 'CAD', 'AUD',
  'NZD', 'CHF', 'AED', 'HKD', 'THB', 'CNY', 'BHD', 'MYR', 'SGD']);
