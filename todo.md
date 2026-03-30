# DefocusApp - TODO

## Schema & Backend
- [x] Schema: tabela `manufacturers` (fabricantes de IOL)
- [x] Schema: tabela `iols` (lentes intraoculares com modelo, fabricante, características)
- [x] Schema: tabela `patients` (pacientes com nome, CPF, nascimento, telefone)
- [x] Schema: tabela `patient_iols` (associação paciente-IOL com alvo refrativo)
- [x] Schema: tabela `measurements` (medições de acuidade visual por data)
- [x] Schema: tabela `measurement_points` (pontos da curva: dioptria, acuidade)
- [x] tRPC: procedures para CRUD de fabricantes
- [x] tRPC: procedures para CRUD de IOLs
- [x] tRPC: procedures para CRUD de pacientes
- [x] tRPC: procedures para CRUD de medições e pontos
- [x] tRPC: procedure para comparação de IOLs (dados agregados)
- [x] tRPC: procedure para alvo refrativo

## Design System & Layout
- [x] Paleta de cores: azul médico, verde, amarelo/ouro
- [x] Tipografia profissional (Inter/Plus Jakarta Sans)
- [x] DashboardLayout com sidebar de navegação
- [x] Rotas: /dashboard, /patients, /iols, /measurements, /compare
- [x] Componente de header com usuário logado

## Módulo de IOLs
- [x] Página de listagem de IOLs com filtros por fabricante
- [x] Modal/formulário de adição de IOL (fabricante, modelo, tipo, características)
- [x] Seed de IOLs populares (Hanita, Rayner, Alcon, Johnson & Johnson)
- [x] Card de IOL com informações visuais

## Módulo de Pacientes
- [x] Página de listagem de pacientes com busca
- [x] Formulário de cadastro de paciente (nome, CPF, nascimento, telefone)
- [x] Página de detalhe do paciente com histórico de medições
- [x] Associação de IOL ao paciente (OD/OS, alvo refrativo)

## Sistema de Medições
- [x] Formulário de registro de medição (data, IOL, olho OD/OS)
- [x] Entrada de pontos da curva de defoque (dioptria, acuidade visual)
- [x] Validação de dados de acuidade visual (0.0 a 1.0)
- [x] Histórico de medições por paciente

## Gráficos e Visualização
- [x] Gráfico de curva de defoque (Recharts LineChart)
- [x] Eixo X: dioptrias (-5.0 a +1.5)
- [x] Eixo Y: acuidade visual (0.0 a 1.0)
- [x] Múltiplas linhas coloridas por IOL/medição
- [x] Legenda interativa
- [x] Tooltip com valores ao hover

## Comparação de IOLs
- [x] Página de comparação com seleção de múltiplos IOLs
- [x] Curvas sobrepostas com cores distintas
- [x] Legenda clara com nome do IOL/fabricante
- [x] Exportar/imprimir gráfico (placeholder - feature futura, toast informativo implementado)

## Alvo Refrativo
- [x] Interface de seleção de alvo refrativo
- [x] Dropdown de fabricante → IOL → valores de refração
- [x] Visualização da curva esperada para o alvo

## Conformidade LGPD/GDPR
- [x] Consentimento de uso de dados no cadastro de paciente
- [x] Dados agregados anonimizados para análise de IOLs
- [x] Política de privacidade acessível

## Testes
- [x] Testes vitest para procedures de IOL
- [x] Testes vitest para procedures de paciente
- [x] Testes vitest para procedures de medição
