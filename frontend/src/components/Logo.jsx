// Offizielles Logo aus C:\MYCARDFOLIO\Branding.
// Hellmodus: Originaldatei. Dunkelmodus: Variante mit hellem "mycard" +
// hellen Kartenkonturen (public/logo-dark.png), Gelb bleibt.
export default function Logo({ className = "h-10" }) {
  // Das dunkle Bild muss dieselbe Anzeige-Art wie das helle bekommen, sonst ist es z. B. auf der
  // Startseite (inline-block in zentriertem Text) im Dunkelmodus ein Block und steht links.
  const darkShown = className.includes("inline-block") ? "dark:inline-block" : "dark:block";
  return (
    <>
      <img src="/logo.png" alt="mycardfolio" className={`${className} w-auto dark:hidden`} />
      <img
        src="/logo-dark.png"
        alt="mycardfolio"
        className={`${className} w-auto hidden ${darkShown}`}
      />
    </>
  );
}
