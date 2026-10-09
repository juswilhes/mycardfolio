// Titelbild eines Artikels. Jeder Artikel hat eins: das eigene oder, wenn keins
// gesetzt ist, das mitgelieferte Standardbild (frontend/public/news).
export default function ArticleCover({ article, className = "" }) {
  return (
    <img
      src={article.image || "/news/cover-default.svg"}
      alt=""
      loading="lazy"
      className={`w-full aspect-[1200/630] object-cover bg-line ${className}`}
    />
  );
}
