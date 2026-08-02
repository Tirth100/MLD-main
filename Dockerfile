FROM eclipse-temurin:17-jdk
WORKDIR /app

# Copy project files
COPY lib ./lib
COPY src ./src
COPY run-agent.bat ./run-agent.bat

# Compile Java source files using wildcard classpath lib/*:src
RUN mkdir -p bin && javac -cp "lib/*:src" -d bin $(find src -name "*.java")
RUN jar cvfe MLD-Agent.jar agent.MldAgent -C bin .

# Expose API server port
EXPOSE 3000

# Start Java backend server
CMD ["java", "-cp", "lib/*:bin:src", "main.Main"]
