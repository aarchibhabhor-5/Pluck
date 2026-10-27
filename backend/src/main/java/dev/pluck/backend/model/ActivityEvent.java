package dev.pluck.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Document(collection = "activity_events")
public class ActivityEvent {

    @Id
    private String id;
    private String teamId;
    private String actorId;
    private String actorName;
    private String type; // e.g. "snippet.created", "snippet.updated", "snippet.deleted", "member.invited", "member.joined", "member.role_changed", "member.removed"
    private String snippetId;
    private String snippetTitle;
    private String text; // Formatted preview text, e.g. "Sarah Jenkins updated auth-middleware (v1.3)"
    private String icon = "cyan"; // "cyan", "green", "pink", "purple", "yellow"
    private Map<String, Object> metadata = new HashMap<>(); // NEVER contains code per PRD §2.5.1
    private String createdAt;

    public ActivityEvent() {
        this.createdAt = Instant.now().toString();
    }

    public ActivityEvent(String teamId, String actorId, String actorName, String type, String text, String icon) {
        this.teamId = teamId;
        this.actorId = actorId;
        this.actorName = actorName;
        this.type = type;
        this.text = text;
        this.icon = icon != null ? icon : "cyan";
        this.createdAt = Instant.now().toString();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTeamId() { return teamId; }
    public void setTeamId(String teamId) { this.teamId = teamId; }

    public String getActorId() { return actorId; }
    public void setActorId(String actorId) { this.actorId = actorId; }

    public String getActorName() { return actorName; }
    public void setActorName(String actorName) { this.actorName = actorName; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getSnippetId() { return snippetId; }
    public void setSnippetId(String snippetId) { this.snippetId = snippetId; }

    public String getSnippetTitle() { return snippetTitle; }
    public void setSnippetTitle(String snippetTitle) { this.snippetTitle = snippetTitle; }

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }

    public String getIcon() { return icon; }
    public void setIcon(String icon) { this.icon = icon; }

    public Map<String, Object> getMetadata() { return metadata; }
    public void setMetadata(Map<String, Object> metadata) { this.metadata = metadata; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
