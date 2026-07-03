import { dashboardModules, type DashboardModuleId } from "@/lib/modules";

export function Sidebar({ activeModule, onSelect, onLogout }: { activeModule: DashboardModuleId; onSelect: (module: DashboardModuleId) => void; onLogout: () => void }) {
  return (
    <aside className="sidebar" aria-label="Dashboard navigation">
      <div className="brand-block">
        <span className="brand-mark">M</span>
        <div><strong>MarketPlace Hub</strong><small>Celo + GoodDollar</small></div>
      </div>
      <nav className="side-nav">
        {dashboardModules.map((module) => (
          <button key={module.id} className={`side-button ${activeModule === module.id ? "active" : ""}`} onClick={() => onSelect(module.id)} type="button">
            <span className="side-icon">{module.icon}</span>
            <span><strong>{module.label}</strong><small>{module.description}</small></span>
          </button>
        ))}
      </nav>
      <button className="side-button logout-button" onClick={onLogout} type="button"><span className="side-icon">↩</span><span><strong>Logout</strong><small>Disconnect this session</small></span></button>
    </aside>
  );
}
