package dev.pluck.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Document(collection = "teams")
public class Team {

    @Id
    private String id;
    private String name;
    private String slug; // Unique CLI prefix (e.g. "acme-core-eng")
    private String type = "team"; // "personal" vs "team" (PRD §2.5.1)
    private String ownerUserId;
    private String role = "Admin"; // Current caller role view convenience
    private boolean editorsCanPublish = false; // PRD §2.5.1 policy toggle
    private List<TeamMember> members = new ArrayList<>();
    private List<Map<String, Object>> collections = new ArrayList<>();
    private String createdAt;
    private String updatedAt;
    private String deletedAt; // Null if active; set on soft-delete

    public Team() {
        this.createdAt = Instant.now().toString();
        this.updatedAt = Instant.now().toString();
    }

    public Team(String id, String name, String slug, String ownerUserId) {
        this.id = id;
        this.name = name;
        this.slug = slug != null ? slug : id;
        this.ownerUserId = ownerUserId;
        this.createdAt = Instant.now().toString();
        this.updatedAt = Instant.now().toString();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getOwnerUserId() { return ownerUserId; }
    public void setOwnerUserId(String ownerUserId) { this.ownerUserId = ownerUserId; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public boolean isEditorsCanPublish() { return editorsCanPublish; }
    public void setEditorsCanPublish(boolean editorsCanPublish) { this.editorsCanPublish = editorsCanPublish; }

    public List<TeamMember> getMembers() { return members; }
    public void setMembers(List<TeamMember> members) { this.members = members; }

    public List<Map<String, Object>> getCollections() { return collections; }
    public void setCollections(List<Map<String, Object>> collections) { this.collections = collections; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public String getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(String updatedAt) { this.updatedAt = updatedAt; }

    public String getDeletedAt() { return deletedAt; }
    public void setDeletedAt(String deletedAt) { this.deletedAt = deletedAt; }
}
