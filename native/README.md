# Windows monitor helper

The helper is deliberately small and isolated. It polls the foreground window once per second, resolves the process executable name, reads the foreground title only when the user opts into title capture, and calculates idle time using `GetLastInputInfo`.

It does **not** capture keyboard contents, mouse coordinates, screenshots, clipboard data or browser history. Output is newline-delimited JSON on stdout. Diagnostics are written to stderr.

Build on Windows with .NET 10:

```powershell
dotnet publish native/WindowsMonitor.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o resources/windows-monitor
```
