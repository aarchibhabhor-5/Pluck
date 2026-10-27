package dev.pluck.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;

@Document(collection = "team_invites")
public class TeamInvite {

    @Id
    private String id;
    private String teamId;
    private String email;
    private String role = "Editor"; // "Admin", "Editor", "Viewer"
    private String tokenHash;       // SHA-256 hash of the invite secret
    private String invitedBy;       // Inviting User ID
    private String invitedByName;
    private String expiresAt;
    private String acceptedAt;      // null if pending
    private String createdAt;

    public TeamInvite() {
        this.createdAt = Instant.now().toString();
        // Default expiry is 7 days from now (PRD §2.5.1)
        this.expiresAt = Instant.now().plusSeconds(7 * 24 * 3600).toString();
    }

    public TeamInvite(String teamId, String email, String role, String tokenHash, String invitedBy, String invitedByName) {
        this.teamId = teamId;
        this.email = email;
        this.role = role != null ? role : "Editor";
        this.tokenHash = tokenHash;
        this.invitedBy = invitedBy;
        this.invitedByName = invitedByName;
        this.createdAt = Instant.now().toString();
        this.expiresAt = Instant.now().plusSeconds(7 * 24 * 3600).toString();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTeamId() { return teamId; }
    public void setTeamId(String teamId) { this.teamId = teamId; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getTokenHash() { return tokenHash; }
    public void setTokenHash(String tokenHash) { this.tokenHash = tokenHash; }

    public String getInvitedBy() { return invitedBy; }
    public void setInvitedBy(String invitedBy) { this.invitedBy = invitedBy; }

    public String getInvitedByName() { return invitedByName; }
    public void setInvitedByName(String invitedByName) { this.invitedByName = invitedByName; }

    public String getExpiresAt() { return expiresAt; }
    public void setExpiresAt(String expiresAt) { this.expiresAt = expiresAt; }

    public String getAcceptedAt() { return acceptedAt; }
    public void setAcceptedAt(String acceptedAt) { this.acceptedAt = acceptedAt; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
