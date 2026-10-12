package dev.pluck.backend.model;

import java.util.ArrayList;
import java.util.List;

public class RunResponse {
    private String status; // "SUCCESS", "ERROR", "TIMEOUT"
    private int exitCode;
    private List<String> stdout = new ArrayList<>();
    private List<String> stderr = new ArrayList<>();
    private Object returnValue;
    private long durationMs;
    private double memoryUsageMb;
    private String runtime;
    private boolean timedOut;

    public RunResponse() {}

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public int getExitCode() {
        return exitCode;
    }

    public void setExitCode(int exitCode) {
        this.exitCode = exitCode;
    }

    public List<String> getStdout() {
        return stdout;
    }

    public void setStdout(List<String> stdout) {
        this.stdout = stdout;
    }

    public List<String> getStderr() {
        return stderr;
    }

    public void setStderr(List<String> stderr) {
        this.stderr = stderr;
    }

    public Object getReturnValue() {
        return returnValue;
    }

    public void setReturnValue(Object returnValue) {
        this.returnValue = returnValue;
    }

    public long getDurationMs() {
        return durationMs;
    }

    public void setDurationMs(long durationMs) {
        this.durationMs = durationMs;
    }

    public double getMemoryUsageMb() {
        return memoryUsageMb;
    }

    public void setMemoryUsageMb(double memoryUsageMb) {
        this.memoryUsageMb = memoryUsageMb;
    }

    public String getRuntime() {
        return runtime;
    }

    public void setRuntime(String runtime) {
        this.runtime = runtime;
    }

    public boolean isTimedOut() {
        return timedOut;
    }

    public void setTimedOut(boolean timedOut) {
        this.timedOut = timedOut;
    }
}
