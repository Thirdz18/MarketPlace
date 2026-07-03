import { dashboardModules, type DashboardModuleId } from "@/lib/modules";

export function PlaceholderPanel({ moduleId }: { moduleId: Exclude<DashboardModuleId, "wallet" | "claim"> }) {
  const module = dashboardModules.find((item) => item.id === moduleId);
  return (
    <section className="placeholder-panel panel-lite">
      <span className="placeholder-icon">{module?.icon}</span>
      <p className="eyebrow">Coming soon</p>
      <h1>{module?.label}</h1>
      <p>{module?.description}. This section is now wired into the new dashboard structure and ready for the next feature implementation.</p>
    </section>
  );
}
