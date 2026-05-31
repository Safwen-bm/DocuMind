// C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\components\dashboard\KeyboardShortcutsModal.tsx

"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Keyboard } from "lucide-react"

interface ShortcutGroup {
  title: string
  shortcuts: { keys: string[]; description: string }[]
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["Ctrl", "K"],     description: "Ouvrir la recherche" },
      { keys: ["?"],             description: "Afficher les raccourcis clavier" },
    ],
  },
  {
    title: "Éditeur de documents",
    shortcuts: [
      { keys: ["Ctrl", "S"],     description: "Sauvegarder le document (crée une version)" },
      { keys: ["Ctrl", "B"],     description: "Gras" },
      { keys: ["Ctrl", "I"],     description: "Italique" },
      { keys: ["Ctrl", "U"],     description: "Souligné" },
      { keys: ["Ctrl", "Z"],     description: "Annuler" },
      { keys: ["Ctrl", "Y"],     description: "Rétablir" },
    ],
  },
  {
    title: "Assistant IA",
    shortcuts: [
      { keys: ["Enter"],         description: "Envoyer un message à l'IA" },
      { keys: ["Shift", "Enter"], description: "Nouvelle ligne dans le message" },
    ],
  },
  {
    title: "Général",
    shortcuts: [
      { keys: ["Esc"],           description: "Fermer un panneau ou une modale" },
      { keys: ["Ctrl", "Enter"], description: "Valider un formulaire" },
    ],
  },
]

interface KeyboardShortcutsModalProps {
  open: boolean
  onClose: () => void
}

function Key({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground shadow-sm">
      {children}
    </kbd>
  )
}

export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Keyboard className="h-4 w-4 text-primary" />
            </div>
            <DialogTitle className="text-base">Raccourcis clavier</DialogTitle>
          </div>
        </DialogHeader>

        <div className="mt-2 space-y-5">
          {SHORTCUT_GROUPS.map(group => (
            <div key={group.title}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </p>
              <div className="rounded-xl border border-border overflow-hidden">
                {group.shortcuts.map((shortcut, i) => (
                  <div
                    key={shortcut.description}
                    className={`flex items-center justify-between px-4 py-2.5 ${
                      i < group.shortcuts.length - 1 ? "border-b border-border" : ""
                    }`}
                  >
                    <span className="text-sm text-foreground">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, ki) => (
                        <span key={key} className="flex items-center gap-1">
                          <Key>{key}</Key>
                          {ki < shortcut.keys.length - 1 && (
                            <span className="text-[10px] text-muted-foreground">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Appuyez sur <Key>?</Key> n'importe où pour ouvrir cette fenêtre
        </p>
      </DialogContent>
    </Dialog>
  )
}