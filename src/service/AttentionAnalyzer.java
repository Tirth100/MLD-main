package service;

import java.util.ArrayList;
import java.util.List;

public class AttentionAnalyzer {

    private int focusedCount = 0;
    private int totalCount = 0;
    private int idleTicks = 0;
    private boolean webcamActive = false;
    private List<Integer> focusHistory = new ArrayList<>();
    private List<String> windowTimeline = new ArrayList<>();
    private List<Boolean> focusTimeline = new ArrayList<>();
    private long startTime = System.currentTimeMillis();

    public void analyzeWindow(String window, boolean webcam) {
        analyzeWindow(window, webcam, 0);
    }

    public void analyzeWindow(String window, boolean webcam, int idleSeconds) {
        if (window == null) window = "Unknown Window";
        totalCount++;

        if (idleSeconds >= 8) {
            idleTicks++;
        }

        boolean isFocused = false;
        
        // Comprehensive case-insensitive matching for valid meeting applications & authorized workspaces
        String lowerWin = window.toLowerCase();
        if (lowerWin.contains("zoom")
         || (lowerWin.contains("meet") && !lowerWin.contains("meeting leech detector") && !lowerWin.contains("mld employee"))
         || lowerWin.contains("powerpoint")
         || lowerWin.contains("powerpnt")) 
        {
            // Must not be idle to be counted as focused
            if (idleSeconds < 8) {
                isFocused = true;
            }
        }
        
        webcamActive = webcam;

        if (isFocused) {
            focusedCount++;
            focusHistory.add(100); 
        } else {
            focusHistory.add(0); 
        }
        
        // Strictly escape JSON breaking characters
        String escapedWindow = window.replace("\\", "\\\\")
                                     .replace("\"", "\\\"")
                                     .replace("\n", " ")
                                     .replace("\r", " ")
                                     .replace("\t", " ");
                                     
        windowTimeline.add(escapedWindow);
        focusTimeline.add(isFocused);

        // Keep timeline sizes bounded (max 1,000 items) to prevent memory growth
        if (windowTimeline.size() > 1000) {
            windowTimeline.remove(0);
            focusTimeline.remove(0);
            if (focusHistory.size() > 1000) {
                focusHistory.remove(0);
            }
        }
    }

    public double getAttentionScore() {
        if (totalCount == 0) return 0;
        return (double) focusedCount / totalCount;
    }
    
    public int getFocusedCount() {
        return focusedCount;
    }
    
    public int getTotalCount() {
        return totalCount;
    }

    public int getIdleSeconds() {
        return idleTicks * 10;
    }

    public int getDurationSeconds() {
        return (int) ((System.currentTimeMillis() - startTime) / 1000);
    }
    
    public List<Integer> getFocusHistory() {
        return focusHistory;
    }
    
    public List<String> getWindowTimeline() {
        return windowTimeline;
    }
    
    public List<Boolean> getFocusTimeline() {
        return focusTimeline;
    }
    
    public void reset() {
        focusedCount = 0;
        totalCount = 0;
        idleTicks = 0;
        webcamActive = false;
        startTime = System.currentTimeMillis();
        focusHistory.clear();
        windowTimeline.clear();
        focusTimeline.clear();
    }
    
    public boolean isWebcamActive() {
        return webcamActive;
    }

    public String getJoinTimeFormatted() {
        return new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new java.util.Date(startTime));
    }
}