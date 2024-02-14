using System.Diagnostics;
using OpenTelemetry.Exporter;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using OpenTelemetry.Exporter.OpenTelemetryProtocol;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenTelemetry()
    .ConfigureResource(resource => resource.AddService("<service_name>"))
    .WithTracing(tracing =>
    {
        tracing.AddAspNetCoreInstrumentation();
        tracing.AddConsoleExporter();
        tracing.AddOtlpExporter(opt =>
        {
            opt.Endpoint = new Uri("<opsverse_collector_url>");
            opt.Protocol = OpenTelemetry.Exporter.OtlpExportProtocol.Grpc;
        });
    });

var app = builder.Build();
app.Logger.LogInformation("Starting {App}", builder.Environment.ApplicationName);

app.MapGet("/", () => "Hello World!");

app.Run();