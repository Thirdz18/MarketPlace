import type { GoodDollarStatus } from "@/lib/gooddollar";

export function ClaimPanel({ claimableAmount, claimStatus, goodDollarMessage, onClaim, disabled }: { claimableAmount: string; claimStatus: GoodDollarStatus; goodDollarMessage: string; onClaim: () => void; disabled: boolean }) {
  return (
    <section className="claim-panel panel-lite">
      <div><p className="eyebrow">GoodDollar UBI</p><h1>Claim G$ daily</h1><p>Check your GoodDollar identity, load your available daily UBI, and submit the claim from your connected wallet.</p></div>
      <div className="claim-card"><span>Claimable amount</span><strong>{claimableAmount}</strong><small>{goodDollarMessage}</small><button onClick={onClaim} disabled={disabled || claimStatus === "loading"} type="button">{claimStatus === "loading" ? "Loading UBI..." : "Claim G$ daily"}</button></div>
    </section>
  );
}
