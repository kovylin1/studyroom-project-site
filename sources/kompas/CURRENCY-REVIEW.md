# Расхождение валюты — разбор вузов, не покрытых P0.4

**Дата:** 2026-08-15 · каталог не тронут, курс справочный и в данные не пишется.

| Вуз | Страна | Валюта каталога | Программ | Решение | Худшее расхождение суммы после пересчёта |
|---|---|---|---:|---|---:|
| Asia Pacific University of Technology and Innovation (`apu-malaysia`) | Malaysia | USD | 2 | ignore | 30.3% |
| Arden University (`arden`) | United Kingdom | GBP | 19 | ignore | 30.7% |
| University of Birmingham, Dubai (`birmingham-dubai`) | United Arab Emirates | USD | 6 | ignore | 13.2% |
| Canadian University Dubai (`canadian-university-dubai`) | United Arab Emirates | USD | 4 | ignore | 10.9% |
| University of Chester (`chester`) | United Kingdom | GBP | 23 | ignore | 31.6% |
| Curtin Singapore (`curtin-singapore`) | Singapore | AUD | 5 | — | 57% |
| De Montfort University Dubai (`de-montfort-dubai`) | United Arab Emirates | USD | 7 | ignore | 31.4% |
| University of Debrecen (`debrecen`) | Hungary | EUR | 4 | ignore | 7% |
| EM Normandie Business School — Dubai (`em-normandie-dubai`) | United Arab Emirates | USD | 1 | ignore | 48.4% |
| Global Banking School (`global-banking-school`) | United Kingdom | GBP | 3 | ignore | 14.2% |
| Heriot-Watt University Malaysia (`heriot-watt-malaysia`) | Malaysia | USD | 5 | ignore | 21.6% |
| Hult International Business School (`hult`) | United States | USD | 3 | ignore | 35.7% |
| Middlesex University Dubai (`middlesex-dubai`) | United Arab Emirates | USD | 8 | ignore | 26.5% |
| Murdoch University Dubai (`murdoch-dubai`) | United Arab Emirates | AUD | 3 | — | 46.3% |
| University of Reading Malaysia (`reading-malaysia`) | Malaysia | USD | 8 | ignore | 14.7% |
| University of Roehampton (`roehampton`) | United Kingdom | GBP | 1 | ignore | 38.8% |
| Schiller International University (`schiller-international-university`) | United States | USD | 10 | ignore | 79.6% |
| University of Wollongong in Dubai (`wollongong-dubai`) | United Arab Emirates | USD | 20 | ignore | 23.1% |

## Что это значит

- Вопрос валюты закрыт прецедентом P0.4: валюту карточки определяет страна вуза, источник вправе прайсить иначе.
- Отдельно заведено 17 кейсов на СУММУ: там расходится не только валюта, и сверка такие случаи пропускает по построению.

