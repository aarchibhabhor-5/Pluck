package dev.pluck.backend.controller;

import dev.pluck.backend.model.User;
import dev.pluck.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository userRepository;

    @Autowired
    public AuthController(UserRepository userRepository) {
        this.userRepository = userRepository;
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
            err.put("error", "USER_NOT_FOUND");
            err.put("message", "No account found with this email. Please create an account first.");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(err);
        }

        User user = userOpt.get();
        if (user.getPassword() != null && !user.getPassword().equals(password)) {
            Map<String, String> err = new HashMap<>();
            err.put("error", "INVALID_CREDENTIALS");
            err.put("message", "Incorrect password. Please verify and try again.");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(err);
        }

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("message", "Authenticated successfully");
        res.put("token", "sess_" + UUID.randomUUID().toString().replace("-", ""));
        res.put("user", user);
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

        if (password == null || password.length() < 10) {
            Map<String, String> err = new HashMap<>();
            err.put("error", "INVALID_PASSWORD");
            err.put("message", "Password must be at least 10 characters.");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(err);
        }

        // Check if user already exists
        if (userRepository.findByEmail(email).isPresent()) {
            Map<String, String> err = new HashMap<>();
            err.put("error", "USER_ALREADY_EXISTS");
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
        newUser.setPassword(password);
        User saved = userRepository.save(newUser);

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("message", "Account created successfully in MongoDB");
        res.put("token", "sess_" + UUID.randomUUID().toString().replace("-", ""));
        res.put("user", saved);
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

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("provider", provider);
        res.put("token", "sess_oauth_" + UUID.randomUUID().toString().replace("-", ""));
        res.put("user", user);
        return ResponseEntity.ok(res);
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser() {
        List<User> users = userRepository.findAll();
        User user = users.isEmpty() ? new User("usr_alex", "Alex Developer", "alex@pluck.dev", "A", "owner") : users.get(0);
        Map<String, Object> res = new HashMap<>();
        res.put("user", user);
        return ResponseEntity.ok(res);
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout() {
        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("message", "Logged out successfully");
        return ResponseEntity.ok(res);
    }
}
