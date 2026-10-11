package dev.pluck.backend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/secrets")
public class SecretController {

    private static final Pattern SECRET_PATTERN = Pattern.compile("(sk_live_[0-9a-zA-Z]{16,}|ghp_[0-9a-zA-Z]{20,}|AKIA[0-9A-Z]{16}|ey[A-Za-z0-9-_]{20,}\\.[A-Za-z0-9-_]{20,})");

    @PostMapping("/scan")
    public ResponseEntity<?> scan(@RequestBody Map<String, String> body) {
        String code = body.getOrDefault("code", "");
        Matcher matcher = SECRET_PATTERN.matcher(code);

        List<Map<String, Object>> findings = new ArrayList<>();
        while (matcher.find()) {
            Map<String, Object> finding = new HashMap<>();
            finding.put("type", "API_KEY");
            finding.put("match", matcher.group(1).substring(0, Math.min(8, matcher.group(1).length())) + "...");
            finding.put("severity", "CRITICAL");
            findings.add(finding);
        }

        Map<String, Object> res = new HashMap<>();
        res.put("hasCritical", !findings.isEmpty());
        res.put("hasHigh", false);
        res.put("findings", findings);
        return ResponseEntity.ok(res);
    }

    @PostMapping("/redact")
    public ResponseEntity<?> redact(@RequestBody Map<String, Object> body) {
        String code = (String) body.getOrDefault("code", "");
        String redacted = SECRET_PATTERN.matcher(code).replaceAll("process.env.API_KEY");

        Map<String, Object> res = new HashMap<>();
        res.put("redactedCode", redacted);
        res.put("message", "All detected secrets transformed to process.env references");
        return ResponseEntity.ok(res);
    }
}
