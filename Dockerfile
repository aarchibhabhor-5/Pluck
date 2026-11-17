# Multi-stage build for Pluck Spring Boot Backend (Java 21)
FROM eclipse-temurin:21-jdk-jammy AS builder
WORKDIR /app
COPY backend/ .
RUN chmod +x ./mvnw && ./mvnw clean package -DskipTests

FROM eclipse-temurin:21-jdk-jammy
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends nodejs python3 python-is-python3 && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/pluck-backend-0.0.1-SNAPSHOT.jar app.jar
ENV PORT=10000
EXPOSE 10000
ENTRYPOINT ["java", "-Dserver.port=${PORT}", "-jar", "app.jar"]
