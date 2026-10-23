// Artikel, die erst nach dem ersten Start per Deploy dazukommen (siehe seedLaterArticles in
// articles.js): jeder wird genau einmal angelegt (Marker je Artikel). Löscht der Betreiber ihn,
// kommt er nicht wieder; bearbeiten kann er ihn wie jeden anderen direkt auf der Seite.
export const LATER_ARTICLES = [
  {
    marker: "article_30th_celebration_v1",
    slug: "30th-celebration-warum-die-preise-so-schnell-fallen",
    title: "30th Celebration: Warum die Preise so schnell fallen",
    category: "Analyse",
    image: "/news/cover-30th-celebration.png",
    published_at: "2026-10-15",
    summary:
      "Hohe Pull Rates und eine riesige Auflage drücken die Preise im Set 30th Celebration. Was Berichte sagen, was unsere Zahlen zeigen und was das für Sammler heißt.",
    body: `## Kurz gesagt

- Das 30th-Celebration-Set wird **in sehr großer Menge gedruckt**, und die besten Karten stecken **deutlich öfter in den Packs** als in den Sets der letzten Jahre.
- Ziel scheint zu sein, dass möglichst **viele Sammler an die Karten kommen**. Die Folge ist **hoher Preisdruck**: Wenn so viele Karten auf den Markt kommen, fallen die Preise.
- Wer eine bestimmte Karte will, fährt mit dem **Einzelkauf** meist besser als mit dem Aufreißen von Packs.

## Was berichtet wird

Kurz nach dem Start des Sets haben mehrere Medien nachgerechnet. Laut [Kotaku](https://kotaku.com/pokemon-tcg-30th-anniversary-set-prices-scalpers-resale-reddit-2000736052) (21. September 2026) steckte eine der begehrtesten Full-Art-Karten in den Sets der letzten Jahre etwa in jedem 100. Pack. Im 30th Celebration soll es etwa jedes 18. sein, und Illustration Rares sollen ungefähr in jedem fünften Pack stecken.

Auch zur Menge gibt es Berichte. Das Set soll die **größte Auflage aller bisherigen Pokémon-Sets** haben und über Monate nachgedruckt werden. [Sports Illustrated](https://www.si.com/collectibles/pokemon-celebrations-30th-anniversary-from-retail-resale) (18. September 2026) schreibt ebenfalls, es werde in höherer Stückzahl gedruckt als frühere Sets. Eine **offizielle Auflagenzahl gibt es nicht**, beide Berichte nennen keine genaue Zahl.

Wie stark das den Markt trifft, zeigt die Future-Mew-Karte: Vor dem Start war sie auf TCGplayer für über 3.000 US-Dollar angeboten, rund fünf Tage nach dem Release lag sie laut Kotaku nur noch bei etwa 120 Dollar und ließ sich kaum über 100 verkaufen.

## Warum viele Karten die Preise drücken

Der Preis einer Karte entsteht aus Angebot und Nachfrage. Vor dem Start sind die Karten knapp, und die Erwartungen schießen in die Höhe. Sobald Millionen Packs in den Läden liegen und die guten Karten alle paar Packs auftauchen, ist die Knappheit weg. Wer eine Karte verkaufen will, trifft auf viele andere Verkäufer, und die Preise rutschen.

Das ist **kein Fehler im Set, sondern eine Folge der Idee**: Wenn jeder die Karten bekommen soll, taugen sie schlechter als Wertanlage.

## Was unsere Zahlen zeigen

Aus den Pull Rates und den aktuellen Preisen rechnen wir, was in einem Pack im Schnitt steckt (Stand 15. Oktober 2026):

- **Hit Rate:** In rund **32 %** der Packs steckt mindestens eine besondere Karte. Zum Vergleich: Bei Ascended Heroes und Pitch Black sind es etwa 20 %.
- **Wert pro Pack:** etwa **8,42 €**. Das ist eine Untergrenze, denn Commons, Uncommons und Rares sind nicht eingerechnet.

Die wertvollsten Karten bei Cardmarket sind aktuell:

- **Mew (Nr. B, G und R):** 2.300 bis 2.900 €. Das sind extrem seltene Varianten, von denen es kaum Verkäufe gibt. Die Preise sind dort eher Schätzwerte.
- **Mew ex:** etwa 100 €
- **Gengar ex:** etwa 75 €
- **Pikachu ex:** etwa 63 €
- **Mewtwo ex:** etwa 55 €

Alle Karten und Preise findest du auf der [Seite des Sets](/sets/30th-celebration).

## Was heißt das für dich?

- **Du willst Packs aufreißen?** Dann wegen des Spaßes. Rechne vorher grob nach: Im Schnitt stecken Karten im Wert von rund 8 € in einem Pack (Untergrenze). Vergleiche das mit dem Preis, den du bezahlst.
- **Du suchst eine bestimmte Karte?** Dann lohnt sich meist der Einzelkauf. Wie die Rechnung aussieht, erklärt unser Artikel [Ziehen oder kaufen](/news/ziehen-oder-kaufen).
- **Du hoffst auf Wertsteigerung?** Sei vorsichtig. Bei so großer Auflage können die Preise weiter fallen. Ob und wann sie sich erholen, lässt sich seriös nicht vorhersagen, und das hier ist **keine Anlageberatung**.

## Quellen und Hinweis

Berichte: [Kotaku](https://kotaku.com/pokemon-tcg-30th-anniversary-set-prices-scalpers-resale-reddit-2000736052) und [Sports Illustrated](https://www.si.com/collectibles/pokemon-celebrations-30th-anniversary-from-retail-resale). Die Pull Rates stammen aus Packöffnungen der Community, nicht von der Pokémon Company. Die Preise sind Cardmarket-Daten in Euro, unverbindlich und ohne Gewähr. Sie ändern sich täglich.`,
  },
  {
    marker: "article_karte_wert_v1",
    slug: "wie-finde-ich-heraus-was-meine-pokemon-karte-wert-ist",
    title: "Wie finde ich heraus, was meine Pokémon-Karte wert ist?",
    category: "Ratgeber",
    image: "/news/cover-karte-wert.png",
    published_at: "2026-10-18",
    summary:
      "Zustand, Version, Preisquelle und Grading: In fünf Schritten findest du den Wert deiner Pokémon-Karte heraus und siehst, wie verlässlich der Preis ist.",
    body: `## Kurz gesagt

Den Wert einer Pokémon-Karte findest du in vier Schritten heraus:

1. **Karte genau bestimmen:** Name, Set und Kartennummer (steht unten auf der Karte).
2. **Version prüfen:** Normal, Reverse Holo, Holo oder 1st Edition – das macht oft einen großen Unterschied.
3. **Zustand einschätzen:** Ehrlich, am besten bei gutem Licht. Schon kleine Kratzer oder weiße Ecken drücken den Preis.
4. **Aktuellen Marktpreis nachsehen:** Nicht den Wunschpreis eines Verkäufers, sondern das, was Karten tatsächlich kosten.

Das Ergebnis ist immer ein **Richtwert**, kein fester Preis. Was dir jemand tatsächlich zahlt, kann abweichen.

## 1. Welche Karte ist es genau?

Auf jeder Karte stehen unten der Name des Sets (meist als kleines Symbol) und die **Kartennummer**, zum Beispiel 210/198. Mit Name und Nummer findest du die Karte eindeutig. Das ist wichtig, denn viele Pokémon gibt es in dutzenden Ausführungen, und die Preise reichen von wenigen Cent bis zu mehreren hundert Euro.

Bei uns findest du die Karte über die [Kartensuche](/sets): Name eingeben, Set und Nummer vergleichen. Die Kartenseite zeigt dann Preis und Preisverlauf, zum Beispiel bei [Drowzee aus Scarlet & Violet](/database/scarlet-violet-210-drowzee).

## 2. Welche Version ist es?

Dieselbe Karte kann in mehreren Ausführungen existieren:

- **Normal:** die einfache Ausführung ohne Glanzeffekt.
- **Reverse Holo:** nicht das Bild, sondern der Rest der Karte glänzt.
- **Holo:** das Bild glänzt.
- **1st Edition:** die erste Auflage älterer Sets, erkennbar am Stempel links unter dem Bild.

Nicht jede Karte gibt es in jeder Ausführung. Viele Illustration Rares zum Beispiel erscheinen nur in einer. Auf unseren Kartenseiten siehst du deshalb je Ausführung eine eigene Preislinie. Wer eine Karte in seine Sammlung einträgt, wählt die Variante gleich mit, und sie wird mit dem Preis **dieser** Variante bewertet.

## 3. In welchem Zustand ist die Karte?

Der Zustand ist der Punkt, an dem Sammler am häufigsten zu optimistisch sind. Auf Marktplätzen wie Cardmarket gibt es dafür feste Stufen, von **Mint** und **Near Mint** (kaum Gebrauchsspuren) über **Excellent**, **Good** und **Light Played** bis **Played** und **Poor** (deutlich abgenutzt oder beschädigt).

So gehst du vor:

- Leg die Karte bei hellem, schrägem Licht hin und dreh sie hin und her. Kratzer und Dellen sieht man so deutlich besser.
- Prüfe die **vier Ecken** (weiß oder abgestoßen?), die **Kanten** (Abplatzer?) und die **Oberfläche** (Kratzer, Knicke, Druckstellen?).
- Sei ehrlich zu dir selbst. Eine Karte, die aus einem frisch geöffneten Pack in eine Hülle kam, ist meist Near Mint. Eine, die in Jackentaschen und Schulranzen war, eher nicht.

Je schlechter der Zustand, desto größer der Abschlag. Bei teuren Karten kann der Unterschied zwischen Near Mint und Played schnell ein Vielfaches ausmachen.

## 4. Woher kommt ein verlässlicher Preis?

Hier lohnt sich ein genauer Blick, denn „der Preis" einer Karte ist keine feste Zahl:

- **Angebotspreise sind keine Verkaufspreise.** Ein Verkäufer kann für eine Karte verlangen, was er will. Ob jemand zahlt, zeigt erst der Verkauf.
- **Der Tiefstpreis** ist oft eine einzelne, schlecht erhaltene oder ausländische Karte und sagt wenig über deine.
- **Der Trend** schwankt bei Karten mit wenigen Verkäufen stark. Ein einziger Verkauf kann ihn verschieben.

Wir nutzen deshalb nicht einen einzelnen Wert, sondern den **Median mehrerer Cardmarket-Kennzahlen** (Trend sowie Durchschnitt über 1, 7 und 30 Tage) und glätten kurze Ausschläge. Bei Karten ab 3 € mitteln wir zusätzlich mit dem Marktpreis aus den USA (TCGplayer), sofern beide Werte zusammenpassen.

Wichtig und ehrlich gesagt: Unsere Preise gelten **pro Karte und Version**, aber **nicht getrennt nach Sprache und Zustand**. Eine deutsche und eine englische Karte oder Near Mint und Played haben bei uns denselben Preis. Wenn dein Exemplar abgenutzt ist, wirst du also in der Regel weniger bekommen.

## 5. Lohnt sich eine Bewertung (Grading)?

Bei sehr wertvollen Karten kann es sinnvoll sein, sie von einem Dienst wie **PSA**, **CGC** oder **Beckett** prüfen und in eine Hülle einschweißen zu lassen. Die Karte bekommt dabei eine Note, meist von 1 bis 10. Gute Noten können den Preis deutlich erhöhen, schlechte machen die Kosten oft nicht wett.

Bevor du das erwägst:

- Das Grading **kostet Geld und dauert Wochen oder Monate**.
- Der Preis hängt stark von der **Note** ab, und die kennst du vorher nicht sicher.
- Bei Karten im Bereich weniger Euro lohnt es sich fast nie.

Als Faustregel: Erst eine Karte mit hohem Marktwert und **sehr gutem Zustand** ist ein Kandidat. Frag im Zweifel in einer Sammlergruppe nach einer zweiten Meinung.

## So gehst du bei mycardfolio vor

1. Karte über die [Kartensuche](/sets) finden, Set und Nummer vergleichen.
2. Auf der Kartenseite die passende Version ansehen und den Preisverlauf prüfen. Springt der Preis stark? Dann sind es wohl wenige Verkäufe, und der Wert ist unsicherer.
3. Die Karte in deine Sammlung eintragen, mit der richtigen Variante. So siehst du den Gesamtwert und die Entwicklung deiner Sammlung über die Zeit.

Wenn du wissen willst, ob sich das Aufreißen neuer Packs lohnt, lies [Ziehen oder kaufen](/news/ziehen-oder-kaufen) und die [Analyse zum 30th Celebration](/news/30th-celebration-warum-die-preise-so-schnell-fallen).

## Hinweis

Alle Preise sind Cardmarket-Daten in Euro (bei teuren Karten zusätzlich TCGplayer), **unverbindlich und ohne Gewähr**. Sie ändern sich täglich und ersetzen keine Beratung. Wer eine teure Karte verkaufen will, sollte vorher aktuelle Verkäufe und Angebote auf dem Marktplatz seiner Wahl ansehen.`,
  },
];
