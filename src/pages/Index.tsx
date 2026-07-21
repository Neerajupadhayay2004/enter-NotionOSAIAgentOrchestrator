import { NewRequestForm } from "@/components/enterprise-os/new-request-form";
import { RequestList } from "@/components/enterprise-os/request-list";
import { useBudgetRequests } from "@/hooks/use-budget-requests";
import { Loader2, Building2 } from "lucide-react";

const Index = () => {
  const { requests, isLoading } = useBudgetRequests();

  return (
    <div className="min-h-full bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">AI-Native Enterprise OS</h1>
            <p className="text-sm text-muted-foreground">Marketing and Finance agents negotiate budgets; humans approve in Notion.</p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-8 px-6 py-8 md:grid-cols-[1fr_1.4fr]">
        <div>
          <NewRequestForm />
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            All Requests
          </h2>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <RequestList requests={requests} />
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
