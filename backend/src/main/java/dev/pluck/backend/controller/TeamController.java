package dev.pluck.backend.controller;

import dev.pluck.backend.model.Team;
import dev.pluck.backend.repository.TeamRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/teams")
public class TeamController {

    private final TeamRepository teamRepository;

    @Autowired
    public TeamController(TeamRepository teamRepository) {
        this.teamRepository = teamRepository;
    }

    private Team getOrCreateDefaultTeam() {
        List<Team> teams = teamRepository.findAll();
        if (!teams.isEmpty()) {
            return teams.get(0);
        }

        Team defaultTeam = new Team();
        defaultTeam.setId("acme-core-eng");
        defaultTeam.setName("Acme Core Eng");
        defaultTeam.setRole("Admin");

        List<Map<String, Object>> members = new ArrayList<>();
        Map<String, Object> m1 = new HashMap<>();
        m1.put("id", "m1");
        m1.put("name", "Alex Developer (You)");
        m1.put("email", "alex@pluck.dev");
        m1.put("role", "Admin");
        m1.put("isOwner", true);
        members.add(m1);
        defaultTeam.setMembers(members);

        List<Map<String, Object>> collections = new ArrayList<>();
        Map<String, Object> c1 = new HashMap<>();
        c1.put("name", "auth-middleware");
        c1.put("emoji", "🔐");
        c1.put("count", 0);
        collections.add(c1);
        defaultTeam.setCollections(collections);

        List<Map<String, Object>> activity = new ArrayList<>();
        defaultTeam.setActivity(activity);

        return teamRepository.save(defaultTeam);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getTeam(@PathVariable String id) {
        Team team = getOrCreateDefaultTeam();
        Map<String, Object> res = new HashMap<>();
        res.put("team", team);
        return ResponseEntity.ok(res);
    }

    @GetMapping("/{id}/activity")
    public ResponseEntity<?> getTeamActivity(@PathVariable String id) {
        Team team = getOrCreateDefaultTeam();
        Map<String, Object> res = new HashMap<>();
        res.put("activity", team.getActivity());
        return ResponseEntity.ok(res);
    }

    @PostMapping("/{id}/invites")
    public ResponseEntity<?> inviteMember(@PathVariable String id, @RequestBody Map<String, String> body) {
        String email = body.get("email");
        String role = body.getOrDefault("role", "Editor");

        if (email == null || email.trim().isEmpty()) {
            Map<String, String> err = new HashMap<>();
            err.put("error", "EMAIL_REQUIRED");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(err);
        }

        Team team = getOrCreateDefaultTeam();
        Map<String, Object> newMember = new HashMap<>();
        newMember.put("id", "m_" + UUID.randomUUID().toString().substring(0, 6));
        newMember.put("name", email.split("@")[0]);
        newMember.put("email", email);
        newMember.put("role", role);
        newMember.put("isOwner", false);

        team.getMembers().add(newMember);

        Map<String, Object> act = new HashMap<>();
        act.put("user", "Alex Developer");
        act.put("action", "invited " + email + " as");
        act.put("target", role);
        act.put("time", "Just now");
        act.put("icon", "cyan");
        team.getActivity().add(0, act);

        teamRepository.save(team);

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("member", newMember);
        res.put("message", "Invitation sent to " + email);
        return ResponseEntity.status(HttpStatus.CREATED).body(res);
    }

    @DeleteMapping("/{id}/members/{memberId}")
    public ResponseEntity<?> removeMember(@PathVariable String id, @PathVariable String memberId) {
        Team team = getOrCreateDefaultTeam();
        boolean removed = team.getMembers().removeIf(m -> memberId.equals(m.get("id")));
        if (removed) {
            teamRepository.save(team);
            Map<String, Object> res = new HashMap<>();
            res.put("success", true);
            res.put("message", "Member removed.");
            return ResponseEntity.ok(res);
        }
        Map<String, String> err = new HashMap<>();
        err.put("error", "MEMBER_NOT_FOUND");
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(err);
    }
}
