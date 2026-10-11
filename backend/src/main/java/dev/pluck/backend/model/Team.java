package dev.pluck.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Document(collection = "teams")
public class Team {

    @Id
    private String id;
    private String name;
    private String role = "Admin";
    private List<Map<String, Object>> members = new ArrayList<>();
    private List<Map<String, Object>> collections = new ArrayList<>();
    private List<Map<String, Object>> activity = new ArrayList<>();

    public Team() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public List<Map<String, Object>> getMembers() { return members; }
    public void setMembers(List<Map<String, Object>> members) { this.members = members; }

    public List<Map<String, Object>> getCollections() { return collections; }
    public void setCollections(List<Map<String, Object>> collections) { this.collections = collections; }

    public List<Map<String, Object>> getActivity() { return activity; }
    public void setActivity(List<Map<String, Object>> activity) { this.activity = activity; }
}
