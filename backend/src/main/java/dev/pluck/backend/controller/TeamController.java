package dev.pluck.backend.controller;

import dev.pluck.backend.model.*;
import dev.pluck.backend.repository.TeamInviteRepository;
import dev.pluck.backend.repository.TeamRepository;
import dev.pluck.backend.repository.UserRepository;
import dev.pluck.backend.service.ActivityService;
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

    @Autowired
    public TeamController(
            TeamRepository teamRepository,
            TeamInviteRepository teamInviteRepository,
            UserRepository userRepository,
            PermissionService permissionService,
            ActivityService activityService,
            EmailService emailService
    ) {
        this.teamRepository = teamRepository;
        this.teamInviteRepository = teamInviteRepository;
        this.userRepository = userRepository;
        this.permissionService = permissionService;
        this.activityService = activityService;
        this.emailService = emailService;
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
     * Resolve calling user from Bearer header or fallback to default user (dev mode)
     */
    private User resolveCaller(String authHeader) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7).trim();
            Optional<User> u = userRepository.findById(token);
            if (u.isPresent()) return u.get();

            Optional<User> byEmail = userRepository.findByEmail(token.toLowerCase());
            if (byEmail.isPresent()) return byEmail.get();
        }

        // Return real user in the database (skip any test users)
        List<User> users = userRepository.findAll();
        for (User u : users) {
            if (!"test_dev@pluck.dev".equalsIgnoreCase(u.getEmail()) && !"alex@pluck.dev".equalsIgnoreCase(u.getEmail())) {
                return u;
            }
        }
        if (!users.isEmpty()) {
            return users.get(0);
        }

        // Create default Alex Developer user if database is empty
        User defaultUser = new User("usr_alex", "Alex Developer", "alex@pluck.dev", "A", "owner");
        return userRepository.save(defaultUser);
    }

    /**
     * Initialize the seed / demo team workspace per PRD §2.5 ("Acme Core Eng")
     */
    private Team getOrCreateDefaultTeam(User caller) {
        List<Team> teams = teamRepository.findByDeletedAtIsNull();
        if (!teams.isEmpty()) {
            return teams.get(0);
        }

        Team team = new Team("acme-core-eng", "Acme Core Eng", "acme-core-eng", caller.getId());
        team.setEditorsCanPublish(false);

        List<TeamMember> members = new ArrayList<>();
        members.add(new TeamMember(caller.getId(), caller.getName(), caller.getEmail(), "Admin", true));
        team.setMembers(members);

        List<Map<String, Object>> collections = new ArrayList<>();
        collections.add(Map.of("id", "col_auth", "name", "auth-middleware", "emoji", "🔐", "desc", "JWT verification, RBAC guards, and session decryptors.", "count", 8));
        collections.add(Map.of("id", "col_aws", "name", "aws-infrastructure", "emoji", "☁️", "desc", "Boto3 client setups, DynamoDB pagination, and S3 uploaders.", "count", 12));
        collections.add(Map.of("id", "col_prisma", "name", "prisma-extensions", "emoji", "🗄️", "desc", "Soft delete, audit logging triggers, and read-replica routers.", "count", 5));
        team.setCollections(collections);

        Team saved = teamRepository.save(team);

        // Seed initial activity events
        activityService.recordSnippetAction(saved.getId(), new User("usr_sarah", "Sarah Jenkins", "sarah@company.com", "S", "member"), "updated", "snip_auth", "auth-middleware (v1.3)");
        activityService.recordSnippetAction(saved.getId(), caller, "created", "snip_rate", "redis-ratelimit");
        activityService.record(saved.getId(), "usr_leo", "Leo Chen", "snippet.copied", "snip_s3", "s3-presigned-upload", "Leo Chen copied s3-presigned-upload via CLI", "pink", Map.of("client", "CLI"));

        return saved;
    }

    /**
     * 1. GET /api/teams — List all team workspaces caller belongs to
     */
    @GetMapping
    public ResponseEntity<?> listTeams(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        User caller = resolveCaller(authHeader);
        List<Team> teams = teamRepository.findByMemberUserId(caller.getId());
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
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        User caller = resolveCaller(authHeader);
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
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        User caller = resolveCaller(authHeader);
        Team team = teamRepository.findByIdAndDeletedAtIsNull(id)
                .or(() -> teamRepository.findBySlugAndDeletedAtIsNull(id))
                .orElse(null);

        if (team == null) {
            team = getOrCreateDefaultTeam(caller);
        }

        // PRD §2.4.6 Invariant: Cross-workspace reads return 404 (not 403) to avoid existence leaks
        TeamMember member = permissionService.getMember(team, caller);
        if (member == null && !caller.getId().equals(team.getOwnerUserId())) {
            // For dev ease, add caller as Admin if team is default demo
            if ("acme-core-eng".equals(team.getId())) {
                member = new TeamMember(caller.getId(), caller.getName(), caller.getEmail(), "Admin", true);
                team.getMembers().add(0, member);
                teamRepository.save(team);
            } else {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "WORKSPACE_NOT_FOUND", "message", "Workspace not found."));
            }
        }

        String role = member != null ? member.getRole() : "Viewer";
        team.setRole(role);

        Map<String, Object> res = new HashMap<>();
        res.put("team", team);
        res.put("role", role);
        res.put("canManageSettings", permissionService.can(team, caller, PermissionService.Action.MANAGE_SETTINGS));
        res.put("canManageMembers", permissionService.can(team, caller, PermissionService.Action.MANAGE_MEMBERS));
        res.put("canPublish", permissionService.can(team, caller, PermissionService.Action.PUBLISH_SNIPPET));
        return ResponseEntity.ok(res);
    }

    /**
     * 4. PATCH /api/teams/{id} — Update team name, slug, settings (Admin only)
     */
    @PatchMapping("/{id}")
    public ResponseEntity<?> updateTeam(
            @PathVariable String id,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        User caller = resolveCaller(authHeader);
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
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        User caller = resolveCaller(authHeader);
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
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        User caller = resolveCaller(authHeader);
        Team team = teamRepository.findByIdAndDeletedAtIsNull(id)
                .or(() -> teamRepository.findBySlugAndDeletedAtIsNull(id))
                .orElseGet(() -> getOrCreateDefaultTeam(caller));

        List<TeamMember> members = team.getMembers();
        List<TeamInvite> pendingInvites = new ArrayList<>();

        // Pending invites are visible to Admins
        if (permissionService.can(team, caller, PermissionService.Action.MANAGE_MEMBERS)) {
            pendingInvites = teamInviteRepository.findByTeamIdAndAcceptedAtIsNull(team.getId());
        }

        return ResponseEntity.ok(Map.of(
                "members", members,
                "pendingInvites", pendingInvites,
                "totalMembers", members.size()
        ));
    }

    /**
     * 7. POST /api/teams/{id}/invites — Invite teammate with role (Admin only)
     */
    @PostMapping("/{id}/invites")
    public ResponseEntity<?> inviteMember(
            @PathVariable String id,
            @RequestBody Map<String, String> body,
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        User caller = resolveCaller(authHeader);
        Team team = teamRepository.findByIdAndDeletedAtIsNull(id)
                .or(() -> teamRepository.findBySlugAndDeletedAtIsNull(id))
                .orElseGet(() -> getOrCreateDefaultTeam(caller));

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
            if (email.equalsIgnoreCase(m.getEmail())) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "ALREADY_MEMBER", "message", email + " is already a member of this team."));
            }
        }

        // Generate cryptographic token
        String rawToken = "pluck_inv_" + UUID.randomUUID().toString().replace("-", "");
        String tokenHash = hashToken(rawToken);

        TeamInvite invite = new TeamInvite(team.getId(), email.trim(), role, tokenHash, caller.getId(), caller.getName());
        TeamInvite saved = teamInviteRepository.save(invite);

        // Also add preview member to team for immediate display
        TeamMember newMember = new TeamMember("usr_" + UUID.randomUUID().toString().substring(0, 6), email.split("@")[0], email, role, false);
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
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        User caller = resolveCaller(authHeader);
        Team team = teamRepository.findByIdAndDeletedAtIsNull(id)
                .or(() -> teamRepository.findBySlugAndDeletedAtIsNull(id))
                .orElse(null);

        if (team == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "WORKSPACE_NOT_FOUND"));

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
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        User caller = resolveCaller(authHeader);
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
        boolean alreadyIn = team.getMembers().stream().anyMatch(m -> caller.getId().equals(m.getUserId()) || caller.getEmail().equalsIgnoreCase(m.getEmail()));
        if (!alreadyIn) {
            TeamMember newMember = new TeamMember(caller.getId(), caller.getName(), caller.getEmail(), invite.getRole(), false);
            team.getMembers().add(newMember);
            teamRepository.save(team);
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
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        User caller = resolveCaller(authHeader);
        Team team = teamRepository.findByIdAndDeletedAtIsNull(id)
                .or(() -> teamRepository.findBySlugAndDeletedAtIsNull(id))
                .orElse(null);

        if (team == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "WORKSPACE_NOT_FOUND"));

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
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        User caller = resolveCaller(authHeader);
        Team team = teamRepository.findByIdAndDeletedAtIsNull(id)
                .or(() -> teamRepository.findBySlugAndDeletedAtIsNull(id))
                .orElse(null);

        if (team == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "WORKSPACE_NOT_FOUND"));

        boolean isSelfLeave = userId.equals(caller.getId());
        if (!isSelfLeave && !permissionService.can(team, caller, PermissionService.Action.MANAGE_MEMBERS)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "FORBIDDEN", "message", "Only Team Admins can remove other members."));
        }

        TeamMember target = permissionService.getMember(team, userId);
        if (target == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "MEMBER_NOT_FOUND"));
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
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        User caller = resolveCaller(authHeader);
        Team team = teamRepository.findByIdAndDeletedAtIsNull(id)
                .or(() -> teamRepository.findBySlugAndDeletedAtIsNull(id))
                .orElseGet(() -> getOrCreateDefaultTeam(caller));

        List<ActivityEvent> events = activityService.getTeamActivity(team.getId());
        return ResponseEntity.ok(Map.of("activity", events));
    }
}
