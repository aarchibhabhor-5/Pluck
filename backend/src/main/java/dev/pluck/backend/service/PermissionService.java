package dev.pluck.backend.service;

import dev.pluck.backend.model.Team;
import dev.pluck.backend.model.TeamMember;
import dev.pluck.backend.model.User;
import org.springframework.stereotype.Service;

import java.util.Objects;

@Service
public class PermissionService {

    public enum Action {
        READ_SNIPPET,
        FORK_SNIPPET,
        VIEW_ACTIVITY,
        CREATE_SNIPPET,
        EDIT_SNIPPET,
        DELETE_OWN_SNIPPET,
        DELETE_ANY_SNIPPET,
        PUBLISH_SNIPPET,
        MANAGE_MEMBERS,
        MANAGE_SETTINGS
    }

    public TeamMember getMember(Team team, String userId) {
        if (team == null || team.getMembers() == null || userId == null) return null;
        for (TeamMember m : team.getMembers()) {
            if (userId.equals(m.getUserId())) return m;
        }
        return null;
    }

    public TeamMember getMember(Team team, User user) {
        if (user == null) return null;
        return getMember(team, user.getId());
    }

    public boolean can(Team team, User user, Action action) {
        if (user == null) return false;
        return can(team, user.getId(), action);
    }

    public boolean can(Team team, String userId, Action action) {
        if (team == null || team.getDeletedAt() != null || userId == null) return false;

        TeamMember member = getMember(team, userId);
        if (member == null) return false; // Non-members have zero access

        String role = member.getRole() != null ? member.getRole().trim().toLowerCase() : "viewer";

        switch (action) {
            case READ_SNIPPET:
            case FORK_SNIPPET:
            case VIEW_ACTIVITY:
                return true; // Admin, Editor, Viewer

            case CREATE_SNIPPET:
            case EDIT_SNIPPET:
            case DELETE_OWN_SNIPPET:
                return "admin".equals(role) || "editor".equals(role);

            case PUBLISH_SNIPPET:
                // PRD §2.4.6: Editor can publish only if team policy editorsCanPublish is true
                return "admin".equals(role) || ("editor".equals(role) && team.isEditorsCanPublish());

            case DELETE_ANY_SNIPPET:
            case MANAGE_MEMBERS:
            case MANAGE_SETTINGS:
                return "admin".equals(role);

            default:
                return false;
        }
    }

    public void assertCan(Team team, User user, Action action) {
        if (!can(team, user, action)) {
            throw new SecurityException("FORBIDDEN: You do not have permission to perform " + action);
        }
    }

    public int countAdmins(Team team) {
        if (team == null || team.getMembers() == null) return 0;
        int count = 0;
        for (TeamMember m : team.getMembers()) {
            if (m.getRole() != null && "admin".equalsIgnoreCase(m.getRole().trim())) {
                count++;
            }
        }
        return count;
    }

    public boolean isLastAdmin(Team team, String userId) {
        TeamMember member = getMember(team, userId);
        if (member == null || !"admin".equalsIgnoreCase(member.getRole())) {
            return false;
        }
        return countAdmins(team) <= 1;
    }
}
