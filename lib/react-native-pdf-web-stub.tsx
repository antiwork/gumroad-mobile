import { forwardRef, useImperativeHandle } from "react";

export type TableContent = { title: string; pageIdx: number; children?: TableContent[] };

export type PdfRef = {
  setPage: (page: number) => void;
};

type PdfProps = {
  source: { uri: string };
  style?: React.CSSProperties | Record<string, unknown>;
  onLoadComplete?: (numberOfPages: number, path: string, size: { width: number; height: number }, toc?: TableContent[]) => void;
  onPageChanged?: (page: number, numberOfPages: number) => void;
  onError?: (error: unknown) => void;
};

const Pdf = forwardRef<PdfRef, PdfProps>(({ source, style }, ref) => {
  useImperativeHandle(ref, () => ({ setPage: () => {} }), []);
  return (
    <iframe
      src={source.uri}
      style={{ border: "none", width: "100%", height: "100%", ...(style as React.CSSProperties) }}
      title="PDF"
    />
  );
});

export default Pdf;
