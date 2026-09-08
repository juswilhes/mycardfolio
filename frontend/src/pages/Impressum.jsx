import LegalLayout from "../components/LegalLayout.jsx";
import { OPERATOR, HOSTING, SITE } from "../lib/legal.js";

export default function Impressum() {
  return (
    <LegalLayout title="Impressum">
      <h2>Angaben gemäß § 5 DDG</h2>
      <address>
        {OPERATOR.name}
        <br />
        {OPERATOR.street}
        <br />
        {OPERATOR.postalCode} {OPERATOR.city}
        <br />
        {OPERATOR.country}
      </address>

      <h2>Kontakt</h2>
      <p>
        E-Mail: <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>
        {OPERATOR.phone && (
          <>
            <br />
            Telefon: {OPERATOR.phone}
          </>
        )}
      </p>

      {OPERATOR.vatId && (
        <>
          <h2>Umsatzsteuer-Identifikationsnummer</h2>
          <p>Gemäß § 27 a Umsatzsteuergesetz: {OPERATOR.vatId}</p>
        </>
      )}

      <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
      <address>
        {OPERATOR.name}, {OPERATOR.street}, {OPERATOR.postalCode} {OPERATOR.city}
      </address>

      <h2>Betrieb der Website / Hosting</h2>
      <p>
        Die Website wird bei {HOSTING.provider} ({HOSTING.address}) betrieben.
        Serverstandort: {HOSTING.serverLocation}. Einzelheiten zur
        Datenverarbeitung stehen in der{" "}
        <a href="/datenschutz">Datenschutzerklärung</a>.
      </p>

      <h2>Verbraucherstreitbeilegung / Universalschlichtungsstelle</h2>
      <p>
        Die Europäische Kommission stellt eine Plattform zur
        Online-Streitbeilegung (OS) bereit:{" "}
        <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noreferrer">
          https://ec.europa.eu/consumers/odr/
        </a>
        . Unsere E-Mail-Adresse findest du oben.
      </p>
      <p>
        Wir sind nicht bereit und nicht verpflichtet, an
        Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
        teilzunehmen.
      </p>

      <h2>Haftung für Inhalte</h2>
      <p>
        Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf
        diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis
        10 DDG sind wir als Diensteanbieter jedoch nicht verpflichtet,
        übermittelte oder gespeicherte fremde Informationen zu überwachen oder
        nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit
        hinweisen. Verpflichtungen zur Entfernung oder Sperrung der Nutzung von
        Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt.
        Bei Bekanntwerden von entsprechenden Rechtsverletzungen entfernen wir
        diese Inhalte umgehend.
      </p>

      <h2>Haftung für Links</h2>
      <p>
        Unser Angebot enthält Links zu externen Websites Dritter, auf deren
        Inhalte wir keinen Einfluss haben. Für die Inhalte der verlinkten Seiten
        ist stets der jeweilige Anbieter oder Betreiber verantwortlich. Bei
        Bekanntwerden von Rechtsverletzungen entfernen wir solche Links
        umgehend.
      </p>

      <h2>Preis- und Kartendaten</h2>
      <p>
        Karten-Stammdaten stammen u. a. aus dem quelloffenen Datensatz
        „pokemon-tcg-data" sowie der TCGdex-API. Preisangaben sind als
        Cardmarket-Trendwerte über die TCGdex-API abgerufene, unverbindliche
        Richtwerte und können von tatsächlichen Marktpreisen abweichen. Es wird
        keine Gewähr für Richtigkeit, Vollständigkeit und Aktualität übernommen.
      </p>

      <h2>Marken- und Urheberrecht</h2>
      <p>
        mycardfolio ist ein privates, unabhängiges Projekt und steht in keiner
        Verbindung zu Nintendo, The Pokémon Company, Creatures Inc. oder GAME
        FREAK inc. „Pokémon" und alle zugehörigen Namen, Bilder und Zeichen sind
        eingetragene Marken bzw. urheberrechtlich geschützte Werke ihrer
        jeweiligen Rechteinhaber und werden hier ausschließlich zur
        Identifikation der Sammelkarten verwendet. Sollten Rechteinhaber die
        Nutzung einzelner Inhalte beanstanden, werden diese nach Kontaktaufnahme
        über die oben genannte Adresse umgehend entfernt.
      </p>

      <p className="text-xs text-subtle">
        {SITE.domain} · {SITE.altDomain}
      </p>
    </LegalLayout>
  );
}
