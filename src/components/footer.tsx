import React from "react";

const Footer = () => {
  return (
    <footer className="flex flex-wrap items-center justify-center gap-2 p-4 border-t border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 text-sm text-gray-700 dark:text-gray-400/80">
      <span>
        © {new Date().getFullYear()} {process.env.APP_NAME}. All rights
        reserved.
      </span>
    </footer>
  );
};

export default Footer;
