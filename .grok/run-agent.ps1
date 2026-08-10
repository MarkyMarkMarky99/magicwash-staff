<#
.SYNOPSIS
  Runs one of this project's Grok agents against the worktree this script sits in.

.DESCRIPTION
  Callers pass an agent name and a brief file and get JSON back. Everything else —
  the container, the mounts, the deny list — is fixed here on purpose.

  Grok runs with --always-approve: it executes whatever it decides to, without asking.
  The container is the entire safety boundary, and the git worktree decides which files
  exist inside it. Grok Build CLI has previously been caught uploading whole repositories
  off-machine, so neither is optional.

  Two rules this file exists to enforce, because a prompt cannot:

  1. The deny list is not caller-configurable. An agent that hits an obstacle cannot
     talk its way past `git commit`, `git push`, `vercel` or `rm -rf` by rephrasing.
  2. Only the worktree is mounted. Ignored files — .env.local above all — are absent
     from a worktree by construction, so secrets are excluded by the mechanism rather
     than by a filename filter someone has to maintain.

  Not caller-configurable, deliberately. If you need to change either, change this file
  in a commit someone can review, not in a prompt.

.PARAMETER Agent
  Name of a definition in <worktree>/.grok/agents/<name>.md. Verified before dispatch:
  grok falls back to its DEFAULT agent silently when a name does not resolve, which would
  mean reporting on work done by something other than the role that was asked for.

.PARAMETER BriefPath
  The brief. Must live inside the worktree so the container can see it.

.PARAMETER Resume
  Session id from a previous run's JSON, to continue that session.

.OUTPUTS
  The raw JSON object grok emits. Check `.stopReason -eq 'EndTurn'` before trusting
  `.text` — any other value means the run was cut off and its report is partial.
#>
param(
    [Parameter(Mandatory = $true)][string]$Agent,
    [Parameter(Mandatory = $true)][string]$BriefPath,
    [string]$Resume,
    [int]$MaxTurns = 30
)

$ErrorActionPreference = "Stop"

# The worktree is this script's grandparent: <worktree>/.grok/run-agent.ps1
$Worktree = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Image = "magicwash-grok-sandbox:latest"
$AuthVolume = "grok-sandbox-auth"

# ---- Preflight. Fail loudly; never silently degrade. ----
docker version --format '{{.Server.Version}}' *> $null
if ($LASTEXITCODE -ne 0) {
    throw "Docker is not running. Start Docker Desktop — this script will not run grok outside the container."
}

docker image inspect $Image *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Building $Image ..." -ForegroundColor DarkGray
    docker build -t $Image -f (Join-Path $PSScriptRoot "sandbox.Dockerfile") $PSScriptRoot
    if ($LASTEXITCODE -ne 0) { throw "docker build failed for $Image" }
}

docker volume inspect $AuthVolume *> $null
if ($LASTEXITCODE -ne 0) {
    throw "Auth volume '$AuthVolume' does not exist. A human must log in once, interactively:`n" +
          "  docker run --rm -it -v ${AuthVolume}:/home/dev/.grok $Image grok login"
}

$AgentDefinition = Join-Path $Worktree ".grok\agents\$Agent.md"
if (-not (Test-Path $AgentDefinition)) {
    throw "No definition at .grok/agents/$Agent.md in this worktree. A worktree contains only " +
          "TRACKED files, so an uncommitted or ignored definition is invisible here — and grok " +
          "would silently fall back to its default agent rather than failing."
}

$ResolvedBrief = (Resolve-Path $BriefPath).Path
if (-not $ResolvedBrief.StartsWith($Worktree, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Brief must live inside the worktree ($Worktree); the container cannot see anything else."
}
$BriefRelative = $ResolvedBrief.Substring($Worktree.Length).TrimStart('\','/').Replace('\','/')

# ---- Fixed safety flags. Not caller-configurable. ----
$GrokArgs = @(
    "--agent", $Agent,
    "--always-approve",
    "--deny", "Bash(git push*)",
    "--deny", "Bash(git commit*)",
    "--deny", "Bash(git reset*)",
    "--deny", "Bash(git checkout*)",
    "--deny", "Bash(git clean*)",
    "--deny", "Bash(vercel*)",
    "--deny", "Bash(rm -rf*)",
    "--prompt-file", "/workspace/$BriefRelative",
    "--output-format", "json",
    "--max-turns", $MaxTurns
)
if ($Resume) { $GrokArgs = @("--resume", $Resume) + $GrokArgs }

# `docker run -t` fails outright on non-TTY stdin, which is the headless case here.
$TtyArgs = @("-i")
if (-not [Console]::IsInputRedirected) { $TtyArgs += "-t" }

$Raw = docker run --rm @TtyArgs `
    -v "${Worktree}:/workspace" `
    -v "${AuthVolume}:/home/dev/.grok" `
    -w /workspace `
    $Image `
    grok @GrokArgs

if ($LASTEXITCODE -ne 0) {
    throw "docker run failed (exit $LASTEXITCODE). Raw output:`n$Raw"
}

$Raw
