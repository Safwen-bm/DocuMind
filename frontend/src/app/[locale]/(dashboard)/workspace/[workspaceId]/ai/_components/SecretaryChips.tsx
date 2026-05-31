"use client";

// C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\app\[locale]\(dashboard)\workspace\[workspaceId]\ai\_components\SecretaryChips.tsx

import { FileText, Users, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface SecretaryChipsProps {
  onSelect: (question: string) => void;
}

const CHIP_CATEGORIES = [
  {
    label: "Sur les documents",
    icon: FileText,
    color: "text-blue-500",
    bg: "bg-blue-500/8 border-blue-500/20 hover:bg-blue-500/15 hover:border-blue-500/40",
    chips: [
      "Résume les documents les plus importants du workspace",
      "Quels sont les sujets principaux couverts par nos documents ?",
      "Existe-t-il un document sur les procédures d'intégration ?",
    ],
  },
  {
    label: "Sur l'équipe & l'activité",
    icon: Users,
    color: "text-emerald-500",
    bg: "bg-emerald-500/8 border-emerald-500/20 hover:bg-emerald-500/15 hover:border-emerald-500/40",
    chips: [
      "Qui a rejoint le workspace récemment ?",
      "Quels documents ont été modifiés cette semaine ?",
      "Qui a créé le plus de documents ?",
      "Résume l'activité récente du workspace",
    ],
  },
];

export function SecretaryChips({ onSelect }: SecretaryChipsProps) {
  return (
    <div className="mt-8 w-full max-w-xl space-y-5 text-left">
      {CHIP_CATEGORIES.map((category) => {
        const Icon = category.icon;
        return (
          <div key={category.label}>
            {/* Category header */}
            <div className="flex items-center gap-2 mb-2.5">
              <Icon className={cn("h-3.5 w-3.5", category.color)} />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {category.label}
              </span>
            </div>

            {/* Chips */}
            <div className="flex flex-wrap gap-2">
              {category.chips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => onSelect(chip)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-left text-xs text-foreground transition-all",
                    category.bg,
                  )}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}