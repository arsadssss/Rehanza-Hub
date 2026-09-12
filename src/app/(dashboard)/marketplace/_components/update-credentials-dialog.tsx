"use client";

/**
 * Update Credentials Dialog
 * Allows the user to securely store Meesho login credentials for auto re-authentication.
 *
 * SECURITY:
 * - Password field is type="password" — never displayed or prefilled.
 * - Credentials are submitted to an authenticated server endpoint only.
 * - Credentials are NEVER stored in localStorage, sessionStorage, or URL params.
 * - React state holds credentials only for the duration of the open form.
 */

import React, { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { ShieldCheck, KeyRound, Mail, Loader2, AlertTriangle } from "lucide-react";

interface UpdateCredentialsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountName: string;
  onSuccess?: () => void;
}

export function UpdateCredentialsDialog({
  open,
  onOpenChange,
  accountId,
  accountName,
  onSuccess,
}: UpdateCredentialsDialogProps) {
  const { toast } = useToast();
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    // Clear sensitive state on close
    setLoginIdentifier("");
    setPassword("");
    setError(null);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!loginIdentifier.trim()) {
        setError("Email or phone number is required.");
        return;
      }
      if (!password || password.length < 4) {
        setError("Password must be at least 4 characters.");
        return;
      }

      setSaving(true);
      try {
        const res = await apiFetch("/api/marketplace/meesho/credentials", {
          method: "POST",
          body: JSON.stringify({
            accountId,
            loginIdentifier: loginIdentifier.trim(),
            password,
          }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to save credentials.");
        }

        // Clear sensitive form state immediately after success
        setLoginIdentifier("");
        setPassword("");

        toast({
          title: "Credentials Saved",
          description:
            "Your Meesho login credentials are now encrypted and stored. Auto re-authentication is enabled.",
        });

        onSuccess?.();
        handleClose();
      } catch (err: any) {
        setError(err.message || "Failed to save credentials. Please try again.");
      } finally {
        setSaving(false);
      }
    },
    [accountId, loginIdentifier, password, toast, handleClose, onSuccess]
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Update Meesho Credentials
          </DialogTitle>
          <DialogDescription>
            Store encrypted credentials for{" "}
            <span className="font-medium text-foreground">{accountName}</span>.
            Rehanza will use these to automatically reconnect when your session expires.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <Alert className="bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
            <ShieldCheck className="w-4 h-4" />
            <AlertDescription className="text-xs">
              Credentials are encrypted with AES-256-GCM before storage.
              Your password is never stored in plaintext or visible in the UI.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="loginIdentifier" className="flex items-center gap-1.5 text-sm">
              <Mail className="w-3.5 h-3.5 text-muted-foreground" />
              Email or Phone Number
            </Label>
            <Input
              id="loginIdentifier"
              type="text"
              autoComplete="email"
              placeholder="your@email.com or +91XXXXXXXXXX"
              value={loginIdentifier}
              onChange={(e) => setLoginIdentifier(e.target.value)}
              disabled={saving}
              required
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="credPassword" className="flex items-center gap-1.5 text-sm">
              <KeyRound className="w-3.5 h-3.5 text-muted-foreground" />
              Meesho Password
            </Label>
            <Input
              id="credPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Your Meesho account password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={saving}
              required
              className="text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Never shown after saving. Current password is not displayed.
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={saving}
              className="text-sm"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !loginIdentifier.trim() || !password}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Save Encrypted
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
