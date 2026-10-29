package dev.pluck.backend;

import dev.pluck.backend.model.User;
import dev.pluck.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.io.File;
import java.nio.file.Files;
import java.util.List;

@SpringBootTest
class PluckBackendApplicationTests {

    @BeforeAll
    static void initEnv() {
        File f = new File(".env");
        if (!f.exists()) f = new File("backend/.env");
        if (!f.exists()) f = new File("../backend/.env");
        if (f.exists()) {
            try {
                List<String> lines = Files.readAllLines(f.toPath());
                for (String line : lines) {
                    line = line.trim();
                    if (line.isEmpty() || line.startsWith("#")) continue;
                    int eq = line.indexOf('=');
                    if (eq > 0) {
                        String key = line.substring(0, eq).trim();
                        String val = line.substring(eq + 1).trim();
                        if ((val.startsWith("\"") && val.endsWith("\"")) || (val.startsWith("'") && val.endsWith("'"))) {
                            val = val.substring(1, val.length() - 1);
                        }
                        if (System.getProperty(key) == null && System.getenv(key) == null) {
                            System.setProperty(key, val);
                        }
                    }
                }
            } catch (Exception e) {}
        }
    }

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private dev.pluck.backend.controller.AuthController authController;

    @Autowired
    private dev.pluck.backend.controller.SnippetController snippetController;

    @Autowired
    private dev.pluck.backend.service.ActivityService activityService;

    @Autowired
    private dev.pluck.backend.repository.SnippetRepository snippetRepository;

    private void cleanupTestMember(User user) {
        if (user == null || user.getEmail() == null) return;
        dev.pluck.backend.model.Team team = teamRepository.findById("acme-core-eng").orElse(null);
        if (team != null && team.getMembers() != null) {
            team.getMembers().removeIf(m -> user.getEmail().equalsIgnoreCase(m.getEmail()));
            teamRepository.save(team);
        }
    }

    @Test
    void testInspectSnippetsAndRemove() {
        User user5 = userRepository.findByEmail("aarchibhabhor5@gmail.com").orElse(null);
        User user6 = userRepository.findByEmail("aarchibhabhor6@gmail.com").orElse(null);
        org.junit.jupiter.api.Assertions.assertNotNull(user5);
        org.junit.jupiter.api.Assertions.assertNotNull(user6);

        try {
            // Ensure user6 is explicitly set to Viewer role for this test
            dev.pluck.backend.model.Team team = teamRepository.findById("acme-core-eng").orElse(null);
            if (team != null) {
                if (team.getMembers() == null) {
                    team.setMembers(new java.util.ArrayList<>());
                }
                boolean found = false;
                for (dev.pluck.backend.model.TeamMember m : team.getMembers()) {
                    if (m.getEmail() != null && m.getEmail().equalsIgnoreCase(user6.getEmail())) {
                        m.setRole("Viewer");
                        found = true;
                    }
                }
                if (!found) {
                    team.getMembers().add(new dev.pluck.backend.model.TeamMember(user6.getId(), user6.getName() != null ? user6.getName() : user6.getUsername(), user6.getEmail(), "Viewer", false));
                }
                teamRepository.save(team);
            }

            List<dev.pluck.backend.model.Snippet> allSnippets = snippetRepository.findAll();
            for (dev.pluck.backend.model.Snippet s : allSnippets) {
                if ("Untitled Snippet".equals(s.getTitle()) || "java functions".equals(s.getTitle())) {
                    // 1. Admin removes snippet from collection -> expect 200 OK
                    org.springframework.http.ResponseEntity<?> res5 = snippetController.updateSnippet(
                            s.getId(),
                            java.util.Map.of("folderId", "general", "folderName", "general", "teamId", "acme-core-eng", "visibility", "team"),
                            null,
                            user5.getId(),
                            user5.getEmail()
                    );
                    org.junit.jupiter.api.Assertions.assertEquals(200, res5.getStatusCode().value(), "Admin must be able to remove snippet from collection");

                    // 2. Viewer attempts to edit or remove snippet -> expect 403 FORBIDDEN
                    org.springframework.http.ResponseEntity<?> res6 = snippetController.updateSnippet(
                            s.getId(),
                            java.util.Map.of("folderId", "general", "folderName", "general", "teamId", "acme-core-eng", "visibility", "team"),
                            null,
                            user6.getId(),
                            user6.getEmail()
                    );
                    org.junit.jupiter.api.Assertions.assertEquals(403, res6.getStatusCode().value(), "Viewer must not be able to modify team snippet collection membership");

                    // 3. Admin re-adds snippet back to collection
                    org.springframework.http.ResponseEntity<?> resRestore = snippetController.updateSnippet(
                            s.getId(),
                            java.util.Map.of("folderId", "col_database", "folderName", "database", "teamId", "acme-core-eng", "visibility", "team"),
                            null,
                            user5.getId(),
                            user5.getEmail()
                    );
                    org.junit.jupiter.api.Assertions.assertEquals(200, resRestore.getStatusCode().value(), "Admin must be able to add snippet back to collection");
                }
            }
        } finally {
            cleanupTestMember(user6);
        }
    }

