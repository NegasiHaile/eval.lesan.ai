"use client";

import { Dispatch, useState, SetStateAction } from "react";
import Modal from "./utils/Modal";
import { UserTypes } from "@/types/user";
import { authClient } from "@/lib/auth-client";
import { FaSpinner } from "react-icons/fa";
import Image from "next/image";

type SocialProvider = "google" | "github" | "huggingface";

const PROVIDERS: {
  id: SocialProvider;
  label: string;
  iconSrc: string;
}[] = [
  { id: "google", label: "Google", iconSrc: "/google-color-icon.svg" },
  { id: "github", label: "GitHub", iconSrc: "/github-icon.svg" },
  { id: "huggingface", label: "Hugging Face", iconSrc: "/huggingface-icon.svg" },
];

type ModalProps = {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  setUser: Dispatch<SetStateAction<UserTypes | null>>;
};

export default function Signup({ isOpen, setIsOpen }: ModalProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleSignIn = async (provider: SocialProvider) => {
    setLoading(provider);
    try {
      await authClient.signIn.social({
        provider,
        callbackURL: "/",
      });
    } catch (err) {
      console.error(`${provider} sign-in error:`, err);
      setLoading(null);
    }
  };

  return (
    <Modal isOpen={isOpen} setIsOpen={()=> {setIsOpen(false); setLoading(null);}}>
      <div className="p-6 rounded w-full md:min-w-lg text-center">
        <h2 className="text-2xl font-semibold mb-2 text-gray-900 dark:text-white">
          Sign in
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
          Use one of the following to continue.
        </p>
        <div className="flex flex-col gap-2">
          {PROVIDERS.map(({ id, label, iconSrc }) => (
            <button
              key={id}
              type="button"
              disabled={!!loading}
              onClick={() => handleSignIn(id)}
              className={`w-full flex items-center justify-center gap-2 rounded-md py-2.5 px-4 text-sm font-medium border border-gray-300 dark:border-gray-600 bg-gray-200/80 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-700 transition ${loading ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
            >
              {loading === id ? (
                <FaSpinner className="shrink-0 size-5 animate-spin" aria-hidden />
              ) : (
                <Image
                  src={iconSrc}
                  alt=""
                  width={20}
                  height={20}
                  className="shrink-0"
                  aria-hidden
                />
              )}
              <span>Sign in with {label}</span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
