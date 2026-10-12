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

        if (folder != null && !folder.equalsIgnoreCase("all")) {
            results = results.stream().filter(s -> folder.equalsIgnoreCase(s.getFolderId())).toList();
        }
        if (lang != null && !lang.isEmpty()) {
            results = results.stream().filter(s -> lang.equalsIgnoreCase(s.getLanguage())).toList();
        }
        if (tag != null && !tag.isEmpty()) {
            results = results.stream().filter(s -> s.getTags() != null && s.getTags().contains(tag)).toList();
        }

        Map<String, Object> response = new HashMap<>();
        response.put("snippets", results);
        response.put("total", results.size());
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

        if (title.trim().isEmpty() || code.trim().isEmpty()) {
            Map<String, String> err = new HashMap<>();
            err.put("error", "TITLE_AND_CODE_REQUIRED");
            err.put("message", "Title and code are required.");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(err);
        }

        String slug = title.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        if (slug.isEmpty()) {
            slug = "snip_" + UUID.randomUUID().toString().substring(0, 8);
        }

        Snippet snippet = new Snippet();
        snippet.setId(slug);
        snippet.setSlug(slug);
        snippet.setTitle(title);
        snippet.setCode(code);
        snippet.setLanguage(language);
        snippet.setFolderId(folderId);
        snippet.setFolderName(folderId);
        snippet.setVisibility(visibility);

        if (payload.containsKey("tags") && payload.get("tags") instanceof List) {
            snippet.setTags((List<String>) payload.get("tags"));
        }

        // Extract package dependencies automatically
        List<Map<String, String>> deps = extractDependencies(code);
        snippet.setDependencies(deps);
        snippet.setAiSummary("Indexed snippet: " + title + " in " + language + " with " + deps.size() + " dependencies.");

        Snippet saved = snippetRepository.save(snippet);

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("snippet", saved);
        res.put("message", "Snippet created and saved to MongoDB successfully");
        return ResponseEntity.status(HttpStatus.CREATED).body(res);
    }

    @PatchMapping("/{id}")
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
        if (payload.containsKey("title")) snippet.setTitle((String) payload.get("title"));
        if (payload.containsKey("code")) {
            String newCode = (String) payload.get("code");
            snippet.setCode(newCode);
            snippet.setDependencies(extractDependencies(newCode));
        }
        if (payload.containsKey("language")) snippet.setLanguage((String) payload.get("language"));
        if (payload.containsKey("folderId")) {
            String fId = (String) payload.get("folderId");
            snippet.setFolderId(fId);
            snippet.setFolderName(fId);
        }
        if (payload.containsKey("visibility")) snippet.setVisibility((String) payload.get("visibility"));
        if (payload.containsKey("tags") && payload.get("tags") instanceof List) {
            snippet.setTags((List<String>) payload.get("tags"));
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

        String forkedId = source.getSlug() + "-fork-" + UUID.randomUUID().toString().substring(0, 6);
        Snippet forked = new Snippet();
        forked.setId(forkedId);
        forked.setSlug(forkedId);
        forked.setTitle(source.getTitle() + " (Fork)");
        forked.setCode(source.getCode());
        forked.setLanguage(source.getLanguage());
        forked.setFolderId(source.getFolderId());
        forked.setFolderName(source.getFolderName());
        forked.setVisibility("private");
        forked.setTags(new ArrayList<>(source.getTags()));
        forked.setDependencies(new ArrayList<>(source.getDependencies()));

        Snippet savedFork = snippetRepository.save(forked);
        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("snippet", savedFork);
        res.put("message", "Snippet forked to personal vault");
        return ResponseEntity.status(HttpStatus.CREATED).body(res);
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

        // Snapshot current code before restoring
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

        Snippet updated = snippetRepository.save(s);
        return ResponseEntity.ok(Map.of("success", true, "restoredVersion", version, "snippet", updated));
    }

    private List<Map<String, String>> extractDependencies(String code) {
        List<Map<String, String>> deps = new ArrayList<>();
        if (code == null) return deps;

        Pattern pattern = Pattern.compile("(?:import\\s+(?:.*?\\s+from\\s+)?['\"]([^'\"./][^'\"]*)['\"]|require\\(['\"]([^'\"./][^'\"]*)['\"]\\))");
        Matcher matcher = pattern.matcher(code);
        Set<String> seen = new HashSet<>();

        while (matcher.find()) {
            String pkg = matcher.group(1) != null ? matcher.group(1) : matcher.group(2);
            if (pkg != null && !pkg.startsWith("node:") && !seen.contains(pkg)) {
                seen.add(pkg);
                Map<String, String> dep = new HashMap<>();
                dep.put("name", pkg);
                dep.put("versionHint", "^1.0.0");
                deps.add(dep);
            }
        }
        return deps;
    }
}
