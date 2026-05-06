import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type Attachment = {
  cdnUrl: string;
  filename: string;
  byteSize: number;
  mimeType: string;
  signedId?: string;
  position: number;
};

type ComposeContextValue = {
  attachments: Attachment[];
  setAttachments: (next: Attachment[] | ((prev: Attachment[]) => Attachment[])) => void;
};

const ComposeContext = createContext<ComposeContextValue | null>(null);

export const ComposeProvider = ({ children }: { children: ReactNode }) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const value = useMemo(() => ({ attachments, setAttachments }), [attachments]);
  return <ComposeContext.Provider value={value}>{children}</ComposeContext.Provider>;
};

export const useCompose = (): ComposeContextValue => {
  const ctx = useContext(ComposeContext);
  if (!ctx) throw new Error("useCompose must be used inside ComposeProvider");
  return ctx;
};
