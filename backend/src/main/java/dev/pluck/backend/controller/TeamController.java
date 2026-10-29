package dev.pluck.backend.controller;

import dev.pluck.backend.model.*;
import dev.pluck.backend.repository.TeamInviteRepository;
import dev.pluck.backend.repository.TeamRepository;
import dev.pluck.backend.repository.UserRepository;
import dev.pluck.backend.service.ActivityService;
import dev.pluck.backend.service.AuthService;
import dev.pluck.backend.service.EmailService;
import dev.pluck.backend.service.PermissionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import dev.pluck.backend.model.Snippet;
import dev.pluck.backend.repository.SnippetRepository;
import java.util.*;

@RestController
@RequestMapping("/api/teams")
public class TeamController {

    private final TeamRepository teamRepository;
    private final TeamInviteRepository teamInviteRepository;
    private final UserRepository userRepository;
    private final PermissionService permissionService;
    private final ActivityService activityService;
    private final EmailService emailService;
    private final AuthService authService;
    private final SnippetRepository snippetRepository;

    @Autowired
    public TeamController(
            TeamRepository teamRepository,
            TeamInviteRepository teamInviteRepository,
            UserRepository userRepository,
            PermissionService permissionService,
            ActivityService activityService,
            EmailService emailService,
            AuthService authService,
            SnippetRepository snippetRepository
    ) {
        this.teamRepository = teamRepository;
        this.teamInviteRepository = teamInviteRepository;
        this.userRepository = userRepository;
        this.permissionService = permissionService;
        this.activityService = activityService;
        this.emailService = emailService;
        this.authService = authService;
        this.snippetRepository = snippetRepository;
    }

