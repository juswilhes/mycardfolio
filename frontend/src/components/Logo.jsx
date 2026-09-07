// Offizielles Logo aus C:\MYCARDFOLIO\Branding.
// Hellmodus: Originaldatei. Dunkelmodus: Variante mit hellem "mycard" +
// hellen Kartenkonturen (public/logo-dark.png), Gelb bleibt.
export default function Logo({ className = "h-10" }) {
  return (
    <>
      <img src="/logo.png" alt="mycardfolio" className={`${className} w-auto dark:hidden`} />
      <img
        src="/logo-dark.png"
        alt="mycardfolio"
        className={`${className} w-auto hidden dark:block`}
      />
    </>
  );
}
