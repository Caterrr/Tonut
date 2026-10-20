param([ValidateSet('Library','Validate','Resolve','Identity')][string]$HostAction='Library',[string]$HostRoot,[string]$HostAppExe,[string]$HostCodexCli)
$ErrorActionPreference='Stop'
function Assert-TonutPublisher([string]$Path) {
 if(-not (Test-Path -LiteralPath $Path -PathType Leaf)) {throw 'Official executable unavailable'}
 $Sig=Get-AuthenticodeSignature -LiteralPath $Path
 if($Sig.Status -ne 'Valid' -or $Sig.SignerCertificate.Subject -notmatch 'OpenAI') {throw 'Valid OpenAI publisher signature required'}
}
function Get-TonutPackage([string]$Exe) {
 $Full=[IO.Path]::GetFullPath($Exe)
 $Matches=@(Get-AppxPackage -ErrorAction SilentlyContinue | Where-Object {$_.InstallLocation -and $Full.StartsWith(([IO.Path]::GetFullPath($_.InstallLocation).TrimEnd('\')+'\'),[StringComparison]::OrdinalIgnoreCase)})
 if($Matches.Count -eq 1) {return $Matches[0]}
 return $null
}
function Resolve-TonutConfig($Config) {
 $App=$Config.AppExe;$Cli=$Config.cli
 if($Config.windowsPackage) {
  $Meta=$Config.windowsPackage
  $Packages=@(Get-AppxPackage -Name $Meta.name -ErrorAction Stop | Where-Object {$_.PackageFamilyName -eq $Meta.family -and $_.Publisher -eq $Meta.publisher})
  if($Packages.Count -ne 1) {throw 'Exact installed Store package not found'}
  foreach($Relative in @($Meta.appRelative,$Meta.cliRelative)) {if($Relative -and ([IO.Path]::IsPathRooted($Relative) -or ($Relative -split '[\\/]') -contains '..')) {throw 'Invalid package-relative executable'}}
  $App=Join-Path $Packages[0].InstallLocation $Meta.appRelative
  if($Meta.cliRelative) {$Cli=Join-Path $Packages[0].InstallLocation $Meta.cliRelative}
 }
 Assert-TonutPublisher $App;Assert-TonutPublisher $Cli
 if([IO.Path]::GetFileName($App) -notmatch '^(Codex|ChatGPT)\.exe$') {throw 'Unexpected desktop executable'}
 $Config.AppExe=[IO.Path]::GetFullPath($App);$Config.app=$Config.AppExe;$Config.cli=[IO.Path]::GetFullPath($Cli)
 return $Config
}
function New-TonutConfig([string]$App,[string]$Cli) {
 $App=(Resolve-Path -LiteralPath $App).Path;$Cli=(Resolve-Path -LiteralPath $Cli).Path
 Assert-TonutPublisher $App;Assert-TonutPublisher $Cli
 $C=[pscustomobject]@{port=39222;duration=10080;app=$App;AppExe=$App;cli=$Cli;windowsPackage=$null}
 $P=Get-TonutPackage $App
 if($P) {
  $Prefix=[IO.Path]::GetFullPath($P.InstallLocation).TrimEnd('\')+'\'
  $RelativeCli=if($Cli.StartsWith($Prefix,[StringComparison]::OrdinalIgnoreCase)) {$Cli.Substring($Prefix.Length)} else {$null}
  $C.windowsPackage=[pscustomobject]@{name=$P.Name;family=$P.PackageFamilyName;publisher=$P.Publisher;appRelative=$App.Substring($Prefix.Length);cliRelative=$RelativeCli}
 }
 return Resolve-TonutConfig $C
}
function Write-TonutConfig([string]$File,$Config) {
 $Temp=$File+'.tmp';[IO.File]::WriteAllText($Temp,($Config|ConvertTo-Json -Depth 8),(New-Object Text.UTF8Encoding($false)));Move-Item -LiteralPath $Temp -Destination $File -Force
}
function Get-TonutOwnedProcesses([string]$Directory) {
 $Paths=@('windows\watchdog.ps1','windows\supervisor.mjs','src\agent.mjs','startup\windows.cjs','startup\windows-bridge.ps1') | ForEach-Object {Join-Path $Directory $_}
 $Scope=$Directory.Replace('\','\\').Replace("'","\'")
 $Items=@(Get-CimInstance Win32_Process -Filter ("(Name='node.exe' OR Name='powershell.exe') AND CommandLine LIKE '%"+$Scope+"%'") -ErrorAction Stop)
 @($Items | Where-Object {
  $Line=$_.CommandLine
  if(-not $Line) {return $false}
  # Exact quoted/unquoted argument boundaries, never a substring of another project path.
  foreach($Path in $Paths) {if($Line -match ('(?:^|\s)"?'+[regex]::Escape($Path)+'"?(?=\s|$)')) {return $true}}
  return $false
 })
}
if($HostAction -eq 'Library') {return}
try {
 if($HostAction -eq 'Validate') {$C=New-TonutConfig $HostAppExe $HostCodexCli;$C|ConvertTo-Json -Depth 8 -Compress;exit}
 $C=Get-Content -LiteralPath (Join-Path $HostRoot 'config.json') -Raw | ConvertFrom-Json
 $C=Resolve-TonutConfig $C
 if($HostAction -eq 'Resolve') {$C|ConvertTo-Json -Depth 8 -Compress;exit}
 $Connections=@(Get-NetTCPConnection -State Listen -LocalPort 39222 -ErrorAction SilentlyContinue)
 $Apps=@(Get-CimInstance Win32_Process -Filter "Name='Codex.exe' OR Name='ChatGPT.exe'" | Where-Object {$_.ExecutablePath -and $_.ExecutablePath.Equals($C.AppExe,[StringComparison]::OrdinalIgnoreCase) -and $_.CommandLine -notmatch '(?:^|\s)--type(?:=|\s)'})
 if($Apps.Count -ne 1 -or -not $Connections.Count) {@{code='waiting_host'}|ConvertTo-Json -Compress;exit}
 $App=$Apps[0]
 if(@($Connections|Where-Object {$_.LocalAddress -ne '127.0.0.1'}).Count -or -not @($Connections|Where-Object {$_.OwningProcess -eq $App.ProcessId}).Count -or $App.CommandLine -notmatch '(?:^|\s)--remote-debugging-port(?:=|\s)39222(?:\s|$)') {@{code='identity_mismatch'}|ConvertTo-Json -Compress;exit}
 @{code='ready';key=([string]$App.ProcessId+':'+$App.CreationDate.ToUniversalTime().ToFileTimeUtc())}|ConvertTo-Json -Compress
} catch {@{code='identity_unavailable'}|ConvertTo-Json -Compress;exit 1}
