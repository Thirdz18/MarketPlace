import type { WalletTransaction } from "@/lib/transactions";

export function TransactionHistory({ transactions, loading, error }: { transactions: WalletTransaction[]; loading: boolean; error?: string }) {
  return (
    <section className="history-panel">
      <div className="section-heading"><div><p className="eyebrow">Transactions</p><h2>Transaction history</h2></div><span className="history-note">G$ events from recent Celo logs</span></div>
      {loading && <p className="muted">Loading recent G$ activity...</p>}
      {error && <p className="status-error">{error}</p>}
      {!loading && !error && transactions.length === 0 && <p className="muted">No recent G$ claim, send, or receive events found for this wallet.</p>}
      <div className="transaction-list">
        {transactions.map((tx) => (
          <article className="transaction-row" key={tx.id}>
            <span className={`tx-badge ${tx.direction}`}>{tx.direction === "in" ? "↓" : "↑"}</span>
            <div><strong>{tx.type === "claim" ? "Claim G$" : tx.type === "send" ? "Send G$" : "Receive G$"}</strong><small>{tx.status === "pending" ? "Submitted to wallet" : `Tx ${tx.hash.slice(0, 8)}…${tx.hash.slice(-6)}`}</small></div>
            <strong className={tx.direction === "in" ? "positive" : "negative"}>{tx.direction === "in" ? "+" : "-"}{tx.amount}</strong>
          </article>
        ))}
      </div>
      <small className="history-note">CELO native transfer history needs an explorer/indexer integration; this MVP shows G$ Transfer events and submitted claim transactions.</small>
    </section>
  );
}
