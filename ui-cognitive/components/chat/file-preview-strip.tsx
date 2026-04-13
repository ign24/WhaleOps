/* eslint-disable @next/next/no-img-element */
"use client";

import { Paperclip, X } from "lucide-react";

type FilePreviewStripProps = {
  fileName: string;
  fileType: "code" | "image";
  fileSizeLabel: string;
  previewSrc?: string;
  onRemove: () => void;
};

const ImageThumb = ({ src, alt }: { src: string; alt: string }) => (
  <img src={src} alt={alt} className="h-8 w-8 rounded object-cover" />
);

export const FilePreviewStrip = ({
  fileName,
  fileType,
  fileSizeLabel,
  previewSrc,
  onRemove,
}: FilePreviewStripProps) => {
  return (
    <div className="neu-raised mb-2 flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs">
      {fileType === "image" && previewSrc ? (
        <ImageThumb src={previewSrc} alt={fileName} />
      ) : (
        <Paperclip size={14} className="shrink-0 text-muted" />
      )}
      <span className="min-w-0 flex-1 truncate font-medium">{fileName}</span>
      <span className="text-muted">{fileSizeLabel}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Quitar archivo adjunto"
        className="ml-1 rounded p-0.5 text-muted hover:text-[var(--error)]"
      >
        <X size={13} />
      </button>
    </div>
  );
};
