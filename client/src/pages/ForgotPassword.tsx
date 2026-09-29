import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ArrowLeft, Mail, CheckCircle2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetMutation = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => {
      setSent(true);
      setError(null);
    },
    onError: (err) => {
      setError(err.message || "Ocorreu um erro. Tente novamente.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Informe seu e-mail.");
      return;
    }
    // A URL de redefinição é montada no servidor, a partir de APP_PUBLIC_URL.
    // O cliente não envia origem: valor vindo do navegador não pode compor um
    // link que carrega token de credencial.
    resetMutation.mutate({ email: email.trim() });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <img
          src="/logo-defocusapp.webp"
          alt="DefocusApp"
          className="h-24 w-auto object-contain mb-2"
        />
        <p className="text-sm text-muted-foreground mt-1">Análise de Curvas de Defoque</p>
      </div>

      <Card className="w-full max-w-md bg-slate-800/60 border-slate-700 shadow-2xl">
        {!sent ? (
          <>
            <CardHeader className="pb-4">
              <CardTitle className="text-xl text-foreground">Esqueceu sua senha?</CardTitle>
              <CardDescription className="text-muted-foreground">
                Informe seu e-mail e enviaremos um link para criar uma nova senha.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive" className="bg-red-950/50 border-red-800 text-red-300">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 bg-slate-900/60 border-slate-600 text-foreground placeholder:text-muted-foreground focus:border-primary"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-11"
                  disabled={resetMutation.isPending}
                >
                  {resetMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Enviando...
                    </span>
                  ) : (
                    "Enviar link de redefinição"
                  )}
                </Button>

                <div className="text-center pt-2">
                  <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Voltar para o login
                  </Link>
                </div>
              </form>
            </CardContent>
          </>
        ) : (
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-green-950/50 border border-green-800 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-2">E-mail enviado!</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Se o endereço <strong className="text-slate-300">{email}</strong> estiver cadastrado,
                  você receberá um e-mail com o link para redefinir sua senha em breve.
                </p>
                <p className="text-xs text-muted-foreground mt-3">
                  O link expira em <strong className="text-slate-400">1 hora</strong>.
                  Verifique também a pasta de spam.
                </p>
              </div>
              <Link href="/login">
                <Button variant="outline" className="mt-2 border-slate-600 text-slate-300 hover:bg-slate-700">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar para o login
                </Button>
              </Link>
            </div>
          </CardContent>
        )}
      </Card>

      <p className="text-xs text-muted-foreground mt-8">
        © 2026 DefocusApp · Uso exclusivo para profissionais de saúde
      </p>
    </div>
  );
}
