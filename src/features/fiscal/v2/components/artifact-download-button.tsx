import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Eye } from "lucide-react";
import { toast } from "sonner";
import { useFiscalArtifact } from "../hooks/use-fiscal";
import {
  buildDanfeFileName,
  buildXmlFileName,
  downloadFile,
  type XmlNaming,
} from "../lib/xml-file";
import { XmlViewerDialog } from "./xml-viewer-dialog";

interface Props {
  path: string | null | undefined;
  label: string;
  fileName: string;
  disabled?: boolean;
}

/**
 * Botão único de download de artefato fiscal (XML ou DANFE).
 * Gera signed URL de curta duração e força o download com nome amigável —
 * nunca abre o arquivo no navegador.
 */
function ArtifactDownloadButton({ path, label, fileName, disabled }: Props) {
  const artifact = useFiscalArtifact();
  const isDisabled = disabled || !path || artifact.isPending;

  async function handleClick() {
    if (!path) return;
    try {
      const { url } = await artifact.mutateAsync(path);
      await downloadFile(url, fileName);
    } catch {
      toast.error("Não foi possível baixar o arquivo.");
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={handleClick} disabled={isDisabled}>
      <Download className="mr-1.5 h-4 w-4" />
      {label}
    </Button>
  );
}

export function XmlDownloadButton({
  path,
  doc,
}: {
  path: string | null | undefined;
  doc?: XmlNaming;
}) {
  return (
    <ArtifactDownloadButton
      path={path}
      label="Baixar XML"
      fileName={buildXmlFileName(doc ?? {})}
    />
  );
}

export function DanfeDownloadButton({
  path,
  doc,
}: {
  path: string | null | undefined;
  doc?: XmlNaming;
}) {
  return (
    <ArtifactDownloadButton
      path={path}
      label="Baixar DANFE"
      fileName={buildDanfeFileName(doc ?? {})}
    />
  );
}

export function XmlViewButton({
  path,
  doc,
}: {
  path: string | null | undefined;
  doc?: XmlNaming;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={!path}
        onClick={() => setOpen(true)}
      >
        <Eye className="mr-1.5 h-4 w-4" /> Visualizar XML
      </Button>
      <XmlViewerDialog
        open={open}
        onOpenChange={setOpen}
        path={path}
        doc={doc ?? {}}
      />
    </>
  );
}
