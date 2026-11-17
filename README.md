# Generator XML → PDF / XLSX / XLS

Pierwszy prototyp aplikacji webowej pobiera ofertę XML z adresu URL, analizuje strukturę Netinet (`offers > o`) i pozwala filtrować oraz eksportować produkty.

## Uruchomienie lokalne

```powershell
npm.cmd start
```

Następnie otwórz: http://localhost:3000

Domyślny feed jest ustawiony na:

`https://b2b.netinet.pl/xmlg/22lxnanobig.xml`

## Obecny zakres

- pobieranie domyślnego albo własnego URL-a XML,
- bezpieczne ograniczenie adresów lokalnych/prywatnych po stronie backendu,
- podgląd produktów, kategorii, SKU, EAN, ceny, stanu i zdjęć,
- wyszukiwanie oraz filtrowanie po kategorii,
- eksport filtrowanych rekordów do XLSX i XLS bez opisów HTML,
- zapis ceny, stanu, dostępności, wagi i liczby zdjęć jako liczb w XLSX i XLS. Numeryczne ID i EAN do 15 cyfr zachowują widoczne zera wiodące. Kod produktu i MPN są tekstem,
- drukowalny widok PDF w stylistyce aplikacji dla zaznaczonych albo aktualnie filtrowanych produktów,
- opcjonalne dołączanie klikalnych linków `Zdjęcie 1`, `Zdjęcie 2` itd. w osobnych kolumnach eksportu.
- link `Otwórz produkt` loguje do publicznej oferty demo Netinet i otwiera właściwy produkt. Link `Karta w B2B` prowadzi bezpośrednio pod adres produktu z XML-a.

Instrukcja otwierania produktów znajduje się nad tabelą w arkuszu `Oferta`. Kliknięcie `Otwórz produkt` uruchamia logowanie do publicznego konta demonstracyjnego Netinet i przekierowuje bezpośrednio na kartę wskazaną w XML. Eksport wykonany lokalnie używa domyślnie publicznego adresu Workera, aby linki działały również na innym komputerze. Adres można nadpisać zmienną `PUBLIC_APP_URL`.

Wersja prototypowa ładuje bibliotekę SheetJS z CDN-u. Przy wdrożeniu produkcyjnym przypniemy bibliotekę lokalnie w procesie budowania.
