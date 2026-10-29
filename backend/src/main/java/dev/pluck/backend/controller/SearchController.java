package dev.pluck.backend.controller;

import dev.pluck.backend.model.Snippet;
import dev.pluck.backend.model.User;
import dev.pluck.backend.repository.SnippetRepository;
import dev.pluck.backend.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/search")
public class SearchController {

    private final SnippetRepository snippetRepository;
    private final AuthService authService;

    @Autowired
    public SearchController(SnippetRepository snippetRepository, AuthService authService) {
        this.snippetRepository = snippetRepository;
        this.authService = authService;
    }

    // Support both GET (legacy) and POST (PRD §2.6.2)
    @GetMapping
    public ResponseEntity<Map<String, Object>> searchGet(
            @RequestParam(required = false, defaultValue = "") String q,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId) {
        User caller = authService.resolveCaller(authHeader, xUserId);
        return performSearch(q, null, null, caller);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> searchPost(
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId) {
        String query = (String) body.getOrDefault("query", "");
        String language = (String) body.getOrDefault("language", null);
        String pkg = (String) body.getOrDefault("package", null);
        User caller = authService.resolveCaller(authHeader, xUserId);
        return performSearch(query, language, pkg, caller);
    }

    private ResponseEntity<Map<String, Object>> performSearch(String q, String langFilter, String pkgFilter, User caller) {
        List<Snippet> all = snippetRepository.findAll();
        all = all.stream().filter(s -> s.getUpdatedAt() != null && authService.canAccessSnippet(s, caller)).toList();
        long startTime = System.currentTimeMillis();
        String query = q != null ? q.toLowerCase().trim() : "";

        if (query.isEmpty()) {
            List<Snippet> top = all.size() > 5 ? all.subList(0, 5) : all;
            Map<String, Object> res = new LinkedHashMap<>();
            res.put("results", top);
            res.put("query", "");
            res.put("count", top.size());
            res.put("meta", Map.of("tookMs", System.currentTimeMillis() - startTime, "degraded", false));
            return ResponseEntity.ok(res);
        }

        // Parse inline filters from query (PRD §2.3.8: lang:ts, pkg:zod)
        String effectiveQuery = query;
        if (effectiveQuery.contains("lang:")) {
            String[] parts = effectiveQuery.split("lang:");
            if (parts.length > 1) {
                String langPart = parts[1].split("\\s+")[0];
                if (langFilter == null) langFilter = langPart;
                effectiveQuery = effectiveQuery.replace("lang:" + langPart, "").trim();
            }
        }
        if (effectiveQuery.contains("pkg:")) {
            String[] parts = effectiveQuery.split("pkg:");
            if (parts.length > 1) {
                String pkgPart = parts[1].split("\\s+")[0];
                if (pkgFilter == null) pkgFilter = pkgPart;
                effectiveQuery = effectiveQuery.replace("pkg:" + pkgPart, "").trim();
            }
        }

        String[] terms = effectiveQuery.split("\\s+");
        final String finalLangFilter = langFilter;
        final String finalPkgFilter = pkgFilter;

        List<Map<String, Object>> scoredList = new ArrayList<>();

        for (Snippet s : all) {
            // Apply language filter
            if (finalLangFilter != null && !finalLangFilter.isEmpty()) {
                if (s.getLanguage() == null || !s.getLanguage().toLowerCase().contains(finalLangFilter.toLowerCase())) {
                    continue;
                }
            }

            // Apply package filter
            if (finalPkgFilter != null && !finalPkgFilter.isEmpty()) {
                boolean hasPkg = false;
                if (s.getDependencies() != null) {
                    for (var dep : s.getDependencies()) {
                        if (dep.get("name") != null && dep.get("name").toLowerCase().contains(finalPkgFilter.toLowerCase())) {
                            hasPkg = true;
                            break;
                        }
                    }
                }
                if (!hasPkg) continue;
            }

            int score = 0;
            String titleLower = s.getTitle() != null ? s.getTitle().toLowerCase() : "";
            String codeLower = s.getCode() != null ? s.getCode().toLowerCase() : "";
            String summaryLower = s.getAiSummary() != null ? s.getAiSummary().toLowerCase() : "";
            String descLower = s.getDescription() != null ? s.getDescription().toLowerCase() : "";
            List<String> matchedBy = new ArrayList<>();

            for (String term : terms) {
                if (term.length() < 2) continue;

                if (titleLower.contains(term)) score += 10;
                if (descLower.contains(term)) score += 7;
                if (summaryLower.contains(term)) score += 6;
                if (codeLower.contains(term)) score += 2;
                if (s.getTags() != null) {
                    for (String t : s.getTags()) {
                        if (t.toLowerCase().contains(term)) score += 4;
                    }
                }
                if (s.getAiKeywords() != null) {
                    for (String k : s.getAiKeywords()) {
                        if (k.toLowerCase().contains(term) || term.contains(k.toLowerCase())) {
                            score += 8;
                            if (!matchedBy.contains("semantic")) matchedBy.add("semantic");
                        }
                    }
                }
                if (s.getDesignPattern() != null && s.getDesignPattern().toLowerCase().contains(term)) {
                    score += 7;
                }
            }

            // Usage prior boost (PRD §2.4.3: ln(1+copy_count))
            score += (int) (3 * Math.log(1 + s.getCopyCount()));

            if (score > 0) {
                if (!matchedBy.contains("keyword")) matchedBy.add("keyword");
                if (titleLower.contains(effectiveQuery)) {
                    if (!matchedBy.contains("name")) matchedBy.add("name");
                }

                Map<String, Object> item = new LinkedHashMap<>();
                item.put("snippet", buildSnippetSummary(s));
                item.put("score", score / 100.0);
                item.put("matchedBy", matchedBy);
                scoredList.add(item);
            }
        }

        scoredList.sort((a, b) -> Double.compare(
                ((Number) b.get("score")).doubleValue(),
                ((Number) a.get("score")).doubleValue()
        ));

        long tookMs = System.currentTimeMillis() - startTime;

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("results", scoredList);
        res.put("meta", Map.of(
                "tookMs", tookMs,
                "degraded", false,
                "query", q
        ));
        res.put("count", scoredList.size());
        return ResponseEntity.ok(res);
    }

    private Map<String, Object> buildSnippetSummary(Snippet s) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", s.getId());
        item.put("slug", s.getSlug());
        item.put("title", s.getTitle());
        item.put("language", s.getLanguage());
        item.put("previewCode", s.getPreviewCode());
        item.put("folderId", s.getFolderId());
        item.put("dependencies", s.getDependencies());
        item.put("aiSummary", s.getAiSummary());
        item.put("aiKeywords", s.getAiKeywords());
        item.put("designPattern", s.getDesignPattern());
        item.put("copyCount", s.getCopyCount());
        return item;
    }
}
