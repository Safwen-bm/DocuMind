import axios from "axios";
import { usePlansStore } from "@/store/plans.store";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000",
  withCredentials: true,
});

const PLAN_LIMIT_CODES = [
  "PLAN_LIMIT_WORKSPACES",
  "PLAN_LIMIT_MEMBERS",
  "PLAN_LIMIT_DOCUMENTS",
  "PLAN_LIMIT_AI",
];

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      window.location.href = "/en/login";
      return Promise.reject(error);
    }

    // ── Plan limit hit — show upgrade modal instead of raw error ─────────
    if (error.response?.status === 403 && typeof window !== "undefined") {
      const data = error.response.data;
      if (data?.code && PLAN_LIMIT_CODES.includes(data.code)) {
        usePlansStore.getState().openUpgradeModal({
          code: data.code,
          currentPlan: data.plan ?? "FREE",
          workspaceId: data.workspaceId ?? null,
          message: data.message ?? "You've reached a plan limit.",
        });
        // Return a rejected promise so mutations still know it failed
        // but the user sees the modal not a toast
        return Promise.reject({ ...error, handled: true });
      }
    }

    return Promise.reject(error);
  },
);

export default api;