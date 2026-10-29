import { useEffect, useRef, type ReactNode } from "react";
import { sources } from "./content";

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    arrow: (
      <>
        <path d="M5 12h14m-6-6 6 6-6 6" />
      </>
    ),
    book: (
      <>
        <path d="M12 6c-3-3-7-3-9-2v15c3-1 6-1 9 2 3-3 6-3 9-2V4c-2-1-6-1-9 2Zm0 0v15" />
      </>
    ),
    comment: (
      <>
        <path d="M21 11a8 8 0 0 1-8 8H8l-5 3V7a4 4 0 0 1 4-4h6a8 8 0 0 1 8 8Z" />
        <path d="M7 8h9M7 12h6" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    branch: (
      <>
        <path d="M7 3v13a5 5 0 0 0 5 5h5M7 9h6a4 4 0 0 0 4-4V3" />
        <path d="m14 6 3-3 3 3m-6 12 3 3 3-3" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.book}
    </svg>
  );
}

export function MarkedText({
  text,
  highlight = true,
}: {
  text: string;
  highlight?: boolean;
}) {
  return (
    <>
      {text
        .split(/(\[\[.*?\]\])/g)
        .map((part, index) =>
          part.startsWith("[[") ? (
            highlight ? (
              <mark key={index}>{part.slice(2, -2)}</mark>
            ) : (
              <span key={index}>{part.slice(2, -2)}</span>
            )
          ) : (
            part
          ),
        )}
    </>
  );
}

export function SourceList({ ids }: { ids: string[] }) {
  return (
    <div className="sources">
      {ids.map((id) => {
        const source = sources.find((item) => item.id === id);
        return source ? (
          <div className="source" key={id}>
            {source.href ? (
              <a href={source.href} target="_blank" rel="noreferrer">
                {source.label} <span aria-hidden="true">↗</span>
              </a>
            ) : (
              <strong>{source.label}</strong>
            )}
            <p>{source.detail}</p>
          </div>
        ) : null;
      })}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      dialog.close();
      opener?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal-wide" : ""}`}
      aria-labelledby="modal-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-top">
        <h2 id="modal-title">{title}</h2>
        <button className="icon-button" aria-label="Cerrar" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      <div className="modal-content">{children}</div>
    </dialog>
  );
}
