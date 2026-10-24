"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Pedigree } from "@/lib/genogramma/model/types";
import { ExportDialog } from "./export-dialog";

export function ExportButton({
  pedigree,
  doctor,
  label = "Esporta",
  variant = "ghost",
  size = "sm",
}: {
  pedigree: Pedigree;
  doctor: boolean;
  label?: string;
  variant?: "ghost" | "secondary" | "primary";
  size?: "sm" | "md" | "lg";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}>
        <Download className="h-4 w-4" aria-hidden="true" /> {label}
      </Button>
      {open ? <ExportDialog pedigree={pedigree} doctor={doctor} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
