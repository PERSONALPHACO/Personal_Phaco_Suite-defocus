import DefocusLayout from "@/components/DefocusLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, Eye, Database, UserCheck, Mail } from "lucide-react";

export default function Privacy() {
  return (
    <DefocusLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Política de Privacidade</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50">
                LGPD — Lei 13.709/2018
              </Badge>
              <Badge variant="outline" className="text-xs text-blue-600 border-blue-200 bg-blue-50">
                GDPR — Regulamento (UE) 2016/679
              </Badge>
              <span className="text-xs text-muted-foreground">Última atualização: março de 2026</span>
            </div>
          </div>
        </div>

        {/* Intro */}
        <Card className="border bg-primary/5 border-primary/20">
          <CardContent className="p-5">
            <p className="text-sm text-foreground leading-relaxed">
              O <strong>DefocusApp</strong> é uma plataforma destinada a oftalmologistas para análise de performance de lentes intraoculares (IOLs) e plotagem de curvas de defoque. Esta Política de Privacidade descreve como coletamos, utilizamos, armazenamos e protegemos os dados pessoais de pacientes e profissionais de saúde, em conformidade com a <strong>Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018)</strong> e o <strong>Regulamento Geral de Proteção de Dados da União Europeia (GDPR — Regulamento (UE) 2016/679)</strong>.
            </p>
          </CardContent>
        </Card>

        {/* Sections */}
        <div className="space-y-5">
          {/* 1. Dados coletados */}
          <PrivacySection
            icon={<Database className="w-5 h-5 text-primary" />}
            title="1. Dados Coletados"
          >
            <p>Coletamos as seguintes categorias de dados:</p>
            <table className="w-full text-sm mt-3 border-collapse">
              <thead>
                <tr className="bg-muted/40">
                  <th className="text-left px-3 py-2 font-semibold text-foreground border">Categoria</th>
                  <th className="text-left px-3 py-2 font-semibold text-foreground border">Dados</th>
                  <th className="text-left px-3 py-2 font-semibold text-foreground border">Finalidade</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Dados do Médico", "Nome, e-mail, CRM (via autenticação)", "Autenticação e controle de acesso"],
                  ["Dados do Paciente", "Nome, CPF, data de nascimento, telefone, e-mail", "Identificação e prontuário clínico"],
                  ["Dados Clínicos", "Acuidade visual, IOL implantada, alvo refrativo, data de cirurgia", "Análise de performance e curvas de defoque"],
                  ["Dados Agregados", "Métricas anonimizadas de performance por tipo de IOL", "Pesquisa e relatórios para fabricantes"],
                ].map(([cat, data, purpose]) => (
                  <tr key={cat} className="border-b hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium text-foreground border">{cat}</td>
                    <td className="px-3 py-2 text-muted-foreground border">{data}</td>
                    <td className="px-3 py-2 text-muted-foreground border">{purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PrivacySection>

          {/* 2. Base Legal */}
          <PrivacySection
            icon={<UserCheck className="w-5 h-5 text-primary" />}
            title="2. Base Legal para Tratamento"
          >
            <p>
              O tratamento de dados pessoais no DefocusApp é realizado com base nas seguintes hipóteses legais previstas na LGPD (Art. 7º) e no GDPR (Art. 6º):
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {[
                ["Consentimento (Art. 7º, I — LGPD)", "O paciente fornece consentimento livre, informado e inequívoco no momento do cadastro, podendo revogá-lo a qualquer tempo."],
                ["Tutela da Saúde (Art. 7º, VIII — LGPD)", "Dados clínicos são tratados para fins de diagnóstico e tratamento médico, com sigilo garantido por profissional de saúde."],
                ["Interesse Legítimo (Art. 7º, IX — LGPD)", "Dados agregados e anonimizados são utilizados para pesquisa de performance de IOLs, sem identificação individual dos pacientes."],
                ["Obrigação Legal (Art. 7º, II — LGPD)", "Cumprimento de obrigações legais e regulatórias aplicáveis à prática médica no Brasil."],
              ].map(([base, desc]) => (
                <li key={base} className="flex gap-2">
                  <span className="text-primary font-bold shrink-0">•</span>
                  <span><strong className="text-foreground">{base}:</strong> {desc}</span>
                </li>
              ))}
            </ul>
          </PrivacySection>

          {/* 3. Anonimização */}
          <PrivacySection
            icon={<Lock className="w-5 h-5 text-primary" />}
            title="3. Anonimização e Dados para Fabricantes"
          >
            <p>
              Os dados compartilhados com fabricantes de IOLs são <strong>estritamente anonimizados</strong> antes de qualquer transmissão. O processo de anonimização garante que:
            </p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {[
                "Nenhum dado identificável do paciente (nome, CPF, data de nascimento) é incluído nos relatórios.",
                "Apenas métricas agregadas de performance (acuidade visual média por dioptria, por tipo de IOL) são compartilhadas.",
                "Os dados são agrupados por fabricante e modelo de IOL, sem referência a indivíduos.",
                "O compartilhamento ocorre somente mediante contrato de processamento de dados com o fabricante, conforme Art. 26 da LGPD.",
                "O médico pode optar por não participar da coleta agregada a qualquer momento nas configurações da conta.",
              ].map((item, i) => (
                <li key={i} className="flex gap-2 text-muted-foreground">
                  <span className="text-emerald-600 font-bold shrink-0">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </PrivacySection>

          {/* 4. Direitos dos Titulares */}
          <PrivacySection
            icon={<Eye className="w-5 h-5 text-primary" />}
            title="4. Direitos dos Titulares de Dados"
          >
            <p>
              Em conformidade com os Arts. 17 a 22 da LGPD e Arts. 15 a 22 do GDPR, os titulares de dados (pacientes e médicos) têm os seguintes direitos:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              {[
                ["Acesso", "Solicitar confirmação e acesso aos dados pessoais tratados"],
                ["Correção", "Solicitar correção de dados incompletos, inexatos ou desatualizados"],
                ["Exclusão", "Solicitar a exclusão de dados desnecessários ou tratados em desconformidade"],
                ["Portabilidade", "Receber os dados em formato estruturado e interoperável"],
                ["Revogação", "Revogar o consentimento a qualquer tempo, sem prejuízo da legalidade do tratamento anterior"],
                ["Oposição", "Opor-se ao tratamento de dados realizado com base em interesse legítimo"],
              ].map(([right, desc]) => (
                <div key={right} className="p-3 rounded-lg border bg-card">
                  <p className="text-sm font-semibold text-foreground">{right}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
          </PrivacySection>

          {/* 5. Segurança */}
          <PrivacySection
            icon={<Lock className="w-5 h-5 text-primary" />}
            title="5. Segurança dos Dados"
          >
            <p>
              Adotamos medidas técnicas e organizacionais adequadas para proteger os dados pessoais contra acesso não autorizado, perda, destruição ou divulgação indevida, incluindo:
            </p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {[
                "Transmissão de dados via HTTPS/TLS 1.3",
                "Autenticação segura com tokens JWT e sessões assinadas",
                "Controle de acesso baseado em papéis (médico/administrador)",
                "Banco de dados com acesso restrito e credenciais rotativas",
                "Logs de auditoria para operações sensíveis",
                "Backups regulares com retenção controlada",
              ].map((item, i) => (
                <li key={i} className="flex gap-2 text-muted-foreground">
                  <span className="text-primary font-bold shrink-0">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </PrivacySection>

          {/* 6. Retenção */}
          <PrivacySection
            icon={<Database className="w-5 h-5 text-primary" />}
            title="6. Retenção e Exclusão de Dados"
          >
            <p>
              Os dados pessoais são mantidos pelo tempo necessário para cumprir as finalidades para as quais foram coletados, observando os seguintes critérios:
            </p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {[
                "Dados de pacientes: mantidos enquanto o médico mantiver conta ativa na plataforma.",
                "Após encerramento da conta: dados excluídos em até 30 dias, salvo obrigação legal de retenção.",
                "Dados agregados anonimizados: podem ser mantidos indefinidamente, pois não constituem dados pessoais.",
                "Logs de auditoria: mantidos por 5 anos conforme regulamentação de saúde.",
              ].map((item, i) => (
                <li key={i} className="flex gap-2 text-muted-foreground">
                  <span className="text-primary font-bold shrink-0">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </PrivacySection>

          {/* 7. Contato */}
          <PrivacySection
            icon={<Mail className="w-5 h-5 text-primary" />}
            title="7. Encarregado de Dados (DPO) e Contato"
          >
            <p>
              Para exercer seus direitos ou esclarecer dúvidas sobre o tratamento de dados pessoais, entre em contato com nosso Encarregado de Proteção de Dados (DPO):
            </p>
            <div className="mt-3 p-4 rounded-lg border bg-card space-y-1.5 text-sm">
              <p><strong className="text-foreground">DefocusApp — Encarregado de Dados</strong></p>
              <p className="text-muted-foreground">E-mail: privacidade@defocusapp.com.br</p>
              <p className="text-muted-foreground">Prazo de resposta: até 15 dias úteis (conforme Art. 18, §5º, LGPD)</p>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Caso não obtenha resposta satisfatória, você pode contatar a <strong>Autoridade Nacional de Proteção de Dados (ANPD)</strong> em <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.gov.br/anpd</a>.
            </p>
          </PrivacySection>
        </div>
      </div>
    </DefocusLayout>
  );
}

function PrivacySection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3">
          {icon}
          <h2 className="text-base font-bold text-foreground">{title}</h2>
        </div>
        <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}
