// context/UserContext.tsx
"use client";
import { UserTypes } from "@/types/user";
import { useState, useContext, ReactNode, useEffect } from "react";
import { Dispatch, SetStateAction, createContext } from "react";

type UserContextType = {
  user: UserTypes | null;
  setUser: Dispatch<SetStateAction<UserTypes | null>>;
};
const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserTypes | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser?.username) {
          // HERE PLEASE CHECK IF THE USER NAME IN LOCALSTORAGE IS REAL USER
          // MAY BE BETTER TO USER JWT
          setUser(parsedUser);
        }
      } catch (e) {
        console.error("Failed to parse user from localStorage", e);
      }
    }
    setLoading(false);
  }, []);

  if (loading) return <></>;

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used within UserProvider");
  return context;
}
