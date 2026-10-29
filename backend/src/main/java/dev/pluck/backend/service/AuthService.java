package dev.pluck.backend.service;

import dev.pluck.backend.controller.AuthController;
import dev.pluck.backend.model.Snippet;
import dev.pluck.backend.model.Team;
import dev.pluck.backend.model.Token;
import dev.pluck.backend.model.User;
import dev.pluck.backend.repository.SessionRepository;
import dev.pluck.backend.repository.TeamRepository;
import dev.pluck.backend.repository.TokenRepository;
import dev.pluck.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final TokenRepository tokenRepository;
    private final SessionRepository sessionRepository;
    private final TeamRepository teamRepository;
    private final PermissionService permissionService;

    @Autowired
    public AuthService(
            UserRepository userRepository,
            TokenRepository tokenRepository,
            SessionRepository sessionRepository,
            TeamRepository teamRepository,
            PermissionService permissionService
    ) {
        this.userRepository = userRepository;
        this.tokenRepository = tokenRepository;
        this.sessionRepository = sessionRepository;
        this.teamRepository = teamRepository;
        this.permissionService = permissionService;
    }

    /**
     * Resolves caller from Authorization header or X-User-Id header.
     * Returns null if anonymous / unauthenticated.
     */
    public User resolveCaller(String authHeader, String xUserId) {
        return resolveCaller(authHeader, xUserId, null);
    }

    /**
     * Resolves caller from Authorization header, X-User-Id header, or X-User-Email header.
     * Returns null if anonymous / unauthenticated.
     */
    public User resolveCaller(String authHeader, String xUserId, String xUserEmail) {
        // 1. Session token in Authorization header
        if (authHeader != null && authHeader.trim().startsWith("Bearer ")) {
            String token = authHeader.substring(7).trim();

            String userId = AuthController.resolveUserId(authHeader);
            if (userId != null) {
                Optional<User> u = userRepository.findById(userId);
                if (u.isPresent()) return u.get();
            }

            // PAT token check
            if (token.startsWith("pluck_pat_")) {
                String rawHex = token.length() >= 18 ? token.substring(10) : "";
                String patHash = rawHex.length() >= 8 ? "hash_" + rawHex.substring(0, 8) : "";
                String prefix = rawHex.length() >= 4 ? "pluck_pat_" + rawHex.substring(0, 4) + "..." : "";
                Optional<Token> tok = tokenRepository.findByTokenHash(patHash).or(() -> tokenRepository.findByPrefix(prefix));
                if (tok.isPresent()) {
                    Optional<User> u = userRepository.findById(tok.get().getUserId());
                    if (u.isPresent()) return u.get();
                }
            }

            // Direct user ID or email in Bearer
            Optional<User> byId = userRepository.findById(token);
            if (byId.isPresent()) return byId.get();

            Optional<User> byEmail = userRepository.findByEmail(token.toLowerCase());
            if (byEmail.isPresent()) return byEmail.get();
        }

        // 2. X-User-Id header
        if (xUserId != null && !xUserId.trim().isEmpty()) {
            Optional<User> u = userRepository.findById(xUserId.trim());
            if (u.isPresent()) return u.get();
            Optional<User> byEmail = userRepository.findByEmail(xUserId.trim().toLowerCase());
            if (byEmail.isPresent()) return byEmail.get();
        }

        // 3. X-User-Email header
        if (xUserEmail != null && !xUserEmail.trim().isEmpty()) {
            Optional<User> byEmail = userRepository.findByEmail(xUserEmail.trim().toLowerCase());
            if (byEmail.isPresent()) return byEmail.get();
        }

        return null;
    }

    /**
     * Checks if a user is a member of the given teamId (or slug).
     */
    public boolean isTeamMember(User user, String teamId) {
        if (user == null || teamId == null || teamId.trim().isEmpty()) return false;
        Optional<Team> teamOpt = teamRepository.findByIdAndDeletedAtIsNull(teamId)
                .or(() -> teamRepository.findBySlugAndDeletedAtIsNull(teamId));
        if (teamOpt.isEmpty()) return false;

        Team team = teamOpt.get();
        if (user.getId().equals(team.getOwnerUserId())) return true;
        return permissionService.getMember(team, user) != null;
    }

    /**
     * Checks if caller has access to read the snippet based on visibility rules:
     * - "public": visible to all (including anonymous).
     * - "team": visible only to members of the team (or snippet author).
     * - "private" (or other): visible only to author.
     */
    public boolean canAccessSnippet(Snippet s, User caller) {
        if (s == null) return false;
        String vis = s.getVisibility() != null ? s.getVisibility().trim().toLowerCase() : "private";

        if ("public".equals(vis)) {
            return true;
        }

        if (caller == null) {
            return false;
        }

        // Author can always see their own snippet
        if (caller.getId() != null && caller.getId().equals(s.getAuthorId())) {
            return true;
        }

        if ("team".equals(vis)) {
            if (s.getTeamId() != null && !s.getTeamId().trim().isEmpty()) {
                return isTeamMember(caller, s.getTeamId());
            }

            // If teamId not explicitly set on snippet, check if caller shares any team with snippet author
            if (s.getAuthorId() != null) {
                List<Team> callerTeams = teamRepository.findByMemberUserId(caller.getId());
                if (callerTeams.isEmpty() && caller.getEmail() != null) {
                    callerTeams = teamRepository.findByMemberEmail(caller.getEmail());
                }
                for (Team t : callerTeams) {
                    if (permissionService.getMember(t, s.getAuthorId()) != null || s.getAuthorId().equals(t.getOwnerUserId())) {
                        return true;
                    }
                }
            }
            return false;
        }

        // For private or unlisted: only author has access
        return false;
    }
}
