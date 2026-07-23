import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { NewRequestForm } from "@/components/enterprise-os/new-request-form";
import { RequestList } from "@/components/enterprise-os/request-list";
import { OfficeScene } from "@/components/enterprise-os/office-scene";
import { LanguageSwitcher } from "@/components/language-switcher";
import { AppSwitcher } from "@/components/app-switcher";
import { useBudgetRequests } from "@/hooks/use-budget-requests";
import {
  Loader2,
  Building2,
  Brain,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Sparkles,
  Users,
  DollarSign,
  BarChart3,
  ArrowRight,
  Zap,
  Shield,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BudgetRequest } from "@/types/enterprise-os";

// --- Sub-components ---

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  glow,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  color: string;
  glow: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-xl border border-white/5 bg-gradient-to-br from-white/5 to-white/[0.02] p-4 backdrop-blur-sm`}>
      <div className={`absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-20 blur-xl ${glow}`} />
      <div className="relative">
        <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
        <p className="mt-1 text-sm font-medium text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function AgentDepartmentCard({
  name,
  role,
  status,
  color,
  icon: Icon,
  metric,
}: {
  name: string;
  role: string;
  status: "active" | "idle" | "processing";
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  metric: string;
}) {
  const statusConfig = {
    active: { dot: "bg-emerald-400", pulse: "bg-emerald-400", label: "Active" },
    idle: { dot: "bg-slate-400", pulse: "", label: "Idle" },
    processing: { dot: "bg-amber-400", pulse: "bg-amber-400", label: "Processing" },
  };
  const s = statusConfig[status];

  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent p-4 backdrop-blur-sm transition-all duration-300 hover:border-white/10 hover:from-white/8">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-foreground">{name}</p>
            <div className="flex items-center gap-1.5">
              <div className="relative h-2.5 w-2.5">
                <div className={`absolute h-2.5 w-2.5 rounded-full ${s.dot}`} />
                {s.pulse && (
                  <div className={`absolute h-2.5 w-2.5 animate-ping rounded-full opacity-75 ${s.pulse}`} />
                )}
              </div>
              <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
            </div>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{role}</p>
          <p className="mt-2 text-xs font-semibold text-foreground/80">{metric}</p>
        </div>
      </div>
    </div>
  );
}

function PendingApprovalBanner({ requests }: { requests: BudgetRequest[] }) {
  const pending = requests.filter(
    (r) => r.status === "pending_approval" || r.status === "negotiating",
  );
  if (pending.length === 0) return null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-violet-500/30 bg-gradient-to-r from-violet-900/30 via-indigo-900/20 to-violet-900/30 p-4 backdrop-blur-sm">
      <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 to-indigo-500/5" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/20">
            <Zap className="h-4 w-4 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {pending.length} request{pending.length > 1 ? "s" : ""} awaiting your decision
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              AI agents have completed analysis — approve or reject directly from the list
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {pending.slice(0, 3).map((r) => (
                <Link key={r.id} to={`/budget-os/requests/${r.id}`}>
                  <Badge
                    variant="outline"
                    className="gap-1 border-violet-500/40 text-xs text-violet-300 hover:bg-violet-500/10"
                  >
                    <ArrowRight className="h-3 w-3" />
                    {r.campaign_name}
                  </Badge>
                </Link>
              ))}
              {pending.length > 3 && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  +{pending.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Main Page ---

const Index = () => {
  const { t } = useTranslation();
  const { requests, isLoading, refetch, deleteRequest, makeDecision } = useBudgetRequests();

  const counts = useMemo(() => {
    const totalBudget = requests.reduce(
      (sum, r) => sum + (Number(r.final_amount ?? r.requested_amount) || 0),
      0,
    );
    const approvedBudget = requests
      .filter((r) => r.status === "approved" || r.status === "completed")
      .reduce((sum, r) => sum + (Number(r.final_amount ?? r.requested_amount) || 0), 0);

    return {
      negotiatingCount: requests.filter((r) => r.status === "negotiating").length,
      pendingCount: requests.filter((r) => r.status === "pending_approval").length,
      approvedCount: requests.filter((r) => r.status === "approved" || r.status === "completed").length,
      rejectedCount: requests.filter((r) => r.status === "rejected").length,
      totalBudget,
      approvedBudget,
    };
  }, [requests]);

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <header className="border-b border-white/5 bg-gradient-to-b from-background to-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 shadow-lg shadow-violet-900/50">
              <Building2 className="h-5 w-5 text-white" />
              <div className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-background bg-emerald-400" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-foreground">
                {t("home.header.title")}
              </h1>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <p className="text-xs text-muted-foreground">AI agents operating</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AppSwitcher />
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            icon={DollarSign}
            label="Total pipeline"
            value={`$${(counts.totalBudget / 1000).toFixed(0)}K`}
            color="bg-violet-500/20 text-violet-400"
            glow="bg-violet-500"
          />
          <StatCard
            icon={CheckCircle2}
            label="Approved"
            value={counts.approvedCount}
            color="bg-emerald-500/20 text-emerald-400"
            glow="bg-emerald-500"
          />
          <StatCard
            icon={Clock}
            label="Pending review"
            value={counts.pendingCount + counts.negotiatingCount}
            color="bg-amber-500/20 text-amber-400"
            glow="bg-amber-500"
          />
          <StatCard
            icon={XCircle}
            label="Rejected"
            value={counts.rejectedCount}
            color="bg-red-500/20 text-red-400"
            glow="bg-red-500"
          />
        </div>

        {/* Pending Approval Banner */}
        <PendingApprovalBanner requests={requests} />

        {/* 3D Agent Scene */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {t("home.office.title")}
              </h2>
            </div>
            <Badge variant="outline" className="gap-1 border-violet-500/30 text-xs text-violet-400">
              <Brain className="h-3 w-3" />
              Live
            </Badge>
          </div>
          <OfficeScene {...counts} />
        </div>

        {/* AI Departments */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              AI Agent Departments
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AgentDepartmentCard
              name="Marketing Agent"
              role="Proposes & advocates budgets"
              status={counts.negotiatingCount > 0 ? "processing" : "idle"}
              color="bg-purple-500/20 text-purple-400"
              icon={TrendingUp}
              metric={`${requests.length} proposals total`}
            />
            <AgentDepartmentCard
              name="Finance Agent"
              role="Market analysis & policy"
              status={counts.negotiatingCount > 0 ? "active" : "idle"}
              color="bg-sky-500/20 text-sky-400"
              icon={BarChart3}
              metric="Gemini AI powered"
            />
            <AgentDepartmentCard
              name="Board (You)"
              role="Final approval authority"
              status={counts.pendingCount > 0 ? "processing" : "idle"}
              color="bg-amber-500/20 text-amber-400"
              icon={Users}
              metric={`${counts.pendingCount} awaiting decision`}
            />
            <AgentDepartmentCard
              name="Security Agent"
              role="Threat detection & response"
              status="active"
              color="bg-rose-500/20 text-rose-400"
              icon={Shield}
              metric="CyberGuard OS"
            />
          </div>
        </div>

        {/* Main workspace: New Request + Request List */}
        <div className="grid gap-8 md:grid-cols-[1fr_1.6fr]">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Submit Request
              </h2>
            </div>
            <NewRequestForm />
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("home.requestsList.title")}
                </h2>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3 text-violet-400" />
                AI analysis on pending requests
              </div>
            </div>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <RequestList
                requests={requests}
                onRetryComplete={refetch}
                onDelete={deleteRequest}
                onDecision={makeDecision}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