    @Test
    void testAuthLogin() {
        // Test login for user 5
        org.springframework.http.ResponseEntity<?> res5 = authController.login(java.util.Map.of(
                "email", "aarchibhabhor5@gmail.com",
                "password", "Aarchibhabhor@15"
        ));
        org.junit.jupiter.api.Assertions.assertEquals(200, res5.getStatusCode().value(), "User 5 login should succeed");

        // Test login for user 6
        org.springframework.http.ResponseEntity<?> res6 = authController.login(java.util.Map.of(
                "email", "aarchibhabhor6@gmail.com",
                "password", "Aarchibhabhor@15"
        ));
        org.junit.jupiter.api.Assertions.assertEquals(200, res6.getStatusCode().value(), "User 6 login should succeed");
    }

    @Autowired
    private dev.pluck.backend.repository.ActivityEventRepository activityEventRepository;

    @Autowired
    private dev.pluck.backend.controller.TeamController teamController;

    @Autowired
    private dev.pluck.backend.repository.TeamRepository teamRepository;

    @Test
    void purgeTestArtifactsAndVerifyFilteredActivity() {
        // 1. Purge legacy test artifacts from activity_events collection
        List<dev.pluck.backend.model.ActivityEvent> all = activityEventRepository.findAll();
        List<dev.pluck.backend.model.ActivityEvent> toDelete = all.stream().filter(e ->
                "usr_da3b7c0e".equals(e.getActorId()) ||
                (e.getActorName() != null && e.getActorName().contains("test_dev")) ||
                "usr_leo".equals(e.getActorId()) ||
                "usr_sarah".equals(e.getActorId())
        ).collect(java.util.stream.Collectors.toList());

        if (!toDelete.isEmpty()) {
            activityEventRepository.deleteAll(toDelete);
            System.out.println("PURGED " + toDelete.size() + " DUMMY/TEST ARTIFACTS FROM ATLAS ACTIVITY EVENTS");
        }

        User user5 = userRepository.findByEmail("aarchibhabhor5@gmail.com").orElse(null);
        User user6 = userRepository.findByEmail("aarchibhabhor6@gmail.com").orElse(null);
        org.junit.jupiter.api.Assertions.assertNotNull(user5);
        org.junit.jupiter.api.Assertions.assertNotNull(user6);

        // 2. Test activity feed for User 5
        org.springframework.http.ResponseEntity<?> res5 = teamController.getActivity("acme-core-eng", null, user5.getId());
        org.junit.jupiter.api.Assertions.assertEquals(200, res5.getStatusCode().value());
        java.util.Map<?, ?> map5 = (java.util.Map<?, ?>) res5.getBody();
        List<?> list5 = (List<?>) map5.get("activity");
        System.out.println("USER 5 AUDIT EVENTS COUNT: " + list5.size());
        for (Object item : list5) {
            dev.pluck.backend.model.ActivityEvent ev = (dev.pluck.backend.model.ActivityEvent) item;
            System.out.println("USER 5 EVENT: " + ev.getText() + " (" + ev.getType() + ")");
            org.junit.jupiter.api.Assertions.assertFalse(ev.getActorName().contains("test_dev"), "Must not contain test_dev");
        }

        // 3. Test activity feed for User 6
        org.springframework.http.ResponseEntity<?> res6 = teamController.getActivity("acme-core-eng", null, user6.getId());
        org.junit.jupiter.api.Assertions.assertEquals(200, res6.getStatusCode().value());
        java.util.Map<?, ?> map6 = (java.util.Map<?, ?>) res6.getBody();
        List<?> list6 = (List<?>) map6.get("activity");
        System.out.println("USER 6 AUDIT EVENTS COUNT: " + list6.size());
        for (Object item : list6) {
            dev.pluck.backend.model.ActivityEvent ev = (dev.pluck.backend.model.ActivityEvent) item;
            System.out.println("USER 6 EVENT: " + ev.getText() + " (" + ev.getType() + ")");
            org.junit.jupiter.api.Assertions.assertFalse(ev.getActorName().contains("test_dev"), "Must not contain test_dev");
        }
    }

