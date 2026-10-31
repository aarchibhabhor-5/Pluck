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
        // When running in cloud hosting environments like Render, always use the configured cloud MongoDB URI
        if (System.getenv("RENDER") != null || System.getenv("DYNO") != null || "production".equalsIgnoreCase(System.getenv("ENVIRONMENT"))) {
            return;
        }

        String mongoUri = System.getProperty("MONGODB_URI");
        if (mongoUri == null || mongoUri.trim().isEmpty()) {
            mongoUri = System.getenv("MONGODB_URI");
        }
        if (mongoUri != null && mongoUri.contains("mongodb+srv://")) {
            boolean reachable = false;
            try {
                String host = null;
                int atIdx = mongoUri.indexOf('@');
                if (atIdx != -1) {
                    int end = mongoUri.indexOf('/', atIdx);
                    if (end == -1) end = mongoUri.indexOf('?', atIdx);
                    if (end == -1) end = mongoUri.length();
                    host = mongoUri.substring(atIdx + 1, end).trim();
                }

                if (host != null && !host.isEmpty()) {
                    java.util.Hashtable<String, String> env = new java.util.Hashtable<>();
                    env.put("java.naming.factory.initial", "com.sun.jndi.dns.DnsContextFactory");
                    javax.naming.directory.DirContext dirContext = new javax.naming.directory.InitialDirContext(env);
                    javax.naming.directory.Attributes attrs = dirContext.getAttributes("_mongodb._tcp." + host, new String[]{"SRV"});
                    javax.naming.directory.Attribute attr = attrs != null ? attrs.get("SRV") : null;
                    if (attr != null && attr.size() > 0) {
                        for (int i = 0; i < Math.min(attr.size(), 3); i++) {
                            String srvRecord = (String) attr.get(i);
                            String[] parts = srvRecord.split("\\s+");
                            if (parts.length >= 4) {
                                String targetHost = parts[3].endsWith(".") ? parts[3].substring(0, parts[3].length() - 1) : parts[3];
                                int port = Integer.parseInt(parts[2]);
                                try (java.net.Socket socket = new java.net.Socket()) {
                                    socket.connect(new java.net.InetSocketAddress(targetHost, port), 1500);
                                    reachable = true;
                                    break;
                                } catch (Exception ignored) {}
                            }
                        }
                    }
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
