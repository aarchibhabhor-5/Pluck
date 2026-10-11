package dev.pluck.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "tokens")
public class Token {

    @Id
    private String id;
    private String name;
    private String prefix;
    private String tokenHash;
    private List<String> scopes = new ArrayList<>();
    private String lastUsed = "Never";
    private String expires = "in 90 days";
    private String createdAt;

    public Token() {
        this.createdAt = Instant.now().toString();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getPrefix() { return prefix; }
    public void setPrefix(String prefix) { this.prefix = prefix; }

    public String getTokenHash() { return tokenHash; }
    public void setTokenHash(String tokenHash) { this.tokenHash = tokenHash; }

    public List<String> getScopes() { return scopes; }
    public void setScopes(List<String> scopes) { this.scopes = scopes; }

    public String getLastUsed() { return lastUsed; }
    public void setLastUsed(String lastUsed) { this.lastUsed = lastUsed; }

    public String getExpires() { return expires; }
    public void setExpires(String expires) { this.expires = expires; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
