package dev.pluck.backend.repository;

import dev.pluck.backend.model.TeamInvite;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TeamInviteRepository extends MongoRepository<TeamInvite, String> {

    List<TeamInvite> findByTeamIdAndAcceptedAtIsNull(String teamId);

    Optional<TeamInvite> findByTokenHashAndAcceptedAtIsNull(String tokenHash);

    Optional<TeamInvite> findByIdAndTeamId(String id, String teamId);

    List<TeamInvite> findByEmailIgnoreCaseAndAcceptedAtIsNull(String email);
}
