"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import Signup from "./Signup";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";

import {
  BookOpen,
  Check,
  FolderOpen,
  Languages,
  Lightbulb,
  LogIn,
  LogOut,
  Menu,
  Mic,
  Palette,
  Trophy,
  User,
  Users,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { usePreferences } from "@/context/PreferencesContext";
import { authClient } from "@/lib/auth-client";

const NavBar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, setUser } = useUser();
  const { theme, setTheme } = useTheme();
  const { showTooltips, setShowTooltips } = usePreferences();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("user");
    setUser(null);
    router.replace("/");
    setMenuOpen(false);
    setDropdownOpen(false);
    // Server sign-out in background; don't block UI
    void authClient.signOut().catch(() => {});
  };

  const navItems = [
    {
      id: 0,
      title: (
        <span className="flex items-center gap-1.5">
          <Languages className="size-4 shrink-0" /> MT
        </span>
      ),
      href: "/",
      public: true,
    },
    {
      id: 2,
      title: (
        <span className="flex items-center gap-1.5">
          <Mic className="size-4 shrink-0" /> ASR
        </span>
      ),
      href: "/asr",
      public: true,
    },
    {
      id: 4,
      title: (
        <span className="flex items-center gap-1.5">
          <Trophy className="size-4 shrink-0" /> Leaderboard
        </span>
      ),
      href: "/leaderboard",
      public: true,
    },
    {
      id: 5,
      title: (
        <span className="flex items-center gap-1.5">
          <FolderOpen className="size-4 shrink-0" /> Datasets
        </span>
      ),
      href: "/datasets",
      public: false,
    },
    {
      id: 6,
      title: (
        <span className="flex items-center gap-1.5">
          <BookOpen className="size-4 shrink-0" /> Docs
        </span>
      ),
      href: "/docs",
      public: true,
    },
  ];

  const userNavItems = [
    {
      id: 1,
      title: (
        <span className="flex items-center gap-1.5">
          <User className="size-4 shrink-0" /> My account
        </span>
      ),
      href: "/profile",
      display: !!user?.username,
      subTitle: user?.username,
    },
    {
      id: 2,
      title: (
        <span className="flex items-center gap-1.5">
          <Users className="size-4 shrink-0" /> All users
        </span>
      ),
      href: "/users",
      display: user?.role === "root",
      subTitle: null,
    },
  ];

  const excludeNavebar = ["/reset-password", "/confirm-email"];

  if (excludeNavebar.includes(pathname)) return null;

  const UserPreferences = () => {
    if (!mounted) {
      return (
        <div className="w-full px-4 py-2 border-y border-neutral-300 dark:border-neutral-700">
          <div className="flex items-center space-x-1">
            <Palette className="size-4 shrink-0" />
            <p className="">Theme</p>
          </div>
          <div className="h-8 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700 mt-1" />
        </div>
      );
    }
    return (
      <div className="w-full px-4 py-2 border-y border-neutral-300 dark:border-neutral-700">
        <div className="flex items-center space-x-1">
          <Palette className="size-4 shrink-0" />
          <p className="">Theme</p>
        </div>

        <div className="flex w-full items-center space-x-2">
          {(["system", "dark", "light"] as const).map((item) => {
            return (
              <button
                key={item}
                onClick={() => setTheme(item)}
                className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium transition-all duration-200 ease-in-out transform hover:scale-105
                                    ${
                                      theme === item
                                        ? "bg-neutral-600 dark:bg-blue-600/80 text-white shadow-lg scale-105"
                                        : "bg-neutral-200 dark:bg-neutral-900/80 hover:bg-neutral-200 dark:hover:bg-neutral-700/70 shadow-md"
                                    }
                                    focus:outline-none focus:ring-opacity-50 cursor-pointer`}
              >
                <span className="font-mono capitalize whitespace-nowrap">
                  {item}
                </span>
                {theme === item && (
                  <span>
                    <Check
                      strokeWidth={4}
                      className="size-4 p-0.5 bg-blue-500 rounded-full text-white"
                    />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center space-x-2 mt-3">
          <div className="flex items-center space-x-1">
            <Lightbulb className="size-4 shrink-0" />
            <p className="">Tooltips</p>
          </div>
          <div className="flex w-full items-centerspace-x-2">
            <button
              onClick={() => {
                setShowTooltips(!showTooltips);
              }}
              className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium transition-all duration-200 ease-in-out transform hover:scale-105
                                    ${
                                      !showTooltips
                                        ? "bg-neutral-600 dark:bg-blue-600/80 text-white shadow-lg scale-105"
                                        : "bg-neutral-200 dark:bg-neutral-900/80 hover:bg-neutral-200 dark:hover:bg-neutral-700/70 shadow-md"
                                    }
                                    focus:outline-none focus:ring-opacity-50 cursor-pointer`}
            >
              <span className="font-mono whitespace-nowrap">
                {showTooltips ? "Hide" : "Show"}
              </span>
              {!showTooltips && (
                <span>
                  <Check
                    strokeWidth={4}
                    className="size-4 p-0.5 bg-blue-500 rounded-full text-white"
                  />
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <nav className="w-full text-neutral-600 dark:text-neutral-300 fixed z-40 bg-gradient-to-b from-neutral-200 to-neutral-100 dark:from-neutral-800 dark:to-neutral-800 px-3">
      <div className="flex justify-between items-center h-16">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold text-neutral-800 dark:text-neutral-100">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center [&>svg]:h-full [&>svg]:w-full" aria-hidden>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor">
              <path d="M8 6h18v3H8V6zm0 6h14v3H8v-3zm0 9h18v3H8v-3zM8 6v20h3V6H8z"/>
            </svg>
          </span>
          {process.env.NEXT_PUBLIC_APP_NAME}
        </Link>

        {/* Hamburger menu button (mobile) */}
        <button
          className="md:hidden p-2 cursor-pointer rounded hover:bg-neutral-200 dark:hover:bg-neutral-700"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
        >
          {menuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>

        {/* Desktop nav links */}
        <div className="hidden md:flex space-x-1 items-center text-lg pt-3">
          {navItems.map((item, i) => {
            // If nav item is not public (is private) and there is no loggedin user, return nothing
            // Else display it
            if (!item.public && !user?.username) return null;
            else
              return (
                <Link
                  key={i}
                  href={item.href}
                  className={`px-3 py-3 rounded-t-md ${
                    pathname === item.href
                      ? "bg-white dark:bg-neutral-900"
                      : "hover:bg-white dark:hover:bg-neutral-900"
                  }`}
                >
                  {item.title}
                </Link>
              );
          })}

          {user?.username ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center cursor-pointer px-2 py-3 rounded-md text-neutral-800 hover:text-black dark:text-white dark:hover:text-neutral-200"
                aria-label="Account menu"
              >
                <User className="size-8 text-neutral-900 dark:text-white" />
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 mt-0 w-fit rounded-b-md shadow-lg bg-neutral-200 dark:bg-neutral-800 z-40 overflow-hidden">
                  <div className="text-sm text-neutral-800 dark:text-neutral-200">
                    {userNavItems.map((item, i) => {
                      if (!item.display) return null;
                      return (
                        <Link
                          key={i}
                          href={item.href}
                          onClick={() => setDropdownOpen(false)}
                          className="flex flex-col px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-900/80"
                        >
                          <span>{item.title}</span>
                          {item.subTitle && (
                            <span className="font-mono text-xs">
                              ({item.subTitle})
                            </span>
                          )}
                        </Link>
                      );
                    })}

                    <UserPreferences />

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full text-left flex items-center gap-2 px-4 py-2 hover:bg-neutral-100 cursor-pointer dark:hover:bg-neutral-900/80"
                    >
                      <LogOut className="size-4 shrink-0" /> Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="flex items-center gap-2 cursor-pointer font-semibold"
            >
              <LogIn className="size-4 shrink-0" /> Sign In
            </button>
          )}
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {menuOpen && (
        <div className="md:hidden mt-2 flex flex-col space-y-2 bg-neutral-100 dark:bg-neutral-800 rounded-md text-lg z-30">
          {navItems.map((item, i) => {
            // If nav item is not public (is private) and there is no loggedin user, return nothing
            // Else display it
            if (!item.public && !user?.username) return null;
            return (
              <Link
                key={i}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`px-2 py-2 rounded hover:bg-white dark:hover:bg-neutral-900 ${
                  pathname === item.href ? "bg-white dark:bg-neutral-900" : ""
                }`}
              >
                {item.title}
              </Link>
            );
          })}

          <UserPreferences />

          {user?.username ? (
            <>
              {userNavItems.map((item, i) => {
                if (!item.display) return null;
                return (
                  <Link
                    key={i}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="px-2 py-2 rounded hover:bg-white dark:hover:bg-neutral-900"
                  >
                    <span>{item.title}</span>
                    {item.subTitle && (
                      <span className="font-mono text-xs">
                        ({item.subTitle})
                      </span>
                    )}
                  </Link>
                );
              })}

              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-2 text-left px-2 py-2 cursor-pointer rounded hover:bg-white dark:hover:bg-neutral-900"
              >
                <LogOut className="size-4 shrink-0" /> Logout
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsOpen(true);
                setMenuOpen(false);
              }}
              className="flex items-center gap-2 px-2 py-2 text-left cursor-pointer hover:bg-white dark:hover:bg-neutral-900"
            >
              <LogIn className="size-4 shrink-0" /> Sign In
            </button>
          )}
        </div>
      )}

      {/* Auth Modal */}
      <Signup isOpen={isOpen} setIsOpen={setIsOpen} setUser={setUser} />
    </nav>
  );
};

export default NavBar;
