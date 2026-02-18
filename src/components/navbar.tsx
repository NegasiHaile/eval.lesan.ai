"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import Signup from "./Signup";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";

import { IoCheckmarkOutline } from "react-icons/io5";
import { VscColorMode } from "react-icons/vsc";
import { FaUserGroup } from "react-icons/fa6";
import { MdOutlineTipsAndUpdates } from "react-icons/md";
import { usePreferences } from "@/context/PreferencesContext";
import { authClient } from "@/lib/auth-client";

const NavBar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, setUser } = useUser();
  const { theme, setTheme, showTooltips, setShowTooltips } = usePreferences();
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
      title: "🈸 MT",
      href: "/",
      public: true,
    },
    {
      id: 2,
      title: "🗣️ ASR",
      href: "/asr",
      public: true,
    },
    // {
    //   id: 3,
    //   title: "✍️ TTS",
    //   href: "/tts",
    //   public: true,
    // },
    {
      id: 4,
      title: "🏆 Leaderboard",
      href: "/leaderboard",
      public: true,
    },
    {
      id: 5,
      title: "🗂️ Datasets",
      href: "/datasets",
      public: false,
    },
  ];

  const userNavItems = [
    {
      id: 1,
      title: "🙎‍♂️ My account",
      href: "/profile",
      display: !!user?.username,
      subTitle: user?.username,
    },
    {
      id: 2,
      title: (
        <div className="flex items-center space-x-1">
          <FaUserGroup /> <p>All users</p>
        </div>
      ),
      href: "/users",
      display: user?.role === "root",
      subTitle: null,
    },
  ];

  const excludeNavebar = ["/reset-password", "/confirm-email"];

  if (excludeNavebar.includes(pathname)) return null;

  const UserPreferences = () => {
    return (
      <div className="w-full px-4 py-2 border-y border-gray-300 dark:border-gray-700">
        <div className="flex items-center space-x-1">
          <VscColorMode />
          <p className="">Theme</p>
        </div>

        <div className="flex w-full items-center space-x-2">
          {["system", "dark", "light"].map((item) => {
            return (
              <button
                key={item}
                onClick={() => {
                  setTheme(item.toLowerCase() as "system" | "dark" | "light");
                }}
                className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium transition-all duration-200 ease-in-out transform hover:scale-105
                                    ${
                                      theme.toLowerCase() === item.toLowerCase()
                                        ? "bg-gray-600 dark:bg-blue-600/80 text-white shadow-lg scale-105"
                                        : "bg-gray-200 dark:bg-gray-900/80 hover:bg-gray-200 dark:hover:bg-gray-700/70 shadow-md"
                                    }
                                    focus:outline-none focus:ring-opacity-50 cursor-pointer`}
              >
                <span className="font-mono capitalize whitespace-nowrap">
                  {item}
                </span>
                {theme.toLowerCase() === item.toLowerCase() && (
                  <span>
                    <IoCheckmarkOutline
                      strokeWidth={4}
                      className="text-lg p-1 bg-blue-500 rounded-full"
                    />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center space-x-2 mt-3">
          <div className="flex items-center space-x-1">
            <MdOutlineTipsAndUpdates className="text-lg" />
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
                                        ? "bg-gray-600 dark:bg-blue-600/80 text-white shadow-lg scale-105"
                                        : "bg-gray-200 dark:bg-gray-900/80 hover:bg-gray-200 dark:hover:bg-gray-700/70 shadow-md"
                                    }
                                    focus:outline-none focus:ring-opacity-50 cursor-pointer`}
            >
              <span className="font-mono whitespace-nowrap">
                {showTooltips ? "Hide" : "Show"}
              </span>
              {!showTooltips && (
                <span>
                  <IoCheckmarkOutline
                    strokeWidth={4}
                    className="text-lg p-1 bg-blue-500 rounded-full"
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
    <nav className="w-full text-gray-600 dark:text-gray-300 fixed z-40 bg-gradient-to-b from-gray-200 to-gray-100 dark:from-gray-800 dark:to-gray-800 px-3">
      <div className="flex justify-between items-center h-16">
        <Link href="/" className="flex items-center gap-2 text-2xl font-extrabold text-gray-800 dark:text-gray-100">
          <Image src="/logo.svg" alt="" width={32} height={32} className="h-8 w-8 shrink-0 object-contain" priority />
          {process.env.NEXT_PUBLIC_APP_NAME}
        </Link>

        {/* Hamburger menu button (mobile) */}
        <button
          className="md:hidden text-3xl py-5 cursor-pointer"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? `✕` : `☰`}
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
                      ? "bg-white dark:bg-gray-900"
                      : "hover:bg-white dark:hover:bg-gray-900"
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
                className="flex items-center cursor-pointer px-2 py-3 rounded-md text-gray-800 hover:text-black dark:text-white dark:hover:text-gray-200"
              >
                <svg
                  className="w-8 h-8 text-gray-900 dark:text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    fillRule="evenodd"
                    d="M17 10v1.126c.367.095.714.24 1.032.428l.796-.797 1.415 1.415-.797.796c.188.318.333.665.428 1.032H21v2h-1.126c-.095.367-.24.714-.428 1.032l.797.796-1.415 1.415-.796-.797a3.979 3.979 0 0 1-1.032.428V20h-2v-1.126a3.977 3.977 0 0 1-1.032-.428l-.796.797-1.415-1.415.797-.796A3.975 3.975 0 0 1 12.126 16H11v-2h1.126c.095-.367.24-.714.428-1.032l-.797-.796 1.415-1.415.796.797A3.977 3.977 0 0 1 15 11.126V10h2Zm.406 3.578.016.016c.354.358.574.85.578 1.392v.028a2 2 0 0 1-3.409 1.406l-.01-.012a2 2 0 0 1 2.826-2.83ZM5 8a4 4 0 1 1 7.938.703 7.029 7.029 0 0 0-3.235 3.235A4 4 0 0 1 5 8Zm4.29 5H7a4 4 0 0 0-4 4v1a2 2 0 0 0 2 2h6.101A6.979 6.979 0 0 1 9 15c0-.695.101-1.366.29-2Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 mt-0 w-fit rounded-b-md shadow-lg bg-gray-200 dark:bg-gray-800 z-40 overflow-hidden">
                  <div className="text-sm text-gray-800 dark:text-gray-200">
                    {userNavItems.map((item, i) => {
                      if (!item.display) return null;
                      return (
                        <Link
                          key={i}
                          href={item.href}
                          onClick={() => setDropdownOpen(false)}
                          className="flex flex-col px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-900/80"
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
                      className="w-full text-left block px-4 py-2 hover:bg-gray-100 cursor-pointer dark:hover:bg-gray-900/80"
                    >
                      🔒 Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="text-bold cursor-pointer text-center"
            >
              🧑‍💻 Sign In
            </button>
          )}
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {menuOpen && (
        <div className="md:hidden mt-2 flex flex-col space-y-2 bg-gray-100 dark:bg-gray-800 rounded-md text-lg z-30">
          {navItems.map((item, i) => {
            // If nav item is not public (is private) and there is no loggedin user, return nothing
            // Else display it
            if (!item.public && !user?.username) return null;
            return (
              <Link
                key={i}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`px-2 py-2 rounded hover:bg-white dark:hover:bg-gray-900 ${
                  pathname === item.href ? "bg-white dark:bg-gray-900" : ""
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
                    className="px-2 py-2 rounded hover:bg-white dark:hover:bg-gray-900"
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
                className="text-left px-2 py-2 cursor-pointer rounded hover:bg-white dark:hover:bg-gray-900"
              >
                🚪 Logout
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsOpen(true);
                setMenuOpen(false);
              }}
              className="px-2 py-2 text-left cursor-pointer hover:bg-white dark:hover:bg-gray-900"
            >
              🧑‍💻 Sign In
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
