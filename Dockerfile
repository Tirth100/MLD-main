FROM eclipse-temurin:17-jdk
WORKDIR /app

# Copy project files
COPY lib ./lib
COPY src ./src
COPY MLDAgent.msi ./MLDAgent.msi

# Compile Java backend source files
RUN mkdir -p bin && javac -cp "lib/jna-5.14.0.jar:lib/jna-platform-5.14.0.jar:lib/postgresql-42.7.3.jar:src" -d bin src/main/Main.java src/api/*.java src/report/*.java src/service/*.java src/database/*.java

# Expose API server port
EXPOSE 3000

# Start Java backend server
CMD ["java", "-cp", "lib/jna-5.14.0.jar:lib/jna-platform-5.14.0.jar:lib/postgresql-42.7.3.jar:bin:src", "main.Main"]
