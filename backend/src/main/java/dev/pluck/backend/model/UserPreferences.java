package dev.pluck.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "user_preferences")
public class UserPreferences {

    @Id
    private String id;
    private String userId;
    private String defaultPackageManager = "npm";
    private String pythonInstaller = "pip";
    private String editorKeymap = "Standard (VS Code)";
    private String updatedAt;

    public UserPreferences() {
        this.updatedAt = Instant.now().toString();
    }

    public UserPreferences(String userId) {
        this.id = "pref_" + userId;
        this.userId = userId;
        this.defaultPackageManager = "npm";
        this.pythonInstaller = "pip";
        this.editorKeymap = "Standard (VS Code)";
        this.updatedAt = Instant.now().toString();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getDefaultPackageManager() { return defaultPackageManager; }
    public void setDefaultPackageManager(String defaultPackageManager) { this.defaultPackageManager = defaultPackageManager; }

    public String getPythonInstaller() { return pythonInstaller; }
    public void setPythonInstaller(String pythonInstaller) { this.pythonInstaller = pythonInstaller; }

    public String getEditorKeymap() { return editorKeymap; }
    public void setEditorKeymap(String editorKeymap) { this.editorKeymap = editorKeymap; }

    public String getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(String updatedAt) { this.updatedAt = updatedAt; }
}
