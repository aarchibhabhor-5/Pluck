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
        SpringApplication.run(PluckBackendApplication.class, args);
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
