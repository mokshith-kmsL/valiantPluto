"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// Demo credentials stored locally — no backend auth needed for the demo
const DEMO_USERS = [
  { email: "manager@stocksense.com",   password: "demo1234", name: "Inventory Manager",  role: "manager" },
  { email: "staff@stocksense.com",     password: "demo1234", name: "Warehouse Staff",    role: "staff" },
];

export default function LoginPage() {
  const router   = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    await new Promise(r => setTimeout(r, 600)); // slight delay for feel

    const user = DEMO_USERS.find(
      u => u.email === email.toLowerCase().trim() && u.password === password
    );

    if (!user) {
      setError("Invalid email or password.");
      setLoading(false);
      return;
    }

    // Store session in localStorage
    localStorage.setItem("ss_user", JSON.stringify({
      name:  user.name,
      email: user.email,
      role:  user.role,
    }));

    router.push("/");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="bg-blue-600 text-white p-2 rounded-lg">
            <Package className="h-6 w-6" />
          </div>
          <span className="text-2xl font-bold text-slate-900">StockSense</span>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <h1 className="text-xl font-semibold text-slate-900">Sign in to your account</h1>
            <p className="text-sm text-slate-500">Manage your inventory operations</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="flex flex-col gap-4">

              {error && (
                <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPw ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="mt-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Signing in…</>
                  : "Sign in"
                }
              </Button>

            </form>

            {/* Demo hint */}
            <div className="mt-5 rounded-md bg-slate-50 border border-slate-200 p-3 text-xs text-slate-500">
              <p className="font-medium text-slate-600 mb-1">Demo credentials</p>
              <p>manager@stocksense.com / demo1234</p>
              <p>staff@stocksense.com / demo1234</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
