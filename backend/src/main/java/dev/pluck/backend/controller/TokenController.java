package dev.pluck.backend.controller;

import dev.pluck.backend.model.Token;
import dev.pluck.backend.repository.TokenRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/tokens")
public class TokenController {

    private final TokenRepository tokenRepository;
    private final dev.pluck.backend.repository.UserRepository userRepository;

    @Autowired
    public TokenController(TokenRepository tokenRepository, dev.pluck.backend.repository.UserRepository userRepository) {
        this.tokenRepository = tokenRepository;
        this.userRepository = userRepository;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getTokens() {
        List<Token> tokens = tokenRepository.findAll();
        Map<String, Object> res = new HashMap<>();
        res.put("tokens", tokens);
        return ResponseEntity.ok(res);
    }

    @PostMapping
    public ResponseEntity<?> createToken(
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        String name = (String) body.get("name");
        if (name == null || name.trim().isEmpty()) {
            Map<String, String> err = new HashMap<>();
            err.put("error", "TOKEN_NAME_REQUIRED");
            err.put("message", "Token name is required.");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(err);
        }

        String rawHex = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String fullToken = "pluck_pat_" + rawHex;
        String prefix = "pluck_pat_" + rawHex.substring(0, 4) + "...";

        String callerUserId = AuthController.resolveUserId(authHeader);
        if (callerUserId == null) {
            callerUserId = userRepository.findAll().stream()
                    .filter(u -> !"test_dev@pluck.dev".equalsIgnoreCase(u.getEmail()))
                    .findFirst()
                    .map(dev.pluck.backend.model.User::getId)
                    .orElse("usr_alex");
        }

        Token token = new Token();
        token.setId("tok_" + rawHex.substring(0, 8));
        token.setUserId(callerUserId);
        token.setName(name);
        token.setPrefix(prefix);
        token.setTokenHash("hash_" + rawHex.substring(0, 8));

        if (body.containsKey("scopes") && body.get("scopes") instanceof List) {
            token.setScopes((List<String>) body.get("scopes"));
        } else {
            token.setScopes(List.of("snippets:read"));
        }

        token.setLastUsed("Just now");
        token.setExpires("in 90 days");

        Token saved = tokenRepository.save(token);

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("token", saved);
        res.put("rawToken", fullToken);
        res.put("message", "Token created. Save this token now, you will not be able to see it again.");
        return ResponseEntity.status(HttpStatus.CREATED).body(res);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteToken(@PathVariable String id) {
        Optional<Token> opt = tokenRepository.findById(id);
        if (opt.isEmpty()) {
            Map<String, String> err = new HashMap<>();
            err.put("error", "TOKEN_NOT_FOUND");
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(err);
        }
        tokenRepository.delete(opt.get());
        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("message", "Token '" + opt.get().getName() + "' revoked.");
        return ResponseEntity.ok(res);
    }
}
