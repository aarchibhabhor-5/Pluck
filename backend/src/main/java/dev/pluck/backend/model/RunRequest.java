package dev.pluck.backend.model;

import java.util.List;

public class RunRequest {
    private String code;
    private String language = "javascript";
    private String entryPoint;
    private List<Object> args;
    private int timeoutMs = 5000;
    private int memoryLimitMb = 64;

    public RunRequest() {}

    public RunRequest(String code, String language) {
        this.code = code;
        this.language = language;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getLanguage() {
        return language;
    }

    public void setLanguage(String language) {
        this.language = language;
    }

    public String getEntryPoint() {
        return entryPoint;
    }

    public void setEntryPoint(String entryPoint) {
        this.entryPoint = entryPoint;
    }

    public List<Object> getArgs() {
        return args;
    }

    public void setArgs(List<Object> args) {
        this.args = args;
    }

    public int getTimeoutMs() {
        return timeoutMs;
    }

    public void setTimeoutMs(int timeoutMs) {
        this.timeoutMs = timeoutMs;
    }

    public int getMemoryLimitMb() {
        return memoryLimitMb;
    }

    public void setMemoryLimitMb(int memoryLimitMb) {
        this.memoryLimitMb = memoryLimitMb;
    }
}
