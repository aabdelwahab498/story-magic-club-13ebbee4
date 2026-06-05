import { Helmet } from "react-helmet-async";

interface SeoProps {
  title: string;
  description?: string;
  path?: string;
  image?: string;
  type?: "website" | "article" | "product";
  jsonLd?: Record<string, unknown>;
}

const BASE_URL = "https://najmah.app";

const Seo = ({ title, description, path, image, type = "website", jsonLd }: SeoProps) => {
  const url = path ? `${BASE_URL}${path}` : BASE_URL;
  const finalTitle = title.length > 60 ? title.slice(0, 57) + "..." : title;
  const finalDesc = description && description.length > 160 ? description.slice(0, 157) + "..." : description;
  return (
    <Helmet>
      <title>{finalTitle}</title>
      {finalDesc && <meta name="description" content={finalDesc} />}
      <link rel="canonical" href={url} />
      <meta property="og:title" content={finalTitle} />
      {finalDesc && <meta property="og:description" content={finalDesc} />}
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      {image && <meta property="og:image" content={image} />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={finalTitle} />
      {finalDesc && <meta name="twitter:description" content={finalDesc} />}
      {image && <meta name="twitter:image" content={image} />}
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
};

export default Seo;
