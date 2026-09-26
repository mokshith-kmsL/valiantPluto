"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Package, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type Step = "email" | "otp" | "done";

export default function ForgotPasswordPage() {
  const router  = useRouter();
  const [step,  setStep]  = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp,   setOtp]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setLoading(false);
    setStep("otp"); // pretend OTP was sent
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (otp.length < 4) { setError("Enter the OTP sent to your email."); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setLoading(false);
    setStep("done");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="bg-blue-600 text-white p-2 rounded-lg">
            <Package className="h-6 w-6" />
          </div>
          <span className="text-2xl font-bold text-slate-900">StockSense</span>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <Link href="/login" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2">
              <ArrowLeft className="h-3 w-3" /> Back to login
            </Link>
            <h1 className="text-xl font-semibold text-slate-900">
              {step === "done" ? "Password reset" : "Reset your password"}
            </h1>
          </CardHeader>
          <CardContent>
            {step === "email" && (
              <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
                <p className="text-sm text-slate-500">Enter your email and we'll send you a one-time code.</p>
                {error && <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">Email address</Label>
                  <Input id="email" type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending…</> : "Send OTP"}
                </Button>
              </form>
            )}

            {step === "otp" && (
              <form onSubmit={handleOtpSubmit} className="flex flex-col gap-4">
                <p className="text-sm text-slate-500">Enter the 6-digit code sent to <strong>{email}</strong>.</p>
                {error && <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="otp">One-time code</Label>
                  <Input id="otp" type="text" placeholder="123456" maxLength={6} value={otp} onChange={e => setOtp(e.target.value)} required />
                </div>
                <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verifying…</> : "Verify OTP"}
                </Button>
              </form>
            )}

            {step === "done" && (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                <p className="text-slate-700 font-medium">Password reset successful.</p>
                <p className="text-sm text-slate-500">You can now sign in with your new password.</p>
                <Button onClick={() => router.push("/login")} className="bg-blue-600 hover:bg-blue-700 text-white w-full">
                  Back to login
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
