import {
  FileText,
  Briefcase,
  Code2,
  Users,
  BarChart2,
  BookOpen,
  ClipboardList,
  Layers,
} from "lucide-react";

export interface DocumentTemplate {
  id: string;
  icon: React.ElementType;
  color: string;
  titleKey: string;
  descKey: string;
  aiPromptKey: string;
  content: any;
}

// ── Helper builders — guarantee no empty text nodes ───────────────────────────

function h1(text: string) {
  return { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text }] };
}
function h2(text: string) {
  return { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] };
}
function h3(text: string) {
  return { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text }] };
}
function p(text: string) {
  return { type: "paragraph", content: [{ type: "text", text }] };
}
function emptyP() {
  return { type: "paragraph" };
}
function li(text: string) {
  return { type: "listItem", content: [p(text)] };
}
function ul(...items: string[]) {
  return { type: "bulletList", content: items.map(li) };
}
function ol(...items: string[]) {
  return { type: "orderedList", content: items.map(li) };
}
function code(language: string, text: string) {
  return { type: "codeBlock", attrs: { language }, content: [{ type: "text", text }] };
}
function cell(text: string) {
  return { type: "tableCell", content: [p(text)] };
}
function headerCell(text: string) {
  return { type: "tableHeader", content: [p(text)] };
}
function headerRow(...headers: string[]) {
  return { type: "tableRow", content: headers.map(headerCell) };
}
function dataRow(...cells: string[]) {
  return { type: "tableRow", content: cells.map(cell) };
}
function table(...rows: any[]) {
  return { type: "table", content: rows };
}

