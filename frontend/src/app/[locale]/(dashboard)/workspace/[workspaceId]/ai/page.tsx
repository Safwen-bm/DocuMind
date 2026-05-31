"use client";

// C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\app\[locale]\(dashboard)\workspace\[workspaceId]\ai\page.tsx

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { workspaceApi } from "@/lib/workspace.api";
import { Workspace } from "@/lib/types";
import { WorkspaceChat } from "./_components/WorkspaceChat";

export default function WorkspaceAiPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  const { data: workspace } = useQuery<Workspace>({
    queryKey: ["workspace", workspaceId],
    queryFn: () => workspaceApi.getOne(workspaceId),
  });

  return (
    <WorkspaceChat
      workspaceId={workspaceId}
      workspaceName={workspace?.nom ?? ""}
    />
  );
}