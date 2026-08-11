package api;

import java.util.regex.Pattern;

public class InputValidator {
    // Standard OWASP-recommended email regex
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[a-zA-Z0-9_+&*-]+(?:\\.[a-zA-Z0-9_+&*-]+)*@(?:[a-zA-Z0-9-]+\\.)+[a-zA-Z]{2,7}$");
    
    // Password: at least 8 chars, 1 uppercase, 1 lowercase, 1 digit
    private static final Pattern PASSWORD_PATTERN = Pattern.compile("^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z]).{8,64}$");

    public static boolean isValidEmail(String email) {
        if (email == null || email.isBlank()) return false;
        return EMAIL_PATTERN.matcher(email).matches();
    }

    public static boolean isValidPassword(String password) {
        if (password == null || password.isBlank()) return false;
        return PASSWORD_PATTERN.matcher(password).matches();
    }

    public static boolean isValidName(String name) {
        if (name == null || name.isBlank()) return false;
        if (name.length() > 100) return false;
        // Allow alphabets, spaces, hyphens, and apostrophes
        return name.matches("^[a-zA-Z\\s\\-']+$");
    }

    public static String sanitizeString(String input) {
        if (input == null) return "";
        // Strip HTML/XML tags
        return input.replaceAll("<[^>]*>", "").trim();
    }
}
