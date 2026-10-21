# fsh

A natural-language shell based on [libfx](https://fx.sh/docs/lib). A fresh `fsh` process starts one translator session; commands share context while that process runs. The translator has no tools: fsh reviews its text response before running a command locally.

## Install

Requires Node.js 20+ and an [AI Gateway key](https://fx.sh/docs/lib/quick-start.md#connect-a-model).

```sh
cd ~/code/fsh
npm install
./scripts/install.sh
export AI_GATEWAY_API_KEY=your-key
fsh
```

The installer links `~/.local/bin/fsh` to this checkout so Node can resolve its `libfx` dependency. Add that directory to `PATH` if necessary. Set `FSH_INSTALL_ALIAS=1` to add `fsh` and `fshr` aliases to an existing `~/.zshrc`, or `FSH_INSTALL_GHOSTTY=1` for a Ghostty command override. Neither integration is required.

## Usage

Enter a plain-language request to translate it into one bash command. Review the displayed command and answer `y` to execute. Simple read-only commands default to yes; other commands default to no. `// <command>` runs a raw command without translation or confirmation; `fshr` does the same for every non-slash input.

Commands: `/help`, `/quit`, `/auto on|off`, `/noconfirm on|off`, `/show on|off`. A bare `cd`, `cd ~`, or simple path persists in the running fsh process.

| Variable | Purpose |
| --- | --- |
| `AI_GATEWAY_API_KEY` | AI Gateway credential required for translation |
| `FSH_MODEL` | Optional libfx model ID |
| `FSH_CONTINUOUS_SESSION=0` | Start a new in-memory session for each translation |
| `FSH_ASSUME_YES=1` | Skip confirmation of translated commands |
| `FSH_AUTO_CONFIRM_SAFE=0` | Default every confirmation to no |
| `FSH_AUTO_RAW=1` | Treat normal input as raw bash |
| `FSH_SHOW_TRANSLATION=0` | Hide the extra `Executing:` line |
| `FSH_DEBUG=1` | Show libfx diagnostic events |

Sessions live only as long as fsh runs. No fx CLI or `fx login` credentials are used.

To uninstall, run `./scripts/uninstall.sh`. To check the implementation, run `npm test`.
