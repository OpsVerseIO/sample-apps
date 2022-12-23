FROM openjdk:17-oracle
WORKDIR /Users/shivtejnarake/Git-Repos/sample-apps/springboot
COPY /target/hello-0.0.1-SNAPSHOT.jar /hello-0.0.1-SNAPSHOT.jar
COPY /opentelemetry-javaagent.jar /opentelemetry-javaagent.jar
COPY /opentelemetry-java-instrumentation-extension-demo-1.0-all.jar /opentelemetry-java-instrumentation-extension-demo-1.0-all.jar
ENTRYPOINT java -javaagent:/opentelemetry-javaagent.jar -Dotel.resource.attributes=service.name=hello-service -Dotel.traces.exporter=otlp -Dotel.exporter.otlp.endpoint=http://otel-collector.devopsnow.svc.cluster.local:4317 -Dotel.metrics.exporter=none  -Dotel.javaagent.extensions=/opentelemetry-java-instrumentation-extension-demo-1.0-all.jar -jar /hello-0.0.1-SNAPSHOT.jar
