FROM openjdk:17-oracle
WORKDIR /Users/shivtejnarake/Springboot/Springboot
COPY /target/hello-0.0.1-SNAPSHOT.jar /hello-0.0.1-SNAPSHOT.jar
COPY /opentelemetry-javaagent.jar /opentelemetry-javaagent.jar
ENTRYPOINT java -javaagent:/opentelemetry-javaagent.jar -Dotel.resource.attributes=service.name=hello-service -Dotel.traces.exporter=zipkin -Dotel.exporter.zipkin.endpoint=$ZIPKIN_ENDPOINT -Dotel.metrics.exporter=none -jar /hello-0.0.1-SNAPSHOT.jar









