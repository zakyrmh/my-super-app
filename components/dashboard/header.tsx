"use client";

import * as React from "react";
import { Bell, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const [greeting, setGreeting] = React.useState("Hello");

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
              John Doe
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
            <AvatarImage src="/avatar-placeholder.png" alt="John Doe" />
            <AvatarFallback className="text-xs font-medium">JD</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
