// Offizielles Logo aus C:\MYCARDFOLIO\Branding (public/logo.png).
// Im Dunkelmodus wird die (fast schwarze) Wortmarke per Filter aufgehellt,
// ohne das Gelb zu zerstören: invert + hue-rotate kehrt die Helligkeit um
// und dreht den Farbton zurück.
export default function Logo({ className = "h-8" }) {
  return (
    <img
      src="/logo.png"
      alt="mycardfolio"
      className={`${className} w-auto dark:[filter:invert(1)_hue-rotate(180deg)]`}
    />
  );
}
