package service;

public class LeechDetector {

    public String checkLeech(double attentionScore) {
        if (attentionScore >= 0.70) {
            return "Engaged";
        } else if (attentionScore >= 0.40) {
            return "Focused";
        } else {
            return "Low Engagement";
        }
    }
}