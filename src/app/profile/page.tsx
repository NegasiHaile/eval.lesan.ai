"use client";

import { useState } from "react";
import Container from "@/components/utils/Container";
import { useUser } from "@/context/UserContext";
import { UserTypes } from "@/types/user";
import {
  Mail,
  Shield,
  User,
  BadgeCheck,
  Building2,
  AtSign,
} from "lucide-react";

function getInitials(user: UserTypes): string {
  if (user.fullName?.trim()) {
    const parts = user.fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  const email = (user.email ?? user.username ?? "").trim();
  if (email) {
    const local = email.split("@")[0];
    return local.slice(0, 2).toUpperCase();
  }
  return "?";
}

function ProfileField({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-neutral-200 dark:border-neutral-700 last:border-0 transition-colors duration-200">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 transition-colors duration-200">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          {label}
        </p>
        <p className="mt-0.5 text-sm font-mono text-neutral-900 dark:text-neutral-100 break-words">
          {value ?? "—"}
        </p>
      </div>
    </div>
  );
}

const Profile = () => {
  const { user } = useUser();
  const [imageError, setImageError] = useState(false);

  if (!user) {
    return (
      <Container>
        <div className="w-full max-w-2xl mx-auto py-12 text-center text-neutral-600 dark:text-neutral-400">
          <p>You are not signed in. Sign in to view your profile.</p>
        </div>
      </Container>
    );
  }

  const initials = getInitials(user);
  const showImage = user.image && !imageError;

  return (
    <Container>
      <div className="w-full max-w-2xl mx-auto py-6 md:py-10">
        {/* Profile header */}
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden transition-shadow duration-200 hover:shadow-md dark:hover:shadow-neutral-900/50">
          <div className="h-24 md:h-28 bg-gradient-to-r from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-700 transition-opacity duration-200" />
          <div className="px-6 pb-6 md:px-8 md:pb-8 -mt-12 md:-mt-14 relative">
            <div className="flex flex-col sm:flex-row sm:items-end sm:gap-6">
              <div className="relative shrink-0">
                {showImage ? (
                  <img
                    src={user.image}
                    alt=""
                    className="h-24 w-24 md:h-28 md:w-28 rounded-xl border-4 border-white dark:border-neutral-900 object-cover bg-neutral-200 dark:bg-neutral-700 transition-all duration-200"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div
                    className="flex h-24 w-24 md:h-28 md:w-28 items-center justify-center rounded-xl border-4 border-white dark:border-neutral-900 bg-neutral-300 dark:bg-neutral-600 text-2xl md:text-3xl font-semibold text-neutral-700 dark:text-neutral-200 transition-colors duration-200"
                    aria-hidden
                  >
                    {initials}
                  </div>
                )}
              </div>
              <div className="mt-4 sm:mt-0 sm:pb-1 flex-1 min-w-0">
                <h1 className="text-xl md:text-2xl font-bold text-neutral-900 dark:text-white truncate transition-colors duration-200">
                  {user.fullName || "Profile"}
                </h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 font-mono truncate mt-0.5 transition-colors duration-200">
                  {user.email ?? user.username}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-300 capitalize transition-colors duration-200">
                    <Shield className="size-3.5" />
                    {user.role}
                  </span>
                  {user.active !== undefined && (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-200 ${
                        user.active
                          ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                          : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                      }`}
                    >
                      <BadgeCheck className="size-3.5" />
                      {user.active ? "Active" : "Inactive"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Details */}
        <section className="mt-8 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden transition-shadow duration-200 hover:shadow-md dark:hover:shadow-neutral-900/50">
          <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 transition-colors duration-200">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 flex items-center gap-2">
              <User className="size-4" />
              Profile
            </h2>
          </div>
          <div className="px-6 py-2">
            <ProfileField
              icon={User}
              label="Full name"
              value={user.fullName}
            />
            <ProfileField
              icon={Mail}
              label="Email"
              value={user.email ?? user.username}
            />
            {(user.institution ?? "").trim() && (
              <ProfileField
                icon={Building2}
                label="Institution"
                value={user.institution}
              />
            )}
            <ProfileField
              icon={AtSign}
              label="Username / login"
              value={user.username}
            />
            <ProfileField
              icon={Shield}
              label="Role"
              value={user.role}
            />
            {user.active !== undefined && (
              <ProfileField
                icon={BadgeCheck}
                label="Account status"
                value={user.active ? "Active" : "Inactive"}
              />
            )}
            {user.id !== undefined && user.id !== "" && (
              <ProfileField
                icon={BadgeCheck}
                label="User ID"
                value={String(user.id)}
              />
            )}
          </div>
        </section>
      </div>
    </Container>
  );
};

export default Profile;
