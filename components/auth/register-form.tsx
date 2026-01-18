"use client";

import * as React from "react";
import { Github, Mail, User, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  signUpWithEmail,
  signInWithGoogle,
  signInWithGitHub,
} from "@/lib/supabase/auth";
import { syncUserToPrisma } from "@/app/actions/auth-actions";

interface RegisterFormProps {
  redirectTo?: string;
}

export function RegisterForm({ redirectTo = "/" }: RegisterFormProps) {
  const [isLoading, setIsLoading] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const handleEmailRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading("email");
    setError(null);
    setSuccess(null);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(null);
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      setIsLoading(null);
      return;
    }

    const result = await signUpWithEmail(name, email, password);

    if (result.error) {
      setError(result.error.message);
      setIsLoading(null);
      return;
    }

    if (result.data) {
      const syncResult = await syncUserToPrisma({
        id: result.data.id,
        email,
        name,
      });

      if (!syncResult.success) {
        setError(syncResult.error || "Failed to create user profile");
        setIsLoading(null);
        return;
      }
    }

    // Show success message for email confirmation
    setSuccess("Check your email to confirm your account before signing in.");
    setIsLoading(null);
  };

  const handleGoogleRegister = async () => {
    setIsLoading("google");
    setError(null);

    const result = await signInWithGoogle(
      `${window.location.origin}${redirectTo}`
    );

    if (result.error) {
      setError(result.error.message);
      setIsLoading(null);
    }
  };

  const handleGitHubRegister = async () => {
    setIsLoading("github");
    setError(null);

    const result = await signInWithGitHub(
      `${window.location.origin}${redirectTo}`
    );

    if (result.error) {
      setError(result.error.message);
      setIsLoading(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* OAuth Buttons */}
      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant="outline"
          className="w-full h-11 gap-3 font-medium"
          onClick={handleGoogleRegister}
          disabled={isLoading !== null}
        >
          {isLoading === "google" ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <svg className="size-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
          )}
          Continue with Google
        </Button>

        <Button
          type="button"
          variant="outline"
          className="w-full h-11 gap-3 font-medium"
          onClick={handleGitHubRegister}
          disabled={isLoading !== null}
        >
          {isLoading === "github" ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Github className="size-5" />
          )}
          Continue with GitHub
        </Button>
      </div>

      {/* Divider */}
      <div className="relative flex items-center">
        <Separator className="flex-1" />
        <span className="px-4 text-xs text-muted-foreground uppercase tracking-wider">
          or register with email
        </span>
        <Separator className="flex-1" />
      </div>

      {/* Email Form */}
      <form onSubmit={handleEmailRegister} className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="John Doe"
              className="pl-10 h-11"
              autoComplete="name"
              required
              disabled={isLoading !== null}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="name@example.com"
              className="pl-10 h-11"
              autoComplete="email"
              required
              disabled={isLoading !== null}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            className="h-11"
            autoComplete="new-password"
            required
            minLength={8}
            disabled={isLoading !== null}
          />
          <p className="text-xs text-muted-foreground">
            Must be at least 8 characters
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            placeholder="••••••••"
            className="h-11"
            autoComplete="new-password"
            required
            minLength={8}
            disabled={isLoading !== null}
          />
        </div>

        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 text-sm text-green-600 dark:text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg">
            {success}
          </div>
        )}

        <Button
          type="submit"
          className="w-full h-11 font-medium"
          disabled={isLoading !== null}
        >
          {isLoading === "email" ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>

      {/* Sign in link */}
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <a
          href="/login"
          className="font-medium text-primary hover:underline underline-offset-4 transition-colors"
        >
          Sign in
        </a>
      </p>
    </div>
  );
}
