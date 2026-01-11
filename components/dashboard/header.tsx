"use client";

import * as React from "react";
import { Bell, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { type UserData } from "@/components/dashboard/dashboard-layout-client";

interface HeaderProps {
  onMenuClick?: () => void;
  user: UserData;
}

/**
 * Generates initials from a name or email.
 * - "John Doe" -> "JD"
 * - "john.doe@example.com" -> "JO" (first two characters of email)
 */
function getInitials(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    // Single word name - use first two characters
    return name.slice(0, 2).toUpperCase();
  }

  if (email) {
    return email.slice(0, 2).toUpperCase();
  }

  return "??";
}

export function Header({ onMenuClick, user }: HeaderProps) {
  const [greeting, setGreeting] = React.useState("Hello");

  // Compute display name and initials
  const displayName = user.name ?? user.email ?? "User";
  const initials = getInitials(user.name, user.email);

  React.useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      setGreeting("Good Morning");
    } else if (hour >= 12 && hour < 17) {
      setGreeting("Good Afternoon");
    } else if (hour >= 17 && hour < 21) {
      setGreeting("Good Evening");
    } else {
      setGreeting("Good Night");
    }
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border/50">
      <div className="flex items-center justify-between h-16 px-4 md:px-6">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onMenuClick}
          >
            <Menu className="size-5" />
          </Button>

          {/* Greeting */}
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground font-medium">
              {greeting} 👋
            </span>
            <span className="text-sm font-semibold text-foreground">
              {displayName}
            </span>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="size-5" />
            {/* Notification Dot */}
            <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full" />
          </Button>

          {/* Avatar - Hidden on mobile */}
          <Avatar className="hidden md:flex size-9 border-2 border-border">
            {user.avatarUrl && (
              <AvatarImage src={user.avatarUrl} alt={displayName} />
            )}
            <AvatarFallback className="text-xs font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
