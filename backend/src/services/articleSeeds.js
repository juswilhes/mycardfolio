// Startartikel für den News-Bereich (werden nur beim allerersten Start angelegt,
// danach pflegt der Betreiber alles im Editor auf /news). Bewusst nur eigene
// Texte, die auf den eigenen Auswertungen der Seite beruhen. Zahlen: Stand 8. Oktober 2026.
export const STARTER_ARTICLES = [
  {
    slug: "hit-rate-erklaert",
    title: "Hit Rate erklärt: Wie oft steckt wirklich ein Treffer im Booster?",
    summary:
      "Etwa jedes fünfte Pack enthält eine besondere Karte – zumindest bei den aktuellen Sets. Wie wir das ausrechnen und was die Zahl (nicht) verrät.",
    category: "Grundlagen",
    published_at: "2026-10-08",
    body: `Du reißt einen Booster auf, und da ist sie: die Illustration Rare, die du seit Wochen suchst. Oder es ist wieder nur die dritte Pflanzen-Energie. Wie oft passiert Ersteres wirklich?

## Was bei uns ein „Treffer“ ist

Als Treffer zählt jede Karte, die über das Übliche hinausgeht. Nicht dazu gehören Common, Uncommon, Rare, Double Rare und Pikachu Rare – die stecken ohnehin regelmäßig im Pack. Alles darüber ist ein Treffer, zum Beispiel Illustration Rare, Special Illustration Rare, Ultra Rare oder Mega Hyper Rare.

## So rechnen wir

Aus den bekannten Quoten pro Karte (etwa „1/480“) und der Zahl der Karten einer Seltenheit ergibt sich, wie wahrscheinlich es ist, dass ein Pack irgendeine Karte dieser Seltenheit enthält. Diese Chancen kombinieren wir zu einer Gesamtchance pro Pack. Die Seltenheiten behandeln wir dabei als voneinander unabhängig – eine Näherung, die aber nie über 100 % kommt.

## Was dabei herauskommt

Stand Oktober 2026 liegen die aktuellen Mega-Sets bei etwa **19 bis 20 %** – im Schnitt also ungefähr jedes fünfte Pack. Beim 30th Celebration sind es rund **32 %**, weil dort auch die Classic Collection aus denselben Boostern kommt.

## Was die Zahl nicht verrät

Ein Durchschnitt ist keine Garantie. Wer zehn Packs öffnet, kann zwei Treffer haben – oder keinen. Außerdem sagt die Hit Rate nichts darüber, wie wertvoll der Treffer ist. Dafür gibt es in der [Analyse](/analyse) den „Wert pro Pack“.

> Faustregel: Die Hit Rate verrät dir, wie oft es funkelt. Der Wert pro Pack verrät dir, ob es sich auch lohnt.`,
  },
  {
    slug: "ziehen-oder-kaufen",
    title: "Ziehen oder kaufen? Eine Rechnung, die dem Geldbeutel wehtut",
    summary:
      "Die Chase-Karte selbst aus Boostern ziehen oder einfach einzeln kaufen? Wir haben nachgerechnet – das Ergebnis ist eindeutig.",
    category: "Analyse",
    published_at: "2026-10-08",
    body: `Der Klassiker unter den Sammlerfragen: Ich will diese eine Karte. Öffne ich Booster, bis sie kommt – oder kaufe ich sie einfach?

## Die Rechnung

Eine Karte mit der Quote **1/480** steckt im Schnitt in jedem 480. Pack. Wer sie ziehen will, muss also im Schnitt 480 Booster öffnen. Mal dem Boosterpreis ergibt das die erwarteten Kosten.

## Ein Beispiel

Bei Phantasmal Flames hat die Mega Charizard X ex (Special Illustration Rare) die Quote 1/400. Bei einem Boosterpreis von 9,50 € sind das im Schnitt rund **3.800 €**. Einzeln kostet die Karte im Oktober 2026 etwa **660 €**. Ziehen wäre also knapp sechsmal so teuer wie Kaufen.

## Warum Booster trotzdem Spaß machen

Die Rechnung zählt nur, was das Ziehen kostet – nicht, was die übrigen Karten aus den Packs wert sind. Und das Öffnen selbst hat ohnehin einen Wert, der sich in keiner Tabelle zeigt. Wer wissen will, was ein Pack im Schnitt hergibt, schaut in der [Analyse](/analyse) unter „Wert pro Pack“.

## Die Schönheitsfehler

- Alles sind Durchschnitte: Mit Glück liegt die Karte im ersten Pack, mit Pech kommt sie auch nach dem Doppelten nicht.
- Die Quoten stammen aus Auswertungen geöffneter Booster und werden von Hand gepflegt – es sind keine offiziellen Zahlen.
- Die Kartenpreise sind Cardmarket-Trendwerte in Euro.

Alle Karten und ihre Kosten findest du in der [Analyse](/analyse) unter „Ziehen oder kaufen“.`,
  },
  {
    slug: "preis-ausreisser",
    title: "Warum ein Kartenpreis manchmal verrücktspielt – und was wir dagegen tun",
    summary:
      "Von 36 € auf 85 € über Nacht und wieder zurück? Das ist meistens kein Markt, sondern ein Ausreißer. So gehen wir damit um.",
    category: "Grundlagen",
    published_at: "2026-10-08",
    body: `Du schaust auf eine Karte: gestern 36 €, heute 85 €. Hype oder Glitch?

## Woher unsere Preise kommen

Unsere Preise sind der Trend-Wert von Cardmarket in Euro, den wir einmal pro Nacht um 1 Uhr abholen. Cardmarket bildet ihn aus den letzten Verkäufen. Bei Karten, die selten gehandelt werden, reicht ein einzelner ungewöhnlicher Verkauf, um den Wert für einen Tag zu verziehen.

## Unser Ausreißer-Filter

Springt ein Tageswert gegenüber dem Vortag um mehr als 40 % und fällt am nächsten Tag wieder zurück, zeigen wir stattdessen den Vortagswert. Bleibt das neue Niveau bestehen, war es ein echter Sprung und wird übernommen. Für den jüngsten Tag lässt sich das noch nicht sagen: Bei einem so großen Sprung zeigen wir bis zur nächsten Nacht den Vortagswert. Die Rohdaten bleiben unverändert gespeichert.

Das Beispiel kam von der Drowzee (Scarlet & Violet, Nr. 210): Cardmarket meldete 85,44 € nach 35,96 € am Vortag, während der eigene 30-Tage-Schnitt von Cardmarket bei 47 € lag. Wir zeigen dort 35,96 € – und wenn Cardmarket morgen wieder so hoch liegt, zeigen wir es auch.

## Der 30-Tage-Schnitt als Gegenprobe

Unter dem aktuellen Preis steht immer der Durchschnitt der letzten 30 Tage. Er glättet Ausreißer und zeigt, ob der heutige Wert zum Trend passt.

## Gut zu wissen

Wir zeigen Richtwerte, keine Kauf- oder Verkaufsempfehlungen. Der Preis, den du beim Verkauf bekommst, hängt von Zustand, Sprache und Nachfrage ab – und von der Laune des Marktes.`,
  },
];
