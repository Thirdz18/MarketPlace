import type { TokenBalance } from "@/lib/tokens";
import type { WalletTransaction } from "@/lib/transactions";
import { TransactionHistory } from "@/components/dashboard/transaction-history";

function maskAddress(address: string | undefined): string {
  if (!address) return "No wallet detected";
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletPanel({ address, profileStatus, tokens, transactions, transactionsLoading, transactionsError }: { address?: string; profileStatus: string; tokens: TokenBalance[]; transactions: WalletTransaction[]; transactionsLoading: boolean; transactionsError?: string }) {
  const visibleTokens = tokens.filter((token) => token.symbol === "G$");

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
        <small className="profile-status">{profileStatus}</small>
      </section>

      {/* Main Content: Balances + Transactions Side by Side */}
      <section className="wallet-main">
        {/* Left Column: Balance Cards */}
        <div className="balance-column">
          <div className="section-heading"><div><p className="eyebrow">GoodDollar · Celo Network</p><h2>GoodDollar balance</h2></div></div>
          
          {/* Balance Card */}
          <div className="balance-cards-grid" aria-label="GoodDollar wallet balance">
            {visibleTokens.map((token) => (
              <article className="balance-card-new" key={`${token.symbol}-balance`}>
                <div className="balance-card-header">
                  <span className={`token-icon token-${token.symbol === "G$" ? "gd" : "celo"}`}>{token.symbol}</span>
                  <small>{token.name}</small>
                </div>
                <div className="balance-card-body">
                  <strong>{token.amount}</strong>
                  <span className="token-symbol-badge">{token.symbol}</span>
                </div>
                {token.note && <small className="balance-note">{token.note}</small>}
              </article>
            ))}
          </div>
        </div>

        {/* Right Column: Transaction History */}
        <div className="transactions-column">
          <TransactionHistory transactions={transactions} loading={transactionsLoading} error={transactionsError} />
        </div>
      </section>
    </div>
  );
}
