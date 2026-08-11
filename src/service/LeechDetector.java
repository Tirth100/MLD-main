package service;

public class LeechDetector {

    public String checkLeech(double attentionScore) {
        if (attentionScore >= 0.75) {
            return "Engaged";
        } else if (attentionScore >= 0.50) {
            return "Focused";
        } else {
            return "Low Engagement";
        }
    }
}