"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import {
  ExternalLink,
  Loader2,
  ShieldCheck,
  Store,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountCreated: (account: { accountId: string; accountName: string }) => void;
}

export function AddAccountDialog({
  open,
  onOpenChange,
  onAccountCreated,
}: AddAccountDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdAccountId, setCreatedAccountId] = useState<string | null>(null);
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up timer on unmount or dialog close
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      setName("");
      setSubmitting(false);
      setCreatedAccountId(null);
      setLoginUrl(null);
      setPolling(false);
    }
  }, [open]);

  const handleStartConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      toast({
        variant: "destructive",
        title: "Account Name Required",
        description: "Please provide a name for this seller account.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch("/api/marketplace/meesho/accounts", {
        method: "POST",
        body: JSON.stringify({ name: cleanName }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create account.");
      }

      const accId = data.account.id;
      setCreatedAccountId(accId);

      const url = data.login?.loginUrl || "https://supplier.meesho.com/panel/v3/new/login";
      setLoginUrl(url);

      // Open in external window
      window.open(url, "_blank", "width=1000,height=750,noopener,noreferrer");

      // Begin polling connection status for this specific account
      setPolling(true);
      pollTimerRef.current = setInterval(async () => {
        try {
          const statusRes = await apiFetch(`/api/marketplace/meesho/status?accountId=${accId}`);
          const statusData = await statusRes.json();

          if (statusRes.ok && statusData.success && statusData.data?.status === "connected") {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            setPolling(false);
            toast({
              title: "Meesho Account Connected!",
              description: `Successfully connected ${cleanName} to Meesho Supplier Hub.`,
            });
            onAccountCreated({
              accountId: accId,
              accountName: cleanName,
            });
            onOpenChange(false);
          }
        } catch (err) {
          // Continue polling
        }
      }, 3000);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description: err.message || "Failed to initiate account connection.",
      });
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400">
              <Store className="w-5 h-5" />
            </div>
            <DialogTitle>Add Meesho Account</DialogTitle>
          </div>
          <DialogDescription>
            Connect an additional Meesho supplier panel account. Each account runs with completely isolated credentials, orders, and payments.
          </DialogDescription>
        </DialogHeader>

        {!polling ? (
          <form onSubmit={handleStartConnection} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="account-name">Account / Store Name</Label>
              <Input
                id="account-name"
                placeholder="e.g. Cosmetics, Store B, Apparel"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Give this account a distinctive label to identify it inside Rehanza-Hub.
              </p>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Zero Password Storage
              </div>
              <p>
                Rehanza-Hub never asks for or stores your Meesho password. You will authenticate directly on the official Meesho Supplier Panel in a secure window.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || !name.trim()}
                className="bg-pink-600 hover:bg-pink-700 text-white"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Initiating...
                  </>
                ) : (
                  "Proceed to Meesho Login"
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-5 py-4">
            <div className="flex flex-col items-center justify-center text-center space-y-3 p-4 rounded-lg bg-pink-500/5 border border-pink-500/20">
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-pink-500/10 flex items-center justify-center text-pink-600 animate-pulse">
                  <Store className="w-6 h-6" />
                </div>
                <div className="absolute -bottom-1 -right-1">
                  <Loader2 className="w-5 h-5 text-pink-600 animate-spin" />
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-sm">Authenticating with Meesho</h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Complete your login in the popup window. Rehanza-Hub is waiting to securely detect your session.
                </p>
              </div>
            </div>

            {loginUrl && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(loginUrl, "_blank", "width=1000,height=750")}
                  className="gap-2 text-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Re-open Meesho Login Window
                </Button>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (pollTimerRef.current) clearInterval(pollTimerRef.current);
                  setPolling(false);
                  onOpenChange(false);
                }}
              >
                Cancel
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

