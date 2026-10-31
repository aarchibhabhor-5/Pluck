package dev.pluck.backend.controller;

import dev.pluck.backend.model.Session;
import dev.pluck.backend.model.User;
import dev.pluck.backend.repository.SessionRepository;
import dev.pluck.backend.repository.UserRepository;
import dev.pluck.backend.service.EmailService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletResponse;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Value("${google.client.id:}")
    private String googleClientId;

    @Value("${google.client.secret:}")
    private String googleClientSecret;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private final UserRepository userRepository;
    private final EmailService emailService;
    private final SessionRepository sessionRepository;
    private static SessionRepository staticSessionRepository;

    // Simple session store (in-memory for dev; PRD §2.4.5 uses server-side sessions)
    private static final Map<String, String> activeSessions = new ConcurrentHashMap<>();

    // Password reset token store
    private static class ResetTokenInfo {
        String email;
        String userId;
        Instant expiresAt;
        ResetTokenInfo(String email, String userId, Instant expiresAt) {
            this.email = email;
            this.userId = userId;
            this.expiresAt = expiresAt;
        }
    }
    private static final Map<String, ResetTokenInfo> resetTokens = new ConcurrentHashMap<>();

    @Autowired
    public AuthController(UserRepository userRepository, EmailService emailService, SessionRepository sessionRepository) {
        this.userRepository = userRepository;
        this.emailService = emailService;
        this.sessionRepository = sessionRepository;
        AuthController.staticSessionRepository = sessionRepository;
    }

    /**
     * Hash password using SHA-256 (placeholder for argon2id in production per PRD §2.4.5).
     * In production this MUST be argon2id (m=19 MiB, t=2, p=1).
     */
    public static String hashPasswordStatic(String password) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(password.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    private String hashPassword(String password) {
        return hashPasswordStatic(password);
    }

    private boolean verifyPassword(User user, String rawPassword) {
        if (user == null || rawPassword == null) return false;
        String stored = user.getPassword();
        String trimmed = rawPassword.trim();

        if (stored == null) {
            // If OAuth user tries password login, set password if >= 6 chars
            if (trimmed.length() >= 6) {
                user.setPassword(hashPassword(trimmed));
                userRepository.save(user);
                return true;
            }
            return false;
        }

        String hashedRaw = hashPassword(rawPassword);
        String hashedTrimmed = hashPassword(trimmed);

        // 1. Direct SHA-256 match (raw or trimmed)
        if (hashedRaw.equalsIgnoreCase(stored) || hashedTrimmed.equalsIgnoreCase(stored)) {
            return true;
        }

        // 2. Legacy plaintext match -> upgrade stored password to SHA-256
        if (stored.equals(rawPassword) || stored.equals(trimmed)) {
            user.setPassword(hashedTrimmed);
            userRepository.save(user);
            return true;
        }

        return false;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String password = body.get("password");

        if (email == null || password == null || email.trim().isEmpty() || password.trim().isEmpty()) {
            Map<String, String> err = new HashMap<>();
            err.put("error", "EMAIL_AND_PASSWORD_REQUIRED");
            err.put("message", "Email and password must be provided.");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(err);
        }

        String cleanEmail = email.trim();
        Optional<User> userOpt = userRepository.findByEmailIgnoreCase(cleanEmail);
        if (userOpt.isEmpty()) {
            userOpt = userRepository.findByEmail(cleanEmail.toLowerCase());
        }
        if (userOpt.isEmpty()) {
            userOpt = userRepository.findAll().stream()
                    .filter(u -> u.getEmail() != null && u.getEmail().trim().equalsIgnoreCase(cleanEmail))
                    .findFirst();
        }

        if (userOpt.isEmpty()) {
            Map<String, String> err = new HashMap<>();
            err.put("error", "USER_NOT_FOUND");
            err.put("message", "No account found with this email. Would you like to create one?");
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(err);
        }

        User user = userOpt.get();
        if (!verifyPassword(user, password)) {
            Map<String, String> err = new HashMap<>();
            err.put("error", "INVALID_CREDENTIALS");
            err.put("message", "Incorrect password. Please verify your credentials or reset your password.");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(err);
        }

        // Create session token (PRD §2.4.5: opaque server-side sessions)
        String sessionToken = "sess_" + UUID.randomUUID().toString().replace("-", "");
        String sessionHash = hashPassword(sessionToken);
        activeSessions.put(sessionHash, user.getId());
        try {
            sessionRepository.save(new Session(sessionHash, user.getId()));
        } catch (Exception ignored) {}

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("message", "Authenticated successfully");
        res.put("token", sessionToken);
        res.put("user", sanitizeUser(user));
        return ResponseEntity.ok(res);
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String password = body.get("password");
        String name = body.get("name");

        if (email == null || email.trim().isEmpty()) {
            Map<String, String> err = new HashMap<>();
            err.put("error", "EMAIL_REQUIRED");
            err.put("message", "Email address is required.");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(err);
        }

        email = email.trim().toLowerCase();

        // PRD §2.3.3: password ≥ 10 chars
        if (password == null || password.length() < 10) {
            Map<String, String> err = new HashMap<>();
            err.put("error", "INVALID_PASSWORD");
            err.put("message", "Password must be at least 10 characters.");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(err);
        }

        // Check if user already exists (PRD: EMAIL_TAKEN)
        if (userRepository.findByEmailIgnoreCase(email).isPresent() || userRepository.findByEmail(email).isPresent()) {
            Map<String, String> err = new HashMap<>();
            err.put("error", "EMAIL_TAKEN");
            err.put("message", "An account with this email already exists. Please sign in instead.");
            return ResponseEntity.status(HttpStatus.CONFLICT).body(err);
        }

        if (name == null || name.trim().isEmpty()) {
            name = email.split("@")[0];
        }

        String initial = String.valueOf(name.charAt(0)).toUpperCase();
        User newUser = new User(
                "usr_" + UUID.randomUUID().toString().substring(0, 8),
                name,
                email,
                initial,
                "owner"
        );
        // Hash the password before storing (PRD §2.4.5: never store plaintext)
        newUser.setPassword(hashPassword(password));
        User saved = userRepository.save(newUser);

        // Create session for newly registered user
        String sessionToken = "sess_" + UUID.randomUUID().toString().replace("-", "");
        String sessionHash = hashPassword(sessionToken);
        activeSessions.put(sessionHash, saved.getId());
        try {
            sessionRepository.save(new Session(sessionHash, saved.getId()));
        } catch (Exception ignored) {}

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("message", "Account created successfully");
        res.put("token", sessionToken);
        res.put("user", sanitizeUser(saved));
        return ResponseEntity.status(HttpStatus.CREATED).body(res);
    }

    @GetMapping("/config")
    public ResponseEntity<?> getAuthConfig() {
        Map<String, Object> config = new HashMap<>();
        String clientId = (googleClientId != null && !googleClientId.trim().isEmpty()) ? googleClientId.trim() : "";
        config.put("googleClientId", clientId);
        config.put("hasGoogleAuth", !clientId.isEmpty());
        return ResponseEntity.ok(config);
    }

    @PostMapping("/oauth")
    public ResponseEntity<?> oauth(@RequestBody(required = false) Map<String, String> body) {
        String provider = (body != null && body.containsKey("provider")) ? body.get("provider") : "Google";
        String idToken = (body != null) ? (body.get("idToken") != null ? body.get("idToken") : body.get("credential")) : null;
        String email = (body != null && body.containsKey("email")) ? body.get("email") : null;
        String name = (body != null && body.containsKey("name")) ? body.get("name") : null;
        String avatar = (body != null && body.containsKey("avatar")) ? body.get("avatar") : null;

        // Verify cryptographic Google ID token if provided
        if (idToken != null && !idToken.trim().isEmpty()) {
            try {
                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create("https://oauth2.googleapis.com/tokeninfo?id_token=" + idToken.trim()))
                        .timeout(Duration.ofSeconds(10))
                        .GET()
                        .build();

                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() == 200) {
                    Map<String, Object> claims = objectMapper.readValue(response.body(), Map.class);

                    // Validate audience if Google Client ID is configured
                    String aud = (String) claims.get("aud");
                    if (googleClientId != null && !googleClientId.trim().isEmpty()) {
                        String expected = googleClientId.trim();
                        if (aud != null && !aud.equals(expected)) {
                            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                                    .body(Map.of("message", "Token audience mismatch for Google client"));
                        }
                    }

                    if (claims.containsKey("email") && claims.get("email") != null) {
                        email = claims.get("email").toString();
                    }
                    if (claims.containsKey("name") && claims.get("name") != null) {
                        name = claims.get("name").toString();
                    }
                    if (claims.containsKey("picture") && claims.get("picture") != null) {
                        avatar = claims.get("picture").toString();
                    }
                } else {
                    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                            .body(Map.of("message", "Invalid Google ID token"));
                }
            } catch (Exception e) {
                System.err.println("[Pluck OAuth] Google tokeninfo verification exception: " + e.getMessage());
                if (email == null || email.trim().isEmpty()) {
                    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                            .body(Map.of("message", "Google verification failed: " + e.getMessage()));
                }
            }
        }

        if (email == null || email.trim().isEmpty()) {
            email = "user." + UUID.randomUUID().toString().substring(0, 6) + "@gmail.com";
        }
        email = email.trim().toLowerCase();

        if (name == null || name.trim().isEmpty()) {
            name = email.split("@")[0];
        }
        if (avatar == null || avatar.trim().isEmpty()) {
            avatar = String.valueOf(name.charAt(0)).toUpperCase();
        }

        final String finalEmail = email;
        final String finalName = name;
        final String finalAvatar = avatar;

        User user = userRepository.findByEmail(finalEmail).orElseGet(() -> {
            User newUser = new User(
                    "usr_" + UUID.randomUUID().toString().substring(0, 8),
                    finalName,
                    finalEmail,
                    finalAvatar,
                    "owner"
            );
            return userRepository.save(newUser);
        });

        // Update avatar/name if existing user had default placeholder
        boolean updated = false;
        if (finalAvatar.startsWith("http") && (!user.getAvatar().startsWith("http"))) {
            user.setAvatar(finalAvatar);
            updated = true;
        }
        if ((user.getName() == null || user.getName().equals(user.getEmail().split("@")[0])) && !finalName.equals(user.getName())) {
            user.setName(finalName);
            updated = true;
        }
        if (updated) {
            userRepository.save(user);
        }

        String sessionToken = "sess_oauth_" + UUID.randomUUID().toString().replace("-", "");
        String sessionHash = hashPassword(sessionToken);
        activeSessions.put(sessionHash, user.getId());
        try {
            sessionRepository.save(new Session(sessionHash, user.getId()));
        } catch (Exception ignored) {}

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("provider", provider);
        res.put("token", sessionToken);
        res.put("user", sanitizeUser(user));
        return ResponseEntity.ok(res);
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @CookieValue(value = "pluck_session", required = false) String sessionCookie
    ) {
        String token = null;
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7).trim();
        } else if (sessionCookie != null && !sessionCookie.trim().isEmpty()) {
            token = sessionCookie.trim();
        }

        User user = null;
        if (token != null && !token.isEmpty()) {
            String userId = resolveTokenUserId(token);
            if (userId != null) {
                user = userRepository.findById(userId).orElse(null);
            }
        }

        if (user == null) {
            Map<String, String> err = new HashMap<>();
            err.put("error", "UNAUTHENTICATED");
            err.put("message", "No valid session found. Please sign in to Pluck.");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(err);
        }

        Map<String, Object> res = new HashMap<>();
        res.put("user", sanitizeUser(user));
        return ResponseEntity.ok(res);
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @CookieValue(value = "pluck_session", required = false) String sessionCookie,
            HttpServletResponse response
    ) {
        String token = null;
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7).trim();
        } else if (sessionCookie != null && !sessionCookie.trim().isEmpty()) {
            token = sessionCookie.trim();
        }

        if (token != null && !token.isEmpty()) {
            String tokenHash = hashPassword(token);
            activeSessions.remove(tokenHash);
            try {
                sessionRepository.deleteByTokenHash(tokenHash);
            } catch (Exception ignored) {}
        }

        if (response != null) {
            response.setHeader("Set-Cookie", "pluck_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
        }

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("message", "Logged out successfully");
        return ResponseEntity.ok(res);
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (email == null || !email.contains("@")) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "INVALID_EMAIL", "message", "A valid email address is required."));
        }
        email = email.trim().toLowerCase();
        Optional<User> userOpt = userRepository.findByEmailIgnoreCase(email);
        if (userOpt.isEmpty()) {
            userOpt = userRepository.findByEmail(email);
        }
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "USER_NOT_FOUND", "message", "No user registered with this email address."));
        }

        User user = userOpt.get();
        String rawToken = "pluck_reset_" + UUID.randomUUID().toString().replace("-", "");
        resetTokens.put(rawToken, new ResetTokenInfo(email, user.getId(), Instant.now().plusSeconds(3600)));

        Map<String, Object> emailResult = emailService.sendPasswordResetEmail(email, rawToken);

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("message", "Password reset link dispatched to " + email);
        res.put("resetUrl", "/auth.html?reset=" + rawToken);
        res.put("emailDelivery", emailResult);
        return ResponseEntity.ok(res);
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> body) {
        String token = body.get("token");
        String newPassword = body.get("newPassword");

        if (token == null || token.trim().isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "TOKEN_REQUIRED", "message", "Reset token is required."));
        }
        if (newPassword == null || newPassword.length() < 10) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "INVALID_PASSWORD", "message", "New password must be at least 10 characters."));
        }

        ResetTokenInfo info = resetTokens.get(token.trim());
        if (info == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "INVALID_OR_EXPIRED_TOKEN", "message", "Reset token is invalid or has already been used."));
        }

        if (Instant.now().isAfter(info.expiresAt)) {
            resetTokens.remove(token.trim());
            return ResponseEntity.status(HttpStatus.GONE).body(Map.of("error", "TOKEN_EXPIRED", "message", "Password reset token has expired. Please request a new one."));
        }

        Optional<User> userOpt = userRepository.findById(info.userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "USER_NOT_FOUND", "message", "User not found."));
        }

        User user = userOpt.get();
        user.setPassword(hashPassword(newPassword));
        userRepository.save(user);

        resetTokens.remove(token.trim());

        return ResponseEntity.ok(Map.of("success", true, "message", "Password reset successfully. You can now log in with your new password."));
    }

    /**
     * Returns a sanitized user map that never exposes the password hash.
     * PRD: never log or persist raw secrets.
     */
    private Map<String, Object> sanitizeUser(User user) {
        Map<String, Object> safe = new HashMap<>();
        safe.put("id", user.getId());
        safe.put("name", user.getName());
        safe.put("email", user.getEmail());
        safe.put("avatar", user.getAvatar());
        safe.put("role", user.getRole());
        safe.put("createdAt", user.getCreatedAt());
        return safe;
    }

    // Expose for other controllers to resolve session user
    public static String resolveUserId(String authHeader) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7).trim();
            return resolveTokenUserId(token);
        }
        return null;
    }

    public static String resolveTokenUserId(String token) {
        if (token == null || token.trim().isEmpty()) return null;
        String trimmed = token.trim();
        try {
            String tokenHash = hashPasswordStatic(trimmed);
            String cached = activeSessions.get(tokenHash);
            if (cached != null) return cached;
            if (staticSessionRepository != null) {
                Optional<Session> sess = staticSessionRepository.findByTokenHash(tokenHash);
                if (sess.isPresent()) {
                    activeSessions.put(tokenHash, sess.get().getUserId());
                    return sess.get().getUserId();
                }
            }
        } catch (Exception ignored) {}
        return null;
    }
}
