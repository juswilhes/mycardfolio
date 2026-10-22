import { Link } from "react-router-dom";
import LegalLayout from "../components/LegalLayout.jsx";
import { OPERATOR } from "../lib/legal.js";

// Nutzungsbedingungen für die Konten. Werden bei der Registrierung akzeptiert (Haken, gespeichert in
// users.terms_accepted_at/terms_version) und sind unter "Konto" verlinkt. Bei einer inhaltlichen Änderung
// TERMS_VERSION in backend/src/services/authService.js hochsetzen und die Nutzer per E-Mail informieren (Ziffer 10).
export default function Nutzungsbedingungen() {
  return (
    <LegalLayout title="Nutzungsbedingungen">
      <h2>1. Anbieter und Geltungsbereich</h2>
      <p>
        mycardfolio (mycardfolio.de) wird von {OPERATOR.name} betrieben (Anschrift
        und Kontakt im <Link to="/impressum">Impressum</Link>). Diese Bedingungen gelten
        für die Nutzung von mycardfolio mit einem Nutzerkonto. Die Nutzung ist
        kostenlos.
      </p>

      <h2>2. Leistungen</h2>
      <p>
        Mit mycardfolio kannst du deine Sammelkarten und Sealed-Produkte erfassen,
        ihren ungefähren Wert verfolgen, eine Watchlist führen und Auswertungen
        ansehen. Einen Anspruch auf bestimmte Funktionen oder auf ständige
        Erreichbarkeit gibt es nicht; Wartung, Störungen und Weiterentwicklung
        können die Nutzung zeitweise einschränken. Funktionen können geändert,
        ergänzt oder entfernt werden. Stellen wir mycardfolio ganz ein, kündigen wir
        das mindestens 30 Tage vorher per E-Mail an, damit du deine Daten
        exportieren kannst.
      </p>

      <h2>3. Nutzerkonto</h2>
      <ul>
        <li>Für die Registrierung brauchst du eine gültige E-Mail-Adresse, die dir gehört.</li>
        <li>Jede Person darf nur ein Konto anlegen; das Konto ist nicht übertragbar.</li>
        <li>
          Halte dein Passwort geheim. Bemerkst du, dass jemand anderes dein Konto
          nutzt, ändere dein Passwort und gib uns Bescheid.
        </li>
      </ul>

      <h2>4. Preise und Inhalte</h2>
      <p>
        Die angezeigten Preise sind automatisch berechnete Richtwerte aus
        öffentlichen Preisdaten Dritter (u. a. Cardmarket, TCGplayer). Sie gelten
        weder für eine bestimmte Sprache noch für einen bestimmten Zustand einer
        Karte, können verzögert oder fehlerhaft sein und ändern sich täglich. Sie
        sind <strong>kein Angebot</strong> und <strong>keine Anlage-, Kauf- oder
        Verkaufsberatung</strong>. Das gilt ebenso für Auswertungen und Artikel.
        Prüfe vor einer Kauf- oder Verkaufsentscheidung den aktuellen Marktpreis
        selbst.
      </p>

      <h2>5. Deine Pflichten</h2>
      <p>Bei der Nutzung von mycardfolio darfst du nicht:</p>
      <ul>
        <li>falsche Angaben machen oder dich als eine andere Person ausgeben,</li>
        <li>
          rechtswidrige Inhalte eintragen, etwa in Notizen oder als Bild-Adresse bei
          Sealed-Produkten,
        </li>
        <li>
          Inhalte oder Daten automatisiert auslesen (z. B. mit Bots oder Scrapern),
          sofern wir das nicht ausdrücklich erlaubt haben,
        </li>
        <li>
          die Seite überlasten, ihre Sicherheitsvorkehrungen umgehen oder auf fremde
          Konten zugreifen.
        </li>
      </ul>

      <h2>6. Deine Daten</h2>
      <p>
        Was du in mycardfolio einträgst, bleibt deins. Wir speichern und verarbeiten
        es nur, um dir den Dienst bereitzustellen; Einzelheiten stehen in der{" "}
        <Link to="/datenschutz">Datenschutzerklärung</Link>. Unter „Konto" kannst du
        deine Daten jederzeit exportieren. Bitte sichere wichtige Daten
        regelmäßig über diesen Export.
      </p>

      <h2>7. Sperrung</h2>
      <p>
        Verstößt du gegen diese Bedingungen oder gegen geltendes Recht, können wir
        einzelne Inhalte entfernen oder dein Konto vorübergehend oder dauerhaft
        sperren. Wir berücksichtigen dabei die Umstände des Einzelfalls und deine
        berechtigten Interessen, weisen dich in der Regel vorher auf den Verstoß hin
        und teilen dir die Gründe einer Maßnahme mit. Du kannst uns dazu jederzeit
        schreiben.
      </p>

      <h2>8. Kündigung und Löschung</h2>
      <p>
        Du kannst dein Konto jederzeit unter „Konto" löschen; damit endet der
        Nutzungsvertrag. Wir können ihn mit einer Frist von 30 Tagen per E-Mail
        kündigen, aus wichtigem Grund (etwa bei schweren oder wiederholten
        Verstößen) auch fristlos. Nie bestätigte Konten ohne Einträge und Konten,
        die drei Jahre nicht genutzt wurden, löschen wir wie in der
        Datenschutzerklärung beschrieben.
      </p>

      <h2>9. Haftung</h2>
      <p>
        Wir haften unbeschränkt für Vorsatz und grobe Fahrlässigkeit, für Schäden
        aus der Verletzung des Lebens, des Körpers oder der Gesundheit sowie nach
        dem Produkthaftungsgesetz. Bei leichter Fahrlässigkeit haften wir nur für
        die Verletzung einer wesentlichen Vertragspflicht, also einer Pflicht, deren
        Erfüllung die Nutzung von mycardfolio überhaupt erst ermöglicht und auf
        deren Einhaltung du regelmäßig vertrauen darfst; in diesem Fall ist die
        Haftung auf den vorhersehbaren, typischen Schaden begrenzt. Im Übrigen ist
        die Haftung ausgeschlossen. Für den Verlust von Daten haften wir nur in
        Höhe des Aufwands, der bei regelmäßigem Export (Ziffer 6) für ihre
        Wiederherstellung nötig gewesen wäre.
      </p>

      <h2>10. Änderungen dieser Bedingungen</h2>
      <p>
        Wir können diese Bedingungen ändern, wenn sich der Dienst oder die
        Rechtslage ändert. Änderungen teilen wir dir mindestens 30 Tage vor ihrem
        Inkrafttreten per E-Mail mit. Bist du nicht einverstanden, kannst du bis
        dahin widersprechen oder dein Konto löschen. Widersprichst du nicht und
        nutzt mycardfolio weiter, gelten die geänderten Bedingungen; darauf weisen
        wir in der Mitteilung gesondert hin.
      </p>

      <h2>11. Schlussbestimmungen</h2>
      <p>
        Es gilt deutsches Recht. Bist du Verbraucher, bleiben zwingende
        Verbraucherschutzvorschriften des Staates, in dem du deinen gewöhnlichen
        Aufenthalt hast, unberührt. Fragen, Hinweise und Beschwerden schickst du an{" "}
        <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>.
      </p>
    </LegalLayout>
  );
}
