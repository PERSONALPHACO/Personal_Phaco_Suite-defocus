import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Extract token from URL query string
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) {
      setToken(t);
    } else {
      setError("Link inválido. Solicite um novo link de redefinição de senha.");
    }
  }, []);

  const resetMutation = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setError(null);
      // Redirect to login after 3 seconds
      setTimeout(() => navigate("/login"), 3000);
    },
    onError: (err) => {
      setError(err.message || "Ocorreu um erro. Tente novamente.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    if (!token) {
      setError("Token inválido. Solicite um novo link.");
      return;
    }

    resetMutation.mutate({ token, newPassword });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <img
          src="https://d2xsxph8kpxj0f.cloudfront.net/310519663364551298/n7THbuCkaLecDawSNhBVgp/logodefocusapp_3f62e833.webp"
          alt="DefocusApp"
          className="h-24 w-auto object-contain mb-2"
        />
        <p className="text-sm text-muted-foreground mt-1">Análise de Curvas de Defoque</p>
      </div>

      <Card className="w-full max-w-md bg-slate-800/60 border-slate-700 shadow-2xl">
        {!success ? (
          <>
            <CardHeader className="pb-4">
              <CardTitle className="text-xl text-foreground">Criar nova senha</CardTitle>
              <CardDescription className="text-muted-foreground">
                Escolha uma senha segura com pelo menos 8 caracteres.
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
                  <Label htmlFor="newPassword" className="text-slate-300">Nova senha</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Mínimo 8 caracteres"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pr-10 bg-slate-900/60 border-slate-600 text-foreground placeholder:text-muted-foreground focus:border-primary"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {newPassword.length > 0 && newPassword.length < 8 && (
                    <p className="text-xs text-amber-400">Mínimo 8 caracteres ({newPassword.length}/8)</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-slate-300">Confirmar nova senha</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirm ? "text" : "password"}
                      placeholder="Repita a nova senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pr-10 bg-slate-900/60 border-slate-600 text-foreground placeholder:text-muted-foreground focus:border-primary"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-400">As senhas não coincidem</p>
                  )}
                  {confirmPassword.length > 0 && newPassword === confirmPassword && newPassword.length >= 8 && (
                    <p className="text-xs text-green-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Senhas coincidem
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-11"
                  disabled={resetMutation.isPending || !token}
                >
                  {resetMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Salvando...
                    </span>
                  ) : (
                    "Salvar nova senha"
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
                <h2 className="text-lg font-semibold text-foreground mb-2">Senha redefinida!</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Sua senha foi atualizada com sucesso.
                  Você será redirecionado para o login em instantes.
                </p>
              </div>
              <Link href="/login">
                <Button className="mt-2 bg-primary hover:bg-primary/90">
                  Ir para o login
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
