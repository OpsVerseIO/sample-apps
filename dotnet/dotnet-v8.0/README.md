# OpsVerse .NET Sample Application Instrumentation

A sample .NET application running on .NET v8.0 to send traces to OpsVerse ObserveNow stack

**Pre-Requisites**

- .NET v8.0 installed on your machine
- Install the necessary packages using `dotnet add package` command:
    - OpenTelemetry.Exporter.Console (Used only for development purposes)
    - OpenTelemetry.Exporter.OpenTelemetryProtocol
    - OpenTelemetry.Instrumentation.AspNetCore
    - OpenTelemetry.Instrumentation.Hosting

**How to run**

```
$ dotnet build
$ dotnet run
// Visit http://localhost:5096 and generate traces
// which should show up in your ObserveNow Grafana instantly.
```