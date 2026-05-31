import { create } from "zustand";
import { Plan, PlanLimitCode } from "@/lib/types";

interface UpgradeModalState {
  open: boolean;
  code: PlanLimitCode | null;
  currentPlan: Plan;
  workspaceId: string | null;
  message: string;
}

interface PlansState {
  upgradeModal: UpgradeModalState;
  openUpgradeModal: (params: {
    code: PlanLimitCode;
    currentPlan: Plan;
    workspaceId: string | null;
    message: string;
  }) => void;
  closeUpgradeModal: () => void;
}

export const usePlansStore = create<PlansState>((set) => ({
  upgradeModal: {
    open: false,
    code: null,
    currentPlan: "FREE",
    workspaceId: null,
    message: "",
  },

  openUpgradeModal: ({ code, currentPlan, workspaceId, message }) =>
    set({
      upgradeModal: { open: true, code, currentPlan, workspaceId, message },
    }),

  closeUpgradeModal: () =>
    set((s) => ({
      upgradeModal: { ...s.upgradeModal, open: false },
    })),
}));