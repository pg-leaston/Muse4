"use client";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AuthForm } from "@/components/auth/auth-form";

type SignInDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  /** Shown under the form; closes the dialog when clicked. */
  dismissLabel?: string;
  onDismiss?: () => void;
};

export function SignInDialog({
  open,
  onOpenChange,
  onSuccess,
  dismissLabel,
  onDismiss,
}: SignInDialogProps) {
  function handleDismiss() {
    onDismiss?.();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden border-white/15 bg-[#120022] p-0 text-white sm:max-w-md">
        <DialogHeader className="flex-col items-start justify-start gap-2 border-white/10 px-6 py-5 sm:px-7">
          <DialogTitle className="text-white">Sign in to Muse</DialogTitle>
          <DialogDescription className="max-w-sm text-left text-sm leading-relaxed text-white/60">
            Access your uploaded library on this device.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="px-6 pb-6 pt-1 sm:px-7 sm:pb-7">
          <AuthForm
            compact
            onSuccess={() => {
              onSuccess?.();
              onOpenChange(false);
            }}
          />
          {dismissLabel ?
            <button
              type="button"
              className="mt-6 w-full text-center text-sm text-white/55 underline-offset-2 hover:text-white/80 hover:underline"
              onClick={handleDismiss}
            >
              {dismissLabel}
            </button>
          : null}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
