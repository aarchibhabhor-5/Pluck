package dev.pluck.backend.service;

import dev.pluck.backend.model.ActivityEvent;
import dev.pluck.backend.model.User;
import dev.pluck.backend.repository.ActivityEventRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class ActivityService {

    private final ActivityEventRepository activityEventRepository;

    @Autowired
    public ActivityService(ActivityEventRepository activityEventRepository) {
        this.activityEventRepository = activityEventRepository;
    }

    public ActivityEvent record(
            String teamId,
            String actorId,
            String actorName,
            String type,
            String snippetId,
            String snippetTitle,
            String text,
            String icon,
            Map<String, Object> metadata
    ) {
        ActivityEvent event = new ActivityEvent(teamId, actorId, actorName, type, text, icon);
        event.setSnippetId(snippetId);
        event.setSnippetTitle(snippetTitle);
        if (metadata != null) {
            // Guardrail: Never persist or log snippet code or secrets in audit feed
            Map<String, Object> safeMeta = new HashMap<>(metadata);
            safeMeta.remove("code");
            safeMeta.remove("password");
            safeMeta.remove("token");
            safeMeta.remove("secrets");
            event.setMetadata(safeMeta);
        }
        return activityEventRepository.save(event);
    }

    public void recordMemberInvited(String teamId, User actor, String inviteeEmail, String role) {
        String actorName = actor != null ? actor.getName() : "Team Admin";
        String text = actorName + " invited " + inviteeEmail + " as " + role;
        record(teamId, actor != null ? actor.getId() : null, actorName, "member.invited", null, null, text, "cyan", Map.of("email", inviteeEmail, "role", role));
    }

    public void recordMemberJoined(String teamId, User actor, String role) {
        String actorName = actor != null ? actor.getName() : "New member";
        String text = actorName + " joined the team workspace as " + role;
        record(teamId, actor != null ? actor.getId() : null, actorName, "member.joined", null, null, text, "green", Map.of("role", role));
    }

    public void recordRoleChanged(String teamId, User actor, String targetName, String oldRole, String newRole) {
        String actorName = actor != null ? actor.getName() : "Admin";
        String text = actorName + " updated " + targetName + "'s role from " + oldRole + " to " + newRole;
        record(teamId, actor != null ? actor.getId() : null, actorName, "member.role_changed", null, null, text, "yellow", Map.of("target", targetName, "oldRole", oldRole, "newRole", newRole));
    }

    public void recordMemberRemoved(String teamId, User actor, String targetName) {
        String actorName = actor != null ? actor.getName() : "Admin";
        String text = actorName + " removed " + targetName + " from the team";
        record(teamId, actor != null ? actor.getId() : null, actorName, "member.removed", null, null, text, "pink", Map.of("target", targetName));
    }

    public void recordSnippetAction(String teamId, User actor, String action, String snippetId, String title) {
        String actorName = actor != null ? actor.getName() : "Developer";
        String icon = "cyan";
        String displayTitle = (title != null && !title.trim().isEmpty()) ? title.trim() : snippetId;
        if (!displayTitle.startsWith("'") && !displayTitle.startsWith("\"")) {
            displayTitle = "'" + displayTitle + "'";
        }
        String text = actorName + " " + action + " snippet " + displayTitle;
        if ("created".equalsIgnoreCase(action)) icon = "green";
        else if ("deleted".equalsIgnoreCase(action)) icon = "pink";
        else if ("updated".equalsIgnoreCase(action)) icon = "purple";
        else if ("published".equalsIgnoreCase(action)) icon = "yellow";

        record(teamId, actor != null ? actor.getId() : null, actorName, "snippet." + action, snippetId, title, text, icon, Map.of("action", action));
    }

    public List<ActivityEvent> getTeamActivity(String teamId) {
        return activityEventRepository.findByTeamIdOrderByCreatedAtDesc(teamId);
    }
}
