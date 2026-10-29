package dev.pluck.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;

@Document(collection = "sessions")
public class Session {

    @Id
    private String id;
    private String tokenHash;
    private String userId;
    private String createdAt;

    public Session() {
        this.createdAt = Instant.now().toString();
    }

    public Session(String tokenHash, String userId) {
        this.tokenHash = tokenHash;
        this.userId = userId;
        this.createdAt = Instant.now().toString();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTokenHash() { return tokenHash; }
    public void setTokenHash(String tokenHash) { this.tokenHash = tokenHash; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}

