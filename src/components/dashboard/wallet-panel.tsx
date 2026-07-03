import type { TokenBalance } from "@/lib/tokens";
import type { WalletTransaction } from "@/lib/transactions";
import { TransactionHistory } from "@/components/dashboard/transaction-history";

export function WalletPanel({ address, profileStatus, tokens, transactions, transactionsLoading, transactionsError }: { address?: string; profileStatus: string; tokens: TokenBalance[]; transactions: WalletTransaction[]; transactionsLoading: boolean; transactionsError?: string }) {
  return (
    <div className="content-stack">
      <section className="wallet-hero panel-lite">
        <div><p className="eyebrow">Connected wallet</p><h1>Your wallet</h1><p>View your Celo wallet balances first. Claim, savings, learning, games, and top-up tools are available from the left menu.</p></div>
        <div className="address-card"><span>Wallet address</span><strong>{address ?? "No wallet detected"}</strong><small>{profileStatus}</small></div>
      </section>
      <section className="token-panel">
        <div className="section-heading"><div><p className="eyebrow">Supported tokens · Celo Network</p><h2>Crypto</h2></div></div>
        <div className="token-list">
          {tokens.map((token) => (
            <article className="token-row" key={token.symbol}>
              <span className={`token-icon token-${token.symbol === "G$" ? "gd" : "celo"}`}>{token.symbol}</span>
              <div><strong>{token.symbol}</strong><small>{token.name}</small></div>
              <div className="token-amount"><strong>{token.amount} {token.symbol}</strong>{token.note && <small>{token.note}</small>}</div>
            </article>
          ))}
        </div>
      </section>
      <TransactionHistory transactions={transactions} loading={transactionsLoading} error={transactionsError} />
    </div>
  );
}
