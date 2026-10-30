package dev.pluck.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.pluck.backend.model.*;
import dev.pluck.backend.repository.SnippetRepository;
import dev.pluck.backend.repository.TeamRepository;
import dev.pluck.backend.repository.TokenRepository;
import dev.pluck.backend.repository.UserRepository;
import dev.pluck.backend.service.RunnerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Model Context Protocol (MCP) Server & CLI Integration Controller
 * Compliant with Anthropic MCP Specification (2024-11-05) for Claude Desktop, Cursor, and VS Code.
 */
@RestController
public class MCPController {

    private final SnippetRepository snippetRepository;
    private final TeamRepository teamRepository;
    private final TokenRepository tokenRepository;
    private final UserRepository userRepository;
    private final RunnerService runnerService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    // Active SSE sessions
    private final Map<String, SseEmitter> activeSessions = new ConcurrentHashMap<>();

    @Autowired
    public MCPController(
            SnippetRepository snippetRepository,
            TeamRepository teamRepository,
            TokenRepository tokenRepository,
            UserRepository userRepository,
            RunnerService runnerService
    ) {
        this.snippetRepository = snippetRepository;
        this.teamRepository = teamRepository;
        this.tokenRepository = tokenRepository;
        this.userRepository = userRepository;
        this.runnerService = runnerService;
    }

    /**
     * 1. GET /api/mcp/sse — Establish Server-Sent Events stream for MCP clients
     */
    @GetMapping(value = "/api/mcp/sse", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter connectSse() {
        String sessionId = UUID.randomUUID().toString();
        SseEmitter emitter = new SseEmitter(1800000L); // 30 minutes timeout

        activeSessions.put(sessionId, emitter);

        emitter.onCompletion(() -> activeSessions.remove(sessionId));
        emitter.onTimeout(() -> activeSessions.remove(sessionId));
        emitter.onError(e -> activeSessions.remove(sessionId));

        try {
            // Per MCP SSE specification: client receives the endpoint URI for POST messages
            emitter.send(SseEmitter.event()
                    .name("endpoint")
                    .data("/api/mcp/messages?sessionId=" + sessionId));
        } catch (IOException e) {
            emitter.completeWithError(e);
        }

        return emitter;
    }

    /**
     * 2. POST /api/mcp/messages — JSON-RPC 2.0 message handler for MCP
     */
    @PostMapping("/api/mcp/messages")
    public ResponseEntity<?> handleMcpMessage(
            @RequestBody Map<String, Object> rpcRequest,
            @RequestParam(required = false) String sessionId,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "PLUCK_TOKEN", required = false) String pluckTokenHeader
    ) {
        String method = (String) rpcRequest.get("method");
        Object id = rpcRequest.get("id");
        Map<String, Object> params = (Map<String, Object>) rpcRequest.getOrDefault("params", Collections.emptyMap());

        if ("notifications/initialized".equals(method)) {
            return ResponseEntity.noContent().build();
        }

        Map<String, Object> rpcResponse = new LinkedHashMap<>();
        rpcResponse.put("jsonrpc", "2.0");
        rpcResponse.put("id", id);

        if ("initialize".equals(method)) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("protocolVersion", "2024-11-05");
            result.put("capabilities", Map.of(
                    "tools", Map.of("listChanged", true),
                    "resources", Map.of("listChanged", false),
                    "prompts", Map.of("listChanged", false)
            ));
            result.put("serverInfo", Map.of(
                    "name", "pluck-mcp-server",
                    "version", "1.0.0"
            ));
            rpcResponse.put("result", result);
            return ResponseEntity.ok(rpcResponse);
        }

        if ("tools/list".equals(method)) {
            List<Map<String, Object>> tools = getRegisteredTools();
            rpcResponse.put("result", Map.of("tools", tools));
            return ResponseEntity.ok(rpcResponse);
        }

        if ("tools/call".equals(method)) {
            String toolName = (String) params.get("name");
            Map<String, Object> arguments = (Map<String, Object>) params.getOrDefault("arguments", Collections.emptyMap());

            Map<String, Object> toolResult = executeTool(toolName, arguments, authHeader, pluckTokenHeader);
            rpcResponse.put("result", toolResult);
            return ResponseEntity.ok(rpcResponse);
        }

