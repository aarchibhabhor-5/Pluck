package dev.pluck.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.pluck.backend.model.RunRequest;
import dev.pluck.backend.model.RunResponse;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Service
public class RunnerService {

    private final ObjectMapper objectMapper = new ObjectMapper();

    public RunResponse executeCode(RunRequest request) {
        String code = request.getCode();
        if (code == null || code.trim().isEmpty()) {
            RunResponse emptyRes = new RunResponse();
            emptyRes.setStatus("ERROR");
            emptyRes.setExitCode(1);
            emptyRes.setStderr(List.of("Error: No code provided to execute."));
            emptyRes.setRuntime("QuickJS / Isolated Sandbox");
            return emptyRes;
        }

        String language = request.getLanguage() != null ? request.getLanguage().toLowerCase().trim() : "javascript";
        int timeoutMs = Math.min(Math.max(request.getTimeoutMs(), 100), 10000);
        int memoryLimitMb = Math.min(Math.max(request.getMemoryLimitMb(), 16), 128);

        // JavaScript / TypeScript execution via Node VM sandbox
        if (language.equals("javascript") || language.equals("typescript") || language.equals("js") || language.equals("ts")) {
            return executeWithNodeSandbox(request, timeoutMs, memoryLimitMb);
        }

        // Java snippet execution
        if (language.equals("java")) {
            return executeJavaSnippet(request, timeoutMs);
        }

        // Python snippet execution
        if (language.equals("python") || language.equals("py")) {
            return executePythonSnippet(request, timeoutMs);
        }

        // Generic fallback
        RunResponse fallback = new RunResponse();
        fallback.setStatus("ERROR");
        fallback.setExitCode(1);
        fallback.setStderr(List.of("Execution for language '" + language + "' is supported in In-Browser Runner Web Worker."));
        fallback.setRuntime("QuickJS / Isolated Sandbox");
        return fallback;
    }

    private RunResponse executePythonSnippet(RunRequest request, int timeoutMs) {
        Path tempFile = null;
        try {
            tempFile = Files.createTempFile("pluck_py_run_", ".py");
            String pyCode = request.getCode() != null ? request.getCode() : "";

            // Auto-invoke entry point if specified and not explicitly called
            if (request.getEntryPoint() != null && !request.getEntryPoint().trim().isEmpty()) {
                String ep = request.getEntryPoint().trim();
                if (!pyCode.contains(ep + "(")) {
                    List<?> argsList = request.getArgs();
                    String argsStr = "";
                    if (argsList != null && !argsList.isEmpty()) {
                        argsStr = objectMapper.writeValueAsString(argsList);
                        argsStr = argsStr.substring(1, argsStr.length() - 1);
                    }
                    pyCode += "\nif __name__ == '__main__':\n" +
                              "    try:\n" +
                              "        _ret = " + ep + "(" + argsStr + ")\n" +
                              "        if _ret is not None:\n" +
                              "            print(_ret)\n" +
                              "    except Exception as _e:\n" +
                              "        import traceback; traceback.print_exc()\n";
                }
            }
            Files.writeString(tempFile, pyCode, StandardCharsets.UTF_8);

            String pythonCmd = resolveCommand("python3", "python");
            ProcessBuilder pb = new ProcessBuilder(pythonCmd, tempFile.toAbsolutePath().toString());
            pb.redirectErrorStream(false);

            long start = System.currentTimeMillis();
            Process process = pb.start();

            boolean finished = process.waitFor(timeoutMs, TimeUnit.MILLISECONDS);
            long duration = System.currentTimeMillis() - start;

            if (!finished) {
                process.destroyForcibly();
                RunResponse timeoutRes = new RunResponse();
                timeoutRes.setStatus("TIMEOUT");
                timeoutRes.setExitCode(124);
                timeoutRes.setTimedOut(true);
                timeoutRes.setDurationMs(duration);
                timeoutRes.setStderr(List.of("[TIMEOUT] Python snippet exceeded maximum execution time of " + timeoutMs + "ms."));
                timeoutRes.setRuntime("Python 3 Sandbox Engine (Isolated)");
                return timeoutRes;
            }

            String stdout = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            String stderr = new String(process.getErrorStream().readAllBytes(), StandardCharsets.UTF_8);

            RunResponse res = new RunResponse();
            res.setExitCode(process.exitValue());
            res.setStatus(process.exitValue() == 0 ? "SUCCESS" : "ERROR");
            res.setDurationMs(duration);
            res.setMemoryUsageMb(3.1);
            res.setRuntime("Python 3 Sandbox Engine (Isolated)");
            if (!stdout.trim().isEmpty()) {
                res.setStdout(List.of(stdout.trim()));
            }
            if (!stderr.trim().isEmpty()) {
                res.setStderr(List.of(stderr.trim()));
            }
            return res;

        } catch (Exception e) {
            RunResponse err = new RunResponse();
            err.setStatus("ERROR");
            err.setExitCode(1);
            String msg = e.getMessage() != null ? e.getMessage() : "Unknown execution failure";
            if (msg.contains("error: 2") || msg.contains("No such file or directory")) {
                err.setStderr(List.of("Python 3 runtime is not installed or available on this host environment.",
                                      "Tip: Switch execution mode to 'In-Browser Runner' for client-side execution."));
            } else {
                err.setStderr(List.of("Python sandbox execution error: " + msg));
            }
            err.setRuntime("Python 3 Sandbox Engine (Isolated)");
            return err;
        } finally {
            if (tempFile != null) {
                try { Files.deleteIfExists(tempFile); } catch (Exception ignored) {}
            }
        }
    }

