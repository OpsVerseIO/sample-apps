using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Threading.Tasks;
using OpenTelemetry;
using OpenTelemetry.Exporter;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Microsoft.Extensions.Configuration;
using System.Net.Http.Headers;
using System.Net.Http;

public class Program
{
    private static readonly ActivitySource MyActivitySource = new ActivitySource("MyCompany.MyProduct.MyLibrary");

    public static void Main(string[] args)
    {
        var tracerProvider = Sdk.CreateTracerProviderBuilder()
            .SetResourceBuilder(ResourceBuilder.CreateDefault().AddService("<service_name>"))
            .AddSource("MyCompany.MyProduct.MyLibrary")
            // .AddConsoleExporter() (Used only for development purposes)
            .AddOtlpExporter(opt =>
            {
                opt.Endpoint = new Uri("<opsverse_collector_url>");
                opt.Protocol = OtlpExportProtocol.Grpc;
            })
            .Build();

        StartServer();

        tracerProvider.Dispose();
    }

    public static void StartServer()
    {
        var listener = new HttpListener();
        listener.Prefixes.Add("http://localhost:8080/");
        listener.Start();
        Console.WriteLine("Server started. Listening on http://localhost:8080/");

        while (true)
        {
            var context = listener.GetContext();
            Task.Run(() => ProcessRequestAsync(context));
        }
    }

    public static async Task ProcessRequestAsync(HttpListenerContext context)
    {
        var response = context.Response;
        var requestUrl = context.Request.Url;

        if (requestUrl.AbsolutePath == "/favicon.ico")
        {
            response.StatusCode = (int)HttpStatusCode.NotFound;
            response.Close();
            return;
        }

        using (var activity = MyActivitySource.StartActivity("HTTPServer.Receive"))
        {
            activity?.SetTag("http.method", context.Request.HttpMethod);
            activity?.SetTag("http.url", requestUrl.ToString());

            var filePath = "index.html";

            try
            {
                response.ContentType = "text/html";
                using (var fileStream = new FileStream(filePath, FileMode.Open, FileAccess.Read))
                {
                    await fileStream.CopyToAsync(response.OutputStream);
                }
            }
            catch (FileNotFoundException)
            {
                response.StatusCode = (int)HttpStatusCode.NotFound;
            }
            catch (Exception)
            {
                response.StatusCode = (int)HttpStatusCode.InternalServerError;
            }
            finally
            {
                response.Close();
            }
        }
    }


}
