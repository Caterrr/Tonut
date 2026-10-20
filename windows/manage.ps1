param([ValidateSet('Install','Uninstall','Status')][string]$Action='Status',[string]$AppExe,[string]$CodexCli)
$ErrorActionPreference='Stop'
$Root=Split-Path $PSScriptRoot -Parent
$Dest=Join-Path $env:LOCALAPPDATA 'Tonut'
$TaskName='Tonut'
if($Action -eq 'Status') {Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue | Select-Object TaskName,State;exit}
function Stop-Ring {
 if(Test-Path $Dest) {
  [IO.File]::WriteAllText((Join-Path $Dest 'stop.request'),"stop`n")
  $Lock=Join-Path $Dest 'supervisor.lock'
  $Until=(Get-Date).AddSeconds(45)
  while((Test-Path $Lock) -and (Get-Date) -lt $Until) {Start-Sleep -Milliseconds 200}
  if(Test-Path $Lock) {throw 'Background helper has not stopped. No processes were force-terminated; inspect before retry.'}
 }
}
if($Action -eq 'Uninstall') {
 Stop-Ring
 Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
 if(Test-Path $Dest) {Remove-Item $Dest -Recurse}
 Write-Output 'Removed Tonut only. Normally quit and reopen Codex to close the debug port.'
 exit
}
$Node=(Get-Command node -ErrorAction Stop).Source
$Major=[int]((& $Node -p 'process.versions.node.split(".")[0]') | Select-Object -Last 1)
if($Major -lt 24) {throw 'Node.js 24+ is required'}
if(-not $AppExe -or -not $CodexCli) {throw 'Supply -AppExe and -CodexCli absolute paths to the official installed Codex desktop and its CLI. No credentials are required.'}
$AppExe=(Resolve-Path -LiteralPath $AppExe).Path
$CodexCli=(Resolve-Path -LiteralPath $CodexCli).Path
if([IO.Path]::GetFileName($AppExe) -notmatch '^(Codex|ChatGPT)\.exe$') {throw 'Select the official desktop executable'}
$Signature=Get-AuthenticodeSignature -LiteralPath $AppExe
if($Signature.Status -ne 'Valid' -or $Signature.SignerCertificate.Subject -notmatch 'OpenAI') {throw 'The selected desktop must have a valid OpenAI publisher signature'}
$CliSignature=Get-AuthenticodeSignature -LiteralPath $CodexCli
if($CliSignature.Status -ne 'Valid' -or $CliSignature.SignerCertificate.Subject -notmatch 'OpenAI') {throw 'The selected CLI must have a valid OpenAI publisher signature'}
Stop-Ring
New-Item $Dest -ItemType Directory -Force | Out-Null
$Files=@('package.json','LICENSE','THIRD_PARTY_NOTICES.md','docs/UPSTREAM-LICENSE','src/agent.mjs','src/renderer.mjs','src/quota.mjs','src/cdp.mjs','src/app-server.mjs','startup/controller.cjs','startup/windows.cjs','startup/windows-bridge.ps1','startup/windows-native.cs','windows/supervisor.mjs','windows/manage.ps1')
foreach($File in $Files) {
 $Target=Join-Path $Dest $File
 New-Item (Split-Path $Target -Parent) -ItemType Directory -Force | Out-Null
 Copy-Item -LiteralPath (Join-Path $Root $File) -Destination $Target -Force
}
$Config=@{port=39222;cli=$CodexCli;app=$AppExe;AppExe=$AppExe;duration=10080} | ConvertTo-Json
[IO.File]::WriteAllText((Join-Path $Dest 'config.json'),$Config,(New-Object Text.UTF8Encoding($false)))
Remove-Item (Join-Path $Dest 'stop.request') -Force -ErrorAction SilentlyContinue
# A built-in WScript wrapper starts our supervisor hidden; no console at login, admin or policy bypass.
$Q=[char]34
$Line='CreateObject("WScript.Shell").Run '+$Q+($Q+$Node+$Q+' '+$Q+(Join-Path $Dest 'windows/supervisor.mjs')+$Q).Replace('"','""')+$Q+', 0, False'
[IO.File]::WriteAllText((Join-Path $Dest 'start.vbs'),$Line)
$User=[Security.Principal.WindowsIdentity]::GetCurrent().Name
$Trigger=New-ScheduledTaskTrigger -AtLogOn -User $User
$Principal=New-ScheduledTaskPrincipal -UserId $User -LogonType Interactive -RunLevel Limited
$Start=New-ScheduledTaskAction -Execute (Join-Path $env:SystemRoot 'System32/wscript.exe') -Argument ('"'+(Join-Path $Dest 'start.vbs')+'"')
$Settings=New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName $TaskName -Action $Start -Trigger $Trigger -Principal $Principal -Settings $Settings -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName
Write-Output 'Installed. Existing running app remains open. Windows build is experimental and requires on-device verification.'
