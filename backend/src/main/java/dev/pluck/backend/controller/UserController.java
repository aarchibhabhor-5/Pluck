package dev.pluck.backend.controller;

import dev.pluck.backend.model.User;
import dev.pluck.backend.model.UserPreferences;
import dev.pluck.backend.repository.UserPreferencesRepository;
import dev.pluck.backend.repository.UserRepository;
import dev.pluck.backend.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/user")
public class UserController {

    private final UserRepository userRepository;
    private final UserPreferencesRepository userPreferencesRepository;
    private final AuthService authService;

    @Autowired
    public UserController(UserRepository userRepository, UserPreferencesRepository userPreferencesRepository, AuthService authService) {
        this.userRepository = userRepository;
        this.userPreferencesRepository = userPreferencesRepository;
        this.authService = authService;
    }

    private User resolveCaller(String authHeader, String xUserId) {
        return authService.resolveCaller(authHeader, xUserId);
    }

    @GetMapping("/profile")
    public ResponseEntity<?> getProfile(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId) {
        User user = resolveCaller(authHeader, xUserId);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "UNAUTHORIZED", "message", "User session expired or invalid."));
        }

        Map<String, Object> safe = new HashMap<>();
        safe.put("id", user.getId());
        safe.put("name", user.getName());
        safe.put("email", user.getEmail());
        safe.put("avatar", user.getAvatar());
        safe.put("role", user.getRole());
        safe.put("createdAt", user.getCreatedAt());

        return ResponseEntity.ok(Map.of("success", true, "user", safe));
    }

    @PatchMapping("/profile")
    public ResponseEntity<?> updateProfile(
            @RequestBody Map<String, String> body,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId
    ) {
        User user = resolveCaller(authHeader, xUserId);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "UNAUTHORIZED", "message", "User session expired or invalid."));
        }

        if (body.containsKey("name") && body.get("name") != null && !body.get("name").trim().isEmpty()) {
            user.setName(body.get("name").trim());
        }
        if (body.containsKey("avatar") && body.get("avatar") != null && !body.get("avatar").trim().isEmpty()) {
            user.setAvatar(body.get("avatar").trim());
        }

        User saved = userRepository.save(user);

        Map<String, Object> safe = new HashMap<>();
        safe.put("id", saved.getId());
        safe.put("name", saved.getName());
        safe.put("email", saved.getEmail());
        safe.put("avatar", saved.getAvatar());
        safe.put("role", saved.getRole());
        safe.put("createdAt", saved.getCreatedAt());

        return ResponseEntity.ok(Map.of("success", true, "message", "Profile updated successfully", "user", safe));
    }

    @GetMapping("/preferences")
    public ResponseEntity<?> getPreferences(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId) {
        User user = resolveCaller(authHeader, xUserId);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "UNAUTHORIZED", "message", "User session expired or invalid."));
        }
        UserPreferences prefs = userPreferencesRepository.findByUserId(user.getId())
                .orElseGet(() -> {
                    UserPreferences def = new UserPreferences(user.getId());
                    return userPreferencesRepository.save(def);
                });

        return ResponseEntity.ok(Map.of("success", true, "preferences", prefs));
    }

    @PutMapping("/preferences")
    public ResponseEntity<?> savePreferences(
            @RequestBody Map<String, String> body,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId
    ) {
        User user = resolveCaller(authHeader, xUserId);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "UNAUTHORIZED", "message", "User session expired or invalid."));
        }
        UserPreferences prefs = userPreferencesRepository.findByUserId(user.getId())
                .orElseGet(() -> new UserPreferences(user.getId()));

        if (body.containsKey("defaultPackageManager")) {
            prefs.setDefaultPackageManager(body.get("defaultPackageManager"));
        }
        if (body.containsKey("pythonInstaller")) {
            prefs.setPythonInstaller(body.get("pythonInstaller"));
        }
        if (body.containsKey("editorKeymap")) {
            prefs.setEditorKeymap(body.get("editorKeymap"));
        }
        prefs.setUpdatedAt(Instant.now().toString());

        UserPreferences saved = userPreferencesRepository.save(prefs);
        return ResponseEntity.ok(Map.of("success", true, "message", "Preferences saved successfully", "preferences", saved));
    }

    @PatchMapping("/preferences")
    public ResponseEntity<?> patchPreferences(
            @RequestBody Map<String, String> body,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId
    ) {
        return savePreferences(body, authHeader, xUserId);
    }
}