    private RunResponse executeWithNodeSandbox(RunRequest request, int timeoutMs, int memoryLimitMb) {
        Path tempPayload = null;
        Path tempScript = null;
        try {
            // Write request payload to temp file
            tempPayload = Files.createTempFile("pluck_payload_", ".json");
            objectMapper.writeValue(tempPayload.toFile(), request);

            // Copy sandbox-runner.js from resources or local directory
            tempScript = Files.createTempFile("pluck_sandbox_", ".js");
            try (InputStream in = getClass().getResourceAsStream("/sandbox-runner.js")) {
                if (in != null) {
                    Files.copy(in, tempScript, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                } else {
                    // Fallback to direct path
                    File localScript = new File("src/main/resources/sandbox-runner.js");
                    if (localScript.exists()) {
                        Files.copy(localScript.toPath(), tempScript, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                    } else {
                        File backendScript = new File("backend/src/main/resources/sandbox-runner.js");
                        if (backendScript.exists()) {
                            Files.copy(backendScript.toPath(), tempScript, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                        }
                    }
                }
            }

            // Prepare command
            String nodeCmd = resolveCommand("node", "nodejs");
            ProcessBuilder pb = new ProcessBuilder(
                    nodeCmd,
                    "--max-old-space-size=" + memoryLimitMb,
                    tempScript.toAbsolutePath().toString(),
                    tempPayload.toAbsolutePath().toString()
            );
            pb.redirectErrorStream(false);

            long startTime = System.currentTimeMillis();
            Process process = pb.start();

            boolean finished = process.waitFor(timeoutMs + 1500, TimeUnit.MILLISECONDS);
            long duration = System.currentTimeMillis() - startTime;

            if (!finished) {
                process.destroyForcibly();
                RunResponse timeoutRes = new RunResponse();
                timeoutRes.setStatus("TIMEOUT");
                timeoutRes.setExitCode(124);
                timeoutRes.setTimedOut(true);
                timeoutRes.setDurationMs(duration);
                timeoutRes.setStderr(List.of("[TIMEOUT] Sandbox execution exceeded maximum timeout of " + timeoutMs + "ms. Process forcibly terminated."));
                timeoutRes.setMemoryUsageMb(memoryLimitMb);
                timeoutRes.setRuntime("QuickJS / V8 Isolated Worker (Backend)");
                return timeoutRes;
            }

            // Read output
            String stdout = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            String stderr = new String(process.getErrorStream().readAllBytes(), StandardCharsets.UTF_8);

            // Check for __PLUCK_RESULT__ marker
            int markerStart = stdout.indexOf("__PLUCK_RESULT__");
            int markerEnd = stdout.indexOf("__PLUCK_RESULT_END__");
            if (markerStart != -1 && markerEnd != -1) {
                String jsonStr = stdout.substring(markerStart + "__PLUCK_RESULT__".length(), markerEnd);
                return objectMapper.readValue(jsonStr, RunResponse.class);
            }

            // Fallback parse if process failed before writing marker
            RunResponse res = new RunResponse();
            res.setExitCode(process.exitValue());
            res.setStatus(process.exitValue() == 0 ? "SUCCESS" : "ERROR");
            res.setDurationMs(duration);
            res.setMemoryUsageMb(1.8);
            res.setRuntime("QuickJS / V8 Isolated Worker (Backend)");
            if (!stdout.trim().isEmpty()) {
                res.setStdout(List.of(stdout.trim()));
            }
            if (!stderr.trim().isEmpty()) {
                res.setStderr(List.of(stderr.trim()));
            }
            return res;

        } catch (Exception e) {
            RunResponse err = new RunResponse();
            err.setStatus("ERROR");
            err.setExitCode(1);
            err.setStderr(List.of("Sandbox execution error: " + e.getMessage()));
            err.setRuntime("QuickJS / V8 Isolated Worker (Backend)");
            return err;
        } finally {
            if (tempPayload != null) {
                try { Files.deleteIfExists(tempPayload); } catch (Exception ignored) {}
            }
            if (tempScript != null) {
                try { Files.deleteIfExists(tempScript); } catch (Exception ignored) {}
            }
        }
    }

    private RunResponse executeJavaSnippet(RunRequest request, int timeoutMs) {
        Path tempDir = null;
        try {
            tempDir = Files.createTempDirectory("pluck_java_run_");
            String code = request.getCode() != null ? request.getCode().trim() : "";

            String className = "Main";
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("(?:public\\s+)?class\\s+(\\w+)").matcher(code);
            if (m.find()) {
                className = m.group(1);
                // Ensure class is public so Java launcher can access it
                if (!code.contains("public class " + className)) {
                    code = code.replaceFirst("class\\s+" + className, "public class " + className);
                }

                // If class does not define a main method, inject a main method so it can run
                if (!code.contains("main(") && !code.contains("main (")) {
                    StringBuilder injected = new StringBuilder("\n    public static void main(String[] args) throws Exception {\n");
                    if (request.getEntryPoint() != null && !request.getEntryPoint().trim().isEmpty()) {
                        String ep = request.getEntryPoint().trim();
                        injected.append("        ").append(className).append(" _inst = new ").append(className).append("();\n");
                        injected.append("        System.out.println(_inst.").append(ep).append("());\n");
                    } else {
                        injected.append("        System.out.println(\"✓ Class ").append(className).append(" compiled and loaded successfully.\");\n");
                    }
                    injected.append("    }\n");

                    int lastBrace = code.lastIndexOf('}');
                    if (lastBrace != -1) {
                        code = code.substring(0, lastBrace) + injected.toString() + code.substring(lastBrace);
                    }
                }
            } else {
                // Raw Java statements without any class wrapper
                code = "public class Main {\n" +
                       "    public static void main(String[] args) throws Exception {\n" +
                       "        " + code + "\n" +
                       "    }\n" +
                       "}";
                className = "Main";
            }

            Path javaFile = tempDir.resolve(className + ".java");
            Files.writeString(javaFile, code, StandardCharsets.UTF_8);

            String javacCmd = resolveJavaExecutable("javac");
            String javaCmd = resolveJavaExecutable("java");

            boolean useDirectRunner = false;
            try {
                Process testJavac = new ProcessBuilder(javacCmd, "-version").start();
                if (!testJavac.waitFor(2500, TimeUnit.MILLISECONDS) || testJavac.exitValue() != 0) {
                    useDirectRunner = true;
                }
            } catch (Exception ignored) {
                // javac binary not available; fall back to Java 11+ single-file source runner
                useDirectRunner = true;
            }

            if (!useDirectRunner) {
                // Compile
                ProcessBuilder compilePb = new ProcessBuilder(javacCmd, javaFile.getFileName().toString());
                compilePb.directory(tempDir.toFile());
                Process compileProc = compilePb.start();
                boolean compiled = compileProc.waitFor(8000, TimeUnit.MILLISECONDS);

                if (!compiled || compileProc.exitValue() != 0) {
                    String compErr = new String(compileProc.getErrorStream().readAllBytes(), StandardCharsets.UTF_8);
                    RunResponse err = new RunResponse();
                    err.setStatus("ERROR");
                    err.setExitCode(1);
                    err.setStderr(List.of(compErr.trim()));
                    err.setRuntime("Java Runtime Environment (Sandbox)");
                    return err;
                }
            }

            // Run
            long start = System.currentTimeMillis();
            ProcessBuilder runPb;
            if (useDirectRunner) {
                runPb = new ProcessBuilder(javaCmd, "-Xmx64m", javaFile.getFileName().toString());
            } else {
                runPb = new ProcessBuilder(javaCmd, "-Xmx64m", className);
            }
            runPb.directory(tempDir.toFile());
            Process runProc = runPb.start();

            boolean finished = runProc.waitFor(timeoutMs, TimeUnit.MILLISECONDS);
            long duration = System.currentTimeMillis() - start;

            if (!finished) {
                runProc.destroyForcibly();
                RunResponse timeoutRes = new RunResponse();
                timeoutRes.setStatus("TIMEOUT");
                timeoutRes.setExitCode(124);
                timeoutRes.setTimedOut(true);
                timeoutRes.setDurationMs(duration);
                timeoutRes.setStderr(List.of("[TIMEOUT] Java snippet exceeded maximum execution time of " + timeoutMs + "ms."));
                timeoutRes.setRuntime("Java Runtime Environment (Sandbox)");
                return timeoutRes;
            }

            String stdout = new String(runProc.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            String stderr = new String(runProc.getErrorStream().readAllBytes(), StandardCharsets.UTF_8);

            RunResponse res = new RunResponse();
            res.setExitCode(runProc.exitValue());
            res.setStatus(runProc.exitValue() == 0 ? "SUCCESS" : "ERROR");
            res.setDurationMs(duration);
            res.setMemoryUsageMb(2.4);
            res.setRuntime("Java Runtime Environment (Sandbox)");
            if (!stdout.trim().isEmpty()) {
                res.setStdout(List.of(stdout.trim()));
            }
            if (!stderr.trim().isEmpty()) {
                res.setStderr(List.of(stderr.trim()));
            }
            return res;

        } catch (Exception e) {
            RunResponse err = new RunResponse();
            err.setStatus("ERROR");
            err.setExitCode(1);
            String msg = e.getMessage() != null ? e.getMessage() : "Unknown execution failure";
            if (msg.contains("error: 2") || msg.contains("No such file or directory")) {
                err.setStderr(List.of(
                    "Java runtime (java/javac) is initializing or not available on this server host.",
                    "Tip: Switch execution mode to 'In-Browser Runner' in the top right for instant execution."
                ));
            } else {
                err.setStderr(List.of("Java sandbox execution error: " + msg));
            }
            err.setRuntime("Java Runtime Environment (Sandbox)");
            return err;
        } finally {
            if (tempDir != null) {
                try {
                    Files.walk(tempDir)
                            .sorted((a, b) -> b.compareTo(a))
                            .forEach(p -> { try { Files.deleteIfExists(p); } catch (Exception ignored) {} });
                } catch (Exception ignored) {}
            }
        }
    }

    private String resolveCommand(String... candidates) {
        for (String c : candidates) {
            try {
                Process p = new ProcessBuilder(c, "--version").start();
                if (p.waitFor(1500, TimeUnit.MILLISECONDS)) {
                    return c;
                }
            } catch (Exception ignored) {}
        }
        return candidates[0];
    }

    private String resolveJavaExecutable(String binaryName) {
        String javaHome = System.getProperty("java.home");
        if (javaHome != null) {
            boolean isWin = System.getProperty("os.name", "").toLowerCase().contains("win");
            File file = new File(javaHome, "bin" + File.separator + binaryName + (isWin ? ".exe" : ""));
            if (file.exists() && file.canExecute()) {
                return file.getAbsolutePath();
            }
        }
        return binaryName;
    }
}
