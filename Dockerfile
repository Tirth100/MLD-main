FROM openjdk:17-jdk-slim
WORKDIR /app

# Copy project files
COPY lib ./lib
COPY src ./src

# Compile Java source files using explicit Linux classpath
RUN javac -cp "lib/jna-5.14.0.jar:lib/jna-platform-5.14.0.jar:lib/postgresql-42.7.3.jar:src" src/main/Main.java src/api/*.java src/monitor/*.java src/report/*.java src/service/*.java src/client/*.java

# Expose API server port
EXPOSE 3000

# Start Java backend server
CMD ["java", "-cp", "lib/jna-5.14.0.jar:lib/jna-platform-5.14.0.jar:lib/postgresql-42.7.3.jar:src", "main.Main"]
