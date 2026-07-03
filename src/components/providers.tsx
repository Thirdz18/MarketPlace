"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { celoMainnet, celoSepolia } from "@/lib/celo";

export function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const clientId = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID;

  if (!appId) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={appId}
      {...(clientId ? { clientId } : {})}
      config={{
        appearance: { theme: "light", accentColor: "#35D07F", logo: undefined },
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
        defaultChain: celoMainnet,
        supportedChains: [celoMainnet, celoSepolia],
        loginMethods: ["email", "google"],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
