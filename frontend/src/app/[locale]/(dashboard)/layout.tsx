import { DashboardLayoutClient } from "@/components/dashboard/dashboard-layout-client";
import { UpgradeModal } from "@/components/plans/UpgradeModal";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayoutClient>
      {children}
      <UpgradeModal />
    </DashboardLayoutClient>
  );
}