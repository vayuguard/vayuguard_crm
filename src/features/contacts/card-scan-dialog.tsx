"use client";

import * as React from "react";
import {
  Camera,
  Check,
  FileUp,
  Loader2,
  RefreshCw,
  ScanLine,
  SwitchCamera,
} from "lucide-react";
import { toast } from "sonner";

import { parseBusinessCard, type ParsedCard } from "@/lib/card-parser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ScannedContact = ParsedCard;

type Stage = "capture" | "scanning" | "review";

const EMPTY_CARD: ParsedCard = {
  name: "",
  designation: "",
  company: "",
  email: "",
  phone: "",
  whatsapp: "",
  website: "",
  linkedinUrl: "",
  twitterUrl: "",
  facebookUrl: "",
  address: "",
  rawText: "",
};

export function CardScanDialog({
  open,
  onOpenChange,
  onConfirm,
  onEditInForm,
  saving = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the user accepts the scanned details — should create the contact. */
  onConfirm: (contact: ScannedContact) => void;
  /** Called when the user wants to tweak the details in the full contact form. */
  onEditInForm: (contact: ScannedContact) => void;
  saving?: boolean;
}) {
  const [stage, setStage] = React.useState<Stage>("capture");
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState(0);
  const [fields, setFields] = React.useState<ParsedCard>(EMPTY_CARD);
  const [cameraOn, setCameraOn] = React.useState(false);
  const [facingMode, setFacingMode] = React.useState<"environment" | "user">(
    "environment",
  );

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const stopCamera = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  const startCamera = React.useCallback(
    async (mode: "environment" | "user") => {
      try {
        stopCamera();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode, width: { ideal: 1920 } },
          audio: false,
        });
        streamRef.current = stream;
        setCameraOn(true);
        // The <video> mounts in the same render pass the state flips, so wait a tick.
        requestAnimationFrame(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            void videoRef.current.play().catch(() => undefined);
          }
        });
      } catch {
        toast.error(
          "Camera unavailable. Grant camera permission or upload a photo instead.",
        );
        setCameraOn(false);
      }
    },
    [stopCamera],
  );

  const reset = React.useCallback(() => {
    stopCamera();
    setStage("capture");
    setImageUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    setProgress(0);
    setFields(EMPTY_CARD);
  }, [stopCamera]);

  // Release the camera whenever the dialog closes or unmounts.
  React.useEffect(() => {
    if (!open) reset();
    return () => stopCamera();
  }, [open, reset, stopCamera]);

  const runOcr = React.useCallback(async (source: string | File) => {
    setStage("scanning");
    setProgress(0);
    try {
      // tesseract.js ships CommonJS, so the interop shape differs per bundler.
      const mod = await import("tesseract.js");
      const recognize = mod.default?.recognize ?? mod.recognize;
      const result = await recognize(source, "eng", {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });
      const text = result.data.text ?? "";
      const parsed = parseBusinessCard(text);
      setFields(parsed);
      setStage("review");
      if (!parsed.name && !parsed.email && !parsed.phone) {
        toast.warning(
          "Could not read much from that image. Try better lighting or fill the fields manually.",
        );
      } else {
        toast.success("Card scanned — review the details below.");
      }
    } catch {
      toast.error("Scan failed. Please try again with a clearer image.");
      setStage("capture");
    }
  }, []);

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }
    stopCamera();
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    void runOcr(file);
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      toast.error("Camera is still starting — try again in a moment.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/png");
    stopCamera();
    setImageUrl(dataUrl);
    void runOcr(dataUrl);
  }

  function updateField(key: keyof ParsedCard, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  const canSave = Boolean(fields.name.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" showCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="size-4" />
            Scan business card
          </DialogTitle>
          <DialogDescription>
            Capture a card with your camera or upload a photo. Details are read
            on your device and filled in automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          {stage === "capture" ? (
            <div className="space-y-3">
              {cameraOn ? (
                <div className="overflow-hidden rounded-lg border border-border bg-black">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="aspect-video w-full object-cover"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center transition-colors hover:bg-muted/60"
                >
                  <ScanLine className="size-8 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    Start the camera or upload a card photo
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PNG or JPG. A flat, well-lit card scans best.
                  </p>
                </button>
              )}

              <div className="flex flex-wrap gap-2">
                {cameraOn ? (
                  <>
                    <Button type="button" onClick={capturePhoto}>
                      <Camera className="size-4" />
                      Capture
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const next =
                          facingMode === "environment" ? "user" : "environment";
                        setFacingMode(next);
                        void startCamera(next);
                      }}
                    >
                      <SwitchCamera className="size-4" />
                      Flip
                    </Button>
                    <Button type="button" variant="ghost" onClick={stopCamera}>
                      Stop camera
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    onClick={() => void startCamera(facingMode)}
                  >
                    <Camera className="size-4" />
                    Use camera
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileUp className="size-4" />
                  Upload image
                </Button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  handleFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
          ) : null}

          {stage === "scanning" ? (
            <div className="space-y-3">
              {imageUrl ? (
                // Blob/data URL preview — next/image cannot optimize these.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt="Card being scanned"
                  className="max-h-56 w-full rounded-lg border border-border object-contain"
                />
              ) : null}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Reading card… {progress}%
                </div>
                <Progress value={progress} />
              </div>
            </div>
          ) : null}

          {stage === "review" ? (
            <div className="space-y-4">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt="Scanned card"
                  className="max-h-40 w-full rounded-lg border border-border object-contain"
                />
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <ScanField
                  label="Name *"
                  value={fields.name}
                  onChange={(v) => updateField("name", v)}
                />
                <ScanField
                  label="Designation"
                  value={fields.designation}
                  onChange={(v) => updateField("designation", v)}
                />
                <ScanField
                  label="Company"
                  value={fields.company}
                  onChange={(v) => updateField("company", v)}
                />
                <ScanField
                  label="Email"
                  value={fields.email}
                  onChange={(v) => updateField("email", v)}
                />
                <ScanField
                  label="Phone"
                  value={fields.phone}
                  onChange={(v) => updateField("phone", v)}
                />
                <ScanField
                  label="WhatsApp"
                  value={fields.whatsapp}
                  onChange={(v) => updateField("whatsapp", v)}
                />
                <ScanField
                  label="Website"
                  value={fields.website}
                  onChange={(v) => updateField("website", v)}
                />
                <ScanField
                  label="LinkedIn"
                  value={fields.linkedinUrl}
                  onChange={(v) => updateField("linkedinUrl", v)}
                />
              </div>
              <ScanField
                label="Address"
                value={fields.address}
                onChange={(v) => updateField("address", v)}
              />

              {!canSave ? (
                <p className="text-xs text-destructive">
                  A name is required before the contact can be added.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {stage === "review" ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
            <Button type="button" variant="ghost" onClick={reset}>
              <RefreshCw className="size-4" />
              Scan again
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onEditInForm(fields)}
            >
              Edit in full form
            </Button>
            <Button
              type="button"
              disabled={!canSave || saving}
              onClick={() => onConfirm(fields)}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              {saving ? "Adding…" : "Add contact"}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ScanField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
