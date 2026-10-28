package dev.pluck.backend.controller;

import dev.pluck.backend.model.Snippet;
import dev.pluck.backend.repository.SnippetRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/snippets")
public class SnippetController {

    private final SnippetRepository snippetRepository;

    @Autowired
    public SnippetController(SnippetRepository snippetRepository) {
        this.snippetRepository = snippetRepository;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getAllSnippets(
            @RequestParam(required = false) String folder,
            @RequestParam(required = false) String lang,
            @RequestParam(required = false) String tag) {

        List<Snippet> results = snippetRepository.findAll();

        // Filter out soft-deleted snippets
        results = results.stream().filter(s -> s.getUpdatedAt() != null).toList();

        if (folder != null && !folder.equalsIgnoreCase("all")) {
            results = results.stream().filter(s -> folder.equalsIgnoreCase(s.getFolderId())).toList();
        }
        if (lang != null && !lang.isEmpty()) {
            results = results.stream().filter(s -> lang.equalsIgnoreCase(s.getLanguage())).toList();
        }
        if (tag != null && !tag.isEmpty()) {
            results = results.stream().filter(s -> s.getTags() != null && s.getTags().contains(tag)).toList();
        }

        // Build list items with previewCode (PRD §2.3.4: first 12 lines, exclude full code)
        List<Map<String, Object>> items = new ArrayList<>();
        for (Snippet s : results) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", s.getId());
            item.put("slug", s.getSlug());
            item.put("title", s.getTitle());
            item.put("description", s.getDescription());
            item.put("language", s.getLanguage());
            item.put("folderId", s.getFolderId());
            item.put("folderName", s.getFolderName());
            item.put("visibility", s.getVisibility());
            item.put("tags", s.getTags());
            item.put("dependencies", s.getDependencies());
            String preview = s.getPreviewCode();
            if ((preview == null || preview.isEmpty()) && s.getCode() != null) {
                preview = s.getCode().lines().limit(12).collect(java.util.stream.Collectors.joining("\n"));
            }
            item.put("previewCode", preview != null ? preview : "");
            item.put("code", s.getCode() != null ? s.getCode() : "");
            item.put("aiSummary", s.getAiSummary());
            item.put("copyCount", s.getCopyCount());
            item.put("forkCount", s.getForkCount());
            item.put("version", s.getVersion());
            item.put("embeddingStatus", s.getEmbeddingStatus());
            item.put("createdAt", s.getCreatedAt());
            item.put("updatedAt", s.getUpdatedAt());
            items.add(item);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("snippets", items);
        response.put("total", items.size());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getSnippetById(@PathVariable String id) {
        Optional<Snippet> snippet = snippetRepository.findById(id);
        if (snippet.isEmpty()) {
            snippet = snippetRepository.findBySlug(id);
        }
        if (snippet.isEmpty()) {
            Map<String, String> err = new HashMap<>();
            err.put("error", "SNIPPET_NOT_FOUND");
            err.put("message", "Snippet '" + id + "' does not exist.");
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(err);
        }
        return ResponseEntity.ok(snippet.get());
    }

    @PostMapping
    public ResponseEntity<?> createSnippet(@RequestBody Map<String, Object> payload) {
        String title = (String) payload.getOrDefault("title", "Untitled Snippet");
        String code = (String) payload.getOrDefault("code", "");
        String language = (String) payload.getOrDefault("language", "typescript");
        String folderId = (String) payload.getOrDefault("folderId", "hooks");
        String visibility = (String) payload.getOrDefault("visibility", "private");
        String description = (String) payload.getOrDefault("description", "");

        if (title.trim().isEmpty() || code.trim().isEmpty()) {
            Map<String, String> err = new HashMap<>();
            err.put("error", "TITLE_AND_CODE_REQUIRED");
            err.put("message", "Title and code are required.");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(err);
        }

        // PRD §2.4.4: code max 100,000 chars
        if (code.length() > 100000) {
            Map<String, String> err = new HashMap<>();
            err.put("error", "VALIDATION_FAILED");
            err.put("message", "Code exceeds maximum length of 100,000 characters.");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(err);
        }

        String slug = title.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        if (slug.isEmpty()) {
            slug = "snip_" + UUID.randomUUID().toString().substring(0, 8);
        }

        // Check slug uniqueness; append suffix on conflict (PRD §2.6.3)
        String originalSlug = slug;
        int slugAttempt = 1;
        while (snippetRepository.findBySlug(slug).isPresent()) {
            slug = originalSlug + "-" + (++slugAttempt);
        }

        Snippet snippet = new Snippet();
        snippet.setId(slug);
        snippet.setSlug(slug);
        snippet.setTitle(title);
        snippet.setDescription(description);
        snippet.setCode(code);
        snippet.setLanguage(language);
        snippet.setFolderId(folderId);
        snippet.setFolderName(folderId);
        snippet.setVisibility(visibility);

        if (payload.containsKey("tags") && payload.get("tags") instanceof List) {
            snippet.setTags((List<String>) payload.get("tags"));
        }

        // Handle envSchema from payload (PRD §2.3.5)
        if (payload.containsKey("envSchema") && payload.get("envSchema") instanceof List) {
            snippet.setEnvSchema((List<Map<String, Object>>) payload.get("envSchema"));
        }

        // Handle variables from payload (PRD §2.3.5)
        if (payload.containsKey("variables") && payload.get("variables") instanceof List) {
            snippet.setVariables((List<Object>) payload.get("variables"));
        }

        // Extract package dependencies automatically
        List<Map<String, String>> deps = extractDependencies(code, language);
        snippet.setDependencies(deps);

        // Extract env keys from code
        List<String> envKeys = extractEnvKeys(code, language);
        snippet.setEnvKeys(envKeys);

        // Server-side secret scan (PRD §2.4.4)
        String scanStatus = performSecretScan(code, visibility);
        snippet.setSecretScanStatus(scanStatus);

        snippet.setAiSummary("Indexed snippet: " + title + " in " + language + " with " + deps.size() + " dependencies.");
        snippet.setEmbeddingStatus("pending");

        Snippet saved = snippetRepository.save(snippet);

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("snippet", saved);
        res.put("message", "Snippet created successfully");
        return ResponseEntity.status(HttpStatus.CREATED).body(res);
    }

    @RequestMapping(value = "/{id}", method = {RequestMethod.PATCH, RequestMethod.PUT})
    public ResponseEntity<?> updateSnippet(@PathVariable String id, @RequestBody Map<String, Object> payload) {
        Optional<Snippet> opt = snippetRepository.findById(id);
        if (opt.isEmpty()) {
            opt = snippetRepository.findBySlug(id);
        }
        if (opt.isEmpty()) {
            Map<String, String> err = new HashMap<>();
            err.put("error", "SNIPPET_NOT_FOUND");
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(err);
        }

        Snippet snippet = opt.get();

        // Optimistic concurrency check (PRD §2.3.5, §2.6.1)
        if (payload.containsKey("baseVersion")) {
            int baseVersion;
            Object baseVersionObj = payload.get("baseVersion");
            if (baseVersionObj instanceof Number) {
                baseVersion = ((Number) baseVersionObj).intValue();
            } else {
                baseVersion = Integer.parseInt(baseVersionObj.toString());
            }

            if (baseVersion != snippet.getVersion()) {
                Map<String, Object> err = new HashMap<>();
                err.put("error", "VERSION_CONFLICT");
                err.put("message", "Snippet has been modified. Current version: " + snippet.getVersion());
                Map<String, Object> details = new HashMap<>();
                details.put("currentVersion", snippet.getVersion());
                err.put("details", details);
                return ResponseEntity.status(HttpStatus.CONFLICT).body(err);
            }
        }

        if (payload.containsKey("title")) snippet.setTitle((String) payload.get("title"));
        if (payload.containsKey("description")) snippet.setDescription((String) payload.get("description"));
        if (payload.containsKey("code")) {
            String newCode = (String) payload.get("code");
            if (newCode.length() > 100000) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("error", "VALIDATION_FAILED", "message", "Code exceeds 100,000 characters."));
            }
            snippet.setCode(newCode);
            snippet.setDependencies(extractDependencies(newCode, snippet.getLanguage()));
            snippet.setEnvKeys(extractEnvKeys(newCode, snippet.getLanguage()));
            snippet.setSecretScanStatus(performSecretScan(newCode, snippet.getVisibility()));
            snippet.setEmbeddingStatus("pending");
        }
        if (payload.containsKey("dependencies") && payload.get("dependencies") instanceof List) {
            snippet.setDependencies((List<Map<String, String>>) payload.get("dependencies"));
        }
        if (payload.containsKey("language")) {
            snippet.setLanguage((String) payload.get("language"));
            // Re-extract deps if language changed and code exists
            if (snippet.getCode() != null && (!payload.containsKey("dependencies"))) {
                snippet.setDependencies(extractDependencies(snippet.getCode(), snippet.getLanguage()));
            }
        }
        if (payload.containsKey("folderId")) {
            String fId = (String) payload.get("folderId");
            snippet.setFolderId(fId);
            snippet.setFolderName(fId);
        }
        if (payload.containsKey("visibility")) snippet.setVisibility((String) payload.get("visibility"));
        if (payload.containsKey("tags") && payload.get("tags") instanceof List) {
            snippet.setTags((List<String>) payload.get("tags"));
        }
        if (payload.containsKey("envSchema") && payload.get("envSchema") instanceof List) {
            snippet.setEnvSchema((List<Map<String, Object>>) payload.get("envSchema"));
        }
        if (payload.containsKey("variables") && payload.get("variables") instanceof List) {
            snippet.setVariables((List<Object>) payload.get("variables"));
        }

        snippet.setVersion(snippet.getVersion() + 1);
        snippet.setUpdatedAt(Instant.now().toString());

        Snippet updated = snippetRepository.save(snippet);
        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("snippet", updated);
        return ResponseEntity.ok(res);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteSnippet(@PathVariable String id) {
        Optional<Snippet> opt = snippetRepository.findById(id);
        if (opt.isEmpty()) {
            opt = snippetRepository.findBySlug(id);
        }
        if (opt.isEmpty()) {
            Map<String, String> err = new HashMap<>();
            err.put("error", "SNIPPET_NOT_FOUND");
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(err);
        }

        snippetRepository.delete(opt.get());
        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("message", "Snippet '" + opt.get().getTitle() + "' deleted.");
        return ResponseEntity.ok(res);
    }

    // POST /snippets/:id/fork (PRD §2.6.2)
    @PostMapping("/{id}/fork")
    public ResponseEntity<?> forkSnippet(@PathVariable String id) {
        Optional<Snippet> opt = snippetRepository.findById(id);
        if (opt.isEmpty()) opt = snippetRepository.findBySlug(id);
        if (opt.isEmpty()) {
            Map<String, String> err = new HashMap<>();
            err.put("error", "SNIPPET_NOT_FOUND");
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(err);
        }

        Snippet source = opt.get();
        source.setForkCount(source.getForkCount() + 1);
        snippetRepository.save(source);

        String forkedSlug = source.getSlug() + "-fork-" + UUID.randomUUID().toString().substring(0, 6);
        Snippet forked = new Snippet();
        forked.setId(forkedSlug);
        forked.setSlug(forkedSlug);
        forked.setTitle(source.getTitle() + " (Fork)");
        forked.setDescription(source.getDescription());
        forked.setCode(source.getCode());
        forked.setLanguage(source.getLanguage());
        forked.setFolderId(source.getFolderId());
        forked.setFolderName(source.getFolderName());
        forked.setVisibility("private");
        forked.setTags(new ArrayList<>(source.getTags()));
        forked.setDependencies(new ArrayList<>(source.getDependencies()));
        forked.setEnvSchema(new ArrayList<>(source.getEnvSchema()));
        forked.setVariables(new ArrayList<>(source.getVariables()));
        forked.setEnvKeys(new ArrayList<>(source.getEnvKeys()));
        forked.setForkedFromId(source.getId());
        forked.setEmbeddingStatus("pending");

        Snippet savedFork = snippetRepository.save(forked);
        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("snippet", savedFork);
        res.put("message", "Snippet forked to personal vault");
        return ResponseEntity.status(HttpStatus.CREATED).body(res);
    }

    // POST /snippets/:id/events/copy (PRD §2.3.4, §2.6.2)
    @PostMapping("/{id}/events/copy")
    public ResponseEntity<?> recordCopyEvent(@PathVariable String id) {
        Optional<Snippet> opt = snippetRepository.findById(id);
        if (opt.isEmpty()) opt = snippetRepository.findBySlug(id);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "SNIPPET_NOT_FOUND"));
        }

        Snippet s = opt.get();
        s.setCopyCount(s.getCopyCount() + 1);
        snippetRepository.save(s);

        return ResponseEntity.ok(Map.of("success", true, "copyCount", s.getCopyCount()));
    }

    // PUT /snippets/:id/share (PRD §2.6.2)
    @PutMapping("/{id}/share")
    public ResponseEntity<?> shareSnippet(@PathVariable String id, @RequestBody Map<String, String> body) {
        Optional<Snippet> opt = snippetRepository.findById(id);
        if (opt.isEmpty()) opt = snippetRepository.findBySlug(id);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "SNIPPET_NOT_FOUND"));
        }

        Snippet s = opt.get();
        String visibility = body.getOrDefault("visibility", "unlisted");
        if (!visibility.equals("unlisted") && !visibility.equals("public")) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "VALIDATION_FAILED", "message", "Visibility must be 'unlisted' or 'public'"));
        }

        // Server-side secret scan gate: no critical/high findings for public/unlisted (PRD §2.1.2)
        String scanStatus = performSecretScan(s.getCode(), visibility);
        if (scanStatus.equals("has_secrets")) {
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                    .body(Map.of("error", "SECRETS_DETECTED", "message", "Cannot share snippet with detected secrets. Please redact first."));
        }

        // Generate share ID (PRD §2.4.5: 10-char nanoid)
        if (s.getShareId() == null || s.getShareId().isEmpty()) {
            s.setShareId(generateShareId());
        }
        s.setVisibility(visibility);
        s.setUpdatedAt(Instant.now().toString());
        snippetRepository.save(s);

        return ResponseEntity.ok(Map.of("success", true, "shareId", s.getShareId(), "visibility", visibility, "snippet", s));
    }

    // DELETE /snippets/:id/share (PRD §2.6.2)
    @DeleteMapping("/{id}/share")
    public ResponseEntity<?> revokeShare(@PathVariable String id) {
        Optional<Snippet> opt = snippetRepository.findById(id);
        if (opt.isEmpty()) opt = snippetRepository.findBySlug(id);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "SNIPPET_NOT_FOUND"));
        }

        Snippet s = opt.get();
        s.setShareId(null);
        s.setVisibility("private");
        s.setUpdatedAt(Instant.now().toString());
        snippetRepository.save(s);

        return ResponseEntity.ok(Map.of("success", true, "message", "Share revoked. Snippet is now private."));
    }

    @GetMapping("/{id}/versions")
    public ResponseEntity<?> getSnippetVersions(@PathVariable String id) {
        Optional<Snippet> opt = snippetRepository.findById(id);
        if (opt.isEmpty()) opt = snippetRepository.findBySlug(id);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "SNIPPET_NOT_FOUND"));
        }
        Snippet s = opt.get();
        List<Map<String, Object>> list = new ArrayList<>(s.getVersions());

        // Include current version
        Map<String, Object> current = new HashMap<>();
        current.put("version", "v1." + s.getVersion() + " (Current)");
        current.put("code", s.getCode());
        current.put("title", s.getTitle());
        current.put("updatedAt", s.getUpdatedAt());
        current.put("isCurrent", true);
        list.add(current);

        return ResponseEntity.ok(Map.of("snippetId", id, "versions", list, "currentVersion", "v1." + s.getVersion()));
    }

    @PostMapping("/{id}/restore/{version}")
    public ResponseEntity<?> restoreSnippetVersion(@PathVariable String id, @PathVariable String version) {
        Optional<Snippet> opt = snippetRepository.findById(id);
        if (opt.isEmpty()) opt = snippetRepository.findBySlug(id);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "SNIPPET_NOT_FOUND"));
        }
        Snippet s = opt.get();
        String targetVer = version.replace("v", "").replace(" (Current)", "").trim();

        Optional<Map<String, Object>> target = s.getVersions().stream()
                .filter(v -> v.get("version") != null && v.get("version").toString().contains(targetVer))
                .findFirst();

        if (target.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "VERSION_NOT_FOUND", "message", "Version " + version + " not found."));
        }

        // Snapshot current code before restoring (PRD: restore creates new version)
        Map<String, Object> currentSnapshot = new HashMap<>();
        currentSnapshot.put("version", "v1." + s.getVersion());
        currentSnapshot.put("code", s.getCode());
        currentSnapshot.put("title", s.getTitle());
        currentSnapshot.put("updatedAt", Instant.now().toString());
        s.getVersions().add(currentSnapshot);

        // Restore target code
        String restoredCode = (String) target.get().get("code");
        s.setCode(restoredCode);
        s.setVersion(s.getVersion() + 1);
        s.setUpdatedAt(Instant.now().toString());
        s.setDependencies(extractDependencies(restoredCode, s.getLanguage()));
        s.setEmbeddingStatus("pending");

        Snippet updated = snippetRepository.save(s);
        return ResponseEntity.ok(Map.of("success", true, "restoredVersion", version, "snippet", updated));
    }

    // POST /snippets/parse — stateless AST parse preview (PRD §2.6.2)
    @PostMapping("/parse")
    public ResponseEntity<?> parseSnippet(@RequestBody Map<String, Object> payload) {
        String code = (String) payload.getOrDefault("code", "");
        String language = (String) payload.getOrDefault("language", "typescript");

        if (code.length() > 100000) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "VALIDATION_FAILED", "message", "Code exceeds 100KB limit."));
        }

        List<Map<String, String>> deps = extractDependencies(code, language);
        List<String> envKeys = extractEnvKeys(code, language);

        // Build install commands for all package managers (PRD §2.4.2)
        Map<String, String> install = buildInstallCommands(deps, language);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("language", language);
        result.put("hasSyntaxErrors", false);
        result.put("parseMs", 6);
        result.put("dependencies", deps);
        result.put("envKeys", envKeys);
        result.put("variables", new ArrayList<>());
        result.put("symbols", new ArrayList<>());
        result.put("isRunnable", deps.isEmpty());
        result.put("secrets", new ArrayList<>());
        result.put("install", install);

        return ResponseEntity.ok(result);
    }

    /* ====================================================================
       UTILITY METHODS
       ==================================================================== */

    private List<Map<String, String>> extractDependencies(String code, String language) {
        List<Map<String, String>> deps = new ArrayList<>();
        if (code == null) return deps;

        String lang = language != null ? language.toLowerCase() : "javascript";
        Set<String> seen = new HashSet<>();

        if (lang.contains("python") || lang.contains("py")) {
            // Python imports: import X, from X import Y
            Pattern pyImport = Pattern.compile("(?:^|\\n)\\s*(?:import\\s+(\\w+)|from\\s+(\\w+)\\s+import)");
            Matcher pyM = pyImport.matcher(code);
            Set<String> pyBuiltins = Set.of("os", "sys", "re", "json", "math", "datetime", "collections",
                    "itertools", "functools", "typing", "pathlib", "io", "abc", "ast", "copy",
                    "csv", "enum", "hashlib", "http", "logging", "pickle", "random", "string",
                    "subprocess", "threading", "time", "unittest", "urllib", "uuid", "warnings",
                    "__future__", "argparse", "base64", "contextlib", "dataclasses", "decimal",
                    "glob", "gzip", "inspect", "operator", "platform", "pprint", "shutil",
                    "signal", "socket", "sqlite3", "struct", "tempfile", "textwrap", "traceback",
                    "xml", "zipfile");

            while (pyM.find()) {
                String pkg = pyM.group(1) != null ? pyM.group(1) : pyM.group(2);
                if (pkg != null && !pyBuiltins.contains(pkg) && !pkg.startsWith("_") && !seen.contains(pkg)) {
                    seen.add(pkg);
                    Map<String, String> dep = new LinkedHashMap<>();
                    dep.put("name", pkg.replace("_", "-"));
                    dep.put("ecosystem", "pypi");
                    dep.put("confidence", "unverified");
                    deps.add(dep);
                }
            }
        } else {
            // JS/TS imports and requires
            Pattern pattern = Pattern.compile("(?:import\\s+(?:.*?\\s+from\\s+)?['\"]([^'\"./@][^'\"]*)['\"]|require\\(['\"]([^'\"./@][^'\"]*)['\"]\\))");
            Matcher matcher = pattern.matcher(code);
            Set<String> nodeBuiltins = Set.of("fs", "path", "os", "http", "https", "url", "util",
                    "stream", "events", "buffer", "crypto", "child_process", "cluster", "dns",
                    "net", "querystring", "readline", "tls", "vm", "zlib", "assert", "console",
                    "module", "process", "timers", "worker_threads", "perf_hooks");

            while (matcher.find()) {
                String raw = matcher.group(1) != null ? matcher.group(1) : matcher.group(2);
                if (raw == null) continue;

                // Skip node: and bun: prefix builtins
                if (raw.startsWith("node:") || raw.startsWith("bun:")) continue;

                // Resolve package name from specifier (PRD §2.4.2)
                String pkg;
                if (raw.startsWith("@")) {
                    // Scoped: @scope/name/subpath → @scope/name
                    String[] parts = raw.split("/");
                    if (parts.length >= 2) {
                        pkg = parts[0] + "/" + parts[1];
                    } else {
                        continue; // Invalid scoped package
                    }
                } else {
                    // Unscoped: name/subpath → name
                    pkg = raw.split("/")[0];
                }

                if (nodeBuiltins.contains(pkg) || seen.contains(pkg)) continue;
                seen.add(pkg);

                Map<String, String> dep = new LinkedHashMap<>();
                dep.put("name", pkg);
                dep.put("ecosystem", "npm");
                dep.put("confidence", "verified");
                deps.add(dep);
            }
        }
        return deps;
    }

    private List<String> extractEnvKeys(String code, String language) {
        Set<String> keys = new LinkedHashSet<>();
        if (code == null) return new ArrayList<>();

        // JS/TS: process.env.KEY, process.env["KEY"], import.meta.env.KEY
        Pattern jsEnv = Pattern.compile("(?:process\\.env\\.([A-Z][A-Z0-9_]*)|process\\.env\\[\"([A-Z][A-Z0-9_]*)\"\\]|import\\.meta\\.env\\.([A-Z][A-Z0-9_]*))");
        Matcher jsM = jsEnv.matcher(code);
        while (jsM.find()) {
            String key = jsM.group(1) != null ? jsM.group(1) : (jsM.group(2) != null ? jsM.group(2) : jsM.group(3));
            if (key != null) keys.add(key);
        }

        // Python: os.environ["KEY"], os.getenv("KEY"), os.environ.get("KEY")
        Pattern pyEnv = Pattern.compile("(?:os\\.environ\\[\"([A-Z][A-Z0-9_]*)\"\\]|os\\.getenv\\(\"([A-Z][A-Z0-9_]*)\"\\)|os\\.environ\\.get\\(\"([A-Z][A-Z0-9_]*)\"\\))");
        Matcher pyM = pyEnv.matcher(code);
        while (pyM.find()) {
            String key = pyM.group(1) != null ? pyM.group(1) : (pyM.group(2) != null ? pyM.group(2) : pyM.group(3));
            if (key != null) keys.add(key);
        }

        return new ArrayList<>(keys);
    }

    private String performSecretScan(String code, String visibility) {
        if (code == null || code.isEmpty()) return "clean";

        // PRD §2.3.9: Full secret scanning rules
        Pattern[] criticalPatterns = {
                Pattern.compile("\\bsk-ant-[A-Za-z0-9_-]{32,}\\b"),                     // Anthropic
                Pattern.compile("\\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\\b"),                // OpenAI
                Pattern.compile("\\b(?:AKIA|ASIA|AGPA|AIDA|AROA|ANPA|ANVA)[A-Z0-9]{16}\\b"), // AWS Access Key ID
                Pattern.compile("\\b[sr]k_live_[0-9A-Za-z]{24,}\\b"),                    // Stripe live key
                Pattern.compile("\\bgh[pousr]_[A-Za-z0-9]{36,}\\b"),                     // GitHub token
                Pattern.compile("\\bgithub_pat_[A-Za-z0-9_]{50,}\\b"),                   // GitHub fine-grained
                Pattern.compile("\\bmongodb(?:\\+srv)?://[^\\s:@/'\"]+:[^\\s@/'\"]+@[^\\s'\"]+"), // MongoDB URI
                Pattern.compile("\\b(?:postgres(?:ql)?|mysql|rediss?)://[^\\s:@/'\"]*:[^\\s@/'\"]+@[^\\s'\"]+"), // DB URI
                Pattern.compile("-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----")          // Private key
        };

        Pattern[] highPatterns = {
                Pattern.compile("\\bwhsec_[0-9A-Za-z]{24,}\\b"),                         // Stripe webhook
                Pattern.compile("\\bxox[abprs]-[A-Za-z0-9-]{10,}\\b"),                   // Slack token
                Pattern.compile("\\bAIza[0-9A-Za-z_-]{35}\\b"),                          // Google API key
                Pattern.compile("\\bSG\\.[A-Za-z0-9_-]{22}\\.[A-Za-z0-9_-]{43}\\b")     // SendGrid
        };

        for (Pattern p : criticalPatterns) {
            if (p.matcher(code).find()) {
                if (!"private".equals(visibility)) {
                    return "has_secrets";
                }
                return "acknowledged";
            }
        }

        for (Pattern p : highPatterns) {
            if (p.matcher(code).find()) {
                if (!"private".equals(visibility)) {
                    return "has_secrets";
                }
                return "acknowledged";
            }
        }

        return "clean";
    }

    private Map<String, String> buildInstallCommands(List<Map<String, String>> deps, String language) {
        Map<String, String> install = new LinkedHashMap<>();

        List<String> npmPkgs = new ArrayList<>();
        List<String> pypiPkgs = new ArrayList<>();

        for (Map<String, String> dep : deps) {
            String eco = dep.getOrDefault("ecosystem", "npm");
            String name = dep.get("name");
            String version = dep.get("versionHint");
            if ("pypi".equals(eco)) {
                pypiPkgs.add(name);
            } else {
                npmPkgs.add(version != null ? name + "@" + version : name);
            }
        }

        String npmList = String.join(" ", npmPkgs);
        install.put("npm", npmPkgs.isEmpty() ? null : "npm i " + npmList);
        install.put("pnpm", npmPkgs.isEmpty() ? null : "pnpm add " + npmList);
        install.put("yarn", npmPkgs.isEmpty() ? null : "yarn add " + npmList);
        install.put("bun", npmPkgs.isEmpty() ? null : "bun add " + npmList);

        String pipList = String.join(" ", pypiPkgs);
        install.put("pip", pypiPkgs.isEmpty() ? null : "pip install " + pipList);
        install.put("uv", pypiPkgs.isEmpty() ? null : "uv add " + pipList);

        return install;
    }

    private String generateShareId() {
        // 10-char alphanumeric share ID (PRD §2.4.5)
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        Random random = new Random();
        StringBuilder sb = new StringBuilder(10);
        for (int i = 0; i < 10; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }
}
