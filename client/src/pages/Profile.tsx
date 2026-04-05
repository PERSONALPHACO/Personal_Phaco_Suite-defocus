import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DefocusLayout from "@/components/DefocusLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User, Mail, Lock, Shield, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function Profile() {
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();

  // Profile info form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profileDirty, setProfileDirty] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Initialize form with current user data once loaded
  const [initialized, setInitialized] = useState(false);
  if (!loading && user && !initialized) {
    setName(user.name ?? "");
    setEmail(user.email ?? "");
    setInitialized(true);
  }

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      setProfileDirty(false);
      toast.success("Perfil atualizado com sucesso!");
    },
    onError: (err) => {
      setProfileError(err.message || "Erro ao atualizar perfil.");
    },
  });

  const updatePassword = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Senha alterada com sucesso!");
    },
    onError: (err) => {
      setPasswordError(err.message || "Erro ao alterar senha.");
    },
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    if (!name.trim() || name.trim().length < 2) {
      setProfileError("Nome deve ter pelo menos 2 caracteres.");
      return;
    }
    updateProfile.mutate({ name: name.trim(), email });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (!currentPassword) {
      setPasswordError("Informe a senha atual.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("As senhas não coincidem.");
      return;
    }
    updatePassword.mutate({ currentPassword, newPassword });
  };

  if (loading || !user) return null;

  const isEmailAuth = user.loginMethod === "email";
  const crm = (user as any).crm;

  return (
    <DefocusLayout>
      <div className="p-6 space-y-6 max-w-2xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Meu Perfil</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie suas informações pessoais e credenciais de acesso
          </p>
        </div>

        {/* Identity card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xl font-bold text-primary">
                  {(user.name ?? "?").charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-semibold text-foreground truncate">{user.name || "Sem nome"}</p>
                <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className={
                      user.role === "admin"
                        ? "border-amber-400 text-amber-600 bg-amber-50"
                        : "border-blue-200 text-blue-600 bg-blue-50"
                    }
                  >
                    <Shield className="w-3 h-3 mr-1" />
                    {user.role === "admin" ? "Administrador" : "Médico"}
                  </Badge>
                  {crm && (
                    <Badge variant="outline" className="border-slate-200 text-slate-600 bg-slate-50 font-mono text-xs">
                      CRM: {crm}
                    </Badge>
                  )}
                  <Badge variant="outline" className="border-slate-200 text-slate-500 text-xs">
                    {isEmailAuth ? "Login por e-mail" : "Login OAuth"}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit profile info */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              Informações Pessoais
            </CardTitle>
            <CardDescription>Atualize seu nome de exibição e endereço de e-mail</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              {profileError && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{profileError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="profile-name">Nome completo</Label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setProfileDirty(true); }}
                  placeholder="Dr. João Silva"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profile-email">
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" />
                    E-mail
                  </span>
                </Label>
                <Input
                  id="profile-email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setProfileDirty(true); }}
                  placeholder="seu@email.com"
                />
              </div>

              {crm && (
                <div className="space-y-1.5">
                  <Label>CRM</Label>
                  <Input value={crm} readOnly disabled className="bg-muted text-muted-foreground cursor-not-allowed" />
                  <p className="text-xs text-muted-foreground">O CRM não pode ser alterado após o cadastro.</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={updateProfile.isPending || !profileDirty}
                className="w-full sm:w-auto"
              >
                {updateProfile.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Change password — only for email/password accounts */}
        {isEmailAuth && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary" />
                Alterar Senha
              </CardTitle>
              <CardDescription>Escolha uma senha forte com pelo menos 8 caracteres</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                {passwordError && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{passwordError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="current-password">Senha atual</Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showCurrent ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Sua senha atual"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(!showCurrent)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-1.5">
                  <Label htmlFor="new-password">Nova senha</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNew ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita a nova senha"
                      className={`pr-10 ${confirmPassword && confirmPassword !== newPassword ? "border-destructive" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && confirmPassword !== newPassword && (
                    <p className="text-xs text-destructive">As senhas não coincidem</p>
                  )}
                  {confirmPassword && confirmPassword === newPassword && newPassword.length >= 8 && (
                    <p className="text-xs text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Senhas coincidem
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={updatePassword.isPending}
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  {updatePassword.isPending ? "Alterando..." : "Alterar Senha"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {!isEmailAuth && (
          <Card className="border-dashed">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground text-center">
                Sua conta usa autenticação OAuth. Para alterar a senha, acesse as configurações do seu provedor de login.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DefocusLayout>
  );
}
