import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { syncUserToPrisma } from "@/app/actions/auth-actions";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && user.email) {
        const name =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email.split("@")[0] ||
          "User";
        const avatarUrl =
          user.user_metadata?.avatar_url || user.user_metadata?.picture;

        // Sync user to Prisma, but don't block navigation on error (just log it)
        // We import syncUserToPrisma dynamically or just use it if imported at top
        try {
          // We need to import it at the top
          await syncUserToPrisma({
            id: user.id,
            email: user.email,
            name: name,
            avatarUrl,
          });
        } catch (e) {
          console.error("Failed to sync user in callback:", e);
        }
      }

      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";

      if (isLocalEnv) {
        // Local development
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        // Production with proxy
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
