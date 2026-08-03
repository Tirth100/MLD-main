FROM eclipse-temurin:17-jdk
WORKDIR /app

# Copy project files
COPY lib ./lib
COPY src ./src
COPY run-agent.bat ./run-agent.bat

# Compile Java source files and build MLD-Agent.jar inside container
RUN mkdir -p bin && javac -cp "lib/jna-5.14.0.jar:lib/jna-platform-5.14.0.jar:lib/postgresql-42.7.3.jar:src" -d bin src/main/Main.java src/api/*.java src/monitor/*.java src/report/*.java src/service/*.java src/agent/*.java
RUN jar cvfe MLD-Agent.jar agent.MldAgent -C bin .

# Expose API server port
EXPOSE 3000

# Start Java backend server
CMD ["java", "-cp", "lib/jna-5.14.0.jar:lib/jna-platform-5.14.0.jar:lib/postgresql-42.7.3.jar:bin:src", "main.Main"]
