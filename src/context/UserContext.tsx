// context/UserContext.tsx
"use client";
import { UserTypes } from "@/types/user";
import { useState, useContext, ReactNode, useEffect } from "react";
import { Dispatch, SetStateAction, createContext } from "react";
import { authClient } from "@/lib/auth-client";

type UserContextType = {
  user: UserTypes | null;
  setUser: Dispatch<SetStateAction<UserTypes | null>>;
  isPending: boolean;
  isInitialSessionPending: boolean;
};
const UserContext = createContext<UserContextType | undefined>(undefined);

function sessionToUser(session: {
  user: { email: string; name?: string; role?: string; image?: string | null; active?: boolean };
} | null): UserTypes | null {
  if (!session?.user) return null;
  const u = session.user;
  return {
    username: u.email,
    role: (u as { role?: string }).role ?? "user",
    fullName: u.name,
    email: u.email,
    active: (u as { active?: boolean }).active,
    image: (u as { image?: string | null }).image ?? undefined,
  };
}

export function UserProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const [overrideUser, setOverrideUser] = useState<UserTypes | null | undefined>(undefined);
  const [hasResolvedInitialSession, setHasResolvedInitialSession] = useState(false);
  const sessionUser = sessionToUser(session);

  const user = overrideUser !== undefined ? overrideUser : sessionUser;
  const isInitialSessionPending = !hasResolvedInitialSession && isPending;

  const setUser: Dispatch<SetStateAction<UserTypes | null>> = (value) => {
    setOverrideUser(typeof value === "function" ? value(user ?? null) : value);
  };

  useEffect(() => {
    if (!isPending) setHasResolvedInitialSession(true);
  }, [isPending]);

  useEffect(() => {
    if (user) {
      localStorage.setItem("user", JSON.stringify({ username: user.username, role: user.role }));
    } else {
      localStorage.removeItem("user");
    }
  }, [user]);

  return (
    <UserContext.Provider
      value={{ user: user ?? null, setUser, isPending, isInitialSessionPending }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used within UserProvider");
  return context;
}
