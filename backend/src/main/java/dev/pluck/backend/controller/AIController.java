package dev.pluck.backend.controller;

import dev.pluck.backend.model.Snippet;
import dev.pluck.backend.repository.SnippetRepository;
import dev.pluck.backend.service.AIService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api")
public class AIController {

    private final AIService aiService;
    private final SnippetRepository snippetRepository;

    @Autowired
    public AIController(AIService aiService, SnippetRepository snippetRepository) {
        this.aiService = aiService;
        this.snippetRepository = snippetRepository;
    }

    @PostMapping("/ai/analyze")
    public ResponseEntity<?> analyzeSnippetDirectly(@RequestBody Map<String, Object> payload) {
        String title = (String) payload.getOrDefault("title", "Untitled Snippet");
        String code = (String) payload.getOrDefault("code", "");
        String language = (String) payload.getOrDefault("language", "typescript");
        String description = (String) payload.getOrDefault("description", "");

        Map<String, Object> analysis = aiService.analyzeSnippet(title, code, language, description);
        return ResponseEntity.ok(Map.of("success", true, "analysis", analysis));
    }

    @GetMapping("/snippets/{id}/ai-details")
    public ResponseEntity<?> getSnippetAIDetails(@PathVariable String id) {
        Optional<Snippet> opt = snippetRepository.findById(id);
        if (opt.isEmpty()) opt = snippetRepository.findBySlug(id);

        Snippet snippet;
        if (opt.isPresent()) {
            snippet = opt.get();
        } else {
            // Provide dynamic analysis for default / transient snippets like use-debounce
            snippet = new Snippet();
            snippet.setId(id);
            snippet.setSlug(id);
            if (id.contains("debounce")) {
                snippet.setTitle("useDebounce Hook");
                snippet.setLanguage("typescript");
                snippet.setCode("import { useState, useEffect } from 'react';\n\nexport function useDebounce<T>(value: T, delay: number = 300): T {\n  const [debouncedVal, setVal] = useState<T>(value);\n\n  useEffect(() => {\n    const t = setTimeout(() => setVal(value), delay);\n    return () => clearTimeout(t);\n  }, [value, delay]);\n\n  return debouncedVal;\n}");
            } else {
                snippet.setTitle("Custom Snippet");
                snippet.setLanguage("javascript");
                snippet.setCode("// Sample code snippet");
            }
        }

        // Perform or retrieve analysis
        Map<String, Object> analysis = aiService.analyzeSnippet(
                snippet.getTitle(),
                snippet.getCode(),
                snippet.getLanguage(),
                snippet.getAiSummary() != null && !snippet.getAiSummary().isEmpty() ? snippet.getAiSummary() : ""
        );

        // Update snippet fields if not already populated
        if (opt.isPresent()) {
            Snippet s = opt.get();
            boolean changed = false;
            if (s.getAiSummary() == null || s.getAiSummary().isEmpty()) {
                s.setAiSummary((String) analysis.get("aiSummary"));
                changed = true;
            }
            if (s.getAiKeywords() == null || s.getAiKeywords().isEmpty()) {
                s.setAiKeywords((List<String>) analysis.get("keywords"));
                changed = true;
            }
            if (s.getDesignPattern() == null || s.getDesignPattern().isEmpty()) {
                s.setDesignPattern((String) analysis.get("designPattern"));
                changed = true;
            }
            if (changed) {
                snippetRepository.save(s);
            }
        }

        return ResponseEntity.ok(Map.of("success", true, "snippetId", id, "analysis", analysis));
    }

    @PostMapping("/snippets/{id}/ai-details/regenerate")
    public ResponseEntity<?> regenerateSnippetAIDetails(@PathVariable String id, @RequestBody(required = false) Map<String, Object> payload) {
        Optional<Snippet> opt = snippetRepository.findById(id);
        if (opt.isEmpty()) opt = snippetRepository.findBySlug(id);

        String codeToAnalyze = null;
        String titleToAnalyze = null;
        String langToAnalyze = null;

        if (payload != null && payload.containsKey("code")) {
            codeToAnalyze = (String) payload.get("code");
        }
        if (payload != null && payload.containsKey("title")) {
            titleToAnalyze = (String) payload.get("title");
        }
        if (payload != null && payload.containsKey("language")) {
            langToAnalyze = (String) payload.get("language");
        }

        Snippet snippet;
        if (opt.isPresent()) {
            snippet = opt.get();
            if (codeToAnalyze != null) snippet.setCode(codeToAnalyze);
            if (titleToAnalyze != null) snippet.setTitle(titleToAnalyze);
            if (langToAnalyze != null) snippet.setLanguage(langToAnalyze);
        } else {
            snippet = new Snippet();
            snippet.setId(id);
            snippet.setSlug(id);
            snippet.setTitle(titleToAnalyze != null ? titleToAnalyze : "useDebounce Hook");
            snippet.setCode(codeToAnalyze != null ? codeToAnalyze : "export function useDebounce(value, delay = 300) {}");
            snippet.setLanguage(langToAnalyze != null ? langToAnalyze : "typescript");
        }

        Map<String, Object> analysis = aiService.analyzeSnippet(
                snippet.getTitle(),
                snippet.getCode(),
                snippet.getLanguage(),
                ""
        );

        snippet.setAiSummary((String) analysis.get("aiSummary"));
        snippet.setAiKeywords((List<String>) analysis.get("keywords"));
        snippet.setAiUseCases((List<String>) analysis.get("useCases"));
        snippet.setDesignPattern((String) analysis.get("designPattern"));

        if (opt.isPresent()) {
            snippetRepository.save(snippet);
        }

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "AI metadata and vector embedding tokens regenerated successfully",
                "analysis", analysis
        ));
    }

    @PostMapping("/ai/simulate-search")
    public ResponseEntity<?> simulateSearchMatching(@RequestBody Map<String, Object> payload) {
        String query = (String) payload.getOrDefault("query", "");
        String snippetId = (String) payload.getOrDefault("snippetId", "use-debounce");

        Optional<Snippet> opt = snippetRepository.findById(snippetId);
        if (opt.isEmpty()) opt = snippetRepository.findBySlug(snippetId);

        Snippet snippet;
        if (opt.isPresent()) {
            snippet = opt.get();
        } else {
            snippet = new Snippet();
            snippet.setId(snippetId);
            snippet.setTitle("useDebounce Hook");
            snippet.setLanguage("typescript");
            snippet.setCode("export function useDebounce(value, delay = 300) {}");
            snippet.setAiSummary("Debounces rapidly changing values with a configurable timeout window in React 18 using useEffect cleanup to eliminate race conditions and redundant network requests.");
            snippet.setDesignPattern("Debounce Decorator / Rate-Limiting Hook");
            snippet.setAiKeywords(List.of("react-hook", "debounce", "delay", "timing", "throttle", "rate-limit", "cleanup", "use-effect"));
        }

        Map<String, Object> simResult = aiService.simulateSemanticSearch(query, snippet);
        return ResponseEntity.ok(Map.of("success", true, "simulation", simResult));
    }
}
