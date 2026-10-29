package dev.pluck.backend.controller;

import dev.pluck.backend.model.Folder;
import dev.pluck.backend.model.Snippet;
import dev.pluck.backend.model.User;
import dev.pluck.backend.repository.FolderRepository;
import dev.pluck.backend.repository.SnippetRepository;
import dev.pluck.backend.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/folders")
public class FolderController {

    private final FolderRepository folderRepository;
    private final SnippetRepository snippetRepository;
    private final AuthService authService;

    @Autowired
    public FolderController(FolderRepository folderRepository, SnippetRepository snippetRepository, AuthService authService) {
        this.folderRepository = folderRepository;
        this.snippetRepository = snippetRepository;
        this.authService = authService;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getFolders(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId) {
        List<Folder> folders = folderRepository.findAll();
        if (folders.isEmpty()) {
            // Seed default folder categories if empty
            folders = Arrays.asList(
                    new Folder("hooks", "hooks", "🪝", 0, "ws_personal"),
                    new Folder("auth", "auth", "🔐", 0, "ws_personal"),
                    new Folder("aws-infra", "aws-infra", "☁️", 0, "ws_personal"),
                    new Folder("database", "database", "🗄️", 0, "ws_personal")
            );
            folderRepository.saveAll(folders);
        }

        User caller = authService.resolveCaller(authHeader, xUserId);
        List<Snippet> accessibleSnippets = snippetRepository.findAll().stream()
                .filter(s -> s.getUpdatedAt() != null && authService.canAccessSnippet(s, caller))
                .toList();
        List<Folder> withCounts = new ArrayList<>();
        for (Folder f : folders) {
            long count = accessibleSnippets.stream().filter(s -> f.getId().equalsIgnoreCase(s.getFolderId())).count();
            f.setCount((int) count);
            withCounts.add(f);
        }

        Map<String, Object> res = new HashMap<>();
        res.put("folders", withCounts);
        res.put("total", withCounts.size());
        return ResponseEntity.ok(res);
    }

    @PostMapping
    public ResponseEntity<?> createFolder(@RequestBody Map<String, String> body) {
        String name = body.get("name");
        String emoji = body.getOrDefault("emoji", "📁");

        if (name == null || name.trim().isEmpty()) {
            Map<String, String> err = new HashMap<>();
            err.put("error", "NAME_REQUIRED");
            err.put("message", "Folder name is required.");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(err);
        }

        String id = name.toLowerCase().replaceAll("[^a-z0-9]+", "-");
        Folder folder = new Folder(id, name, emoji, 0, "ws_personal");
        Folder saved = folderRepository.save(folder);

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("folder", saved);
        return ResponseEntity.status(HttpStatus.CREATED).body(res);
    }
}
