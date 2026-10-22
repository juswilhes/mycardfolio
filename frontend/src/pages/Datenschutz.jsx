import LegalLayout from "../components/LegalLayout.jsx";
import { OPERATOR, HOSTING } from "../lib/legal.js";

// Diese Erklärung beschreibt die Verarbeitung so, wie die App aktuell
// funktioniert (Server-Logs, lokale Einstellungen, Nutzerkonto,
// Kartenbilder von Drittanbietern). Bei jeder Änderung an der
// Datenverarbeitung muss auch dieser Text angepasst werden.
export default function Datenschutz() {
  return (
    <LegalLayout title="Datenschutzerklärung">
      <h2>1. Verantwortlicher</h2>
      <address>
        {OPERATOR.name}
        <br />
        {OPERATOR.street}
        <br />
        {OPERATOR.postalCode} {OPERATOR.city}, {OPERATOR.country}
        <br />
        E-Mail: <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>
      </address>
      <p>
        Ein Datenschutzbeauftragter ist gesetzlich nicht bestellt. Bei Fragen zum
        Datenschutz wende dich an die oben genannte Adresse.
      </p>

      <h2>2. Überblick</h2>
      <p>
        mycardfolio hilft dir, deine Sammelkarten und deren Wert zu verwalten.
        Wir verarbeiten dabei so wenige personenbezogene Daten wie möglich: die
        technisch beim Seitenaufruf anfallenden Daten sowie deine Konto- und
        Sammlungsdaten. Alle Inhalte, auch Kartenbilder und Schriften, kommen von
        unserem eigenen Server. Wir setzen keine Werbe- oder Tracking-Cookies
        ein und nutzen keine Analyse-Dienste.
      </p>

      <h2>3. Aufruf der Website</h2>
      <p>
        Beim Aufruf der Website übermittelt dein Browser automatisch Daten an
        unseren Server: IP-Adresse, Datum und Uhrzeit des Zugriffs, angefragte
        Adresse, die zuvor besuchte Seite (Referrer) sowie Browser- und
        Betriebssystem-Kennung. Diese Daten sind technisch nötig, um dir die
        Seite auszuliefern. Wir speichern dabei <strong>keine
        Zugriffsprotokolle mit deiner IP-Adresse</strong>; sie wird nur für die
        Dauer der Anfrage verarbeitet und für die unten beschriebene Zählung
        sofort in einen Hash umgewandelt.
      </p>
      <p>
        <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. f DSGVO (berechtigtes
        Interesse an einem sicheren, funktionsfähigen Betrieb).
      </p>
      <p>
        Zusätzlich führen wir eine einfache, eigene Nutzungsstatistik – ohne
        externen Analyse-Dienst:
      </p>
      <ul>
        <li>
          <strong>Seitenaufrufe:</strong> ein Zähler je Kalendertag und Pfad
          (z. B. „/impressum: 12"), ohne jeden Personenbezug.
        </li>
        <li>
          <strong>Besucherzahl:</strong> um ungefähr zu wissen, wie viele
          verschiedene Personen die Seite besuchen, speichern wir pro Tag einen{" "}
          <em>nicht umkehrbaren Hash</em> aus deiner IP-Adresse, dem Datum und
          einem geheimen Zufallswert. Aus dem Hash lässt sich die IP nicht
          zurückrechnen; er wird nur zum Zählen verschiedener Besucher genutzt
          und nach <strong>spätestens 7 Tagen gelöscht</strong>. Ebenfalls anonym
          zählen wir, wie viele dieser Besucher auf der Seite aktiv waren
          (gescrollt oder geklickt), und bekannte Roboter (z. B. Suchmaschinen)
          rechnen wir heraus. Die dafür ausgewertete Browserkennung speichern
          wir nicht.
        </li>
      </ul>
      <p>
        <strong>Rechtsgrundlage</strong> für beides: Art. 6 Abs. 1 lit. f DSGVO
        (berechtigtes Interesse, die Nutzung der eigenen Seite in
        datensparsamer Form nachvollziehen zu können).
      </p>
      <p>
        <strong>Fehlerberichte:</strong> Tritt in deinem Browser ein
        Programmfehler auf, sendet die Seite automatisch einen Fehlerbericht an
        uns: Fehlermeldung, technische Details zum Fehler, die aufgerufene
        Adresse, deine Browserkennung und – nur wenn du angemeldet bist – die
        E-Mail-Adresse deines Kontos. Wir nutzen die Berichte ausschließlich, um
        Fehler zu finden und zu beheben, und löschen sie nach{" "}
        <strong>30 Tagen</strong> (bei Löschung deines Kontos sofort).
        Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an
        einer fehlerfrei funktionierenden Seite).
      </p>

      <h2>4. Hosting</h2>
      <p>
        Die Website wird bei {HOSTING.provider} ({HOSTING.address}) gehostet. Der
        Hoster verarbeitet die unter Ziffer 3 genannten Daten in unserem Auftrag
        auf Grundlage eines Vertrags zur Auftragsverarbeitung nach Art. 28 DSGVO.
        Serverstandort: {HOSTING.serverLocation}.
      </p>

      <h2>5. Cookies und Speicherung auf deinem Gerät</h2>
      <p>
        Wir verwenden keine Cookies zu Werbe- oder Analysezwecken, daher gibt es
        keinen Cookie-Einwilligungsbanner. Eingesetzt werden ausschließlich:
      </p>
      <ul>
        <li>
          <strong>Session-Cookie (nur mit Nutzerkonto):</strong> hält dich nach
          dem Login angemeldet. Technisch erforderlich, § 25 Abs. 2 Nr. 2 TDDDG,
          Art. 6 Abs. 1 lit. b DSGVO. Gültig für 30 Tage, wird beim Abmelden
          gelöscht. Zur Sitzung speichern wir auf dem Server einen Hash des
          Sitzungsschlüssels, das Ablaufdatum und deine Browserkennung.
        </li>
        <li>
          <strong>Lokaler Speicher (localStorage) deines Browsers:</strong>
          speichert, ob du den Hell- oder Dunkelmodus gewählt hast und welche
          Orden du schon gesehen hast. Diese Angaben verlassen dein Gerät nicht und
          werden nicht an uns übertragen. Rechtsgrundlage § 25 Abs. 2 Nr. 2
          TDDDG (für die von dir gewünschte Funktion unbedingt erforderlich).
        </li>
      </ul>

      <h2>6. Registrierung und Nutzerkonto</h2>
      <p>
        Für die Nutzung der Sammlungsverwaltung legst du ein Konto an. Dabei
        verarbeiten wir deine E-Mail-Adresse und dein Passwort (ausschließlich
        als nicht umkehrbarer kryptografischer Hash gespeichert). Optional
        kannst du einen Anzeigenamen angeben. Die E-Mail-Adresse nutzen wir zur
        Anmeldung, zur Bestätigung des Kontos, für ein Zurücksetzen des Passworts
        und für zwingend erforderliche Mitteilungen zum Dienst. Zum Schutz vor
        dem Erraten von Passwörtern zählen wir fehlgeschlagene Anmeldeversuche
        und sperren das Konto nach fünf Fehlversuchen vorübergehend.
      </p>
      <p>
        <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO (Erfüllung
        des Nutzungsvertrags).
        <br />
        <strong>Speicherdauer:</strong> bis zur Löschung des Kontos. Du kannst
        dein Konto jederzeit selbst löschen; dabei werden deine Konto- und
        Sammlungsdaten unwiderruflich entfernt (gesetzliche Aufbewahrungspflichten
        bleiben unberührt). Außerdem löschen wir automatisch:
      </p>
      <ul>
        <li>
          Konten, deren E-Mail-Adresse nach <strong>30 Tagen</strong> nicht
          bestätigt ist und in denen nichts gespeichert wurde.
        </li>
        <li>
          Konten, die <strong>drei Jahre</strong> nicht genutzt wurden. Vorher
          schicken wir dir eine E-Mail; meldest du dich innerhalb von 30 Tagen
          an, bleibt das Konto bestehen. Dafür speichern wir, wann du die Seite
          zuletzt angemeldet genutzt hast (tagesgenau).
        </li>
      </ul>
      <p>
        Unsere tägliche Datensicherung enthält eine Kopie der Datenbank; gelöschte
        Daten verschwinden daraus spätestens nach <strong>14 Tagen</strong>.
      </p>

      <h2>7. Deine Sammlungs- und Portfoliodaten</h2>
      <p>
        Die von dir erfassten Karten, Sealed-Produkte, Kaufpreise, Zustände,
        Verkäufe, Notizen, deine Watchlist, erreichte Orden und die daraus
        berechneten Werte speichern wir deinem Konto zugeordnet, um dir
        die Auswertung deiner Sammlung anzuzeigen. Diese Daten werden nicht an
        Dritte weitergegeben und nicht für andere Zwecke ausgewertet.
        Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.
      </p>

      <h2>8. Kartenbilder und Schriftarten</h2>
      <p>
        Die Bilder der Sammelkarten stammen von externen Bild-Servern
        (<code>images.pokemontcg.io</code>, <code>assets.tcgdex.net</code>,{" "}
        <code>images.scrydex.com</code>, <code>assets.pokemon.com</code>).{" "}
        <strong>Dein Browser lädt sie aber ausschließlich von unserem Server</strong>:
        Unser Server holt das Bild beim jeweiligen Anbieter ab, speichert es
        zwischen und liefert es dir aus. Die Anbieter erhalten dabei keine Daten
        von dir, insbesondere nicht deine IP-Adresse.
      </p>
      <p>
        Auch die Schriftarten laden wir von unserem eigenen Server; es wird
        keine Verbindung zu Google oder anderen Schriftanbietern hergestellt.
      </p>
      <p>
        Eine Ausnahme sind Bilder, deren Adresse du selbst bei einem
        Sealed-Produkt einträgst: Diese lädt dein Browser direkt von der von dir
        angegebenen Adresse.
      </p>

      <h2>9. Serverseitig abgerufene Datenquellen</h2>
      <p>
        Zur Ergänzung von Karten- und Preisinformationen ruft unser Server –
        ohne Bezug zu deiner Person – Daten von folgenden Diensten ab: TCGdex,
        Pokémon TCG API, die öffentlichen Preislisten von Cardmarket, PokéAPI
        sowie Wechselkurse von frankfurter.dev. Für eine interne Übersicht des
        Betreibers liest unser Server außerdem öffentliche News- und Forenbeiträge
        (Pokézentrum, PokéBeach, Reddit). Dabei werden keine personenbezogenen
        Daten von dir übermittelt.
      </p>

      <h2>10. Kontaktaufnahme</h2>
      <p>
        Wenn du uns per E-Mail kontaktierst, verarbeiten wir deine Angaben zur
        Bearbeitung der Anfrage (Art. 6 Abs. 1 lit. b bzw. lit. f DSGVO). Die
        Daten werden gelöscht, sobald sie nicht mehr benötigt werden und keine
        Aufbewahrungspflichten entgegenstehen.
      </p>

      <h2>11. Empfänger deiner Daten</h2>
      <p>
        Empfänger ist {HOSTING.provider} ({HOSTING.address}) als
        Auftragsverarbeiter nach Art. 28 DSGVO: zum einen als Hoster (Ziffer 4),
        zum anderen für den Versand der System-E-Mails (Kontobestätigung,
        Zurücksetzen des Passworts) über den E-Mail-Dienst von IONOS. Die
        Verarbeitung findet in der EU statt; eine Übermittlung in Drittländer
        außerhalb der EU/des EWR findet nicht statt.
      </p>

      <h2>12. Deine Rechte</h2>
      <p>Dir stehen gegenüber uns folgende Rechte hinsichtlich deiner Daten zu:</p>
      <ul>
        <li>Auskunft (Art. 15 DSGVO)</li>
        <li>Berichtigung (Art. 16 DSGVO)</li>
        <li>Löschung (Art. 17 DSGVO)</li>
        <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
        <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
        <li>
          Widerspruch gegen Verarbeitungen auf Grundlage von Art. 6 Abs. 1 lit. f
          DSGVO (Art. 21 DSGVO)
        </li>
      </ul>
      <p>
        Zur Ausübung genügt eine formlose Nachricht an die oben genannte
        E-Mail-Adresse. Bei einem Nutzerkonto kannst du viele dieser Rechte
        (Export, Löschung) direkt in den Kontoeinstellungen wahrnehmen.
      </p>

      <h2>13. Beschwerderecht bei der Aufsichtsbehörde</h2>
      <p>
        Unabhängig davon hast du das Recht, dich bei einer
        Datenschutz-Aufsichtsbehörde zu beschweren, insbesondere in dem
        Mitgliedstaat deines Aufenthaltsorts oder des Orts des mutmaßlichen
        Verstoßes.
      </p>

      <h2>14. Keine automatisierte Entscheidungsfindung</h2>
      <p>
        Eine automatisierte Entscheidungsfindung oder ein Profiling nach Art. 22
        DSGVO findet nicht statt. Die Wertberechnung deiner Sammlung ist eine
        reine Anzeige und hat keine rechtliche Wirkung.
      </p>

      <h2>15. Änderungen dieser Datenschutzerklärung</h2>
      <p>
        Wir passen diese Erklärung an, wenn sich die Datenverarbeitung ändert.
        Es gilt die jeweils hier veröffentlichte Fassung.
      </p>
    </LegalLayout>
  );
}
