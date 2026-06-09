import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, Trash2, FileText, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import { cn } from "@/lib/utils";

const BUCKET = "attachments";
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED = "application/pdf,image/jpeg,image/png,image/webp";

export type AttachmentValue = {
  path: string | null; // storage path
};

function isImagePath(p: string) {
  return /\.(jpe?g|png|webp|gif)$/i.test(p);
}

async function getSignedUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export function AttachmentField({
  companyId,
  recordId,
  value,
  onChange,
}: {
  companyId: string | null | undefined;
  recordId: string;
  value: string | null;
  onChange: (path: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (value) getSignedUrl(value).then(setPreviewUrl);
    else setPreviewUrl(null);
  }, [value]);


  const handleFile = async (file: File) => {
    if (!companyId) {
      toast.error("Sem empresa");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("Arquivo maior que 10MB");
      return;
    }
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${companyId}/${recordId}/${Date.now()}_${safeName}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      onChange(path);
      const url = await getSignedUrl(path);
      setPreviewUrl(url);
      toast.success("Comprovante anexado");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async () => {
    if (!value) return;
    if (!confirm("Remover o comprovante?")) return;
    try {
      await supabase.storage.from(BUCKET).remove([value]);
      onChange(null);
      setPreviewUrl(null);
      toast.success("Comprovante removido");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const open = async () => {
    if (!value) return;
    const url = previewUrl ?? (await getSignedUrl(value));
    if (url) window.open(url, "_blank");
  };

  if (value) {
    const isImg = isImagePath(value);
    const name = value.split("/").pop() ?? "comprovante";
    return (
      <div className="flex items-start gap-2 p-2 rounded-md border bg-muted/20">
        {isImg && previewUrl ? (
          <button type="button" onClick={open}>
            <img src={previewUrl} alt="" className="h-20 w-20 object-cover rounded" />
          </button>
        ) : (
          <div className="h-20 w-20 rounded bg-muted flex items-center justify-center">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs truncate">{name}</div>
          <div className="flex gap-1 mt-2">
            <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={open}>
              <ExternalLink className="h-3 w-3 mr-1" /> Abrir
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-rose-600" onClick={remove}>
              <Trash2 className="h-3 w-3 mr-1" /> Remover
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="w-full"
      >
        {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Paperclip className="h-4 w-4 mr-1" />}
        {uploading ? "Enviando..." : "Anexar comprovante"}
      </Button>
      <div className="text-[10px] text-muted-foreground mt-1">PDF, JPG, PNG, WEBP — máx 10MB</div>
    </div>
  );
}

export function AttachmentBadge({ path, onClick }: { path: string | null; onClick?: () => void }) {
  if (!path) {
    return <span className="text-[10px] text-muted-foreground">Sem comprovante</span>;
  }
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        const url = await getSignedUrl(path);
        if (url) window.open(url, "_blank");
        onClick?.();
      }}
      title="Abrir comprovante"
      className={cn("text-emerald-600 hover:text-emerald-700")}
    >
      <Paperclip className="h-3.5 w-3.5" />
    </button>
  );
}
