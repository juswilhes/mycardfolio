import LegalLayout from "../components/LegalLayout.jsx";
import { OPERATOR } from "../lib/legal.js";

// Nutzungsbedingungen speziell für den Marktplatz (Kauf/Verkauf zwischen
// Nutzern). Ergänzt die allgemeinen Seiten (Impressum/Datenschutz), gilt
// zusätzlich für jeden, der im Marktplatz kauft oder verkauft.
//
// WICHTIG: Das ist ein fachlich sorgfältig formulierter ENTWURF, keine
// rechtsverbindliche/anwaltlich geprüfte Fassung - siehe Hinweisbanner
// (steuert LegalLayout über LEGAL_REVIEWED in lib/legal.js). Vor dem
// Livegang der Zahlungsfunktion unbedingt von einer fachkundigen Person
// (Anwalt / eRecht24 o. Ä.) prüfen lassen, insbesondere Ziffer 6 (Widerruf)
// und Ziffer 9 (Haftung).
export default function MarketplaceTerms() {
  return (
    <LegalLayout title="Marktplatz-Nutzungsbedingungen">
      <h2>1. Geltungsbereich</h2>
      <p>
        Diese Bedingungen gelten zusätzlich zu den allgemeinen Nutzungsbedingungen von mycardfolio
        für jeden, der über den Marktplatz-Bereich von mycardfolio Karten oder Sealed-Produkte
        anbietet ("Verkäufer") oder erwirbt ("Käufer").
      </p>

      <h2>2. Rolle von mycardfolio</h2>
      <p>
        mycardfolio betreibt den Marktplatz als <strong>reine Vermittlungsplattform</strong>. Der
        Kaufvertrag über eine angebotene Karte oder ein Sealed-Produkt kommt ausschließlich
        zwischen Käufer und Verkäufer zustande – mycardfolio wird nicht Vertragspartei dieses
        Kaufvertrags und verkauft selbst keine Karten oder Produkte.
      </p>

      <h2>3. Angebote</h2>
      <p>
        Verkäufer dürfen nur Karten und Produkte anbieten, die sich tatsächlich in ihrem Besitz und
        Eigentum befinden. Titel, Bild, Zustand und Beschreibung eines Angebots müssen der Realität
        entsprechen. mycardfolio übernimmt keine Prüfung von Echtheit, Zustand oder Eigentum der
        angebotenen Karten/Produkte.
      </p>

      <h2>4. Zustandekommen des Kaufs</h2>
      <p>
        Mit Klick auf "Kaufen" gibt der Käufer ein verbindliches Kaufangebot zum angezeigten Preis
        ab. Der Kaufvertrag kommt mit erfolgreicher Zahlungsabwicklung zustande. Der Verkäufer ist
        verpflichtet, die Ware unverzüglich, spätestens innerhalb von 5 Werktagen nach Zahlungseingang,
        an die vom Käufer angegebene Adresse zu versenden.
      </p>

      <h2>5. Zahlungsabwicklung, Provision</h2>
      <p>
        Die Zahlung wickelt ausschließlich unser Zahlungsdienstleister Stripe ab (Stripe Connect).
        Der Käufer zahlt den vollen Angebotspreis; Stripe transferiert den Betrag abzüglich der
        mycardfolio-Provision automatisch an das Stripe-Konto des Verkäufers. Die aktuelle
        Provisionshöhe wird im Marktplatz vor jedem Kauf angezeigt. Verkäufer benötigen ein bei
        Stripe verifiziertes Konto; die dafür nötigen Angaben (Identität, Bankverbindung) macht der
        Verkäufer direkt gegenüber Stripe, mycardfolio erhält diese Daten nicht.
      </p>

      <h2>6. Widerrufsrecht</h2>
      <p>
        Verkäufer im Marktplatz handeln als Privatpersonen, nicht als Unternehmer im Sinne des § 14
        BGB. Bei einem Kaufvertrag zwischen zwei Privatpersonen besteht daher grundsätzlich{" "}
        <strong>kein</strong> gesetzliches Widerrufsrecht nach § 312g BGB. Tritt ein Verkäufer
        gewerblich auf, gelten für ihn die gesetzlichen Fernabsatz- und Widerrufsregelungen; dies zu
        prüfen und umzusetzen obliegt dem jeweiligen Verkäufer.
      </p>

      <h2>7. Versand, Gefahrübergang</h2>
      <p>
        Der Verkäufer ist für sicheren und nachverfolgbaren Versand verantwortlich. Bei einem Kauf
        durch einen Verbraucher geht die Gefahr des zufälligen Untergangs oder der Verschlechterung
        auf dem Versandweg erst mit Übergabe an den Käufer über (§ 475 Abs. 2 BGB entsprechend); der
        Verkäufer trägt daher das Verlustrisiko bis zum Erhalt durch den Käufer.
      </p>

      <h2>8. Mängel und Streitigkeiten</h2>
      <p>
        Reklamationen zu Zustand, Echtheit oder Lieferung einer Karte/eines Produkts sind eine
        Angelegenheit zwischen Käufer und Verkäufer. mycardfolio ist an solchen Streitigkeiten nicht
        beteiligt, kann auf Bitte beider Seiten aber vermittelnd tätig werden. Stripe-eigene
        Käuferschutz- bzw. Rückbuchungsmechanismen (z. B. Chargebacks) bleiben davon unberührt.
      </p>

      <h2>9. Haftung von mycardfolio</h2>
      <p>
        Da mycardfolio nicht Vertragspartei des Kaufvertrags wird, haftet mycardfolio nicht für
        Echtheit, Zustand, Lieferung oder Rechtsmängel der über den Marktplatz gehandelten
        Karten/Produkte. Für eigene Pflichtverletzungen (z. B. Fehler im Bezahlvorgang) haftet
        mycardfolio nach den gesetzlichen Vorschriften, bei leichter Fahrlässigkeit beschränkt auf
        vorhersehbare, vertragstypische Schäden.
      </p>

      <h2>10. Sperrung von Angeboten und Konten</h2>
      <p>
        mycardfolio kann Angebote entfernen und Verkäuferkonten sperren, wenn begründeter Verdacht
        auf einen Verstoß gegen diese Bedingungen, geltendes Recht oder die Stripe-Nutzungsbedingungen
        besteht.
      </p>

      <h2>11. Änderungen</h2>
      <p>
        Wir passen diese Bedingungen an, wenn sich der Marktplatz oder die rechtlichen Anforderungen
        ändern. Es gilt die zum Zeitpunkt des jeweiligen Kaufs veröffentlichte Fassung.
      </p>

      <h2>12. Kontakt</h2>
      <p>
        Fragen zum Marktplatz richtest du an{" "}
        <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>.
      </p>
    </LegalLayout>
  );
}
