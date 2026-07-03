import type { WalletTransaction } from "@/lib/transactions";

export function TransactionHistory({ transactions, loading, error }: { transactions: WalletTransaction[]; loading: boolean; error?: string }) {
  return (
    <section className="history-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Activity</p>
          <h2>Transaction history</h2>
        </div>
        <span className="history-note">Recent G$ events</span>
      </div>
      
      {loading && (
        <div className="tx-loading">
          <div className="tx-loading-item"></div>
          <div className="tx-loading-item"></div>
          <div className="tx-loading-item"></div>
        </div>
      )}
      
      {error && <p className="status-error">{error}</p>}
      
      {!loading && !error && transactions.length === 0 && (
        <div className="tx-empty">
          <div className="tx-empty-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p>No transactions yet</p>
          <small>Your G$ activity will appear here</small>
        </div>
      )}
      
      <div className="transaction-list">
        {transactions.map((tx) => (
          <article className="transaction-row" key={tx.id}>
            <span className={`tx-badge ${tx.direction}`}>{tx.direction === "in" ? "↓" : "↑"}</span>
            <div className="tx-details">
              <strong>{tx.type === "claim" ? "Claim G$" : tx.type === "send" ? "Send G$" : "Receive G$"}</strong>
              <small>{tx.status === "pending" ? "Submitted to wallet" : `Tx ${tx.hash.slice(0, 8)}…${tx.hash.slice(-6)}`}</small>
            </div>
            <strong className={`tx-amount ${tx.direction === "in" ? "positive" : "negative"}`}>
              {tx.direction === "in" ? "+" : "-"}{tx.amount}
            </strong>
          </article>
        ))}
      </div>
      
      <small className="history-note">CELO native transfer history needs an explorer/indexer integration; this MVP shows G$ Transfer events and submitted claim transactions.</small>
    </section>
  );
}
