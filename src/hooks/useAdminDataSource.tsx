import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type DataSource = "mock" | "real";

interface AdminDataSourceCtx {
  source: DataSource;
  setSource: (s: DataSource) => void;
  isMock: boolean;
}

const Ctx = createContext<AdminDataSourceCtx | undefined>(undefined);

const STORAGE_KEY = "starry-tales-admin-data-source";

export const AdminDataSourceProvider = ({ children }: { children: ReactNode }) => {
  const [source, setSourceState] = useState<DataSource>(() => {
    if (typeof window === "undefined") return "real";
    const stored = localStorage.getItem(STORAGE_KEY) as DataSource | null;
    return stored ?? "real";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, source);
    }
  }, [source]);

  return (
    <Ctx.Provider value={{ source, setSource: setSourceState, isMock: source === "mock" }}>
      {children}
    </Ctx.Provider>
  );
};

export function useAdminDataSource() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdminDataSource must be used within AdminDataSourceProvider");
  return ctx;
}
