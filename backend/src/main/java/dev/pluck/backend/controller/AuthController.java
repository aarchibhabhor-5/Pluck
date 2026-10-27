package dev.pluck.backend.controller;

import dev.pluck.backend.model.User;
import dev.pluck.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository userRepository;

    // Simple session store (in-memory for dev; PRD §2.4.5 uses server-side sessions)
    private static final Map<String, String> activeSessions = new HashMap<>();

    @Autowired
    public AuthController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * Hash password using SHA-256 (placeholder for argon2id in production per PRD §2.4.5).
     * In production this MUST be argon2id (m=19 MiB, t=2, p=1).
     */
    private String hashPassword(String password) {
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

    private boolean verifyPassword(String rawPassword, String storedHash) {
        return hashPassword(rawPassword).equals(storedHash);
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

        email = email.trim().toLowerCase();
        Optional<User> userOpt = userRepository.findByEmail(email);

        if (userOpt.isEmpty()) {
            Map<String, String> err = new HashMap<>();
            err.put("error", "INVALID_CREDENTIALS");
            err.put("message", "Invalid email or password.");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(err);
        }

        User user = userOpt.get();
        if (user.getPassword() == null || !verifyPassword(password, user.getPassword())) {
            Map<String, String> err = new HashMap<>();
            err.put("error", "INVALID_CREDENTIALS");
            err.put("message", "Invalid email or password.");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(err);
        }

        // Create session token (PRD §2.4.5: opaque server-side sessions)
        String sessionToken = "sess_" + UUID.randomUUID().toString().replace("-", "");
        String sessionHash = hashPassword(sessionToken);
        activeSessions.put(sessionHash, user.getId());

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
        if (userRepository.findByEmail(email).isPresent()) {
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

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("message", "Account created successfully");
        res.put("token", sessionToken);
        res.put("user", sanitizeUser(saved));
        return ResponseEntity.status(HttpStatus.CREATED).body(res);
    }

    @PostMapping("/oauth")
    public ResponseEntity<?> oauth(@RequestBody(required = false) Map<String, String> body) {
        String provider = (body != null && body.containsKey("provider")) ? body.get("provider") : "Google";
        String email = (body != null && body.containsKey("email")) ? body.get("email") : null;
        String name = (body != null && body.containsKey("name")) ? body.get("name") : null;
        String avatar = (body != null && body.containsKey("avatar")) ? body.get("avatar") : null;

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

        String sessionToken = "sess_oauth_" + UUID.randomUUID().toString().replace("-", "");
        String sessionHash = hashPassword(sessionToken);
        activeSessions.put(sessionHash, user.getId());

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("provider", provider);
        res.put("token", sessionToken);
        res.put("user", sanitizeUser(user));
        return ResponseEntity.ok(res);
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        // Try to resolve user from session token (PRD §2.4.5)
        User user = null;
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            String tokenHash = hashPassword(token);
            String userId = activeSessions.get(tokenHash);
            if (userId != null) {
                user = userRepository.findById(userId).orElse(null);
            }
        }

        // Fallback: return the most recently created user (dev convenience)
        if (user == null) {
            List<User> users = userRepository.findAll();
            if (!users.isEmpty()) {
                user = users.get(users.size() - 1);
            }
        }

        if (user == null) {
            Map<String, String> err = new HashMap<>();
            err.put("error", "UNAUTHENTICATED");
            err.put("message", "No valid session. Please log in.");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(err);
        }

        Map<String, Object> res = new HashMap<>();
        res.put("user", sanitizeUser(user));
        return ResponseEntity.ok(res);
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        // Revoke the session token (PRD §2.4.5: revocable sessions)
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            String tokenHash = hashPassword(token);
            activeSessions.remove(tokenHash);
        }

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("message", "Logged out successfully");
        return ResponseEntity.ok(res);
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
            String token = authHeader.substring(7);
            try {
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
                StringBuilder hex = new StringBuilder();
                for (byte b : hash) {
                    hex.append(String.format("%02x", b));
                }
                return activeSessions.get(hex.toString());
            } catch (NoSuchAlgorithmException e) {
                return null;
            }
        }
        return null;
    }
}