// ── Templates ─────────────────────────────────────────────────────────────────

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  // 1. Meeting Notes
  {
    id: "meeting-notes",
    icon: ClipboardList,
    color: "bg-blue-500/10 text-blue-500",
    titleKey: "meetingNotes.title",
    descKey: "meetingNotes.desc",
    aiPromptKey: "meetingNotes.aiPrompt",
    content: {
      type: "doc",
      content: [
        h1("Meeting Notes"),
        p("📅 Date: ___________   ⏰ Time: ___________   📍 Location: ___________"),
        h2("Attendees"),
        ul("Name — Role", "Name — Role"),
        h2("Agenda"),
        ol("Topic one", "Topic two", "Topic three"),
        h2("Discussion & Decisions"),
        p("Write key discussion points and decisions made here..."),
        h2("Action Items"),
        table(
          headerRow("Task", "Owner", "Due Date"),
          dataRow(" ", " ", " "),
          dataRow(" ", " ", " "),
        ),
        h2("Next Meeting"),
        p("Date & time TBD"),
      ],
    },
  },

  // 2. Project Brief
  {
    id: "project-brief",
    icon: Briefcase,
    color: "bg-violet-500/10 text-violet-500",
    titleKey: "projectBrief.title",
    descKey: "projectBrief.desc",
    aiPromptKey: "projectBrief.aiPrompt",
    content: {
      type: "doc",
      content: [
        h1("Project Brief"),
        h2("Overview"),
        p("Describe the project in 2-3 sentences. What problem does it solve and for whom?"),
        h2("Goals & Objectives"),
        ul("Primary goal", "Secondary goal"),
        h2("Scope"),
        h3("In scope"),
        ul("Feature or deliverable"),
        h3("Out of scope"),
        ul("What we are explicitly NOT doing"),
        h2("Timeline"),
        table(
          headerRow("Milestone", "Date", "Owner"),
          dataRow("Kickoff", " ", " "),
          dataRow("First delivery", " ", " "),
          dataRow("Final delivery", " ", " "),
        ),
        h2("Stakeholders"),
        ul("Name — Role — Responsibility"),
        h2("Risks & Mitigation"),
        ul("Risk → Mitigation plan"),
      ],
    },
  },

  // 3. Technical Spec
  {
    id: "technical-spec",
    icon: Code2,
    color: "bg-emerald-500/10 text-emerald-500",
    titleKey: "technicalSpec.title",
    descKey: "technicalSpec.desc",
    aiPromptKey: "technicalSpec.aiPrompt",
    content: {
      type: "doc",
      content: [
        h1("Technical Specification"),
        h2("Summary"),
        p("One paragraph explaining what this spec covers and why."),
        h2("Context & Problem Statement"),
        p("What is the technical problem we are solving?"),
        h2("Proposed Solution"),
        p("Describe your approach at a high level."),
        h2("Architecture"),
        p("Describe components, data flow, and dependencies."),
        h2("API Design"),
        code("http", "POST /api/resource\nContent-Type: application/json\n\n{\n  \"field\": \"value\"\n}"),
        h2("Data Model"),
        code("typescript", "interface Resource {\n  id: string;\n  name: string;\n  createdAt: Date;\n}"),
        h2("Security Considerations"),
        ul("Authentication & authorization", "Input validation", "Rate limiting"),
        h2("Open Questions"),
        ul("Question that still needs an answer"),
      ],
    },
  },

  // 4. Onboarding Guide
  {
    id: "onboarding-guide",
    icon: Users,
    color: "bg-orange-500/10 text-orange-500",
    titleKey: "onboardingGuide.title",
    descKey: "onboardingGuide.desc",
    aiPromptKey: "onboardingGuide.aiPrompt",
    content: {
      type: "doc",
      content: [
        h1("Onboarding Guide"),
        p("Welcome to the team! This guide will help you get set up and productive as quickly as possible."),
        h2("Week 1 Checklist"),
        ul(
          "Set up your development environment",
          "Meet your team members",
          "Read the architecture overview",
          "Complete your first task",
        ),
        h2("Environment Setup"),
        code("bash", "# Clone the repository\ngit clone https://github.com/your-org/repo\n\n# Install dependencies\nnpm install\n\n# Start the development server\nnpm run dev"),
        h2("Key Tools & Access"),
        table(
          headerRow("Tool", "Purpose", "How to get access"),
          dataRow("GitHub", "Source control", "Ask team lead"),
          dataRow("Slack", "Communication", "Invite via email"),
          dataRow("Jira", "Task tracking", "Ask team lead"),
        ),
        h2("Code Conventions"),
        ul(
          "Branch naming: feature/your-feature-name",
          "Commit format: conventional commits (feat:, fix:, docs:)",
          "All PRs require one reviewer approval",
        ),
        h2("Who To Ask"),
        ul(
          "Technical questions → Team Lead",
          "HR & admin → HR contact",
          "Product questions → Product Manager",
        ),
      ],
    },
  },

  // 5. Weekly Report
  {
    id: "weekly-report",
    icon: BarChart2,
    color: "bg-cyan-500/10 text-cyan-500",
    titleKey: "weeklyReport.title",
    descKey: "weeklyReport.desc",
    aiPromptKey: "weeklyReport.aiPrompt",
    content: {
      type: "doc",
      content: [
        h1("Weekly Report"),
        p("Week of: ___________"),
        h2("✅ Completed This Week"),
        ul("What was accomplished", "Another completed item"),
        h2("🔄 In Progress"),
        ul("What is currently being worked on and current status"),
        h2("📅 Next Week Plan"),
        ul("Planned task or goal", "Another planned item"),
        h2("⚠️ Blockers & Issues"),
        ul("Any blockers or issues that need attention"),
        h2("📊 Key Metrics"),
        table(
          headerRow("Metric", "This Week", "Last Week"),
          dataRow(" ", " ", " "),
          dataRow(" ", " ", " "),
        ),
        h2("💬 Notes & Highlights"),
        p("Anything else worth mentioning..."),
      ],
    },
  },

  // 6. API Documentation
  {
    id: "api-documentation",
    icon: Layers,
    color: "bg-rose-500/10 text-rose-500",
    titleKey: "apiDocumentation.title",
    descKey: "apiDocumentation.desc",
    aiPromptKey: "apiDocumentation.aiPrompt",
    content: {
      type: "doc",
      content: [
        h1("API Documentation"),
        h2("Overview"),
        p("Brief description of what this API does and who it is for."),
        h2("Base URL"),
        code("text", "https://api.yourdomain.com/v1"),
        h2("Authentication"),
        p("All requests must include a Bearer token in the Authorization header."),
        code("http", "Authorization: Bearer <your-token>"),
        h2("Endpoints"),
        h3("GET /resource"),
        p("Returns a list of resources."),
        code("json", "// Response 200 OK\n[\n  {\n    \"id\": \"uuid\",\n    \"name\": \"Example\",\n    \"createdAt\": \"2024-01-01T00:00:00Z\"\n  }\n]"),
        h3("POST /resource"),
        p("Creates a new resource."),
        code("json", "// Request body\n{\n  \"name\": \"string (required)\"\n}\n\n// Response 201 Created\n{\n  \"id\": \"uuid\",\n  \"name\": \"string\"\n}"),
        h2("Error Codes"),
        table(
          headerRow("Code", "Meaning"),
          dataRow("400", "Bad Request — missing or invalid parameters"),
          dataRow("401", "Unauthorized — invalid or missing token"),
          dataRow("404", "Not Found — resource does not exist"),
          dataRow("500", "Internal Server Error"),
        ),
      ],
    },
  },

  // 7. Product Requirements
  {
    id: "product-requirements",
    icon: FileText,
    color: "bg-amber-500/10 text-amber-500",
    titleKey: "productRequirements.title",
    descKey: "productRequirements.desc",
    aiPromptKey: "productRequirements.aiPrompt",
    content: {
      type: "doc",
      content: [
        h1("Product Requirements Document"),
        h2("Problem Statement"),
        p("What user problem are we solving? Who experiences this problem and how often?"),
        h2("Goals"),
        ul(
          "User goal: what the user wants to achieve",
          "Business goal: what the company wants to achieve",
        ),
        h2("User Stories"),
        ul(
          "As a [user type], I want to [action] so that [benefit].",
          "As a [user type], I want to [action] so that [benefit].",
        ),
        h2("Functional Requirements"),
        table(
          headerRow("ID", "Requirement", "Priority"),
          dataRow("FR-01", "Description", "High"),
          dataRow("FR-02", "Description", "Medium"),
        ),
        h2("Non-Functional Requirements"),
        ul(
          "Performance: page loads in under 2 seconds",
          "Accessibility: WCAG 2.1 AA compliant",
        ),
        h2("Success Metrics"),
        ul("Metric and target value"),
      ],
    },
  },

  // 8. Knowledge Base Article
  {
    id: "knowledge-base",
    icon: BookOpen,
    color: "bg-indigo-500/10 text-indigo-500",
    titleKey: "knowledgeBase.title",
    descKey: "knowledgeBase.desc",
    aiPromptKey: "knowledgeBase.aiPrompt",
    content: {
      type: "doc",
      content: [
        h1("Knowledge Base Article"),
        p("A concise one-line summary of what this article covers."),
        h2("Overview"),
        p("Explain the topic in plain language. Who is the intended reader? What will they learn?"),
        h2("Prerequisites"),
        ul("What the reader needs to know or have before reading this"),
        h2("Step-by-Step Guide"),
        ol(
          "First step — describe what to do and why",
          "Second step",
          "Third step",
        ),
        h2("Common Issues & Troubleshooting"),
        ul("Issue: description → Solution: how to fix it"),
        h2("Related Articles"),
        ul("Link to related document"),
      ],
    },
  },
];