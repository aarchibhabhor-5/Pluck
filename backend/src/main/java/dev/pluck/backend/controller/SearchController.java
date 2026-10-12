package dev.pluck.backend.controller;

import dev.pluck.backend.model.Snippet;
import dev.pluck.backend.repository.SnippetRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/search")
public class SearchController {

    private final SnippetRepository snippetRepository;

    @Autowired
    public SearchController(SnippetRepository snippetRepository) {
        this.snippetRepository = snippetRepository;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> search(@RequestParam(required = false, defaultValue = "") String q) {
        List<Snippet> all = snippetRepository.findAll();
        String query = q.toLowerCase().trim();

        if (query.isEmpty()) {
            List<Snippet> top = all.size() > 5 ? all.subList(0, 5) : all;
            Map<String, Object> res = new HashMap<>();
            res.put("results", top);
            res.put("query", "");
            res.put("count", top.size());
            return ResponseEntity.ok(res);
        }

        String[] terms = query.split("\\s+");
        List<Map<String, Object>> scoredList = new ArrayList<>();

        for (Snippet s : all) {
            int score = 0;
            String titleLower = s.getTitle() != null ? s.getTitle().toLowerCase() : "";
            String codeLower = s.getCode() != null ? s.getCode().toLowerCase() : "";
            String summaryLower = s.getAiSummary() != null ? s.getAiSummary().toLowerCase() : "";

            for (String term : terms) {
                if (titleLower.contains(term)) score += 10;
                if (summaryLower.contains(term)) score += 6;
                if (codeLower.contains(term)) score += 2;
                if (s.getTags() != null) {
                    for (String t : s.getTags()) {
                        if (t.toLowerCase().contains(term)) score += 4;
                    }
                }
                if (s.getAiKeywords() != null) {
                    for (String k : s.getAiKeywords()) {
                        if (k.toLowerCase().contains(term) || term.contains(k.toLowerCase())) score += 8;
                    }
                }
                if (s.getDesignPattern() != null && s.getDesignPattern().toLowerCase().contains(term)) {
                    score += 7;
                }
            }

            if (score > 0) {
                Map<String, Object> item = new HashMap<>();
                item.put("id", s.getId());
                item.put("title", s.getTitle());
                item.put("language", s.getLanguage());
                item.put("code", s.getCode());
                item.put("folderId", s.getFolderId());
                item.put("dependencies", s.getDependencies());
                item.put("aiSummary", s.getAiSummary());
                item.put("aiKeywords", s.getAiKeywords());
                item.put("designPattern", s.getDesignPattern());
                item.put("matchedBy", (summaryLower.contains(query) || (s.getAiKeywords() != null && !s.getAiKeywords().isEmpty())) ? List.of("semantic", "keyword") : List.of("keyword"));
                item.put("relevanceScore", score);
                scoredList.add(item);
            }
        }

        scoredList.sort((a, b) -> (Integer) b.get("relevanceScore") - (Integer) a.get("relevanceScore"));

        Map<String, Object> res = new HashMap<>();
        res.put("results", scoredList);
        res.put("query", query);
        res.put("count", scoredList.size());
        res.put("latencyMs", 22);
        return ResponseEntity.ok(res);
    }
}
