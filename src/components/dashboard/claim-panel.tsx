import type { GoodDollarStatus } from "@/lib/gooddollar";

type ClaimPanelProps = {
  claimableAmount: string;
  claimStatus: GoodDollarStatus;
  goodDollarMessage: string;
  nextClaimCountdown?: string;
  nextClaimTime?: string;
  onClaim: () => void;
  disabled: boolean;
};

export function ClaimPanel({ claimableAmount, claimStatus, goodDollarMessage, nextClaimCountdown, nextClaimTime, onClaim, disabled }: ClaimPanelProps) {
  const isAlreadyClaimed = Boolean(nextClaimTime);

  return (
    <section className="claim-panel panel-lite">
      <div><p className="eyebrow">GoodDollar UBI</p><h1>Claim G$ daily</h1><p>Check your GoodDollar identity, load your available daily UBI, and submit the claim from your connected wallet.</p></div>
      <div className="claim-card">
        <span>{isAlreadyClaimed ? "Claim status" : "Claimable amount"}</span>
        <strong>{isAlreadyClaimed ? "Already claimed" : claimableAmount}</strong>
        <small>{goodDollarMessage}</small>
        {nextClaimTime && <small>Next claim: {nextClaimTime}</small>}
        {nextClaimCountdown && <small>Live countdown: {nextClaimCountdown}</small>}
        <button onClick={onClaim} disabled={disabled || claimStatus === "loading" || isAlreadyClaimed} type="button">{claimStatus === "loading" ? "Loading UBI..." : isAlreadyClaimed ? "Already claimed" : "Claim G$ daily"}</button>
      </div>
    </section>
  );
}
