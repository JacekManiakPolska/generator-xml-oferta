# Generator XML → XLSX / XLS / CSV

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
- eksport filtrowanych rekordów do CSV, XLSX i XLS bez opisów HTML,
- opcjonalne dołączanie wszystkich URL-i zdjęć jako osobnych kolumn w eksporcie.
- kolumna `Otwórz produkt (demo)` w XLSX/XLS otwiera podgląd produktu przez aplikację, która korzysta po stronie serwera z publicznej oferty demo Netinet; `URL produktu B2B` pozostaje adresem referencyjnym.

Wersja prototypowa ładuje bibliotekę SheetJS z CDN-u. Przy wdrożeniu produkcyjnym przypniemy bibliotekę lokalnie w procesie budowania.
