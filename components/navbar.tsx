"use client";

import Link from "next/link";
import { Plus, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { UserProfileDropdown } from "@/components/UserProfileDropdown";
import { SearchBar } from "@/components/search-bar";

// ...

export function Navbar() {
  const { data: session } = useSession();

  return (
    <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">
                B
              </span>
            </div>
            <span className="font-semibold text-lg hidden sm:inline">
              BlogHub
            </span>
          </Link>

          {/* Search Bar */}
          <div className="hidden md:flex flex-1 mx-8 justify-center">
            <SearchBar />
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {session ? (
              <>
                <Link href="/create">
                  <Button variant="default" size="sm" className="gap-2">
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Write</span>
                  </Button>
                </Link>
                <UserProfileDropdown />
              </>
            ) : (
              <>
                <Link href="/create">
                  <Button variant="default" size="sm" className="gap-2">
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Write</span>
                  </Button>
                </Link>
                <Link href="/login">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 bg-transparent"
                  >
                    <LogIn className="w-4 h-4" />
                    <span className="hidden sm:inline">Sign In</span>
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
