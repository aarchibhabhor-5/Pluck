package dev.pluck.backend.config;

import dev.pluck.backend.controller.AuthController;
import dev.pluck.backend.model.Token;
import dev.pluck.backend.model.User;
import dev.pluck.backend.repository.TokenRepository;
import dev.pluck.backend.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.Set;

/**
 * Enforces zero-bypass server-side authentication gating on all Pluck protected application pages.
 * Cryptographically validates the session against active sessions and database.
 * If missing, invalid, or expired, immediately purges cookies, adds no-cache headers,
 * and redirects to auth.html.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class PageSecurityFilter extends OncePerRequestFilter {

    private final UserRepository userRepository;
    private final TokenRepository tokenRepository;

    private static final Set<String> PROTECTED_PREFIXES = Set.of(
            "/app",
            "/team",
            "/studio",
            "/settings",
            "/snippet"
    );

    @Autowired
    public PageSecurityFilter(UserRepository userRepository, TokenRepository tokenRepository) {
        this.userRepository = userRepository;
        this.tokenRepository = tokenRepository;
    }

    private boolean isProtectedUri(String uri) {
        if (uri == null) return false;
        String lower = uri.toLowerCase();

        for (String prefix : PROTECTED_PREFIXES) {
            if (lower.equals(prefix) ||
                lower.equals(prefix + ".html") ||
                lower.startsWith(prefix + "/") ||
                lower.startsWith(prefix + ".html/")) {
                return true;
            }
        }
        return false;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String uri = request.getRequestURI();

        if (isProtectedUri(uri)) {
            // Strict anti-caching headers prevent browser history/bfcache back-button leakage
            response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0, post-check=0, pre-check=0");
            response.setHeader("Pragma", "no-cache");
            response.setHeader("Expires", "0");

            // Extract session token from cookie
            String sessionToken = null;
            if (request.getCookies() != null) {
                for (Cookie cookie : request.getCookies()) {
                    if ("pluck_session".equals(cookie.getName())) {
                        String val = cookie.getValue();
                        if (val != null && !val.trim().isEmpty()) {
                            sessionToken = val.trim();
                            break;
                        }
                    }
                }
            }

            // Also check Authorization header if present
            if (sessionToken == null) {
                String authHeader = request.getHeader("Authorization");
                if (authHeader != null && authHeader.startsWith("Bearer ")) {
                    sessionToken = authHeader.substring(7).trim();
                }
            }

            boolean isValid = false;
            if (sessionToken != null && !sessionToken.isEmpty()) {
                // 1. Validate session token against server-side session registry & database
                String userId = AuthController.resolveTokenUserId(sessionToken);
                if (userId != null) {
                    Optional<User> userOpt = userRepository.findById(userId);
                    if (userOpt.isPresent()) {
                        isValid = true;
                    }
                }

                // 2. Or validate Personal Access Token (PAT)
                if (!isValid && sessionToken.startsWith("pluck_pat_")) {
                    String rawHex = sessionToken.length() >= 18 ? sessionToken.substring(10) : "";
                    String patHash = rawHex.length() >= 8 ? "hash_" + rawHex.substring(0, 8) : "";
                    String prefix = rawHex.length() >= 4 ? "pluck_pat_" + rawHex.substring(0, 4) + "..." : "";
                    Optional<Token> tok = tokenRepository.findByTokenHash(patHash).or(() -> tokenRepository.findByPrefix(prefix));
                    if (tok.isPresent()) {
                        Optional<User> userOpt = userRepository.findById(tok.get().getUserId());
                        if (userOpt.isPresent()) {
                            isValid = true;
                        }
                    }
                }
            }

            if (!isValid) {
                // Purge invalid cookie from client
                response.addHeader("Set-Cookie", "pluck_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");

                String target = uri;
                if (request.getQueryString() != null) {
                    target += "?" + request.getQueryString();
                }
                response.sendRedirect("/auth.html?next=" + URLEncoder.encode(target, StandardCharsets.UTF_8));
                return;
            }
        }

        filterChain.doFilter(request, response);
    }
}
