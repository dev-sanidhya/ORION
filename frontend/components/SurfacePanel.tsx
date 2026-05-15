"use client";

import clsx from "clsx";
import { ReactNode } from "react";

interface SurfacePanelProps {
  children: ReactNode;
  className?: string;
  strong?: boolean;
}

export default function SurfacePanel({ children, className, strong = false }: SurfacePanelProps) {
  return (
    <div
      className={clsx(
        strong ? "orion-panel-strong" : "orion-panel",
        "rounded-[28px]",
        className,
      )}
    >
      {children}
    </div>
  );
}
