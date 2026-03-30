import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { Activity, ArrowRight, BarChart3, Eye, GitCompare, Lock, Shield, Users } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && user) {
      setLocation("/dashboard");
    }
  }, [user, loading, setLocation]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-md">
              <Activity className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <span className="font-bold text-lg text-foreground tracking-tight">DefocusApp</span>
              <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">Análise de IOLs</span>
            </div>
          </div>
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            Entrar
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container py-20 md:py-28">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20">
            <Shield className="w-4 h-4" />
            Plataforma Médica Certificada · LGPD/GDPR Compliant
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight tracking-tight">
            Curvas de Defoque
            <span className="block text-primary">para Oftalmologistas</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Plote dados de acuidade visual, construa curvas de defoque e compare a performance de IOLs com precisão clínica. Tome decisões mais confiantes na escolha do alvo refrativo.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button
              size="lg"
              onClick={() => { window.location.href = getLoginUrl(); }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 shadow-lg hover:shadow-xl transition-all"
            >
              Acessar Plataforma
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
            Funcionalidades Clínicas
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Ferramentas desenvolvidas especificamente para a prática da cirurgia refrativa de catarata
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            {
              icon: Users,
              title: "Gestão de Pacientes",
              description: "Cadastre pacientes com dados clínicos completos, histórico cirúrgico e associação de IOLs implantados.",
              color: "text-primary",
              bg: "bg-primary/10",
            },
            {
              icon: BarChart3,
              title: "Curvas de Defoque",
              description: "Plote e visualize curvas de defoque interativas com eixos calibrados em dioptrias e acuidade visual.",
              color: "text-emerald-600",
              bg: "bg-emerald-50",
            },
            {
              icon: GitCompare,
              title: "Comparação de IOLs",
              description: "Compare múltiplas lentes intraoculares com curvas sobrepostas e análise visual de performance.",
              color: "text-amber-600",
              bg: "bg-amber-50",
            },
            {
              icon: Eye,
              title: "Biblioteca de IOLs",
              description: "Acesse um catálogo completo de IOLs dos principais fabricantes mundiais com características técnicas.",
              color: "text-purple-600",
              bg: "bg-purple-50",
            },
            {
              icon: Lock,
              title: "Dados Protegidos",
              description: "Conformidade total com LGPD e GDPR. Dados de pacientes criptografados e com controle de acesso.",
              color: "text-rose-600",
              bg: "bg-rose-50",
            },
            {
              icon: Activity,
              title: "Análise de Performance",
              description: "Refine seus resultados refrativos com dados agregados e anonimizados de performance de IOLs.",
              color: "text-sky-600",
              bg: "bg-sky-50",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="bg-card rounded-xl p-6 border shadow-sm hover:shadow-md transition-shadow"
            >
              <div className={`w-11 h-11 rounded-xl ${feature.bg} flex items-center justify-center mb-4`}>
                <feature.icon className={`w-5 h-5 ${feature.color}`} />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container py-16">
        <div className="max-w-2xl mx-auto text-center bg-primary rounded-2xl p-10 shadow-xl">
          <h2 className="text-2xl md:text-3xl font-bold text-primary-foreground mb-3">
            Pronto para começar?
          </h2>
          <p className="text-primary-foreground/80 mb-6">
            Acesse sua conta e comece a registrar dados de seus pacientes hoje mesmo.
          </p>
          <Button
            size="lg"
            variant="outline"
            onClick={() => { window.location.href = getLoginUrl(); }}
            className="bg-white text-primary hover:bg-white/90 font-semibold border-0 shadow-md"
          >
            Entrar na Plataforma
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-background py-8">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center">
              <Activity className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">DefocusApp</span>
            <span>— Plataforma de Análise de IOLs</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5" />
            <span>Dados protegidos conforme LGPD · Lei 13.709/2018</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