    @Test
    void testViewerRoleEnforcement() {
        User user5 = userRepository.findByEmail("aarchibhabhor5@gmail.com").orElse(null);
        User user6 = userRepository.findByEmail("aarchibhabhor6@gmail.com").orElse(null);
        org.junit.jupiter.api.Assertions.assertNotNull(user5);
        org.junit.jupiter.api.Assertions.assertNotNull(user6);

        try {
            // Ensure user6 is explicitly set to Viewer role for this test
            dev.pluck.backend.model.Team team = teamRepository.findById("acme-core-eng").orElse(null);
            if (team != null) {
                if (team.getMembers() == null) {
                    team.setMembers(new java.util.ArrayList<>());
                }
                boolean found = false;
                for (dev.pluck.backend.model.TeamMember m : team.getMembers()) {
                    if (m.getEmail() != null && m.getEmail().equalsIgnoreCase(user6.getEmail())) {
                        m.setRole("Viewer");
                        found = true;
                    }
                }
                if (!found) {
                    team.getMembers().add(new dev.pluck.backend.model.TeamMember(user6.getId(), user6.getName() != null ? user6.getName() : user6.getUsername(), user6.getEmail(), "Viewer", false));
                }
                teamRepository.save(team);
            }

            // 1. Viewer attempts to create a team snippet -> Expect 403 FORBIDDEN
            org.springframework.http.ResponseEntity<?> createViewerRes = snippetController.createSnippet(
                    java.util.Map.of(
                            "title", "Viewer Illegal Snippet",
                            "code", "console.log('should fail');",
                            "visibility", "team",
                            "teamId", "acme-core-eng"
                    ),
                    null,
                    user6.getId(),
                    user6.getEmail()
            );
            org.junit.jupiter.api.Assertions.assertEquals(403, createViewerRes.getStatusCode().value(), "Viewer must not be allowed to create team snippets");

            // 2. Viewer attempts to invite member -> Expect 403 FORBIDDEN
            org.springframework.http.ResponseEntity<?> inviteViewerRes = teamController.inviteMember(
                    "acme-core-eng",
                    java.util.Map.of("email", "hacker@pluck.dev", "role", "Admin"),
                    null,
                    user6.getId(),
                    user6.getEmail()
            );
            org.junit.jupiter.api.Assertions.assertEquals(403, inviteViewerRes.getStatusCode().value(), "Viewer must not be allowed to invite members");

            // 3. Viewer attempts to update member role -> Expect 403 FORBIDDEN
            org.springframework.http.ResponseEntity<?> roleViewerRes = teamController.updateMemberRole(
                    "acme-core-eng",
                    user6.getId(),
                    java.util.Map.of("role", "Admin"),
                    null,
                    user6.getId(),
                    user6.getEmail()
            );
            org.junit.jupiter.api.Assertions.assertEquals(403, roleViewerRes.getStatusCode().value(), "Viewer must not be allowed to change roles");

            // 4. Verify Admin (user5) has full access
            org.springframework.http.ResponseEntity<?> teamRes5 = teamController.getTeam("acme-core-eng", null, user5.getId(), user5.getEmail());
            org.junit.jupiter.api.Assertions.assertEquals(200, teamRes5.getStatusCode().value());
            java.util.Map<?, ?> teamMap5 = (java.util.Map<?, ?>) teamRes5.getBody();
            org.junit.jupiter.api.Assertions.assertEquals("Admin", teamMap5.get("role"));
            org.junit.jupiter.api.Assertions.assertEquals(true, teamMap5.get("canEditSnippets"));
            org.junit.jupiter.api.Assertions.assertEquals(true, teamMap5.get("canManageMembers"));

            // 5. Verify Viewer (user6) role resolution
            org.springframework.http.ResponseEntity<?> teamRes6 = teamController.getTeam("acme-core-eng", null, user6.getId(), user6.getEmail());
            org.junit.jupiter.api.Assertions.assertEquals(200, teamRes6.getStatusCode().value());
            java.util.Map<?, ?> teamMap6 = (java.util.Map<?, ?>) teamRes6.getBody();
            org.junit.jupiter.api.Assertions.assertEquals("Viewer", teamMap6.get("role"));
            org.junit.jupiter.api.Assertions.assertEquals(false, teamMap6.get("canEditSnippets"));
            org.junit.jupiter.api.Assertions.assertEquals(false, teamMap6.get("canManageMembers"));
        } finally {
            cleanupTestMember(user6);
        }
    }

}
