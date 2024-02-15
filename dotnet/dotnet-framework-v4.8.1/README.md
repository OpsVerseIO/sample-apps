# OpsVerse .NET Sample Application Instrumentation

A sample .NET application running on .NET Framework v4.8.1 to send traces to OpsVerse ObserveNow stack

**Pre-Requisites**

- .NET Framework v4.8.1 installed on your machine
- Install the necessary packages using `dotnet add package` command or using NuGet Package Manager:
    - Microsoft.AspNetCore.Hosting
    - Microsoft.Net.Http
    - Microsoft.Owin.Hosting
    - Nancy
    - Nancy.Owin
    - OpenTelemetry
    - OpenTelemetry.Exporter.Console (Used only for development purposes)
    - OpenTelemetry.Exporter.OpenTelemetryProtocol
    - OpenTelemetry.Instrumentation.AspNetCore
    - OpenTelemetry.Instrumentation.HTTP

**How to run**

```
$ dotnet build
$ dotnet run
// Visit http://localhost:8080 and generate traces
// which should show up in your ObserveNow Grafana instantly.
```