# Multi-stage Dockerfile for Pluck Spring Boot Backend (Render deployment)
# Stage 1: Build JAR using Maven
FROM eclipse-temurin:21-jdk-jammy AS builder
WORKDIR /app
COPY . .
RUN chmod +x ./mvnw && ./mvnw clean package -DskipTests

# Stage 2: Minimal, fast, secure production runtime
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
COPY --from=builder /app/target/pluck-backend-0.0.1-SNAPSHOT.jar app.jar

# Render injects PORT dynamically (defaults to 10000 on Render, 4000 locally)
ENV PORT=10000
EXPOSE 10000

ENTRYPOINT ["java", "-Dserver.port=${PORT}", "-jar", "app.jar"]

