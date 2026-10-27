package dev.pluck.backend.model;

import java.time.Instant;

public class TeamMember {

    private String userId;
    private String name;
    private String email;
    private String role = "Editor"; // "Admin", "Editor", "Viewer"
    private boolean isOwner = false;
    private String joinedAt;

    public TeamMember() {
        this.joinedAt = Instant.now().toString();
    }

    public TeamMember(String userId, String name, String email, String role, boolean isOwner) {
        this.userId = userId;
        this.name = name;
        this.email = email;
        this.role = role != null ? role : "Editor";
        this.isOwner = isOwner;
        this.joinedAt = Instant.now().toString();
    }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public boolean isOwner() { return isOwner; }
    public void setOwner(boolean owner) { isOwner = owner; }

    public String getJoinedAt() { return joinedAt; }
    public void setJoinedAt(String joinedAt) { this.joinedAt = joinedAt; }
}
