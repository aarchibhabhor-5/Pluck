package dev.pluck.backend.repository;

import dev.pluck.backend.model.ActivityEvent;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ActivityEventRepository extends MongoRepository<ActivityEvent, String> {

    List<ActivityEvent> findByTeamIdOrderByCreatedAtDesc(String teamId);
}
