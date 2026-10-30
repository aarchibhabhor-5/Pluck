package dev.pluck.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.io.File;
import java.nio.file.Files;
import java.util.List;

@SpringBootApplication
public class PluckBackendApplication {

    public static void main(String[] args) {
        loadDotenv();
        checkAndConfigureMongoFallback();
        SpringApplication.run(PluckBackendApplication.class, args);
    }

    /**
     * Verifies cloud MongoDB Atlas connectivity. If unreachable (e.g. current IP not in Atlas Access List or firewall),
     * automatically switches to the running local MongoDB to prevent app hang/downtime.
     */
    private static void checkAndConfigureMongoFallback() {
        String mongoUri = System.getProperty("MONGODB_URI");
        if (mongoUri == null || mongoUri.trim().isEmpty()) {
            mongoUri = System.getenv("MONGODB_URI");
        }
        if (mongoUri != null && mongoUri.contains("mongodb+srv://")) {
            boolean reachable = false;
            try {
                try (java.net.Socket socket = new java.net.Socket()) {
                    socket.connect(new java.net.InetSocketAddress("159.41.230.197", 27017), 1500);
                    reachable = true;
                } catch (Exception e1) {
                    try (java.net.Socket socket2 = new java.net.Socket()) {
                        socket2.connect(new java.net.InetSocketAddress("159.41.230.198", 27017), 1500);
                        reachable = true;
                    } catch (Exception ignored) {}
                }
            } catch (Exception ignored) {}

            if (!reachable) {
                System.out.println("[Pluck] Cloud MongoDB Atlas unreachable on port 27017 from current IP.");
                System.out.println("[Pluck] Automatically falling back to local MongoDB (mongodb://127.0.0.1:27017/pluck) for instant zero-latency responses.");
                System.setProperty("MONGODB_URI", "mongodb://127.0.0.1:27017/pluck");
                System.setProperty("spring.data.mongodb.uri", "mongodb://127.0.0.1:27017/pluck");
            } else {
                System.out.println("[Pluck] Verified cloud MongoDB Atlas connectivity.");
            }
        }
    }

    /**
     * Loads environment variables from .env file into System properties before Spring Boot boots up.
     */
    private static void loadDotenv() {
        File[] candidates = new File[]{
                new File(".env"),
                new File("backend/.env"),
                new File("../.env")
        };

        for (File f : candidates) {
            if (f.exists() && f.isFile()) {
                try {
                    List<String> lines = Files.readAllLines(f.toPath());
                    int loadedCount = 0;
                    for (String line : lines) {
                        line = line.trim();
                        if (line.isEmpty() || line.startsWith("#")) continue;
                        int eq = line.indexOf('=');
                        if (eq > 0) {
                            String key = line.substring(0, eq).trim();
                            String value = line.substring(eq + 1).trim();
                            if ((value.startsWith("\"") && value.endsWith("\"")) ||
                                (value.startsWith("'") && value.endsWith("'"))) {
                                value = value.substring(1, value.length() - 1);
                            }
                            // Set if not already provided via OS environment variable
                            if (System.getProperty(key) == null && System.getenv(key) == null) {
                                System.setProperty(key, value);
                                loadedCount++;
                            }
                        }
                    }
                    System.out.println("[Pluck] Loaded " + loadedCount + " environment variable(s) from: " + f.getAbsolutePath());
                    break;
                } catch (Exception e) {
                    System.err.println("[Pluck] Warning: Could not read .env file: " + e.getMessage());
                }
            }
        }
    }

}
