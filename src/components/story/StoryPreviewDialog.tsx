import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye, FileText, BookOpen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { buildTxt, type StoryPageLike } from "@/lib/storyDownloads";

interface Props {
  title: string;
  pages: StoryPageLike[];
  triggerLabel?: string;
}

/**
 * Lightweight preview of the TXT export and an EPUB-style rendering of the
 * story's pages so the user can sanity-check content before triggering the
 * actual download.
 */
export default function StoryPreviewDialog({ title, pages, triggerLabel }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const txt = useMemo(() => buildTxt(title, pages), [title, pages]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-full">
          <Eye className="h-4 w-4" />
          {triggerLabel ?? t("preview.trigger", { defaultValue: "Preview export" })}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("preview.title", { defaultValue: "Export preview" })}</DialogTitle>
          <DialogDescription>
            {t("preview.desc", { defaultValue: "Quickly check the TXT and EPUB output before downloading." })}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="epub" className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="epub" className="gap-1.5">
              <BookOpen className="h-4 w-4" /> EPUB
            </TabsTrigger>
            <TabsTrigger value="txt" className="gap-1.5">
              <FileText className="h-4 w-4" /> TXT
            </TabsTrigger>
          </TabsList>

          <TabsContent value="epub">
            <ScrollArea className="h-[60vh] rounded-md border bg-background p-4">
              <article className="prose prose-sm max-w-none dark:prose-invert">
                <h1 className="text-xl font-bold text-center mb-4">{title || "Story"}</h1>
                {pages.map((p, i) => (
                  <section key={i} className="mb-6 pb-4 border-b border-border last:border-0">
                    <h2 className="text-sm font-semibold text-muted-foreground mb-2">
                      {t("preview.page", { defaultValue: "Page" })} {i + 1}
                    </h2>
                    {p.image_url && (
                      <img
                        src={p.image_url}
                        alt={`Page ${i + 1}`}
                        className="rounded-lg max-h-64 mx-auto my-2 object-cover"
                        loading="lazy"
                      />
                    )}
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{p.text}</p>
                  </section>
                ))}
                {pages.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t("preview.empty", { defaultValue: "No pages to preview." })}
                  </p>
                )}
              </article>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="txt">
            <ScrollArea className="h-[60vh] rounded-md border bg-muted/40 p-4">
              <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed">{txt}</pre>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
