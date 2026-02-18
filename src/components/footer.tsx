import React from "react";

const Footer = () => {
  return (
    <footer className="flex flex-wrap items-center justify-center gap-2 p-4 border-t border-neutral-200 bg-white dark:bg-neutral-900 dark:border-neutral-800 text-sm text-neutral-700 dark:text-neutral-400/80">
      <span className="inline-flex items-center gap-1.5">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center [&>svg]:h-full [&>svg]:w-full" aria-hidden>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor">
            <path d="M8 6h18v3H8V6zm0 6h14v3H8v-3zm0 9h18v3H8v-3zM8 6v20h3V6H8z"/>
          </svg>
        </span>
        © {new Date().getFullYear()} {process.env.APP_NAME}. All rights
        reserved.
      </span>
    </footer>
  );
};

export default Footer;
