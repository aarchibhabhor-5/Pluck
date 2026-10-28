package dev.pluck.backend.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.pluck.backend.model.Token;
import dev.pluck.backend.repository.TokenRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.Optional;

@Component
@Order(1)
public class TokenAuthFilter extends OncePerRequestFilter {

    private final TokenRepository tokenRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    public TokenAuthFilter(TokenRepository tokenRepository) {
        this.tokenRepository = tokenRepository;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");
        String pluckTokenHeader = request.getHeader("PLUCK_TOKEN");

        String pat = null;
        if (pluckTokenHeader != null && pluckTokenHeader.trim().startsWith("pluck_pat_")) {
            pat = pluckTokenHeader.trim();
        } else if (authHeader != null && authHeader.trim().startsWith("Bearer pluck_pat_")) {
            pat = authHeader.trim().substring(7).trim();
        }

        if (pat != null) {
            String rawHex = pat.length() >= 18 ? pat.substring(10) : "";
            String tokenHash = rawHex.length() >= 8 ? "hash_" + rawHex.substring(0, 8) : "";
            String prefix = rawHex.length() >= 4 ? "pluck_pat_" + rawHex.substring(0, 4) + "..." : "";

            Optional<Token> tokenOpt = tokenRepository.findByTokenHash(tokenHash)
                    .or(() -> tokenRepository.findByPrefix(prefix));

            if (tokenOpt.isEmpty()) {
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                response.setContentType("application/json");
                Map<String, String> err = Map.of(
                        "error", "INVALID_TOKEN",
                        "message", "The provided Personal Access Token is invalid or has been revoked."
                );
                response.getWriter().write(objectMapper.writeValueAsString(err));
                return;
            }

            Token token = tokenOpt.get();
            token.setLastUsed("Just now");
            tokenRepository.save(token);

            request.setAttribute("PLUCK_AUTHENTICATED_TOKEN", token);
            request.setAttribute("PLUCK_AUTHENTICATED_USER_ID", token.getUserId());
            request.setAttribute("PLUCK_TOKEN_SCOPES", token.getScopes());
        }

        filterChain.doFilter(request, response);
    }
}
