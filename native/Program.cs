using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Diagnostics;

if (!OperatingSystem.IsWindows())
{
    Console.Error.WriteLine("WindowsMonitor only runs on Windows.");
    return 2;
}

var interval = 1000;
var captureWindowTitles = args.Any(arg => string.Equals(arg, "--capture-window-titles=true", StringComparison.OrdinalIgnoreCase));
foreach (var arg in args)
{
    if (arg.StartsWith("--interval-ms=", StringComparison.OrdinalIgnoreCase) && int.TryParse(arg[14..], out var parsed))
        interval = Math.Clamp(parsed, 250, 5000);
}

using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(interval));
while (await timer.WaitForNextTickAsync())
{
    try
    {
        var hwnd = Native.GetForegroundWindow();
        if (hwnd == IntPtr.Zero) continue;
        var title = new StringBuilder();
        if (captureWindowTitles)
        {
            var length = Native.GetWindowTextLength(hwnd);
            title = new StringBuilder(Math.Clamp(length + 1, 1, 2048));
            _ = Native.GetWindowText(hwnd, title, title.Capacity);
        }
        _ = Native.GetWindowThreadProcessId(hwnd, out var pid);
        var processName = "unknown";
        try { using var process = Process.GetProcessById((int)pid); processName = process.ProcessName + ".exe"; }
        catch (Exception) { /* Protected or short-lived process: retain safe fallback. */ }
        var idle = Native.GetIdleSeconds();
        var payload = new { type = "sample", timestamp = DateTime.UtcNow.ToString("O"), processName, windowTitle = title.ToString(), idleSeconds = idle };
        Console.WriteLine(JsonSerializer.Serialize(payload));
        Console.Out.Flush();
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"Sample error: {ex.Message}");
    }
}
return 0;

internal static class Native
{
    [DllImport("user32.dll")] internal static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] internal static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] internal static extern int GetWindowTextLength(IntPtr hWnd);
    [DllImport("user32.dll")] internal static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("user32.dll")] private static extern bool GetLastInputInfo(ref LastInputInfo info);
    [DllImport("kernel32.dll")] private static extern ulong GetTickCount64();

    [StructLayout(LayoutKind.Sequential)]
    private struct LastInputInfo { public uint cbSize; public uint dwTime; }

    internal static double GetIdleSeconds()
    {
        var info = new LastInputInfo { cbSize = (uint)Marshal.SizeOf<LastInputInfo>() };
        if (!GetLastInputInfo(ref info)) return 0;
        var tick = unchecked((uint)GetTickCount64());
        return Math.Max(0, unchecked(tick - info.dwTime) / 1000d);
    }
}
