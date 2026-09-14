"use client";
import type { ReactNode, ButtonHTMLAttributes } from "react";
import { X } from "lucide-react";
export function IconButton({
  children,
  label,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
}) {
  return (
    <button className="icon-button" aria-label={label} title={label} {...props}>
      {children}
    </button>
  );
}
export function Modal({
  title,
  children,
  close,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
        }}
      >
        <header>
          <h2>{title}</h2>
          <IconButton label="关闭面板" onClick={close}>
            <X size={18} />
          </IconButton>
        </header>
        {children}
      </section>
    </div>
  );
}
export function Wave({ seed = 1 }: { seed?: number }) {
  return (
    <span className="wave" aria-hidden="true">
      {Array.from({ length: 60 }, (_, i) => (
        <i key={i} style={{ height: `${18 + ((i * 17 + seed * 31) % 71)}%` }} />
      ))}
    </span>
  );
}
