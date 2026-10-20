$ErrorActionPreference='Stop'
$Root=Split-Path $PSScriptRoot -Parent
$Action='sentinel';$MarkerRoot=$Root
. (Join-Path $Root 'windows\host.ps1') -HostAction Library
if($Action -ne 'sentinel' -or $Root -ne $MarkerRoot) {throw 'Host library clobbered caller scope'}
foreach($File in @('windows/manage.ps1','windows/watchdog.ps1','windows/host.ps1','startup/windows-bridge.ps1')) {
 $Tokens=$null;$Errors=$null
 [Management.Automation.Language.Parser]::ParseFile((Join-Path $Root $File),[ref]$Tokens,[ref]$Errors)|Out-Null
 if($Errors.Count){throw ($Errors|Out-String)}
}
Add-Type -Path (Join-Path $Root 'startup\windows-native.cs') -ReferencedAssemblies System.Management,System.Core,System.Windows.Forms
# Real OS kernel mutex test, isolated from the product mutex and any desktop application.
$Name='Local\TonutTest.'+[guid]::NewGuid().ToString('N')
$Mutex=[Threading.Mutex]::new($false,$Name)
$Code='$m=[Threading.Mutex]::new($false,"'+$Name+'");$m.WaitOne()|Out-Null;[Console]::WriteLine("held");[Console]::Out.Flush();[Console]::ReadLine()|Out-Null;[Environment]::Exit(0)'
$Info=[Diagnostics.ProcessStartInfo]::new();$Info.FileName=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$Info.Arguments='-NoProfile -NonInteractive -EncodedCommand '+[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($Code));$Info.UseShellExecute=$false;$Info.CreateNoWindow=$true;$Info.RedirectStandardInput=$true;$Info.RedirectStandardOutput=$true
$Child=[Diagnostics.Process]::Start($Info)
try {
 if($Child.StandardOutput.ReadLine() -ne 'held'){throw 'Mutex fixture did not start'}
 if($Mutex.WaitOne(0)){throw 'Concurrent runtime lock was not exclusive'}
 $Child.StandardInput.WriteLine('exit');if(-not $Child.WaitForExit(10000)){throw 'Fixture did not exit'}
 $Owned=$false;try{$Owned=$Mutex.WaitOne(1000)}catch [Threading.AbandonedMutexException]{$Owned=$true}
 if(-not $Owned){throw 'Crashed owner left a stale kernel lock'}
 $Mutex.ReleaseMutex()
}finally{$Child.Dispose();$Mutex.Dispose()}
# Store update resolution: fixture paths, exact family/publisher, no real package mutation or host launch.
$Temp=Join-Path ([IO.Path]::GetTempPath()) ('tonut-store-test-'+[guid]::NewGuid().ToString('N'));New-Item $Temp -ItemType Directory|Out-Null
try {
 $New=Join-Path $Temp 'new-package';New-Item (Join-Path $New 'app') -ItemType Directory -Force|Out-Null
 [IO.File]::WriteAllText((Join-Path $New 'app\Codex.exe'),'fixture');[IO.File]::WriteAllText((Join-Path $New 'app\codex-cli.exe'),'fixture')
 function Get-AppxPackage {param($Name) [pscustomobject]@{PackageFamilyName='OpenAI.Codex_test';Publisher='CN=OpenAI';InstallLocation=$New}}
 function Assert-TonutPublisher([string]$Path){if(-not(Test-Path -LiteralPath $Path -PathType Leaf)){throw 'Fixture executable missing'}}
 $C=[pscustomobject]@{AppExe='old';app='old';cli='old';windowsPackage=[pscustomobject]@{name='OpenAI.Codex';family='OpenAI.Codex_test';publisher='CN=OpenAI';appRelative='app\Codex.exe';cliRelative='app\codex-cli.exe'}}
 $Resolved=Resolve-TonutConfig $C;if($Resolved.AppExe -ne (Join-Path $New 'app\Codex.exe')){throw 'Store update path not recovered'}
 $C.windowsPackage.publisher='untrusted';$Rejected=$false;try{Resolve-TonutConfig $C|Out-Null}catch{$Rejected=$true};if(-not $Rejected){throw 'Untrusted package publisher accepted'}
}finally{Remove-Item $Temp -Recurse -Force}
Write-Output 'PASS Windows parsing, native compilation, kernel crash-lock recovery and simulated exact Store resolution. No installed Codex lifecycle/UI was exercised.'
