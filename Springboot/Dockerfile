FROM openjdk:17-oracle
WORKDIR /Users/shivtejnarake/Springboot/Springboot
COPY /target/hello-0.0.1-SNAPSHOT.jar /hello-0.0.1-SNAPSHOT.jar
COPY /opentelemetry-javaagent.jar /opentelemetry-javaagent.jar
COPY /otel-0.10.1.jar /otel-0.10.1.jar
COPY /agent-0.10.2.jar /agent-0.10.2.jar
ENV PYROSCOPE_APPLICATION_NAME=springboot.java
ENV PYROSCOPE_SERVER_ADDRESS=http://pyroscope.pyroscope.svc.cluster.local:4040

EXPOSE 8080
#ENTRYPOINT java -jar /hello-0.0.1-SNAPSHOT.jar -javaagent:/opentelemetry-javaagent.jar -Dotel.javaagent.extensions=/otel-0.10.1.jar -Dpyroscope.application.name=springboot-java-instrumentation -Dotel.pyroscope.start.profiling=true -Dpyroscope.format=jfr -Dpyroscope.profiler.event=itimer -Dpyroscope.server.address=http://pyroscope.pyroscope.svc.cluster.local -Dotel.resource.attributes=service.name=hello-service -Dotel.traces.exporter=zipkin -Dotel.exporter.zipkin.endpoint=http://otel-collector.devopsnow.svc.cluster.local:9411

ENTRYPOINT java -javaagent:/agent-0.10.2.jar -jar /hello-0.0.1-SNAPSHOT.jar




