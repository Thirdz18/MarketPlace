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

const statusLabels: Record<GoodDollarStatus, string> = {
  idle: "Checking eligibility",
  loading: "Loading status",
  success: "Ready to claim",
  claimed: "Already claimed",
  unverified: "Face verification required",
  error: "Needs attention",
};

export function ClaimPanel({ claimableAmount, claimStatus, goodDollarMessage, nextClaimCountdown, nextClaimTime, onClaim, disabled }: ClaimPanelProps) {
  const isAlreadyClaimed = claimStatus === "claimed" || Boolean(nextClaimTime);
  const needsVerification = claimStatus === "unverified";
  const displayAmount = needsVerification ? "Not eligible yet" : isAlreadyClaimed ? "Already claimed" : claimableAmount;
  const primaryButtonLabel = claimStatus === "loading" ? "Loading UBI..." : needsVerification ? "Verify face first" : isAlreadyClaimed ? "Already claimed" : "Claim G$ daily";

  return (
    <section className="claim-panel panel-lite">
      <div><p className="eyebrow">GoodDollar UBI</p><h1>Claim G$ daily</h1><p>Check your GoodDollar identity, complete face verification when needed, load your available daily UBI, and submit the claim from your connected wallet.</p></div>
      <div className="claim-card">
        <span>{isAlreadyClaimed ? "Claim status" : needsVerification ? "Eligibility status" : "Claimable amount"}</span>
        <strong>{displayAmount}</strong>
        <div className={`status-pill status-${claimStatus}`}>{statusLabels[claimStatus]}</div>
        <small>{goodDollarMessage}</small>
        {needsVerification && <a className="verify-link" href="https://gooddapp.org" target="_blank" rel="noreferrer">Open GoodDapp / GoodWallet face verification</a>}
        {nextClaimTime && <small>Next claim: {nextClaimTime}</small>}
        {nextClaimCountdown && <small>Live countdown: {nextClaimCountdown}</small>}
        <button onClick={onClaim} disabled={disabled || claimStatus === "loading" || isAlreadyClaimed || needsVerification} type="button">{primaryButtonLabel}</button>
      </div>
    </section>
  );
}
