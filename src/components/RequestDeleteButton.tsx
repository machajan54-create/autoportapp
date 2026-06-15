import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requestDeletion } from "@/lib/deletion-requests.functions";

type Props = {
  entityType: string;
  entityId: string;
  /** What is being deleted (shown in the dialog). */
  entityLabel?: string;
  /** Optional callback fired after a successful request submission. */
  onRequested?: () => void;
  /** Button visual variant. Defaults to "ghost". */
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  /** Override the button content (icon-only is the default). */
  children?: React.ReactNode;
  className?: string;
  /** Disable the trigger button. */
  disabled?: boolean;
  /** Tooltip / aria-label fallback. */
  title?: string;
};

/**
 * Universal delete control. Instead of deleting directly, it opens a dialog
 * asking the user for a reason and submits a deletion request that a super
 * admin must approve. Use this everywhere a record may need to be removed.
 */
export function RequestDeleteButton({
  entityType,
  entityId,
  entityLabel,
  onRequested,
  variant = "ghost",
  size = "sm",
  children,
  className,
  disabled,
  title = "Požádat o smazání",
}: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const submitFn = useServerFn(requestDeletion);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 3) {
      toast.error("Uveďte důvod (alespoň 3 znaky).");
      return;
    }
    setBusy(true);
    try {
      await submitFn({
        data: { entity_type: entityType, entity_id: entityId, reason: reason.trim() },
      });
      toast.success("Žádost o smazání byla odeslána super adminovi.");
      setOpen(false);
      setReason("");
      onRequested?.();
    } catch (err: any) {
      toast.error(err?.message ?? "Nepodařilo se odeslat žádost.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={disabled}
        title={title}
        aria-label={title}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {children ?? <Trash2 className="h-4 w-4" />}
      </Button>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent
          onClick={(e) => e.stopPropagation()}
          className="sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle>Požádat o smazání</DialogTitle>
            <DialogDescription>
              {entityLabel
                ? `Mazání záznamu: ${entityLabel}.`
                : "Žádost bude předána super adminovi ke schválení."}{" "}
              Schválené žádosti jsou nevratné.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label htmlFor="deletion-reason">Důvod *</Label>
              <Textarea
                id="deletion-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="Stručně vysvětlete, proč má být záznam smazán."
                required
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Zrušit
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Odesílám…" : "Odeslat žádost"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}