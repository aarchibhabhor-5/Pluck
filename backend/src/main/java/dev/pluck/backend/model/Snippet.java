package dev.pluck.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Document(collection = "snippets")
public class Snippet {

    @Id
    private String id;
    private String slug;
    private String title;
    private String code;
    private String language = "typescript";
    private String folderId = "hooks";
    private String folderName = "hooks";
    private String visibility = "private";
    private int version = 1;
    private List<Map<String, Object>> versions = new ArrayList<>();
    private List<String> tags = new ArrayList<>();
    private List<Map<String, String>> dependencies = new ArrayList<>();
    private List<String> envKeys = new ArrayList<>();
    private List<Object> variables = new ArrayList<>();
    private String aiSummary;
    private List<String> aiKeywords = new ArrayList<>();
    private List<String> aiUseCases = new ArrayList<>();
    private String designPattern;
    private String embeddingModel = "text-embedding-3-small (1536 dims)";
    private String embeddingStatus = "ready";
    private int vectorDimensions = 1536;
    private int forkCount = 0;
    private String createdAt;
    private String updatedAt;

    public Snippet() {
        this.createdAt = Instant.now().toString();
        this.updatedAt = Instant.now().toString();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }

    public String getFolderId() { return folderId; }
    public void setFolderId(String folderId) { this.folderId = folderId; }

    public String getFolderName() { return folderName; }
    public void setFolderName(String folderName) { this.folderName = folderName; }

    public String getVisibility() { return visibility; }
    public void setVisibility(String visibility) { this.visibility = visibility; }

    public int getVersion() { return version; }
    public void setVersion(int version) { this.version = version; }

    public List<Map<String, Object>> getVersions() { return versions; }
    public void setVersions(List<Map<String, Object>> versions) { this.versions = versions; }

    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }

    public List<Map<String, String>> getDependencies() { return dependencies; }
    public void setDependencies(List<Map<String, String>> dependencies) { this.dependencies = dependencies; }

    public List<String> getEnvKeys() { return envKeys; }
    public void setEnvKeys(List<String> envKeys) { this.envKeys = envKeys; }

    public List<Object> getVariables() { return variables; }
    public void setVariables(List<Object> variables) { this.variables = variables; }

    public String getAiSummary() { return aiSummary; }
    public void setAiSummary(String aiSummary) { this.aiSummary = aiSummary; }

    public List<String> getAiKeywords() { return aiKeywords; }
    public void setAiKeywords(List<String> aiKeywords) { this.aiKeywords = aiKeywords; }

    public List<String> getAiUseCases() { return aiUseCases; }
    public void setAiUseCases(List<String> aiUseCases) { this.aiUseCases = aiUseCases; }

    public String getDesignPattern() { return designPattern; }
    public void setDesignPattern(String designPattern) { this.designPattern = designPattern; }

    public String getEmbeddingModel() { return embeddingModel; }
    public void setEmbeddingModel(String embeddingModel) { this.embeddingModel = embeddingModel; }

    public String getEmbeddingStatus() { return embeddingStatus; }
    public void setEmbeddingStatus(String embeddingStatus) { this.embeddingStatus = embeddingStatus; }

    public int getVectorDimensions() { return vectorDimensions; }
    public void setVectorDimensions(int vectorDimensions) { this.vectorDimensions = vectorDimensions; }

    public int getForkCount() { return forkCount; }
    public void setForkCount(int forkCount) { this.forkCount = forkCount; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public String getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(String updatedAt) { this.updatedAt = updatedAt; }
}
