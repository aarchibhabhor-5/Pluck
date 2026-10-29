package dev.pluck.backend.repository;

import dev.pluck.backend.model.Session;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SessionRepository extends MongoRepository<Session, String> {
    Optional<Session> findByTokenHash(String tokenHash);
    void deleteByTokenHash(String tokenHash);
    List<Session> findByUserId(String userId);
}

