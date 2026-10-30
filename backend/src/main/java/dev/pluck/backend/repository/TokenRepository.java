package dev.pluck.backend.repository;

import dev.pluck.backend.model.Token;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TokenRepository extends MongoRepository<Token, String> {
    Optional<Token> findByTokenHash(String tokenHash);
    Optional<Token> findByPrefix(String prefix);
    List<Token> findByUserId(String userId);
}

