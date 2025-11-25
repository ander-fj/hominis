# Lista de Compras - App de Supermercado

Aplicativo React Native com Expo para gerenciar listas de compras com scanner de código de barras.

## 📱 Sobre o Projeto 

App de lista de compras com recursos avançados:
- 🛒 Lista de compras interativa com gestos swipe
- 📷 Scanner de código de barras
- 📊 Análise de preços
- 📈 Relatórios de compras
- 💾 Sincronização com Supabase
- 🎨 Interface moderna e responsiva

## 🚀 Tecnologias

- **Expo SDK**: 51.0.0
- **React Native**: 0.74.3
- **React**: 18.2.0
- **TypeScript**: 5.3.0
- **Supabase**: Backend e banco de dados
- **Expo Router**: Navegação
- **Yarn**: Gerenciador de pacotes

## 📚 Documentação

Este README contém todas as informações necessárias para desenvolver e fazer build do aplicativo.

## 🔧 Instalação Rápida

### Pré-requisitos
- Node.js 18+
- Yarn instalado globalmente
- Android Studio (para Android)
- JDK 17 ou 11

### Instalar

```bash
# 1. Instalar dependências
yarn install

# 2. Iniciar desenvolvimento
yarn dev

# 3. Build Android
yarn build:android-debug
```

## 📋 Scripts Disponíveis

```bash
# Desenvolvimento
yarn dev                    # Iniciar servidor
yarn android               # Executar no Android
yarn ios                   # Executar no iOS

# Build
yarn build:android         # Build release
yarn build:android-debug   # Build debug
yarn build:web            # Build web

# Limpeza
yarn clean:android        # Limpar build Android
yarn clean:cache         # Limpar cache
yarn fix:build           # Limpar tudo e rebuild

# Qualidade
yarn typecheck           # Verificar tipos TypeScript
yarn lint               # Lint do código
```

## ⚠️ Problemas Comuns e Soluções

### Erros de instalação?
```bash
# Limpar e reinstalar
rm -rf node_modules yarn.lock
yarn install
```

### Build Android falha?
```bash
# Limpar build
yarn clean:android
rm -rf android/.gradle android/build
yarn build:android-debug
```

## 🎯 Funcionalidades

### Lista de Compras
- ✅ Adicionar/remover itens
- ✅ Marcar como comprado
- ✅ Gestos swipe para ações rápidas
- ✅ Persistência com Supabase

### Scanner de Código de Barras
- ✅ Scanner integrado com câmera
- ✅ Busca automática de produtos
- ✅ Adiciona à lista automaticamente

### Análise de Preços
- ✅ Comparação de preços
- ✅ Histórico de compras
- ✅ Sugestões de economia

### Relatórios
- ✅ Gastos mensais
- ✅ Produtos mais comprados
- ✅ Estatísticas detalhadas

## 🗄️ Banco de Dados

O app usa Supabase para:
- Armazenamento de listas
- Sincronização entre dispositivos
- Histórico de compras
- Análise de preços

Ver migrações em: `supabase/migrations/`

## 🎨 Ícone do App

O app usa o ícone personalizado em `assets/images/icone.png`:
- Logo colorido de supermercado
- Frutas (limão, morango, folha)
- Configurado para todas as plataformas

## 📱 Plataformas Suportadas

- ✅ Android (5.0+)
- ✅ iOS (13.0+)
- ✅ Web (navegadores modernos)

## 🔐 Variáveis de Ambiente

Criar arquivo `.env`:
```bash
EXPO_PUBLIC_SUPABASE_URL=sua_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=sua_chave
```

## 🤝 Desenvolvimento

### Estrutura do Projeto
```
├── app/                  # Rotas (Expo Router)
│   ├── (tabs)/          # Tabs principais
│   └── _layout.tsx      # Layout root
├── components/          # Componentes reutilizáveis
├── lib/                # Utilitários (Supabase, storage)
├── assets/             # Imagens e assets
├── android/            # Código nativo Android
├── ios/               # Código nativo iOS
└── supabase/          # Migrações do banco
```

### Boas Práticas
- ✅ Use TypeScript para tudo
- ✅ Sempre rode `yarn typecheck` antes de commit
- ✅ Limpe builds antes de commitar
- ✅ Siga as convenções do projeto
- ✅ Use yarn (não npm)

## 🐛 Debug

### Ver logs do Metro
```bash
yarn dev
# Pressione 'r' para reload
# Pressione 'j' para abrir debugger
```

### Debug no Android
```bash
# Ver logs
adb logcat *:S ReactNative:V ReactNativeJS:V

# Ver dispositivos
adb devices
```

## 📦 Build de Produção

### Android APK
```bash
# Build release (minificado e otimizado)
yarn build:android

# APK estará em:
# android/app/build/outputs/apk/release/
```

### Com EAS (recomendado)
```bash
# Instalar EAS CLI (se não tiver)
yarn global add eas-cli

# Login
eas login

# Build
eas build -p android --profile production
```

## 📊 Tamanhos

- **APK Debug**: ~40-50 MB
- **APK Release**: ~20-30 MB (otimizado)
- **Código fonte**: < 50 MB

## ✅ Status do Projeto

- ✅ Expo SDK 51 atualizado
- ✅ React Native 0.74.3
- ✅ Todas as dependências compatíveis
- ✅ Builds otimizados (R8, minify)
- ✅ Documentação completa
- ✅ Pronto para produção

## 🔗 Links Úteis

- [Documentação Expo](https://docs.expo.dev/)
- [React Native Docs](https://reactnative.dev/)
- [Supabase Docs](https://supabase.com/docs)
- [Expo Router](https://docs.expo.dev/router/introduction/)

## 📄 Licença

Projeto privado - Lista de Compras

---

**Versão**: 1.0.0
**Última atualização**: 2025-10-16
**SDK**: Expo 51.0.0
**Status**: ✅ Produção
