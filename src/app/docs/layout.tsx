import { ReactNode } from "react";
import DocsShell from "./DocsShell";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return <DocsShell>{children}</DocsShell>;
}
