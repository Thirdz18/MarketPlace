export type DashboardModuleId = "wallet" | "claim" | "savings" | "learn" | "play" | "topup";

export const dashboardModules = [
  { id: "wallet", label: "Wallet", icon: "⇄", description: "Balances and transaction history" },
  { id: "claim", label: "Claim", icon: "G$", description: "Claim daily GoodDollar UBI" },
  { id: "savings", label: "Savings", icon: "🏦", description: "Savings goals and future Celo vaults" },
  { id: "learn", label: "Learn & Earn", icon: "📚", description: "Education tasks and rewards" },
  { id: "play", label: "Play & Earn", icon: "🎮", description: "Minigames and reward loops" },
  { id: "topup", label: "Mobile Top Up", icon: "📱", description: "Airtime and mobile data utility" },
] as const satisfies ReadonlyArray<{ id: DashboardModuleId; label: string; icon: string; description: string }>;