        // Unknown method
        rpcResponse.put("error", Map.of(
                "code", -32601,
                "message", "Method not found: " + method
        ));
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(rpcResponse);
    }

    /**
     * 3. CLI Verification Endpoints (/api/cli/auth & /api/cli/verify)
     */
    @GetMapping("/api/cli/verify")
    public ResponseEntity<?> verifyCliToken(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "PLUCK_TOKEN", required = false) String pluckTokenHeader
    ) {
        String tokenStr = pluckTokenHeader != null ? pluckTokenHeader : (authHeader != null && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null);
        if (tokenStr == null || !tokenStr.startsWith("pluck_pat_")) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "authenticated", false,
                    "message", "Valid PLUCK_TOKEN header or Bearer pluck_pat_... required."
            ));
        }

        String rawHex = tokenStr.substring(10);
        String tokenHash = rawHex.length() >= 8 ? "hash_" + rawHex.substring(0, 8) : "";
        String prefix = rawHex.length() >= 4 ? "pluck_pat_" + rawHex.substring(0, 4) + "..." : "";

        Optional<Token> tokenOpt = tokenRepository.findByTokenHash(tokenHash)
                .or(() -> tokenRepository.findByPrefix(prefix));

        if (tokenOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "authenticated", false,
                    "message", "Token not found or revoked."
            ));
        }

        Token token = tokenOpt.get();
        token.setLastUsed("Just now");
        tokenRepository.save(token);

        User user = null;
        if (token.getUserId() != null) {
            user = userRepository.findById(token.getUserId()).orElse(null);
        }

        List<Snippet> snippets = snippetRepository.findAll();
        List<Team> teams = teamRepository.findByDeletedAtIsNull();

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("authenticated", true);
        res.put("tokenName", token.getName());
        res.put("scopes", token.getScopes());
        res.put("user", user != null ? Map.of("name", user.getName(), "email", user.getEmail()) : Map.of("name", "Developer"));
        res.put("vaultCount", snippets.size());
        res.put("teamsCount", teams.size());
        res.put("serverStatus", "connected");

        return ResponseEntity.ok(res);
    }

    @PostMapping("/api/cli/auth")
    public ResponseEntity<?> cliAuth(@RequestBody Map<String, String> body) {
        return verifyCliToken(null, body.get("token"));
    }

    // ── Internal MCP Tool Execution ─────────────────────────────────────
    private List<Map<String, Object>> getRegisteredTools() {
        return List.of(
                Map.of(
                        "name", "search_snippets",
                        "description", "Search snippet vault by keywords, language, or intent.",
                        "inputSchema", Map.of(
                                "type", "object",
                                "properties", Map.of(
                                        "query", Map.of("type", "string", "description", "Search query or intent description"),
                                        "language", Map.of("type", "string", "description", "Optional language filter (e.g. typescript, python, go, rust, java)"),
                                        "tag", Map.of("type", "string", "description", "Optional tag filter")
                                ),
                                "required", List.of("query")
                        )
                ),
                Map.of(
                        "name", "get_snippet",
                        "description", "Retrieve source code and full metadata for a snippet by ID or slug.",
                        "inputSchema", Map.of(
                                "type", "object",
                                "properties", Map.of(
                                        "id", Map.of("type", "string", "description", "Snippet ID or slug (e.g. use-debounce, auth-middleware)")
                                ),
                                "required", List.of("id")
                        )
                ),
                Map.of(
                        "name", "create_snippet",
                        "description", "Save a new snippet into the user's Pluck vault.",
                        "inputSchema", Map.of(
                                "type", "object",
                                "properties", Map.of(
                                        "title", Map.of("type", "string", "description", "Title of snippet"),
                                        "code", Map.of("type", "string", "description", "Complete source code"),
                                        "language", Map.of("type", "string", "description", "Programming language"),
                                        "description", Map.of("type", "string", "description", "Documentation of purpose"),
                                        "tags", Map.of("type", "array", "items", Map.of("type", "string"), "description", "Tags")
                                ),
                                "required", List.of("title", "code", "language")
                        )
                ),
                Map.of(
                        "name", "list_collections",
                        "description", "List all team collections and shared folders.",
                        "inputSchema", Map.of(
                                "type", "object",
                                "properties", Collections.emptyMap()
                        )
                ),
                Map.of(
                        "name", "execute_code",
                        "description", "Execute code snippet inside the secure isolated sandbox runner.",
                        "inputSchema", Map.of(
                                "type", "object",
                                "properties", Map.of(
                                        "code", Map.of("type", "string", "description", "Source code to execute"),
                                        "language", Map.of("type", "string", "description", "Runtime language (javascript, python, java)")
                                ),
                                "required", List.of("code", "language")
                        )
                )
        );
    }

    private Map<String, Object> executeTool(String toolName, Map<String, Object> args, String authHeader, String pluckToken) {
        try {
            switch (toolName) {
                case "search_snippets": {
                    String query = String.valueOf(args.getOrDefault("query", "")).toLowerCase();
                    String langFilter = args.containsKey("language") ? String.valueOf(args.get("language")).toLowerCase() : null;

                    List<Snippet> all = snippetRepository.findAll();
                    List<Map<String, Object>> matches = new ArrayList<>();

                    for (Snippet s : all) {
                        if (langFilter != null && !langFilter.equalsIgnoreCase(s.getLanguage())) continue;
                        boolean textMatch = query.isEmpty() ||
                                (s.getTitle() != null && s.getTitle().toLowerCase().contains(query)) ||
                                (s.getDescription() != null && s.getDescription().toLowerCase().contains(query)) ||
                                (s.getCode() != null && s.getCode().toLowerCase().contains(query));

                        if (textMatch) {
                            matches.add(Map.of(
                                    "id", s.getId(),
                                    "slug", s.getSlug() != null ? s.getSlug() : s.getId(),
                                    "title", s.getTitle(),
                                    "language", s.getLanguage(),
                                    "description", s.getDescription() != null ? s.getDescription() : "",
                                    "previewCode", s.getPreviewCode()
                            ));
                        }
                    }

                    String text = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(matches);
                    return Map.of("content", List.of(Map.of("type", "text", "text", text)));
                }

                case "get_snippet": {
                    String id = String.valueOf(args.get("id"));
                    Optional<Snippet> snippetOpt = snippetRepository.findById(id)
                            .or(() -> snippetRepository.findBySlug(id));

                    if (snippetOpt.isEmpty()) {
                        return Map.of("isError", true, "content", List.of(Map.of("type", "text", "text", "Snippet not found for: " + id)));
                    }

                    Snippet s = snippetOpt.get();
                    String text = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(s);
                    return Map.of("content", List.of(Map.of("type", "text", "text", text)));
                }

                case "create_snippet": {
                    String title = String.valueOf(args.get("title"));
                    String code = String.valueOf(args.get("code"));
                    String language = String.valueOf(args.getOrDefault("language", "typescript"));
                    String desc = args.containsKey("description") ? String.valueOf(args.get("description")) : "";

                    String slug = title.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");
                    if (slug.isEmpty()) slug = "snippet-" + UUID.randomUUID().toString().substring(0, 6);

                    Snippet snip = new Snippet();
                    snip.setId(slug);
                    snip.setSlug(slug);
                    snip.setTitle(title);
                    snip.setCode(code);
                    snip.setLanguage(language);
                    snip.setDescription(desc);
                    snip.setFolderId("cli");
                    snip.setFolderName("CLI Snippets");

                    Snippet saved = snippetRepository.save(snip);
                    return Map.of("content", List.of(Map.of("type", "text", "text", "Snippet created successfully! ID: " + saved.getId())));
                }

                case "list_collections": {
                    List<Team> teams = teamRepository.findByDeletedAtIsNull();
                    List<Map<String, Object>> allCols = new ArrayList<>();
                    for (Team t : teams) {
                        if (t.getCollections() != null) {
                            allCols.addAll(t.getCollections());
                        }
                    }
                    String text = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(allCols);
                    return Map.of("content", List.of(Map.of("type", "text", "text", text)));
                }

                case "execute_code": {
                    String code = String.valueOf(args.get("code"));
                    String lang = String.valueOf(args.getOrDefault("language", "javascript"));

                    RunRequest req = new RunRequest();
                    req.setCode(code);
                    req.setLanguage(lang);
                    req.setTimeoutMs(5000);
                    req.setMemoryLimitMb(64);

                    RunResponse res = runnerService.executeCode(req);
                    String text = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(res);
                    return Map.of("content", List.of(Map.of("type", "text", "text", text)));
                }

                default:
                    return Map.of("isError", true, "content", List.of(Map.of("type", "text", "text", "Unknown tool: " + toolName)));
            }
        } catch (Exception e) {
            return Map.of("isError", true, "content", List.of(Map.of("type", "text", "text", "Error executing tool " + toolName + ": " + e.getMessage())));
        }
    }
}