    /**
     * Hash helper for token hashing per PRD §2.5.1
     */
    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 digest unavailable", e);
        }
    }

    /**
     * Resolve calling user from Bearer header or fallback
     */
    private User resolveCaller(String authHeader, String xUserId, String xUserEmail) {
        User u = authService.resolveCaller(authHeader, xUserId, xUserEmail);
        if (u != null) return u;

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7).trim();
            Optional<User> byId = userRepository.findById(token);
            if (byId.isPresent()) return byId.get();

            Optional<User> byEmail = userRepository.findByEmail(token.toLowerCase());
            if (byEmail.isPresent()) return byEmail.get();
        }

        return null;
    }

    private User resolveCaller(String authHeader) {
        return resolveCaller(authHeader, null, null);
    }

    /**
     * Initialize the seed / demo team workspace per PRD §2.5 ("Acme Core Eng")
     */
    private Team getOrCreateDefaultTeam(User caller) {
        List<Team> teams = teamRepository.findByDeletedAtIsNull();
        if (!teams.isEmpty()) {
            return teams.get(0);
        }

        String ownerId = (caller != null && caller.getId() != null) ? caller.getId() : "usr_5f2c0b56";
        String ownerName = (caller != null && caller.getName() != null) ? caller.getName() : "aarchibhabhor5";
        String ownerEmail = (caller != null && caller.getEmail() != null) ? caller.getEmail() : "aarchibhabhor5@gmail.com";

        Team team = new Team("acme-core-eng", "Acme Core Eng", "acme-core-eng", ownerId);
        team.setEditorsCanPublish(false);

        List<TeamMember> members = new ArrayList<>();
        members.add(new TeamMember(ownerId, ownerName, ownerEmail, "Admin", true));
        team.setMembers(members);

        List<Map<String, Object>> collections = new ArrayList<>();
        team.setCollections(collections);

        Team saved = teamRepository.save(team);
        return saved;
    }

    /**
     * 1. GET /api/teams — List all team workspaces caller belongs to
     */
    @GetMapping
    public ResponseEntity<?> listTeams(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "X-User-Email", required = false) String xUserEmail
    ) {
        User caller = resolveCaller(authHeader, xUserId, xUserEmail);
        if (caller == null) {
            return ResponseEntity.ok(Map.of("teams", Collections.emptyList()));
        }
        List<Team> teams = teamRepository.findByMemberUserId(caller.getId());
        if (teams.isEmpty() && caller.getEmail() != null) {
            teams = teamRepository.findByMemberEmail(caller.getEmail());
        }
        if (teams.isEmpty()) {
            Team def = getOrCreateDefaultTeam(caller);
            teams = List.of(def);
        }
        return ResponseEntity.ok(Map.of("teams", teams));
    }

    /**
     * 2. POST /api/teams — Create a new team workspace (PRD §2.6.2)
     */
    @PostMapping
    public ResponseEntity<?> createTeam(
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "X-User-Email", required = false) String xUserEmail
    ) {
        User caller = resolveCaller(authHeader, xUserId, xUserEmail);
        if (caller == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "UNAUTHORIZED", "message", "Authentication required."));
        }
        String name = (String) body.get("name");
        if (name == null || name.trim().isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "NAME_REQUIRED", "message", "Team name is required."));
        }

        String slug = (String) body.get("slug");
        if (slug == null || slug.trim().isEmpty()) {
            slug = name.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");
        }

        // Slug uniqueness check (PRD §2.5.1)
        if (teamRepository.findBySlugAndDeletedAtIsNull(slug).isPresent()) {
            slug = slug + "-" + UUID.randomUUID().toString().substring(0, 4);
        }

        String teamId = "team_" + UUID.randomUUID().toString().substring(0, 8);
        Team team = new Team(teamId, name.trim(), slug, caller.getId());
        team.setEditorsCanPublish(Boolean.TRUE.equals(body.get("editorsCanPublish")));

        // Creator is automatically Admin + Owner
        TeamMember creator = new TeamMember(caller.getId(), caller.getName(), caller.getEmail(), "Admin", true);
        team.getMembers().add(creator);

        Team saved = teamRepository.save(team);
        activityService.record(saved.getId(), caller.getId(), caller.getName(), "team.created", null, null, caller.getName() + " created team workspace " + name, "green", Map.of("name", name));

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("success", true, "team", saved));
    }

    /**
     * 3. GET /api/teams/{id} — Read team details & caller role (PRD §2.6.2)
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getTeam(
            @PathVariable String id,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "X-User-Email", required = false) String xUserEmail
    ) {
        User caller = resolveCaller(authHeader, xUserId, xUserEmail);
        Team team = teamRepository.findByIdAndDeletedAtIsNull(id)
                .or(() -> teamRepository.findBySlugAndDeletedAtIsNull(id))
                .orElse(null);

        if (team == null) {
            team = getOrCreateDefaultTeam(caller);
        }

        // PRD §2.4.6 Invariant: Cross-workspace reads return 404 (not 403) to avoid existence leaks
        TeamMember member = (caller != null) ? permissionService.getMember(team, caller) : null;
        if (member == null && (caller == null || !caller.getId().equals(team.getOwnerUserId()))) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "WORKSPACE_NOT_FOUND", "message", "Workspace not found."));
        }

        String role = (caller != null && caller.getId().equals(team.getOwnerUserId())) ? "Admin" : (member != null ? member.getRole() : "Viewer");
        team.setRole(role);

        Map<String, Object> res = new HashMap<>();
        res.put("team", team);
        res.put("role", role);
        res.put("canManageSettings", caller != null && permissionService.can(team, caller, PermissionService.Action.MANAGE_SETTINGS));
        res.put("canManageMembers", caller != null && permissionService.can(team, caller, PermissionService.Action.MANAGE_MEMBERS));
        res.put("canPublish", caller != null && permissionService.can(team, caller, PermissionService.Action.PUBLISH_SNIPPET));
        res.put("canEditSnippets", caller != null && permissionService.can(team, caller, PermissionService.Action.EDIT_SNIPPET));
        res.put("canCreateSnippets", caller != null && permissionService.can(team, caller, PermissionService.Action.CREATE_SNIPPET));
        return ResponseEntity.ok(res);
    }

    public ResponseEntity<?> getTeam(String id, String authHeader) {
        return getTeam(id, authHeader, null, null);
    }

    /**
     * 4. PATCH /api/teams/{id} — Update team name, slug, settings (Admin only)
     */
    @PatchMapping("/{id}")
    public ResponseEntity<?> updateTeam(
            @PathVariable String id,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "X-User-Email", required = false) String xUserEmail
    ) {
        User caller = resolveCaller(authHeader, xUserId, xUserEmail);
        if (caller == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "UNAUTHORIZED", "message", "Authentication required."));
        }
        Team team = teamRepository.findByIdAndDeletedAtIsNull(id)
                .or(() -> teamRepository.findBySlugAndDeletedAtIsNull(id))
                .orElse(null);

        if (team == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "WORKSPACE_NOT_FOUND"));
        }

        if (!permissionService.can(team, caller, PermissionService.Action.MANAGE_SETTINGS)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "FORBIDDEN", "message", "Only Team Admins can modify team policies and settings."));
        }

        if (body.containsKey("name")) {
            team.setName((String) body.get("name"));
        }
        if (body.containsKey("slug")) {
            String newSlug = (String) body.get("slug");
            Optional<Team> existing = teamRepository.findBySlugAndDeletedAtIsNull(newSlug);
            if (existing.isPresent() && !existing.get().getId().equals(team.getId())) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "SLUG_TAKEN", "message", "This team slug is already in use."));
            }
            team.setSlug(newSlug);
        }
        if (body.containsKey("editorsCanPublish")) {
            team.setEditorsCanPublish(Boolean.TRUE.equals(body.get("editorsCanPublish")));
        }
        team.setUpdatedAt(Instant.now().toString());
        teamRepository.save(team);

        activityService.record(team.getId(), caller.getId(), caller.getName(), "team.updated", null, null, caller.getName() + " updated team policy settings", "yellow", body);

        return ResponseEntity.ok(Map.of("success", true, "team", team));
    }

    /**
     * 5. DELETE /api/teams/{id} — Soft delete team workspace (Admin only)
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteTeam(
            @PathVariable String id,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "X-User-Email", required = false) String xUserEmail
    ) {
        User caller = resolveCaller(authHeader, xUserId, xUserEmail);
        if (caller == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "UNAUTHORIZED", "message", "Authentication required."));
        }
        Team team = teamRepository.findByIdAndDeletedAtIsNull(id)
                .or(() -> teamRepository.findBySlugAndDeletedAtIsNull(id))
                .orElse(null);

        if (team == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "WORKSPACE_NOT_FOUND"));
        }

        if (!permissionService.can(team, caller, PermissionService.Action.MANAGE_SETTINGS)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "FORBIDDEN", "message", "Only Team Admins can delete this workspace."));
        }

        team.setDeletedAt(Instant.now().toString());
        teamRepository.save(team);

        return ResponseEntity.ok(Map.of("success", true, "message", "Team workspace deleted successfully."));
    }

    /**
     * 6. GET /api/teams/{id}/members — List members & pending invites (PRD §2.6.2)
     */
    @GetMapping("/{id}/members")
    public ResponseEntity<?> getMembers(
            @PathVariable String id,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "X-User-Email", required = false) String xUserEmail
    ) {
        User caller = resolveCaller(authHeader, xUserId, xUserEmail);
        Team team = teamRepository.findByIdAndDeletedAtIsNull(id)
                .or(() -> teamRepository.findBySlugAndDeletedAtIsNull(id))
                .orElseGet(() -> getOrCreateDefaultTeam(caller));

        List<TeamMember> members = team.getMembers();
        if (members == null) {
            members = new ArrayList<>();
            team.setMembers(members);
        }

        // Auto-sync member userId & name from registered User repository
        boolean teamMembersUpdated = false;
        for (TeamMember m : members) {
            if (m.getEmail() != null) {
                Optional<User> uOpt = userRepository.findByEmail(m.getEmail().toLowerCase());
                if (uOpt.isPresent()) {
                    User regUser = uOpt.get();
                    if (!regUser.getId().equals(m.getUserId())) {
                        m.setUserId(regUser.getId());
                        teamMembersUpdated = true;
                    }
                    if (regUser.getName() != null && !regUser.getName().equals(m.getName())) {
                        m.setName(regUser.getName());
                        teamMembersUpdated = true;
                    }
                }
            }
        }
        if (teamMembersUpdated) {
            teamRepository.save(team);
        }

        List<TeamInvite> pendingInvites = new ArrayList<>();
        // Pending invites are visible ONLY to Admins
        if (caller != null && permissionService.can(team, caller, PermissionService.Action.MANAGE_MEMBERS)) {
            List<TeamInvite> allInvites = teamInviteRepository.findByTeamIdAndAcceptedAtIsNull(team.getId());
            Set<String> memberEmails = new HashSet<>();
            for (TeamMember m : members) {
                if (m.getEmail() != null) {
                    memberEmails.add(m.getEmail().trim().toLowerCase());
                }
            }
            for (TeamInvite inv : allInvites) {
                if (inv.getEmail() != null && memberEmails.contains(inv.getEmail().trim().toLowerCase())) {
                    inv.setAcceptedAt(Instant.now().toString());
                    teamInviteRepository.save(inv);
                } else {
                    pendingInvites.add(inv);
                }
            }
        }

        String callerRole = "Viewer";
        if (caller != null) {
            if (caller.getId().equals(team.getOwnerUserId())) {
                callerRole = "Admin";
            } else {
                TeamMember callerMember = permissionService.getMember(team, caller);
                if (callerMember != null && callerMember.getRole() != null) {
                    callerRole = callerMember.getRole();
                }
            }
        }

        return ResponseEntity.ok(Map.of(
                "members", members,
                "pendingInvites", pendingInvites,
                "totalMembers", members.size(),
                "callerRole", callerRole
        ));
    }

    public ResponseEntity<?> getMembers(String id, String authHeader) {
        return getMembers(id, authHeader, null, null);
    }

    /**
     * 7. POST /api/teams/{id}/invites — Invite teammate with role (Admin only)
     */
    @PostMapping("/{id}/invites")
    public ResponseEntity<?> inviteMember(
            @PathVariable String id,
            @RequestBody Map<String, String> body,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "X-User-Email", required = false) String xUserEmail
    ) {
        User caller = resolveCaller(authHeader, xUserId, xUserEmail);
        Team team = teamRepository.findByIdAndDeletedAtIsNull(id)
                .or(() -> teamRepository.findBySlugAndDeletedAtIsNull(id))
                .orElseGet(() -> getOrCreateDefaultTeam(caller));

        if (caller == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "UNAUTHORIZED", "message", "Authentication required."));
        }

        if (!permissionService.can(team, caller, PermissionService.Action.MANAGE_MEMBERS)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "FORBIDDEN", "message", "Only Team Admins can invite new members."));
        }

        String email = body.get("email");
        String role = body.getOrDefault("role", "Editor");

        if (email == null || !email.contains("@")) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "INVALID_EMAIL", "message", "A valid email address is required."));
        }

        // Check if user is already a member
        for (TeamMember m : team.getMembers()) {
            if (email.trim().equalsIgnoreCase(m.getEmail())) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "ALREADY_MEMBER", "message", email + " is already a member of this team."));
            }
        }

        // Generate cryptographic token
        String rawToken = "pluck_inv_" + UUID.randomUUID().toString().replace("-", "");
        String tokenHash = hashToken(rawToken);

        TeamInvite invite = new TeamInvite(team.getId(), email.trim(), role, tokenHash, caller.getId(), caller.getName());
        TeamInvite saved = teamInviteRepository.save(invite);

        // If an existing registered user has this email, use their real ID and name
        String memberUserId = "usr_" + UUID.randomUUID().toString().substring(0, 6);
        String memberName = email.split("@")[0];
        Optional<User> existingUser = userRepository.findByEmail(email.trim().toLowerCase());
        if (existingUser.isPresent()) {
            memberUserId = existingUser.get().getId();
            if (existingUser.get().getName() != null) {
                memberName = existingUser.get().getName();
            }
        }

        TeamMember newMember = new TeamMember(memberUserId, memberName, email.trim(), role, false);
        team.getMembers().add(newMember);
        teamRepository.save(team);

        activityService.recordMemberInvited(team.getId(), caller, email, role);

        // Dispatch real SMTP email or simulated log per PRD §2.6.2 & §M4.1
        Map<String, Object> emailResult = emailService.sendTeamInviteEmail(
                email.trim(),
                team.getName(),
                caller.getName(),
                role,
                rawToken
        );

        Map<String, Object> resp = new HashMap<>();
        resp.put("success", true);
        resp.put("message", "Invitation generated for " + email);
        resp.put("inviteId", saved.getId());
        resp.put("inviteUrl", "/auth.html?invite=" + rawToken);
        resp.put("member", newMember);
        resp.put("emailDelivery", emailResult);

        return ResponseEntity.status(HttpStatus.CREATED).body(resp);
    }

    /**
     * 8. DELETE /api/teams/{id}/invites/{inviteId} — Revoke pending invite
     */
    @DeleteMapping("/{id}/invites/{inviteId}")
    public ResponseEntity<?> revokeInvite(
            @PathVariable String id,
            @PathVariable String inviteId,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "X-User-Email", required = false) String xUserEmail
    ) {
        User caller = resolveCaller(authHeader, xUserId, xUserEmail);
        Team team = teamRepository.findByIdAndDeletedAtIsNull(id)
                .or(() -> teamRepository.findBySlugAndDeletedAtIsNull(id))
                .orElse(null);

        if (team == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "WORKSPACE_NOT_FOUND"));

        if (caller == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "UNAUTHORIZED", "message", "Authentication required."));
        }

        if (!permissionService.can(team, caller, PermissionService.Action.MANAGE_MEMBERS)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "FORBIDDEN", "message", "Only Team Admins can revoke invites."));
        }

        Optional<TeamInvite> inv = teamInviteRepository.findByIdAndTeamId(inviteId, team.getId());
        if (inv.isPresent()) {
            teamInviteRepository.delete(inv.get());
            return ResponseEntity.ok(Map.of("success", true, "message", "Invite revoked successfully."));
        }

        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "INVITE_NOT_FOUND"));
    }

    /**
     * 9. POST /api/teams/invites/accept — Accept team invite via token (PRD §2.6.2)
     */
    @PostMapping("/invites/accept")
    public ResponseEntity<?> acceptInvite(
            @RequestBody Map<String, String> body,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "X-User-Email", required = false) String xUserEmail
    ) {
        User caller = resolveCaller(authHeader, xUserId, xUserEmail);
        String token = body.get("token");
        if (token == null || token.trim().isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "TOKEN_REQUIRED", "message", "Invite token is required."));
        }

        String tokenHash = hashToken(token.trim());
        TeamInvite invite = teamInviteRepository.findByTokenHashAndAcceptedAtIsNull(tokenHash).orElse(null);

        if (invite == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "INVALID_OR_EXPIRED_INVITE", "message", "This invite link is invalid or has already been used."));
        }

        // Verify expiry
        if (Instant.now().isAfter(Instant.parse(invite.getExpiresAt()))) {
            return ResponseEntity.status(HttpStatus.GONE).body(Map.of("error", "INVITE_EXPIRED", "message", "This invite has expired."));
        }

        Team team = teamRepository.findByIdAndDeletedAtIsNull(invite.getTeamId()).orElse(null);
        if (team == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "WORKSPACE_NOT_FOUND"));
        }

        // Add user as member if not already present
        if (caller != null) {
            boolean alreadyIn = team.getMembers().stream().anyMatch(m -> caller.getId().equals(m.getUserId()) || caller.getEmail().equalsIgnoreCase(m.getEmail()));
            if (!alreadyIn) {
                TeamMember newMember = new TeamMember(caller.getId(), caller.getName(), caller.getEmail(), invite.getRole(), false);
                team.getMembers().add(newMember);
                teamRepository.save(team);
            }
        }

        invite.setAcceptedAt(Instant.now().toString());
        teamInviteRepository.save(invite);

        activityService.recordMemberJoined(team.getId(), caller, invite.getRole());

        return ResponseEntity.ok(Map.of("success", true, "teamId", team.getId(), "teamSlug", team.getSlug(), "role", invite.getRole()));
    }

    /**
     * 10. PATCH /api/teams/{id}/members/{userId} — Change member role (PRD §2.4.6)
     */
    @PatchMapping("/{id}/members/{userId}")
    public ResponseEntity<?> updateMemberRole(
            @PathVariable String id,
            @PathVariable String userId,
            @RequestBody Map<String, String> body,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "X-User-Email", required = false) String xUserEmail
    ) {
        User caller = resolveCaller(authHeader, xUserId, xUserEmail);
        Team team = teamRepository.findByIdAndDeletedAtIsNull(id)
                .or(() -> teamRepository.findBySlugAndDeletedAtIsNull(id))
                .orElse(null);

        if (team == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "WORKSPACE_NOT_FOUND"));

        if (caller == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "UNAUTHORIZED", "message", "Authentication required."));
        }

        if (!permissionService.can(team, caller, PermissionService.Action.MANAGE_MEMBERS)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "FORBIDDEN", "message", "Only Team Admins can change member roles."));
        }

        String newRole = body.get("role");
        if (newRole == null || (!newRole.equalsIgnoreCase("Admin") && !newRole.equalsIgnoreCase("Editor") && !newRole.equalsIgnoreCase("Viewer"))) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "INVALID_ROLE", "message", "Role must be Admin, Editor, or Viewer."));
        }

        TeamMember target = permissionService.getMember(team, userId);
        if (target == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "MEMBER_NOT_FOUND"));
        }

        // PRD Invariant: Last Admin cannot be demoted (§2.4.6)
        if ("admin".equalsIgnoreCase(target.getRole()) && !"admin".equalsIgnoreCase(newRole)) {
            if (permissionService.isLastAdmin(team, userId)) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                        "error", "LAST_ADMIN_CANNOT_BE_DEMOTED",
                        "message", "A workspace must have at least one Admin. Promote another member before demoting this Admin."
                ));
            }
        }

        String oldRole = target.getRole();
        target.setRole(newRole.substring(0, 1).toUpperCase() + newRole.substring(1).toLowerCase());
        teamRepository.save(team);

        activityService.recordRoleChanged(team.getId(), caller, target.getName(), oldRole, target.getRole());

        return ResponseEntity.ok(Map.of("success", true, "member", target));
    }

    /**
     * 11. DELETE /api/teams/{id}/members/{userId} — Remove member (PRD §2.4.6)
     */
    @DeleteMapping("/{id}/members/{userId}")
    public ResponseEntity<?> removeMember(
            @PathVariable String id,
            @PathVariable String userId,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "X-User-Email", required = false) String xUserEmail
    ) {
        User caller = resolveCaller(authHeader, xUserId, xUserEmail);
        Team team = teamRepository.findByIdAndDeletedAtIsNull(id)
                .or(() -> teamRepository.findBySlugAndDeletedAtIsNull(id))
                .orElse(null);

        if (team == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "WORKSPACE_NOT_FOUND"));

        if (caller == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "UNAUTHORIZED", "message", "Authentication required."));
        }

        boolean isSelfLeave = userId.equals(caller.getId());
        if (!isSelfLeave && !permissionService.can(team, caller, PermissionService.Action.MANAGE_MEMBERS)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "FORBIDDEN", "message", "Only Team Admins can remove other members."));
        }

        TeamMember target = permissionService.getMember(team, userId);
        if (target == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "MEMBER_NOT_FOUND"));
        }

        if (target.isOwner()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "CANNOT_REMOVE_OWNER", "message", "The workspace owner cannot be removed."));
        }

        // PRD Invariant: Last Admin cannot leave or be removed (§2.4.6)
        if ("admin".equalsIgnoreCase(target.getRole()) && permissionService.isLastAdmin(team, userId)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                    "error", "CANNOT_REMOVE_LAST_ADMIN",
                    "message", "The last Admin cannot leave or be removed. Promote another Admin first."
            ));
        }

        team.getMembers().removeIf(m -> userId.equals(m.getUserId()) || (target.getEmail() != null && target.getEmail().equalsIgnoreCase(m.getEmail())));
        teamRepository.save(team);

        activityService.recordMemberRemoved(team.getId(), caller, target.getName());

        return ResponseEntity.ok(Map.of("success", true, "message", "Member removed from workspace."));
    }

    /**
     * 12. GET /api/teams/{id}/activity — Live audit log feed (PRD §2.6.2, §2.3.8)
     */
    @GetMapping("/{id}/activity")
    public ResponseEntity<?> getActivity(
            @PathVariable String id,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "X-User-Email", required = false) String xUserEmail
    ) {
        User resolvedCaller = authService.resolveCaller(authHeader, xUserId, xUserEmail);
        if (resolvedCaller == null) {
            resolvedCaller = resolveCaller(authHeader, xUserId, xUserEmail);
        }
        final User caller = resolvedCaller;

        Team team = teamRepository.findByIdAndDeletedAtIsNull(id)
                .or(() -> teamRepository.findBySlugAndDeletedAtIsNull(id))
                .orElseGet(() -> getOrCreateDefaultTeam(caller));

        List<ActivityEvent> events = activityService.getTeamActivity(team.getId());

        final User activeCaller = caller;
        boolean isMember = (activeCaller != null) && (
                activeCaller.getId().equals(team.getOwnerUserId()) ||
                (team.getMembers() != null && team.getMembers().stream().anyMatch(m ->
                        activeCaller.getId().equals(m.getUserId()) ||
                        (activeCaller.getEmail() != null && activeCaller.getEmail().equalsIgnoreCase(m.getEmail()))
                ))
        );

        List<ActivityEvent> filtered = events.stream().filter(ev -> {
            // Exclude test bot artifacts
            if ("usr_da3b7c0e".equals(ev.getActorId()) || (ev.getActorName() != null && ev.getActorName().contains("test_dev"))) {
                return false;
            }
            if ("usr_leo".equals(ev.getActorId()) || "usr_sarah".equals(ev.getActorId())) {
                return false;
            }

            // 1. Changes made by the logged-in user themselves
            if (activeCaller != null && (
                    activeCaller.getId().equals(ev.getActorId()) ||
                    (activeCaller.getName() != null && activeCaller.getName().equalsIgnoreCase(ev.getActorName())) ||
                    (activeCaller.getEmail() != null && activeCaller.getEmail().equalsIgnoreCase(ev.getActorName()))
            )) {
                return true;
            }

            // 2. Snippet-related events
            if (ev.getSnippetId() != null) {
                Optional<Snippet> snipOpt = snippetRepository.findById(ev.getSnippetId())
                        .or(() -> snippetRepository.findBySlug(ev.getSnippetId()));
                if (snipOpt.isPresent()) {
                    Snippet s = snipOpt.get();
                    if ("public".equalsIgnoreCase(s.getVisibility())) {
                        return true;
                    }
                    if ("team".equalsIgnoreCase(s.getVisibility()) && isMember) {
                        return true;
                    }
                    // Private snippet belonging to another user must NEVER be visible
                    return false;
                }
            }

            // 3. Workspace-level actions for teams the user belongs to (members, collections, policies)
            if (isMember && team.getId().equals(ev.getTeamId())) {
                if (ev.getSnippetId() == null) {
                    return true;
                }
            }

            return false;
        }).collect(java.util.stream.Collectors.toList());

        return ResponseEntity.ok(Map.of("activity", filtered));
    }

    public ResponseEntity<?> getActivity(String id, String authHeader, String xUserId) {
        return getActivity(id, authHeader, xUserId, null);
    }

    /**
     * 13. GET /api/teams/{id}/collections — List team collections
     */
    @GetMapping("/{id}/collections")
    public ResponseEntity<?> getCollections(
            @PathVariable String id,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "X-User-Email", required = false) String xUserEmail
    ) {
        User caller = resolveCaller(authHeader, xUserId, xUserEmail);
        Team team = teamRepository.findByIdAndDeletedAtIsNull(id)
                .or(() -> teamRepository.findBySlugAndDeletedAtIsNull(id))
                .orElseGet(() -> getOrCreateDefaultTeam(caller));

        List<Map<String, Object>> collections = team.getCollections();
        if (collections == null) collections = new ArrayList<>();
        else collections = new ArrayList<>(collections);

        // Auto-purge hardcoded legacy mock data
        boolean changed = collections.removeIf(c -> 
            "col_auth".equals(c.get("id")) || 
            "col_aws".equals(c.get("id")) || 
            "col_prisma".equals(c.get("id")) ||
            "auth-middleware".equals(c.get("name")) ||
            "aws-infrastructure".equals(c.get("name")) ||
            "prisma-extensions".equals(c.get("name"))
        );
        if (changed) {
            team.setCollections(collections);
            teamRepository.save(team);
        }

        // Dynamically compute real snippet count for each collection
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> c : collections) {
            Map<String, Object> copy = new HashMap<>(c);
            String colId = (String) c.get("id");
            String colName = (String) c.get("name");
            long cnt = 0;
            if (colId != null) {
                cnt = snippetRepository.countByTeamIdAndFolderId(team.getId(), colId);
            }
            if (cnt == 0 && colName != null) {
                cnt = snippetRepository.countByTeamIdAndFolderNameIgnoreCase(team.getId(), colName);
            }
            if (cnt == 0 && colName != null) {
                cnt = snippetRepository.countByTeamIdAndFolderId(team.getId(), colName);
            }
            copy.put("count", cnt);
            result.add(copy);
        }

        return ResponseEntity.ok(Map.of("success", true, "collections", result));
    }

    /**
     * 14. POST /api/teams/{id}/collections — Create new collection
     */
    @PostMapping("/{id}/collections")
    public ResponseEntity<?> createCollection(
            @PathVariable String id,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "X-User-Email", required = false) String xUserEmail
    ) {
        User caller = resolveCaller(authHeader, xUserId, xUserEmail);
        if (caller == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "UNAUTHORIZED", "message", "Authentication required."));
        }
        Team team = teamRepository.findByIdAndDeletedAtIsNull(id)
                .or(() -> teamRepository.findBySlugAndDeletedAtIsNull(id))
                .orElseGet(() -> getOrCreateDefaultTeam(caller));

        if (!permissionService.can(team, caller, PermissionService.Action.CREATE_SNIPPET)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "FORBIDDEN", "message", "Viewers cannot create collections."));
        }

        String name = (String) body.get("name");
        if (name == null || name.trim().isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "NAME_REQUIRED", "message", "Collection name is required."));
        }

        String emoji = (String) body.getOrDefault("emoji", "📁");
        String desc = (String) body.getOrDefault("desc", "");

        String rawSlug = name.trim().toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");
        String colId = "col_" + (rawSlug.isEmpty() ? UUID.randomUUID().toString().substring(0, 8) : rawSlug);

        List<Map<String, Object>> collections = team.getCollections();
        if (collections == null) {
            collections = new ArrayList<>();
            team.setCollections(collections);
        }

        for (Map<String, Object> existing : collections) {
            if (name.trim().equalsIgnoreCase(String.valueOf(existing.get("name")))) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "COLLECTION_EXISTS", "message", "A collection with this name already exists."));
            }
        }

        Map<String, Object> newCol = new HashMap<>();
        newCol.put("id", colId);
        newCol.put("name", name.trim());
        newCol.put("emoji", emoji != null && !emoji.trim().isEmpty() ? emoji.trim() : "📁");
        newCol.put("desc", desc != null ? desc.trim() : "");
        newCol.put("count", 0);
        newCol.put("createdAt", Instant.now().toString());

        collections.add(newCol);
        teamRepository.save(team);

        activityService.record(team.getId(), caller.getId(), caller.getName(), "collection.created", null, null,
                caller.getName() + " created collection '" + name.trim() + "'", "purple", Map.of("collection", name.trim(), "id", colId));

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("success", true, "collection", newCol, "message", "Collection created successfully."));
    }

    /**
     * 15. PATCH /api/teams/{id}/collections/{colId} — Update collection
     */
    @PatchMapping("/{id}/collections/{colId}")
    public ResponseEntity<?> updateCollection(
            @PathVariable String id,
            @PathVariable String colId,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "X-User-Email", required = false) String xUserEmail
    ) {
        User caller = resolveCaller(authHeader, xUserId, xUserEmail);
        if (caller == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "UNAUTHORIZED", "message", "Authentication required."));
        }
        Team team = teamRepository.findByIdAndDeletedAtIsNull(id)
                .or(() -> teamRepository.findBySlugAndDeletedAtIsNull(id))
                .orElse(null);

        if (team == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "WORKSPACE_NOT_FOUND"));

        if (!permissionService.can(team, caller, PermissionService.Action.EDIT_SNIPPET)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "FORBIDDEN", "message", "Viewers cannot edit collections."));
        }

        List<Map<String, Object>> collections = team.getCollections();
        if (collections == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "COLLECTION_NOT_FOUND"));

        Map<String, Object> target = null;
        for (Map<String, Object> c : collections) {
            if (colId.equalsIgnoreCase(String.valueOf(c.get("id")))) {
                target = c;
                break;
            }
        }

        if (target == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "COLLECTION_NOT_FOUND"));

        if (body.containsKey("name") && body.get("name") != null && !String.valueOf(body.get("name")).trim().isEmpty()) {
            target.put("name", String.valueOf(body.get("name")).trim());
        }
        if (body.containsKey("emoji") && body.get("emoji") != null && !String.valueOf(body.get("emoji")).trim().isEmpty()) {
            target.put("emoji", String.valueOf(body.get("emoji")).trim());
        }
        if (body.containsKey("desc")) {
            target.put("desc", body.get("desc") != null ? String.valueOf(body.get("desc")).trim() : "");
        }
        target.put("updatedAt", Instant.now().toString());

        teamRepository.save(team);
        return ResponseEntity.ok(Map.of("success", true, "collection", target));
    }

    /**
     * 16. DELETE /api/teams/{id}/collections/{colId} — Delete collection
     */
    @DeleteMapping("/{id}/collections/{colId}")
    public ResponseEntity<?> deleteCollection(
            @PathVariable String id,
            @PathVariable String colId,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "X-User-Email", required = false) String xUserEmail
    ) {
        User caller = resolveCaller(authHeader, xUserId, xUserEmail);
        if (caller == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "UNAUTHORIZED", "message", "Authentication required."));
        }
        Team team = teamRepository.findByIdAndDeletedAtIsNull(id)
                .or(() -> teamRepository.findBySlugAndDeletedAtIsNull(id))
                .orElse(null);

        if (team == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "WORKSPACE_NOT_FOUND"));

        if (!permissionService.can(team, caller, PermissionService.Action.DELETE_ANY_SNIPPET)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "FORBIDDEN", "message", "Only Admins can delete team collections."));
        }

        List<Map<String, Object>> collections = team.getCollections();
        if (collections == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "COLLECTION_NOT_FOUND"));

        String removedName = null;
        boolean removed = false;
        Iterator<Map<String, Object>> iter = collections.iterator();
        while (iter.hasNext()) {
            Map<String, Object> c = iter.next();
            if (colId.equalsIgnoreCase(String.valueOf(c.get("id")))) {
                removedName = String.valueOf(c.get("name"));
                iter.remove();
                removed = true;
                break;
            }
        }

        if (!removed) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "COLLECTION_NOT_FOUND"));

        teamRepository.save(team);

        activityService.record(team.getId(), caller.getId(), caller.getName(), "collection.deleted", null, null,
                caller.getName() + " deleted collection '" + (removedName != null ? removedName : colId) + "'", "pink", Map.of("collectionId", colId));

        return ResponseEntity.ok(Map.of("success", true, "message", "Collection deleted successfully."));
    }
}
