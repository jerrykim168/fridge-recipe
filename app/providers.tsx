"use client";

// Client-side context providers wired once at the app root. Also mounts the
// single global auth dialog so any component can open it via useAuth().

import type { ReactNode } from "react";
import { AuthProvider } from "@/context/AuthContext";
import { SavedRecipesProvider } from "@/context/SavedRecipesContext";
import AuthDialog from "@/components/AuthDialog";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <SavedRecipesProvider>
        {children}
        <AuthDialog />
      </SavedRecipesProvider>
    </AuthProvider>
  );
}
