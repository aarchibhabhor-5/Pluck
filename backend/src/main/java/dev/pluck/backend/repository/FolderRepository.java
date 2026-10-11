package dev.pluck.backend.repository;

import dev.pluck.backend.model.Folder;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface FolderRepository extends MongoRepository<Folder, String> {
}
