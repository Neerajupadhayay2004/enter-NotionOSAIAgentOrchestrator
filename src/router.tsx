import Index from "./pages/Index";
import RequestDetail from "./pages/RequestDetail";
import CyberGuardDashboard from "./pages/CyberGuardDashboard";
import IncidentDetail from "./pages/IncidentDetail";
import HoneypotNetwork from "./pages/HoneypotNetwork";
import NotFound from "./pages/NotFound";

export const routers = [
  {
    path: "/",
    name: "home",
    element: <CyberGuardDashboard />,
  },
  {
    path: "/security/incidents/:id",
    name: "incident-detail",
    element: <IncidentDetail />,
  },
  {
    path: "/security/honeypot",
    name: "honeypot-network",
    element: <HoneypotNetwork />,
  },
  {
    path: "/budget-os",
    name: "budget-os-home",
    element: <Index />,
  },
  {
    path: "/budget-os/requests/:id",
    name: "budget-os-request-detail",
    element: <RequestDetail />,
  },
  /* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */
  {
    path: "*",
    name: "404",
    element: <NotFound />,
  },
];

declare global {
  interface Window {
    __routers__: typeof routers;
  }
}

window.__routers__ = routers;
