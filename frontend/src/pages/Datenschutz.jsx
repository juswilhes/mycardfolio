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
        technisch beim Seitenaufruf anfallenden Daten, deine Konto- und
        Sammlungsdaten sowie – für die Anzeige der Kartenbilder – eine
        Verbindung deines Browsers zu externen Bild-Servern (siehe Ziffer 7).
        Wir setzen keine Werbe- oder Tracking-Cookies ein und nutzen keine
        Analyse-Dienste.
      </p>

      <h2>3. Aufruf der Website – Server-Logfiles</h2>
      <p>
        Beim Aufruf der Website übermittelt dein Browser automatisch Daten an den
        Server unseres Hosters. Das sind: IP-Adresse, Datum und Uhrzeit des
        Zugriffs, angefragte Adresse/Datei, HTTP-Statuscode, übertragene
        Datenmenge, die zuvor besuchte Seite (Referrer) sowie Browser- und
        Betriebssystem-Kennung. Diese Daten sind für den Betrieb, die Sicherheit
        und die Stabilität notwendig.
      </p>
      <p>
        <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. f DSGVO (berechtigtes
        Interesse an einem sicheren, funktionsfähigen Betrieb).
        <br />
        <strong>Speicherdauer:</strong> Logdaten werden nach spätestens 14 Tagen
        gelöscht oder anonymisiert, sofern kein sicherheitsrelevanter Vorfall
        eine längere Aufbewahrung erfordert.
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
          Art. 6 Abs. 1 lit. b DSGVO. Wird beim Abmelden bzw. nach Ablauf
          gelöscht.
        </li>
        <li>
          <strong>Lokaler Speicher (localStorage) deines Browsers:</strong>
          speichert deine Anzeige-Einstellungen (Hell-/Dunkelmodus, gewählte
          Sortierung und Filter). Diese Angaben verlassen dein Gerät nicht und
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
        und für zwingend erforderliche Mitteilungen zum Dienst.
      </p>
      <p>
        <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO (Erfüllung
        des Nutzungsvertrags).
        <br />
        <strong>Speicherdauer:</strong> bis zur Löschung des Kontos. Du kannst
        dein Konto jederzeit selbst löschen; dabei werden deine Konto- und
        Sammlungsdaten unwiderruflich entfernt (gesetzliche Aufbewahrungspflichten
        bleiben unberührt).
      </p>

      <h2>7. Deine Sammlungs- und Portfoliodaten</h2>
      <p>
        Die von dir erfassten Karten, Kaufpreise, Zustände, Verkäufe, Notizen und
        daraus berechneten Werte speichern wir deinem Konto zugeordnet, um dir
        die Auswertung deiner Sammlung anzuzeigen. Diese Daten werden nicht an
        Dritte weitergegeben und nicht für andere Zwecke ausgewertet.
        Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.
      </p>

      <h2>8. Kartenbilder von Drittanbietern</h2>
      <p>
        Die Bilder der Sammelkarten werden nicht von uns, sondern direkt von
        externen Servern geladen (u. a. <code>images.pokemontcg.io</code>,{" "}
        <code>assets.tcgdex.net</code>, <code>images.scrydex.com</code>). Dein
        Browser stellt dazu eine Verbindung zu diesen Anbietern her und
        übermittelt dabei technisch bedingt deine IP-Adresse sowie
        Browserangaben an den jeweiligen Server. Auf diese Verarbeitung durch die
        Drittanbieter haben wir keinen Einfluss.
      </p>
      <p>
        <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. f DSGVO (berechtigtes
        Interesse an der Darstellung der Karten ohne eigene Speicherung großer
        Bildmengen). Eine Auslieferung der Bilder über einen eigenen Server
        (Proxy), die diese Übermittlung vermeidet, ist geplant.
      </p>

      <h2>9. Serverseitig abgerufene Datenquellen</h2>
      <p>
        Zur Ergänzung von Karten- und Preisinformationen ruft unser Server –
        ohne Bezug zu deiner Person – Daten von folgenden Diensten ab: TCGdex,
        PokéAPI, Pokémon TCG API sowie Wechselkurse von frankfurter.dev. Dabei
        werden keine personenbezogenen Daten von dir übermittelt.
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
        Empfänger sind ausschließlich unser Hoster (Auftragsverarbeiter, Ziffer
        4) und – bei Kontobetrieb – ggf. ein E-Mail-Versanddienstleister für
        System-E-Mails, ebenfalls als Auftragsverarbeiter. Eine Übermittlung in
        Drittländer außerhalb der EU/des EWR findet nicht statt bzw. nur auf
        Grundlage geeigneter Garantien nach Art. 44 ff. DSGVO.
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
