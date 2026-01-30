# Sistema MRS RH & SST

Sistema completo e moderno de gestão integrada de Recursos Humanos e Segurança do Trabalho, com **Ranking Inteligente de Colaboradores** totalmente configurável.

## 🎯 Características Principais

### Ranking Inteligente
- **Critérios 100% Configuráveis**: Adicione, edite e remova critérios de avaliação
- **Editor Drag-and-Drop**: Reordene critérios arrastando com o mouse
- **Auto-Ajuste Automático**: Sistema recalcula automaticamente ao alterar pesos
- **Normalização Dinâmica**: Pontuações normalizadas de 0-100 para comparação justa
- **Análise Individual**: Radar chart com pontos fortes e fracos
- **Sugestões Personalizadas**: Sistema gera sugestões de melhoria automaticamente

### Design Corporativo MRS
- **Cores Oficiais**: Azul Escuro (#002b55), Amarelo (#ffcc00), Branco (#ffffff)
- **Logo MRS**: Preparado para receber logo personalizado
- **Animações Suaves**: Framer Motion para transições elegantes
- **Responsivo**: Funciona perfeitamente em desktop, tablet e mobile

### Dashboards Integrados
- **Dashboard RH**: Colaboradores ativos, faltas, atrasos, horas trabalhadas
- **Dashboard SST**: Treinamentos, EPIs, exames, acidentes, conformidade
- **Análise Integrada**: Correlação entre indicadores RH × SST
- **Previsões**: Modelos preditivos para planejamento estratégico

### Exportação Profissional
- **PDF**: Relatórios completos com jsPDF
- **XLSX**: Planilhas editáveis com SheetJS
- **Gráficos**: Recharts para visualizações interativas

### Sincronização Google Sheets
- Link configurável para planilha Google
- Atualização automática de dados
- Importação/exportação bidirecional

## 🚀 Tecnologias Utilizadas

- **Frontend**: React 18 + TypeScript + Vite
- **Estilização**: Tailwind CSS
- **Animações**: Framer Motion
- **Gráficos**: Recharts
- **Drag-and-Drop**: @dnd-kit
- **Banco de Dados**: Supabase (PostgreSQL)
- **Exportação**: jsPDF + xlsx (SheetJS)
- **Datas**: date-fns (formato brasileiro)
- **Ícones**: Lucide React

## 📋 Funcionalidades do Sistema

### 1. Ranking Inteligente

#### Como Funciona
1. Cada colaborador recebe pontuações em diversos critérios
2. Cada critério tem um peso (%) configurável
3. Sistema normaliza pontuações de 0-100
4. Calcula média ponderada: `pontuação_total = Σ (normalizado × peso)`
5. Ordena colaboradores por pontuação total

#### Critérios Padrão
| Critério | Peso | Direção | Descrição |
|----------|------|---------|-----------|
| Assiduidade | 30% | Menor = Melhor | Número de faltas |
| Pontualidade | 10% | Menor = Melhor | Atrasos |
| Horas Trabalhadas | 15% | Maior = Melhor | Cumprimento de carga horária |
| Atestados Válidos | 10% | Maior = Melhor | Documentação entregue |
| Treinamentos | 20% | Maior = Melhor | Participação em cursos |
| Colaboração | 15% | Maior = Melhor | Avaliações de colegas |

#### Editor de Critérios
- **Adicionar**: Clique em "Adicionar" para novo critério
- **Editar**: Altere nome, tipo, direção, fonte e peso
- **Remover**: Clique no ícone de lixeira
- **Reordenar**: Arraste pela handle (ícone de três linhas)
- **Validação**: Soma dos pesos deve ser 100%
- **Salvar**: Clique em "Salvar Critérios"
- **Recalcular**: Clique em "Recalcular Ranking" para atualizar

### 2. Dashboard RH
- **Colaboradores Ativos**: Total de colaboradores no sistema
- **Faltas e Atrasos**: Últimos 30 dias com tendência
- **Horas Médias**: Média de horas trabalhadas por dia
- **Distribuição**: Por departamento em gráfico de barras
- **Evolução Temporal**: Gráfico mensal de faltas e atrasos

### 3. Dashboard SST
- **Treinamentos Vencidos**: Alertas automáticos
- **EPIs Pendentes**: Controle de entrega
- **Exames Vencidos**: Gestão médica
- **Acidentes**: Registro e análise
- **Taxa de Conformidade**: Indicador geral de segurança

### 4. Análise Integrada
- Correlação entre indicadores de RH e SST
- Identificação de padrões
- Gráficos comparativos
- Insights automáticos

### 5. Previsões
- Média móvel
- Regressão linear
- Suavização exponencial
- Projeções de 1-12 meses

### 6. Configurações
- Link para Google Sheets
- Editor de critérios drag-and-drop
- Dados de exemplo
- Recálculo global de rankings

## 🔧 Configuração Inicial

### 1. Variáveis de Ambiente
```
VITE_SUPABASE_URL=sua_url_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima
```

### 2. Inserir Dados de Exemplo
1. Acesse **Configurações**
2. Clique em **Dados de Exemplo**
3. Confirme a inserção
4. Sistema criará 8 colaboradores com histórico

### 3. Configurar Critérios
1. Acesse **Configurações** → **Editor de Critérios**
2. Ajuste pesos conforme necessário
3. Adicione ou remova critérios
4. Salve as alterações
5. Clique em **Recalcular Ranking**

### 4. Visualizar Ranking
1. Acesse **Ranking Inteligente**
2. Selecione período e departamento
3. Visualize top 10 colaboradores
4. Clique em um colaborador para análise detalhada
5. Exporte PDF ou XLSX conforme necessário

## 📊 Estrutura do Banco de Dados

### Tabelas Principais
- `employees`: Colaboradores
- `evaluation_criteria`: Critérios de avaliação (configuráveis)
- `employee_scores`: Pontuações individuais
- `employee_rankings`: Rankings calculados
- `attendance_records`: Registros de presença
- `sst_trainings`: Treinamentos de segurança
- `sst_ppe`: EPIs
- `sst_medical_exams`: Exames médicos
- `sst_incidents`: Acidentes e incidentes
- `sheets_sync_config`: Configuração Google Sheets

### Segurança
- Row Level Security (RLS) habilitado
- Políticas de acesso por usuário autenticado
- Proteção contra perda de dados

## 🎨 Paleta de Cores MRS

```css
--mrs-blue-primary: #002b55    /* Azul Escuro Principal */
--mrs-blue-dark: #001f3f       /* Azul Mais Escuro */
--mrs-blue-light: #003d73      /* Azul Mais Claro */
--mrs-yellow-primary: #ffcc00  /* Amarelo Principal */
--mrs-yellow-dark: #e6b800     /* Amarelo Escuro */
--mrs-yellow-light: #ffd633    /* Amarelo Claro */
--mrs-white: #ffffff           /* Branco */
```

## 📱 Responsividade

O sistema é totalmente responsivo e funciona em:
- **Desktop**: 1920px e acima
- **Laptop**: 1366px - 1920px
- **Tablet**: 768px - 1366px
- **Mobile**: 320px - 768px

## 🔄 Formato Brasileiro

- **Datas**: dd/MM/yyyy (17/10/2025)
- **Hora**: HH:mm (14:30)
- **Números**: 1.234,56
- **Percentual**: 85,5%
- **Moeda**: R$ 1.234,56
- **Idioma**: Português do Brasil

## 📦 Exportação de Dados

### PDF
- Cabeçalho com título e data
- Tabelas formatadas
- Paginação automática
- Rodapé com identificação

### XLSX
- Colunas auto-ajustadas
- Formatação preservada
- Compatível com Excel/Sheets
- Nome com data/hora

## 🚀 Próximas Funcionalidades

- [ ] Autenticação completa
- [ ] Notificações em tempo real
- [ ] Chat entre RH e colaboradores
- [ ] Metas e OKRs
- [ ] Avaliação 360°
- [ ] Dashboard mobile nativo
- [ ] Integração completa Google Sheets API
- [ ] BI avançado com Power BI
- [ ] Machine Learning para previsões
- [ ] Gamificação

## 📞 Suporte

Sistema desenvolvido com foco em:
- ✅ Usabilidade intuitiva
- ✅ Performance otimizada
- ✅ Segurança de dados
- ✅ Escalabilidade
- ✅ Manutenibilidade

---

**MRS Logística** - Sistema RH & SST v2.0
