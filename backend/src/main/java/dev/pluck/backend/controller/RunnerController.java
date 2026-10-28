package dev.pluck.backend.controller;

import dev.pluck.backend.model.RunRequest;
import dev.pluck.backend.model.RunResponse;
import dev.pluck.backend.service.RunnerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/runner")
public class RunnerController {

    private final RunnerService runnerService;

    @Autowired
    public RunnerController(RunnerService runnerService) {
        this.runnerService = runnerService;
    }

    @PostMapping("/execute")
    public ResponseEntity<RunResponse> executeSnippet(@RequestBody RunRequest request) {
        RunResponse response = runnerService.executeCode(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getRunnerStatus() {
        Map<String, Object> status = new HashMap<>();
        status.put("available", true);
        status.put("runtimes", List.of("javascript", "typescript", "python", "java"));
        status.put("maxMemoryMb", 64);
        status.put("defaultTimeoutMs", 5000);
        status.put("engine", "QuickJS / V8 / Python 3 Isolated Sandbox");
        return ResponseEntity.ok(status);
    }
}
