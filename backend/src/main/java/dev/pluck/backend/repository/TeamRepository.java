package dev.pluck.backend.repository;

import dev.pluck.backend.model.Team;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TeamRepository extends MongoRepository<Team, String> {

    Optional<Team> findByIdAndDeletedAtIsNull(String id);

    Optional<Team> findBySlugAndDeletedAtIsNull(String slug);

    List<Team> findByDeletedAtIsNull();

    @Query("{ 'members.userId': ?0, 'deletedAt': null }")
    List<Team> findByMemberUserId(String userId);

    @Query("{ 'members.email': ?0, 'deletedAt': null }")
    List<Team> findByMemberEmail(String email);
}
