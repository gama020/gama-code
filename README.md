# Gama Os

<p align="center">
  <img src="assets/prod/black-macos-1024.png" width="128" height="128" alt="Gama Os Logo" style="border-radius: 24px;" />
</p>

<p align="center">
  <strong>A Superfície de Controle Inteligente para Agentes de Código no seu Computador</strong><br />
  <em>macOS • Windows • Linux • Web</em>
</p>

---

## 🚀 Sobre o Gama Os

O **Gama Os** é uma plataforma open-source moderna para orquestração e controle de agentes de inteligência artificial de desenvolvimento direto na sua máquina (Claude Code, OpenAI Codex, Cursor, Google Antigravity, OpenCode, Grok Build e fx).

Este projeto é um fork evoluído do [T3 Code](https://github.com/pingdotgg/t3code), customizado com:

- **Identidade Visual Gama Os**: Monograma exclusivo em alta resolução, novos ícones e temas nativos.
- **100% em Português do Brasil (PT-BR)**: Sistema completo de internacionalização com suporte a múltiplos idiomas.
- **Nova Barra Lateral (Sidebar)**: Inspirada no Antigravity e Codex, com agrupamento inteligente por repositórios, branches git, contadores de threads e monitoramento em tempo real de estados do agente (🔵 executando, 🟢 pronto, 🟡 aprovação necessária, 🔴 erro).
- **Compilação Multiplataforma**: Instaladores nativos para **macOS (.dmg)**, **Windows (.exe NSIS)** e **Linux (.AppImage / .deb)**.
- **Sincronização Upstream Contínua**: Mecanismo de isolamento que permite puxar e incorporar as novidades do repositório oficial com um único comando.

---

## 📥 Instalação dos Binários Pré-compilados

### macOS (Apple Silicon & Intel)

Baixe o arquivo `.dmg` mais recente em [Releases](https://github.com/gama020/gama-code/releases):

- **Apple Silicon (M1/M2/M3/M4)**: `Gama-Os-<versao>-arm64.dmg`
- **Intel (x64)**: `Gama-Os-<versao>-x64.dmg`

Basta abrir o `.dmg` e arrastar o **Gama Os** para a pasta `/Applications`.

### Windows

Baixe o instalador `Gama-Os-<versao>-x64.exe` em [Releases](https://github.com/gama020/gama-code/releases) e execute a instalação com assistente NSIS.

### Linux (Ubuntu, Debian, Fedora, Arch)

Baixe o pacote desejado em [Releases](https://github.com/gama020/gama-code/releases):

- **AppImage**: Torne executável com `chmod +x Gama-Os-*.AppImage` e execute diretamente.
- **Debian / Ubuntu**: Instale com `sudo apt install ./Gama-Os-*.deb`.

---

## 🛠️ Comandos da CLI (`gama`, `gamaos`, `t3`)

O Gama Os inclui uma CLI avançada no terminal:

```bash
# Iniciar o servidor local e abrir a interface web
gama

# Iniciar em segundo plano como serviço
gama service install

# Parear com outro dispositivo (mobile ou outro computador)
gama pair

# Executar diagnóstico de dependências e agentes instalados
gama doctor
```

---

## 💻 Desenvolvimento & Compilação Local

### Pré-requisitos

- **Node.js** >= 22 (recomendado Node 22+)
- **pnpm** >= 12
- **Rust / Cargo** (para os módulos nativos de monitoramento de recursos)
- **ImageMagick** (opcional, para regerar ativos de marca)

### Instalação de Dependências

```bash
pnpm install
```

### Executar em Modo de Desenvolvimento

```bash
# Iniciar o servidor e o cliente web com hot reload
pnpm run dev
```

### Compilar os Instaladores Desktop Localmente

```bash
# Compilar os bundles do web, servidor e desktop
./node_modules/.bin/vp run --filter @t3tools/desktop build

# 1. Gerar o DMG para macOS (Apple Silicon arm64)
pnpm run dist:desktop:dmg:arm64

# 2. Gerar o DMG para macOS (Intel x64)
pnpm run dist:desktop:dmg:x64

# 3. Gerar o instalador NSIS (.exe) para Windows
pnpm run dist:desktop:win:x64

# 4. Gerar AppImage e pacote .deb para Linux
pnpm run dist:desktop:linux
```

Os arquivos gerados são salvos automaticamente na pasta `release/`.

---

## 🔄 Sincronização com o Repositório Original (Upstream)

Para puxar novas atualizações lançadas pelo repositório oficial (`pingdotgg/t3code`) sem perder nenhuma customização:

```bash
./scripts/sync-upstream.sh
```

Esse script busca os commits mais recentes do upstream, atualiza a branch `upstream-main` e faz o merge limpo na branch de produção do Gama Os.

---

## 🌐 Internacionalização & Idiomas

As traduções do Gama Os ficam centralizadas em:

- `apps/web/src/i18n/locales/pt-BR.json` (Português - Brasil)
- `apps/web/src/i18n/locales/en-US.json` (Inglês)

O idioma padrão é **Português do Brasil**, com alternância fácil pelo menu de Configurações da aplicação.

---

## 📄 Licença

Distribuído sob a licença MIT. Consulte o arquivo [LICENSE](./LICENSE) para obter mais detalhes.
