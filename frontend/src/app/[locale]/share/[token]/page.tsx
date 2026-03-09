"use client"

import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import Highlight from "@tiptap/extension-highlight"
import { TextStyle } from "@tiptap/extension-text-style"
import { Color } from "@tiptap/extension-color"
import Image from "@tiptap/extension-image"
import { Table } from "@tiptap/extension-table"
import TableRow from "@tiptap/extension-table-row"
import TableCell from "@tiptap/extension-table-cell"
import TableHeader from "@tiptap/extension-table-header"
import { useEffect } from "react"
import { shareApi, SharedDocument } from "@/lib/share.api"
import { Loader2, Brain, Eye, Pencil, Clock, AlertTriangle } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { fr as frLocale } from "date-fns/locale"

export default function SharedDocumentPage() {
  const params = useParams()
  const token = params.token as string
  const locale = params.locale as string
  const t = useTranslations("dashboard.share")

  const { data, isLoading, error } = useQuery<SharedDocument>({
    queryKey: ["shared-doc", token],
    queryFn: () => shareApi.resolveToken(token),
    retry: false,
  })

  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      Image.configure({ HTMLAttributes: { class: "rounded-lg max-w-full my-4" } }),
      Table.configure({ resizable: false, HTMLAttributes: { class: "border-collapse table-auto w-full" } }),
      TableRow, TableHeader, TableCell,
    ],
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[300px] px-1",
      },
    },
  })

  useEffect(() => {
    if (data?.document?.contenu && editor) {
      editor.commands.setContent(data.document.contenu)
    }
  }, [data, editor])

  const dateLocale = locale === "fr" ? frLocale : undefined

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 mb-4">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">{t("invalidLink")}</h1>
        <p className="text-sm text-muted-foreground max-w-sm">{t("invalidLinkDesc")}</p>
      </div>
    )
  }

  const { document: doc, permission, expiresAt } = data

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Brain className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-bold">DocuMind</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium
              ${permission === "EDIT" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : "bg-muted text-muted-foreground"}`}>
              {permission === "EDIT"
                ? <><Pencil className="h-3 w-3" />{t("editBadge")}</>
                : <><Eye className="h-3 w-3" />{t("readOnlyBadge")}</>}
            </span>
            {expiresAt && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(expiresAt), { addSuffix: true, locale: dateLocale })}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Document */}
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8 border-b border-border pb-6">
          <h1 className="text-3xl font-bold text-foreground mb-3">{doc.titre}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                {doc.author.nom[0].toUpperCase()}
              </div>
              {doc.author.nom}
            </span>
            <span>{doc.workspace.nom}</span>
            {doc.dossier && <span>{doc.dossier.nom}</span>}
            <span>
              {t("modifiedAgo", {
                time: formatDistanceToNow(new Date(doc.dateMiseAJour), { addSuffix: true, locale: dateLocale })
              })}
            </span>
          </div>
        </div>
        <div className="[&_.ProseMirror]:outline-none">
          <EditorContent editor={editor} />
        </div>
      </main>

      <footer className="border-t border-border py-6 mt-16">
        <div className="mx-auto max-w-4xl px-6 text-center text-xs text-muted-foreground">
          {t("sharedVia")} <span className="font-semibold text-foreground">DocuMind</span>
        </div>
      </footer>
    </div>
  )
}