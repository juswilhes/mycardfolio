// Offizielles Logo aus C:\MYCARDFOLIO\Branding (public/logo.png),
// unverändert in beiden Modi.
export default function Logo({ className = "h-10" }) {
  return <img src="/logo.png" alt="mycardfolio" className={`${className} w-auto`} />;
}
