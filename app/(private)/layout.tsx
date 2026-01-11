import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import {
  DashboardLayoutClient,
  type UserData,
} from "@/components/dashboard/dashboard-layout-client";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect to login if not authenticated
  if (!user) {
    redirect("/login");
  }

  // Extract user data from metadata
  const userData: UserData = {
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    email: user.email ?? null,
    avatarUrl: user.user_metadata?.avatar_url ?? null,
  };

  return (
    <DashboardLayoutClient user={userData}>{children}</DashboardLayoutClient>
  );
}
