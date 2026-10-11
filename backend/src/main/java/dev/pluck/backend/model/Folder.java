package dev.pluck.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "folders")
public class Folder {

    @Id
    private String id;
    private String name;
    private String emoji = "📁";
    private int count = 0;
    private String workspaceId = "ws_personal";

    public Folder() {}

    public Folder(String id, String name, String emoji, int count, String workspaceId) {
        this.id = id;
        this.name = name;
        this.emoji = emoji;
        this.count = count;
        this.workspaceId = workspaceId;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmoji() { return emoji; }
    public void setEmoji(String emoji) { this.emoji = emoji; }

    public int getCount() { return count; }
    public void setCount(int count) { this.count = count; }

    public String getWorkspaceId() { return workspaceId; }
    public void setWorkspaceId(String workspaceId) { this.workspaceId = workspaceId; }
}
