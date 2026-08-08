"use client";

import * as React from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FileUploaderProps = {
  label?: string;
  accept?: string;
  value?: string;
  onUrlChange?: (url: string) => void;
  onFileText?: (text: string, file: File) => void | Promise<void>;
  className?: string;
  disabled?: boolean;
};

/** URL + optional local file picker for attachments when UploadThing token is unset. */
export function FileUploader({
  label = "Attachment",
  accept,
  value,
  onUrlChange,
  onFileText,
  className,
  disabled,
}: FileUploaderProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="https://… or paste file URL"
          value={value ?? ""}
          onChange={(e) => onUrlChange?.(e.target.value)}
          disabled={disabled}
          className="min-w-[200px] flex-1"
        />
        {onFileText ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              className="hidden"
              disabled={disabled}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                await onFileText(text, file);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="size-4" />
              Browse
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
