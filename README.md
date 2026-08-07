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
- drukowalny widok PDF w stylistyce aplikacji dla zaznaczonych albo aktualnie filtrowanych produktów,
- opcjonalne dołączanie wszystkich URL-i zdjęć jako osobnych kolumn w eksporcie.
- kolumna `Otwórz produkt (demo)` w XLSX/XLS loguje do publicznej oferty demo Netinet i otwiera właściwą kartę produktu; `URL produktu B2B` pozostaje adresem referencyjnym.

Kliknięcie `Otwórz produkt` uruchamia logowanie do publicznego konta demonstracyjnego Netinet i przekierowuje bezpośrednio na kartę wskazaną w XML. Eksport wykonany lokalnie używa domyślnie publicznego adresu Workera, aby linki działały również na innym komputerze. Adres można nadpisać zmienną `PUBLIC_APP_URL`.

Wersja prototypowa ładuje bibliotekę SheetJS z CDN-u. Przy wdrożeniu produkcyjnym przypniemy bibliotekę lokalnie w procesie budowania.
