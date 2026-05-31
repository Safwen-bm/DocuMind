import api from "./api";
import { WorkspaceUsage } from "./types";

export const plansApi = {
  getUsage: (workspaceId: string): Promise<WorkspaceUsage> =>
    api.get(`/plans/usage/${workspaceId}`).then((r) => r.data),

  createCheckout: (workspaceId: string, plan: "PRO" | "ENTERPRISE"): Promise<{ url: string }> =>
    api.post("/plans/checkout", { workspaceId, plan }).then((r) => r.data),

  getBillingPortal: (workspaceId: string): Promise<{ url: string }> =>
    api.post("/plans/billing-portal", { workspaceId }).then((r) => r.data),
};