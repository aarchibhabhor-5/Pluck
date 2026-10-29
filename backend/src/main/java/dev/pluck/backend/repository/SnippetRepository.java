package dev.pluck.backend.repository;

import dev.pluck.backend.model.Snippet;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface SnippetRepository extends MongoRepository<Snippet, String> {
    Optional<Snippet> findBySlug(String slug);
    List<Snippet> findByFolderId(String folderId);
    List<Snippet> findByLanguageIgnoreCase(String language);
    List<Snippet> findByTagsContaining(String tag);
    List<Snippet> findByTitleContainingIgnoreCaseOrCodeContainingIgnoreCase(String title, String code);
    long countByTeamIdAndFolderId(String teamId, String folderId);
    long countByTeamIdAndFolderNameIgnoreCase(String teamId, String folderName);
}
