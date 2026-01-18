import { createClient } from "@/utils/supabase/client";
import { Provider } from "@supabase/supabase-js";

/**
 * Auth service untuk menangani semua operasi autentikasi Supabase
 * Memisahkan logika Supabase dari komponen UI
 */

export type AuthError = {
  message: string;
  status?: number;
};

export type AuthResult<T = void> = {
  data?: T;
  error?: AuthError;
};

/**
 * Login dengan email dan password
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  const supabase = createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      error: {
        message: error.message,
        status: error.status,
      },
    };
  }

  return { data: undefined };
}

/**
 * Register dengan email, password, dan nama
 */
export async function signUpWithEmail(
  name: string,
  email: string,
  password: string
): Promise<AuthResult<import("@supabase/supabase-js").User>> {
  const supabase = createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
        display_name: name,
      },
    },
  });

  if (error) {
    return {
      error: {
        message: error.message,
        status: error.status,
      },
    };
  }

  return { data: data.user || undefined };
}

/**
 * Login dengan OAuth Provider (Google, GitHub, dll)
 */
export async function signInWithOAuth(
  provider: Provider,
  redirectTo?: string
): Promise<AuthResult> {
  const supabase = createClient();

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirectTo || `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    return {
      error: {
        message: error.message,
        status: error.status,
      },
    };
  }

  return { data: undefined };
}

/**
 * Login dengan Google
 */
export async function signInWithGoogle(
  redirectTo?: string
): Promise<AuthResult> {
  return signInWithOAuth("google", redirectTo);
}

/**
 * Login dengan GitHub
 */
export async function signInWithGitHub(
  redirectTo?: string
): Promise<AuthResult> {
  return signInWithOAuth("github", redirectTo);
}

/**
 * Logout user
 */
export async function signOut(): Promise<AuthResult> {
  const supabase = createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    return {
      error: {
        message: error.message,
        status: error.status,
      },
    };
  }

  return { data: undefined };
}

/**
 * Get current session
 */
export async function getSession() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    return {
      error: {
        message: error.message,
        status: error.status,
      },
    };
  }

  return { data: data.session };
}

/**
 * Get current user
 */
export async function getUser() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return {
      error: {
        message: error.message,
        status: error.status,
      },
    };
  }

  return { data: data.user };
}
