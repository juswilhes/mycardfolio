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
];
