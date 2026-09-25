# Plan de redesign și verificare pentru FinKids Tycoon

## Scop
Simplificarea aspectului pentru copii, păstrând fluxul și mecanicile jocului: turnare, decorare, coacere și servire. Asseturile existente rămân intacte și continuă să fie folosite.

## Elemente care rămân neschimbate
- Cele patru etape și ordinea lor.
- Formele cerc, inimă și stea, precum și mărimile S, M și L.
- Toppingurile, tragerea și plasarea lor.
- Țintele de turnare și coacere generate pentru fiecare comandă.
- Calculul scorurilor, cantității, calității și transferul producției la servire.
- Imaginile existente din game_assets/images.

## Plan vizual
1. Reducerea competiției vizuale: o singură culoare de accent, fundal cald simplu, panouri plate și mai puține chenare, umbre, gradienturi și animații.
2. Ierarhie clară: etapa curentă evidențiată, comenzile și scorul grupate în panoul lateral, zona de lucru păstrată ca element principal.
3. Controale lizibile și accesibile: butoane suficient de mari, focus vizibil pentru tastatură, etichete explicite și spațiere consecventă.
4. Feedback calm: păstrarea mesajelor de reușită și a ferestrei de coacere, cu animații discrete și respectarea preferinței pentru mișcare redusă.
5. Adaptare la ecrane înguste: panouri într-o singură coloană, paletă ușor de atins și fără derulare orizontală.

## Corecții logice confirmate
- O comandă nouă oprește intervalele active și resetează progresul cuptorului înainte de a inițializa comanda, ca o coacere veche să nu poată finaliza peste comanda nouă.
- Decorarea păstrează regula existentă, minimum două toppinguri permit continuarea, iar potrivirea celor cerute influențează scorul.
- Navigarea nu permite săritul peste pașii care au condiții de finalizare. Înapoi rămâne disponibil pentru pașii anteriori.
- Sliderul de turnare și butonul de turnare păstrează aceeași stare, fără să depășească intervalul 0–100%.

## Verificare
- Validare sintactică PHP și verificări JavaScript fără schimbarea bazei de date.
- Deschiderea paginii pe localhost și parcurgerea etapelor, inclusiv umplerea formei, plasarea toppingurilor și cronometrarea coacerii.
- Verificare vizuală pe ecran lat și îngust.
