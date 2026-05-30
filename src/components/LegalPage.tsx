import { ReactNode } from "react";
import Seo from "./Seo";

interface LegalPageProps {
  title: string;
  description: string;
  path: string;
  effectiveDate: string;
  children: ReactNode;
}

const LegalPage = ({ title, description, path, effectiveDate, children }: LegalPageProps) => {
  return (
    <>
      <Seo title={`${title} — NajmaH`} description={description} path={path} />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <header className="mb-8 border-b-2 border-kids-softPurple dark:border-primary/30 pb-6">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">{title}</h1>
          <p className="text-sm text-muted-foreground">Effective date: {effectiveDate}</p>
        </header>
        <article className="prose prose-sm sm:prose-base max-w-none dark:prose-invert space-y-6 text-foreground leading-relaxed [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_a]:text-primary [&_a]:underline">
          {children}
        </article>
      </div>
    </>
  );
};

export default LegalPage;
