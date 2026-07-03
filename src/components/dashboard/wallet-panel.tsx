import type { TokenBalance } from "@/lib/tokens";
import type { WalletTransaction } from "@/lib/transactions";
import { TransactionHistory } from "@/components/dashboard/transaction-history";

function maskAddress(address: string | undefined): string {
  if (!address) return "No wallet detected";
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletPanel({ address, profileStatus, tokens, transactions, transactionsLoading, transactionsError }: { address?: string; profileStatus: string; tokens: TokenBalance[]; transactions: WalletTransaction[]; transactionsLoading: boolean; transactionsError?: string }) {
  // Calculate total balance in USD (for demo, we'll use a placeholder)
  const totalBalance = tokens.reduce((acc, token) => {
    const amount = parseFloat(token.amount.replace(/,/g, '')) || 0;
    return acc + amount;
  }, 0);

  return (
    <div className="content-stack">
      {/* Wallet Info Header */}
      <section className="wallet-header panel-lite animate-in">
        <div className="wallet-header-content">
          <div className="wallet-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 12V7C21 5.89543 20.1046 5 19 5H5C3.89543 5 3 5.89543 3 7V17C3 18.1046 3.89543 19 5 19H19C20.1046 19 21 18.1046 21 17V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 12H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="17" cy="12" r="1" fill="currentColor"/>
            </svg>
          </div>
          <div className="wallet-info">
            <span className="wallet-label">Wallet</span>
            <strong className="wallet-address">{maskAddress(address)}</strong>
          </div>
        </div>
      </section>

      {/* Total Balance */}
      <section className="total-balance panel-lite">
        <div className="total-balance-header">
          <span className="total-balance-label">Total Balance</span>
          <strong className="total-balance-amount">${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
        </div>
      </section>

      {/* Token Cards - Side by Side */}
      <section className="token-cards-section">
        <div className="token-cards-grid">
          {tokens.map((token) => (
            <article className="token-card" key={`${token.symbol}-card`}>
              <div className="token-card-header">
                <span className={`token-icon token-${token.symbol === "G$" ? "gd" : "celo"}`}>{token.symbol}</span>
                <div className="token-card-info">
                  <strong>{token.name}</strong>
                  <small>{token.symbol === "G$" ? "GoodDollar" : "Celo"}</small>
                </div>
              </div>
              <div className="token-card-balance">
                <strong>{token.amount}</strong>
                <span className="token-symbol">{token.symbol}</span>
              </div>
              {token.note && <small className="token-card-note">{token.note}</small>}
              <div className="token-card-actions">
                <button className="token-action-btn primary">
                  {token.symbol === "G$" ? "Claim" : "Buy"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Recent Transactions - Below Tokens */}
      <TransactionHistory transactions={transactions} loading={transactionsLoading} error={transactionsError} />
    </div>
  );
}
