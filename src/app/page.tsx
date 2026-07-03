import { AppShell } from "@/components/app-shell";

export default function Home() {
  return <AppShell privyConfigured={Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID)} />;
}
